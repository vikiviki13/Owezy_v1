import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  archiveFriend, calculateFriendBalance, calculateStatement, clearFriendData, clearFriendDues, createExpense,
  createFriend, deleteFriend, friendLedger, listExpensesForFriend, listFriends, listRepaymentsForFriend, recordRepayment, resetDB,
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

  it('rejects repayments that exceed the outstanding balance', () => {
    const friend = createFriend({ name: 'Vijay' });
    const expense = createExpense({
      title: 'Cab', category: 'Travel', total_amount: 300, owner_share: 0,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 300 }],
    });

    expect(() => recordRepayment({ friend_id: friend.id, amount: 301 })).toThrow(/exceed/);
    expect(() => recordRepayment({ friend_id: friend.id, amount: 301, expense_id: expense.id })).toThrow(/exceed/);
    expect(listRepaymentsForFriend(friend.id)).toHaveLength(0);
    expect(calculateFriendBalance(friend.id).pending).toBe(300);
  });

  it('rejects repayments beyond the net amount after a purchase-time contribution', () => {
    const friend = createFriend({ name: 'Divya' });
    createExpense({
      title: 'Trip', category: 'Travel', total_amount: 1000, owner_share: 400,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 600 }],
      payer_type: 'multiple',
      payment_contributions: [{ id: 'c1', payer_id: 'owner', amount: 700 }, { id: 'c2', payer_id: friend.id, amount: 300 }],
    });
    // The friend already contributed 300, so only 300 of the 600 share is outstanding.
    expect(calculateFriendBalance(friend.id).theyOweMe).toBe(300);
    expect(() => recordRepayment({ friend_id: friend.id, amount: 301 })).toThrow(/exceed/);
    recordRepayment({ friend_id: friend.id, amount: 300 });
    expect(calculateFriendBalance(friend.id).pending).toBe(0);
  });
});

describe('friendLedger direction awareness', () => {
  it('marks a repayment received from a friend as reducing the balance', () => {
    const friend = createFriend({ name: 'Meera' });
    createExpense({
      title: 'Dinner', category: 'Food', total_amount: 1000, owner_share: 400,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 600 }],
    });
    recordRepayment({ friend_id: friend.id, amount: 200 });

    const entry = friendLedger(friend.id).find((e) => e.kind === 'repayment')!;
    expect(entry.title).toBe('Payment received');
    expect(entry.direction).toBe('from_friend');
    expect(entry.sign).toBe(-1);
  });

  it('marks a repayment paid to a friend as increasing the balance', () => {
    const friend = createFriend({ name: 'Meera' });
    createExpense({
      title: 'Dinner', category: 'Food', total_amount: 1000, owner_share: 400,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 600 }],
      payer_type: 'friend', payer_friend_id: friend.id,
      payment_contributions: [{ id: 'p1', payer_id: friend.id, amount: 1000 }],
    });
    recordRepayment({ friend_id: friend.id, amount: 400, direction: 'to_friend' });

    const ledger = friendLedger(friend.id);
    const repayment = ledger.find((e) => e.kind === 'repayment')!;
    expect(repayment.title).toBe('Paid to friend');
    expect(repayment.direction).toBe('to_friend');
    expect(repayment.sign).toBe(1);
    expect(repayment.runningBalance).toBe(0);
  });

  it('separates money received from money paid to the friend in the statement', () => {
    const friend = createFriend({ name: 'Ravi' });
    createExpense({
      title: 'Dinner', category: 'Food', total_amount: 1000, owner_share: 400,
      expense_date: '2026-08-10',
      participants: [{ friend_id: friend.id, share_amount: 600 }],
    });
    recordRepayment({ friend_id: friend.id, amount: 200, repayment_date: '2026-08-12' });
    createExpense({
      title: 'Lunch', category: 'Food', total_amount: 1500, owner_share: 500,
      expense_date: '2026-08-11',
      participants: [{ friend_id: friend.id, share_amount: 1000 }],
      payer_type: 'friend', payer_friend_id: friend.id,
      payment_contributions: [{ id: 'p1', payer_id: friend.id, amount: 1500 }],
    });
    recordRepayment({ friend_id: friend.id, amount: 500, direction: 'to_friend', repayment_date: '2026-08-13' });

    const stmt = calculateStatement(friend.id, '2026-08-01', '2026-08-31');
    expect(stmt.periodRepayments).toBe(200);
    expect(stmt.periodPaidToFriend).toBe(500);
    // Ledger: +600 (owed) -200 (received) -500 (advanced for me) +500 (paid back to friend).
    expect(stmt.closingBalance).toBe(400);
    expect(calculateFriendBalance(friend.id).pending).toBe(400);
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
