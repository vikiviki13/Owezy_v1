import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  archiveFriend, calculateFriendBalance, clearFriendData, clearFriendDues, createExpense,
  createFriend, deleteFriend, listExpensesForFriend, listFriends, listRepaymentsForFriend, recordRepayment, resetDB,
} from './db';

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

beforeEach(() => {
  stubStorage();
  resetDB();
});

describe('clearFriendDues', () => {
  it('creates a settlement repayment equal to the pending balance and keeps history', () => {
    const friend = createFriend({ name: 'Arun' });
    createExpense({
      title: 'Dinner', category: 'Food', total_amount: 450, owner_share: 0,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 450 }],
    });
    expect(calculateFriendBalance(friend.id).pending).toBe(450);

    const repayment = clearFriendDues(friend.id, { payment_method: 'Cash' });

    expect(repayment?.amount).toBe(450);
    expect(calculateFriendBalance(friend.id).pending).toBe(0);
    expect(calculateFriendBalance(friend.id).status).toBe('settled');
    expect(listExpensesForFriend(friend.id)).toHaveLength(1);
    expect(listRepaymentsForFriend(friend.id)).toHaveLength(1);
  });

  it('returns undefined when there is nothing pending', () => {
    const friend = createFriend({ name: 'Priya' });
    expect(clearFriendDues(friend.id)).toBeUndefined();
  });
});

describe('clearFriendData', () => {
  it('deletes expenses the friend was the only participant of, plus their repayments', () => {
    const friend = createFriend({ name: 'Arun' });
    const other = createFriend({ name: 'Karthik' });
    const solo = createExpense({
      title: 'Cab', category: 'Travel', total_amount: 300, owner_share: 0,
      expense_date: '2026-08-11',
      participants: [{ friend_id: friend.id, share_amount: 300 }],
    });
    recordRepayment({ friend_id: friend.id, amount: 100, payment_method: 'UPI' });
    createExpense({
      title: 'Dinner', category: 'Food', total_amount: 900, owner_share: 300,
      expense_date: '2026-08-12',
      participants: [{ friend_id: friend.id, share_amount: 300 }, { friend_id: other.id, share_amount: 300 }],
    });

    clearFriendData(friend.id);

    expect(listExpensesForFriend(friend.id)).toHaveLength(0);
    expect(listRepaymentsForFriend(friend.id)).toHaveLength(0);
    expect(calculateFriendBalance(friend.id).pending).toBe(0);
    // shared expense survives and the other friend is unaffected
    expect(listExpensesForFriend(other.id)).toHaveLength(1);
    void solo;
  });

  it('keeps the friend profile itself', () => {
    const friend = createFriend({ name: 'Sneha' });
    clearFriendData(friend.id);
    expect(listFriends().map((f) => f.id)).toContain(friend.id);
  });
});

describe('archiveFriend / deleteFriend', () => {
  it('archiving hides the friend from normal lists but preserves history', () => {
    const friend = createFriend({ name: 'Vijay' });
    createExpense({
      title: 'Movie', category: 'Movie', total_amount: 600, owner_share: 0,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 600 }],
    });

    archiveFriend(friend.id, true);

    expect(listFriends().map((f) => f.id)).not.toContain(friend.id);
    expect(listFriends(true).map((f) => f.id)).toContain(friend.id);
    expect(calculateFriendBalance(friend.id).pending).toBe(600);
    expect(listExpensesForFriend(friend.id)).toHaveLength(1);
  });

  it('deleteFriend removes the profile and all history', () => {
    const friend = createFriend({ name: 'Priya' });
    deleteFriend(friend.id);
    expect(listFriends(true).map((f) => f.id)).not.toContain(friend.id);
    expect(listExpensesForFriend(friend.id)).toHaveLength(0);
  });
});