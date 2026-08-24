import { describe, expect, it } from 'vitest';
import { bundleToCsv } from './csvExport';
import type { ExportBundle } from './exportTypes';

const bundle = {
  schemaVersion: 1, exportType: 'report', app: 'Owezy', exportedAt: '2026-08-30T00:00:00.000Z', currency: 'INR',
  range: { from: '2026-01-01', to: '2026-08-30', label: 'All time' },
  summary: { personalSpending: 95, spentForFriends: 221.28, paidByFriendsForMe: 0, totalPaidByMe: 316.28, totalReceived: 122.66, friendsOweMe: 100, iOweFriends: 0, netBalance: 100, netDirection: 'NET_RECEIVABLE', expenseCount: 1, friendCount: 1, repaymentCount: 1, currency: 'INR', dateFrom: '2026-01-01', dateTo: '2026-08-30' },
  friends: [{ friendId: 'f1', friendName: 'Arun', totalExpenses: 500, myShare: 95, friendShare: 221.28, totalPaidByMe: 316.28, totalPaidByFriend: 0, totalRepaidByFriend: 122.66, totalRepaidToFriend: 0, creditAmount: 0, amountOwedToMe: 100, amountIOwe: 0, netBalance: 100, balanceDirection: 'OWES_ME', status: 'partial' }],
  categories: [],
  expenses: [{ recordType: 'expense', expenseId: 'e1', expenseName: 'Idly', expenseTitle: 'Idly', category: 'Food', friendName: '', friendId: '', groupName: '', totalAmount: 95, ownerShare: 95, recoverableAmount: 0, shareAmount: 0, paidAmount: 0, pendingAmount: 0, paymentAmount: 95, paymentDirection: 'PAID_BY_ME', paymentMethod: 'UPI', payer: 'me', expenseDate: '2026-08-24', expenseTime: '09:00', currency: 'INR', status: 'settled', notes: '', createdAt: '', updatedAt: '' }],
  repayments: [],
  source: {} as ExportBundle['source'],
} as ExportBundle;

describe('human-facing CSV export', () => {
  it('contains only readable report sections and labels', () => {
    const csv = bundleToCsv(bundle);
    expect(csv).toContain('SUMMARY');
    expect(csv).toContain('FRIENDS');
    expect(csv).toContain('EXPENSES');
    expect(csv).toContain('REPAYMENTS');
    expect(csv).toContain('My Spending');
    expect(csv).toContain('Myself');
    expect(csv).not.toContain('expense_id');
    expect(csv).not.toContain('friend_id');
    expect(csv).not.toContain('recoverable_amount');
    expect(csv).not.toContain('balance_direction');
  });
});
