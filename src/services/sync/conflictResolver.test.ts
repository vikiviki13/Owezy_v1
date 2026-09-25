import { describe, expect, it } from 'vitest';
import { mergeAppData, type StoredDoc } from './conflictResolver';

// Deterministic "now" so tombstone retention is independent of when tests run.
const NOW_MS = Date.parse('2026-09-01T12:00:00.000Z');

function doc(overrides: Partial<StoredDoc> = {}): StoredDoc {
  const now = '2026-08-18T10:00:00.000Z';
  return {
    rev: 0,
    updated_at: now,
    profile: { id: 'user-1', full_name: 'You', updated_at: now },
    preferences: { user_id: 'user-1', currency_code: 'INR', updated_at: now },
    friends: [],
    groups: [],
    groupMembers: [],
    expenses: [],
    expenseParticipants: [],
    expenseItems: [],
    expenseItemAssignments: [],
    expenseAdjustments: [],
    repayments: [],
    attachments: [],
    deleted: [],
    ...overrides,
  };
}

function friend(id: string, updatedAt: string, overrides: Record<string, unknown> = {}) {
  return { id, owner_id: 'user-1', name: `Friend ${id}`, is_archived: false, created_at: updatedAt, updated_at: updatedAt, ...overrides };
}

function expense(id: string, updatedAt: string) {
  return { id, owner_id: 'user-1', title: `Expense ${id}`, category: 'Food', total_amount: 100, owner_share: 0, recoverable_amount: 100, expense_date: '2026-08-10', expense_time: '12:00', currency: 'INR', split_mode: 'custom', status: 'pending', created_at: updatedAt, updated_at: updatedAt };
}

describe('conflict resolver', () => {
  it('keeps records that exist on only one side (no data loss)', () => {
    const local = doc({ friends: [friend('a', '2026-08-18T09:00:00.000Z')] });
    const cloud = doc({ friends: [friend('b', '2026-08-18T09:00:00.000Z')] });
    const { merged, needsPush } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.friends.map((entry) => entry.id).sort()).toEqual(['a', 'b']);
    expect(needsPush).toBe(true);
  });

  it('resolves same-ID conflicts by the newer updated_at', () => {
    const older = friend('a', '2026-08-17T09:00:00.000Z', { name: 'Old Name' });
    const newer = friend('a', '2026-08-18T09:00:00.000Z', { name: 'New Name' });
    const { merged, needsPush } = mergeAppData(doc({ friends: [older] }), doc({ friends: [newer] }), NOW_MS);
    expect(merged.friends).toHaveLength(1);
    expect(merged.friends[0].name).toBe('New Name');
    expect(needsPush).toBe(false);
  });

  it('never duplicates the same record across repeated syncs', () => {
    const local = doc({ expenses: [expense('e1', '2026-08-18T09:00:00.000Z')] });
    const first = mergeAppData(local, doc({}), NOW_MS);
    const second = mergeAppData(first.merged, first.merged, NOW_MS);
    expect(second.merged.expenses).toHaveLength(1);
    expect(second.needsPush).toBe(false);
  });

  it('drops tombstoned records from the merged cache and propagates tombstones', () => {
    const local = doc({ friends: [friend('a', '2026-08-17T09:00:00.000Z')] });
    const cloud = doc({
      deleted: [{ entityType: 'friend', id: 'a', deletedAt: '2026-08-18T09:00:00.000Z' }],
    });
    const { merged, needsPush } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.friends).toHaveLength(0);
    expect(needsPush).toBe(false);
  });

  it('a newer edit on one device supersedes an older tombstone from another', () => {
    const local = doc({
      friends: [friend('a', '2026-08-18T10:30:00.000Z')],
      deleted: [{ entityType: 'friend', id: 'a', deletedAt: '2026-08-18T09:00:00.000Z' }],
    });
    const cloud = doc({});
    const { merged, needsPush } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.friends).toHaveLength(1);
    expect(needsPush).toBe(true);
  });

  it('a re-imported friend with a fresh updated_at survives its own earlier tombstone', () => {
    // Re-importing a deleted contact reuses the same server row, so its
    // `created_at` still predates the deletion. The friend survives only when
    // the client stamps a newer `updated_at` than the tombstone recorded at
    // deletion time.
    const local = doc({
      friends: [friend('a', '2026-08-18T10:40:00.000Z', { created_at: '2026-08-18T09:00:00.000Z' })],
      deleted: [{ entityType: 'friend', id: 'a', deletedAt: '2026-08-18T10:30:00.000Z' }],
    });
    const cloud = doc({});
    const { merged } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.friends.map((entry) => entry.id)).toEqual(['a']);
  });

  it('reconciles children when the parent expense is tombstoned', () => {
    const participant = { id: 'p1', expense_id: 'e1', friend_id: 'f1', share_amount: 50, paid_amount: 0, pending_amount: 50, status: 'pending', created_at: '2026-08-18T09:00:00.000Z', updated_at: '2026-08-18T09:00:00.000Z' };
    const local = doc({
      expenses: [expense('e1', '2026-08-17T09:00:00.000Z')],
      expenseParticipants: [participant],
    });
    const cloud = doc({ deleted: [{ entityType: 'expense', id: 'e1', deletedAt: '2026-08-18T09:00:00.000Z' }] });
    const { merged } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.expenses).toHaveLength(0);
    expect(merged.expenseParticipants).toHaveLength(0);
  });

  it('keeps financial transactions with different IDs separate (no merging)', () => {
    const local = doc({ expenses: [expense('e1', '2026-08-18T09:00:00.000Z')] });
    const cloud = doc({ expenses: [expense('e2', '2026-08-18T09:00:00.000Z')] });
    const { merged, needsPush } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.expenses.map((entry) => entry.id).sort()).toEqual(['e1', 'e2']);
    expect(needsPush).toBe(true);
  });

  it('expires tombstones after the retention window', () => {
    const local = doc({});
    const cloud = doc({ deleted: [{ entityType: 'friend', id: 'a', deletedAt: '2026-06-01T09:00:00.000Z' }] });
    const { merged } = mergeAppData(local, cloud, NOW_MS);
    expect(merged.deleted).toHaveLength(0);
  });
});
