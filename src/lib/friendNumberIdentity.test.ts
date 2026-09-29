import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  calculateFriendBalance, commitImportedFriends, createExpense, createFriend, dedupeFriendsByNumber,
  deleteFriend, getFriend, invalidateCache, listFriends, resetDB, updateFriend,
} from './db';
import { classifyContactDraft, createContactImportDraft, normalizePhoneToE164 } from './contactImport';

function stubStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: () => true });
}

const NUMBER = '+919876543210';

beforeEach(() => {
  stubStorage();
  resetDB();
});

function numbersOfFriends() {
  return listFriends()
    .map((friend) => normalizePhoneToE164(friend.whatsapp_e164 || friend.whatsapp_number || friend.phone_number || friend.phone))
    .filter(Boolean);
}

describe('one record per phone number', () => {
  it('a re-add replaces the same-number record even when the ids differ', () => {
    // Added by hand: a locally generated id, no whatsapp_e164.
    createFriend({ name: 'Arun', phone: NUMBER, whatsapp_number: NUMBER });

    // Re-added from a contact import: the server reuses its own row id.
    commitImportedFriends([{
      id: 'server-row-uuid',
      owner_id: 'local-user',
      name: 'Arun',
      whatsapp_e164: NUMBER,
      whatsapp_number: NUMBER,
      phone_number: NUMBER,
      phone: NUMBER,
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    }]);

    expect(numbersOfFriends()).toEqual([NUMBER]);
  });

  it('a deleted profile leaves the number free to add again', () => {
    const existing = createFriend({ name: 'Arun', whatsapp_e164: NUMBER });
    const draft = createContactImportDraft([{ name: ['Arun'], tel: [NUMBER] }], 'friends', 'user-1');

    expect(classifyContactDraft(draft.items, listFriends())[0].status).toBe('already');

    deleteFriend(existing.id);

    expect(listFriends()).toHaveLength(0);
    expect(numbersOfFriends()).toEqual([]);
    expect(classifyContactDraft(draft.items, listFriends())[0].status).toBe('ready');
  });

  it('never lets two friends share one number through repeated re-adds', () => {
    for (let i = 0; i < 3; i += 1) {
      const existing = createFriend({ name: 'Arun', whatsapp_e164: NUMBER });
      deleteFriend(existing.id);
      commitImportedFriends([{
        id: 'server-row-uuid',
        owner_id: 'local-user',
        name: 'Arun',
        whatsapp_e164: NUMBER,
        is_archived: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
      }]);
      const match = listFriends().find((friend) => friend.id === 'server-row-uuid');
      if (match) deleteFriend(match.id);
    }
    expect(listFriends()).toHaveLength(0);
  });
});

describe('repairing an already-stuck duplicate', () => {
  // A duplicate can no longer be created through the app, so the corrupt state
  // is written straight into the stored document: this is what a user who hit
  // the bug before the fix already has on their device.
  function seedStoredDuplicate() {
    const original = createFriend({ name: 'Arun', whatsapp_e164: NUMBER });
    createExpense({
      title: 'Dinner', category: 'Food', total_amount: 600, expense_date: '2026-09-01',
      participants: [{ friend_id: original.id, share_amount: 300, paid_amount: 0, pending_amount: 300, status: 'pending' }],
      owner_share: 300,
    });
    const raw = localStorage.getItem('tab_db_session_v2');
    const doc = JSON.parse(raw as string);
    doc.friends.push({
      id: 'server-row-uuid', owner_id: 'local-user', name: 'Arun', whatsapp_e164: NUMBER,
      is_archived: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
    });
    localStorage.setItem('tab_db_session_v2', JSON.stringify(doc));
    invalidateCache();
    return original;
  }

  it('detects the duplicate and leaves the number unaddable', () => {
    seedStoredDuplicate();

    expect(numbersOfFriends()).toEqual([NUMBER, NUMBER]);
    const draft = createContactImportDraft([{ name: ['Arun'], tel: [NUMBER] }], 'friends', 'user-1');
    expect(classifyContactDraft(draft.items, listFriends())[0].status).toBe('already');
  });

  it('collapses the duplicate onto the record the history points at', () => {
    const original = seedStoredDuplicate();

    const removed = dedupeFriendsByNumber();

    expect(removed).toEqual(['server-row-uuid']);
    expect(listFriends().map((friend) => friend.id)).toEqual([original.id]);
    expect(numbersOfFriends()).toEqual([NUMBER]);
  });

  it('keeps the expense attached to the surviving friend', () => {
    const original = seedStoredDuplicate();
    expect(calculateFriendBalance(original.id).pending).toBe(300);

    dedupeFriendsByNumber();

    // The balance is derived from expense participants, so an unchanged balance
    // proves the history still points at a live friend rather than an id that
    // was just removed.
    expect(calculateFriendBalance(original.id).pending).toBe(300);
  });

  it('carries a contact detail over from the record it removes', () => {
    const original = seedStoredDuplicate();
    updateFriend(original.id, { email: '' });
    const stored = JSON.parse(localStorage.getItem('tab_db_session_v2') as string);
    stored.friends.find((friend: { id: string }) => friend.id === 'server-row-uuid').email = 'arun@example.com';
    localStorage.setItem('tab_db_session_v2', JSON.stringify(stored));
    invalidateCache();

    dedupeFriendsByNumber();

    expect(getFriend(original.id)?.email).toBe('arun@example.com');
  });

  it('is idempotent and safe to run on every load', () => {
    seedStoredDuplicate();

    expect(dedupeFriendsByNumber()).toHaveLength(1);
    expect(dedupeFriendsByNumber()).toEqual([]);
    expect(listFriends()).toHaveLength(1);
  });
});
