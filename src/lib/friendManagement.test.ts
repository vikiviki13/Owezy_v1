import { beforeEach, describe, expect, it } from 'vitest';
import {
  archiveFriend,
  calculateFriendBalance,
  clearAllDues,
  clearFriendFinancialData,
  createExpense,
  createFriend,
  deleteFriendProfile,
  friendHasFinancialHistory,
  friendLedger,
  getExpense,
  getFriend,
  listExpensesForFriend,
  listFriends,
  recordRepayment,
  resetDB,
  updateFriend,
} from './db';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  resetDB();
});

describe('friend profile management', () => {
  it('updates friend details without changing transaction history', () => {
    const friend = createFriend({ name: 'Arun', whatsapp_number: '+919876543210' });
    createExpense({
      title: 'Dinner',
      category: 'Food',
      total_amount: 500,
      owner_share: 0,
      expense_date: '2026-08-01',
      participants: [{ friend_id: friend.id, share_amount: 500 }],
    });
    const before = friendLedger(friend.id);

    updateFriend(friend.id, { name: 'Arun Kumar', nickname: 'AK', notes: 'College friend' });

    expect(getFriend(friend.id)).toMatchObject({ name: 'Arun Kumar', nickname: 'AK', notes: 'College friend' });
    expect(friendLedger(friend.id).map(({ kind, amount, refId }) => ({ kind, amount, refId })))
      .toEqual(before.map(({ kind, amount, refId }) => ({ kind, amount, refId })));
  });

  it('clears all dues by creating a settlement while keeping old expenses', () => {
    const friend = createFriend({ name: 'Arun' });
    const expense = createExpense({
      title: 'Trip',
      category: 'Travel',
      total_amount: 2850,
      owner_share: 0,
      expense_date: '2026-08-01',
      participants: [{ friend_id: friend.id, share_amount: 2850 }],
    });

    const settlement = clearAllDues({ friend_id: friend.id, settlement_date: '2026-08-14', notes: 'Paid externally' });

    expect(settlement).toMatchObject({ amount: 2850, is_settlement: true, payment_method: undefined });
    expect(calculateFriendBalance(friend.id).pending).toBe(0);
    expect(getExpense(expense.id)).toBeTruthy();
    expect(friendLedger(friend.id).map((entry) => entry.title)).toEqual(['Trip', 'Dues cleared']);
  });

  it('clears only the selected friend from a shared expense', () => {
    const arun = createFriend({ name: 'Arun' });
    const priya = createFriend({ name: 'Priya' });
    const expense = createExpense({
      title: 'Group dinner',
      category: 'Food',
      total_amount: 500,
      owner_share: 200,
      expense_date: '2026-08-01',
      participants: [
        { friend_id: arun.id, share_amount: 100 },
        { friend_id: priya.id, share_amount: 200 },
      ],
    });
    recordRepayment({ friend_id: arun.id, amount: 40, payment_method: 'Cash' });
    recordRepayment({ friend_id: priya.id, amount: 50, payment_method: 'UPI' });

    clearFriendFinancialData(arun.id);

    expect(getFriend(arun.id)).toBeTruthy();
    expect(friendLedger(arun.id)).toEqual([]);
    expect(listExpensesForFriend(arun.id)).toEqual([]);
    expect(listExpensesForFriend(priya.id)).toHaveLength(1);
    expect(getExpense(expense.id)?.recoverable_amount).toBe(200);
    expect(calculateFriendBalance(priya.id).pending).toBe(150);
  });

  it('guards deletion when history exists and allows archive instead', () => {
    const friend = createFriend({ name: 'Arun' });
    createExpense({
      title: 'Lunch',
      category: 'Food',
      total_amount: 300,
      owner_share: 0,
      expense_date: '2026-08-01',
      participants: [{ friend_id: friend.id, share_amount: 300 }],
    });

    expect(friendHasFinancialHistory(friend.id)).toBe(true);
    expect(deleteFriendProfile(friend.id)).toBe('has-history');
    expect(getFriend(friend.id)).toBeTruthy();

    archiveFriend(friend.id);
    expect(listFriends()).not.toContainEqual(expect.objectContaining({ id: friend.id }));
    expect(listFriends(true)).toContainEqual(expect.objectContaining({ id: friend.id, is_archived: true }));
  });

  it('supports explicitly clearing data and deleting the profile', () => {
    const friend = createFriend({ name: 'Arun' });
    createExpense({
      title: 'Cab',
      category: 'Travel',
      total_amount: 200,
      owner_share: 0,
      expense_date: '2026-08-01',
      participants: [{ friend_id: friend.id, share_amount: 200 }],
    });

    expect(deleteFriendProfile(friend.id, { clearFinancialData: true })).toBe('deleted');
    expect(getFriend(friend.id)).toBeUndefined();
  });
});
