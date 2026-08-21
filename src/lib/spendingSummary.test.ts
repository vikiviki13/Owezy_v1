import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateFriendBalance, calculateSpendingSummary, createExpense, createFriend, recordRepayment, resetDB } from './db';

function stubStorage() {
  const store = new Map<string, string>();
  const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear() };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: () => true });
}

beforeEach(() => { stubStorage(); resetDB(); });

describe('personal spending tracking', () => {
  it('tracks a personal expense without requiring a friend', () => {
    createExpense({ title: 'Solo lunch', category: 'Food', total_amount: 500, owner_share: 500, expense_date: '2026-08-10', participants: [] });
    const summary = calculateSpendingSummary('2026-08-01', '2026-08-31');
    expect(summary.myActualSpending).toBe(500);
    expect(summary.spentForFriends).toBe(0);
    expect(summary.totalPaidByMe).toBe(500);
  });

  it('separates my share from money paid for a friend', () => {
    const friend = createFriend({ name: 'Arun' });
    createExpense({ title: 'Dinner', category: 'Food', total_amount: 1000, owner_share: 400, expense_date: '2026-08-10', participants: [{ friend_id: friend.id, share_amount: 600 }] });
    const summary = calculateSpendingSummary('2026-08-01', '2026-08-31');
    expect(summary.myActualSpending).toBe(400);
    expect(summary.spentForFriends).toBe(600);
    expect(summary.totalPaidByMe).toBe(1000);
    expect(calculateFriendBalance(friend.id).theyOweMe).toBe(600);
  });

  it('tracks friend-paid amounts as money I owe them', () => {
    const friend = createFriend({ name: 'Arun' });
    createExpense({ title: 'Dinner', category: 'Food', total_amount: 1000, owner_share: 400, expense_date: '2026-08-10', participants: [{ friend_id: friend.id, share_amount: 600 }], payer_type: 'friend', payer_friend_id: friend.id, payment_contributions: [{ payer_id: friend.id, amount: 1000 }] });
    expect(calculateSpendingSummary('2026-08-01', '2026-08-31').paidByFriendsForMe).toBe(400);
    expect(calculateFriendBalance(friend.id).iOweThem).toBe(400);
    recordRepayment({ friend_id: friend.id, amount: 400, direction: 'to_friend' });
    expect(calculateFriendBalance(friend.id).iOweThem).toBe(0);
  });
});
