import { describe, expect, it } from 'vitest';
import type { Expense, ExpenseParticipant, Friend } from '../../types';
import type { ExportDateRange, ExportSourceData } from './exportTypes';
import { buildCategories, buildFinancialSummary, buildFriendReport } from './financialSummary';

const range: ExportDateRange = { from: '2026-08-01', to: '2026-08-31', label: 'August' };
const friend: Friend = { id: 'f1', owner_id: 'owner', name: 'Arun', is_archived: false, created_at: '2026-08-01', updated_at: '2026-08-01' };
const baseExpense: Expense = { id: 'e1', owner_id: 'owner', title: 'Dinner', category: 'Food', total_amount: 1000, owner_share: 400, recoverable_amount: 600, expense_date: '2026-08-10', expense_time: '19:00', currency: 'INR', split_mode: 'custom', status: 'pending', payer_type: 'me', created_at: '2026-08-10', updated_at: '2026-08-10', payment_contributions: [{ id: 'p1', payer_id: 'owner', amount: 1000 }] };
const participant: ExpenseParticipant = { id: 'ep1', expense_id: 'e1', friend_id: 'f1', share_amount: 600, paid_amount: 0, pending_amount: 600, status: 'pending', created_at: '2026-08-10', updated_at: '2026-08-10' };

function source(overrides: Partial<ExportSourceData> = {}): ExportSourceData {
  return {
    profile: { id: 'owner', full_name: 'You', default_currency: 'INR', created_at: '2026-01-01', updated_at: '2026-01-01' },
    preferences: { id: 'p', user_id: 'owner', currency_code: 'INR', number_format: 'indian', decimal_display: '2', date_format: 'DD MMM YYYY', time_format: '24h', week_starts_on: 'monday', timezone: 'Asia/Calcutta', timezone_mode: 'manual', language: 'en', theme: 'system', notifications_enabled: false, payment_reminders_enabled: false, pending_balance_reminders_enabled: false, app_updates_enabled: false, default_reminder_days: 7, default_reminder_time: '09:00', app_lock_enabled: false, auto_lock_duration: '5m', created_at: '2026-01-01', updated_at: '2026-01-01' },
    friends: [friend], groups: [], groupMembers: [], expenses: [baseExpense], expenseParticipants: [participant], expenseItems: [], expenseItemAssignments: [], expenseAdjustments: [], repayments: [], attachments: [], deleted: [], ...overrides,
  };
}

describe('financial export reporting', () => {
  it('separates self spending, friend spending, and actual payments', () => {
    const summary = buildFinancialSummary(source(), range);
    expect(summary.personalSpending).toBe(400);
    expect(summary.spentForFriends).toBe(600);
    expect(summary.totalPaidByMe).toBe(1000);
    expect(summary.friendsOweMe).toBe(600);
  });

  it('handles a friend-paid expense as payable, not receivable', () => {
    const expense = { ...baseExpense, payer_type: 'friend' as const, payment_contributions: [{ id: 'p2', payer_id: 'f1', amount: 1000 }] };
    const report = buildFriendReport(source({ expenses: [expense] }), 'f1', range);
    expect(report.myShare).toBe(400);
    expect(report.amountOwedToMe).toBe(0);
    expect(report.amountIOwe).toBe(400);
    expect(report.balanceDirection).toBe('I_OWE');
  });

  it('reduces receivable and reports overpayment credit', () => {
    const report = buildFriendReport(source({ repayments: [{ id: 'r1', owner_id: 'owner', friend_id: 'f1', amount: 700, payment_method: 'UPI', repayment_date: '2026-08-20', repayment_time: '10:00', created_at: '2026-08-20', updated_at: '2026-08-20' }] }), 'f1', range);
    expect(report.amountOwedToMe).toBe(0);
    expect(report.creditAmount).toBe(100);
    expect(report.totalRepaidByFriend).toBe(700);
  });

  it('filters all report activity by the selected date range', () => {
    const outside = { ...baseExpense, id: 'e2', expense_date: '2026-09-01' };
    const summary = buildFinancialSummary(source({ expenses: [baseExpense, outside] }), range);
    expect(summary.expenseCount).toBe(1);
    expect(summary.totalPaidByMe).toBe(1000);
  });

  it('builds category totals from transaction data', () => {
    expect(buildCategories(source(), range)).toEqual([{ category: 'Food', yourShare: 400, friendsShare: 600, total: 1000 }]);
  });
});
