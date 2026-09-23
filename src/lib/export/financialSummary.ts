import type { Expense, ExpensePayerType } from '../../types';
import { getExportData } from '../db';
import { roundCurrency } from '../utils';
import type {
  CategoryReport, ExpenseReport, ExportBundle, ExportDateRange, ExportSourceData,
  FinancialSummary, FriendReport, RepaymentReport,
} from './exportTypes';

function payments(expense: Expense) {
  return expense.payment_contributions?.length
    ? expense.payment_contributions
    : [{ id: `${expense.id}-legacy-owner-payment`, payer_id: 'owner', amount: expense.total_amount }];
}

function payerType(expense: Expense): ExpensePayerType {
  return expense.payer_type || 'me';
}

function paidBy(expense: Expense, payerId: string) {
  return roundCurrency(payments(expense).filter((payment) => payment.payer_id === payerId).reduce((sum, payment) => sum + payment.amount, 0));
}

function dateInRange(date: string, range: ExportDateRange) {
  return date >= range.from && date <= range.to;
}

function initialOwed(expense: Expense, shareAmount: number, friendId: string) {
  // Mirror calculateFriendBalance: friend-paid expenses are owed to the paying
  // friend (not by every participant), and purchase-time contributions reduce
  // THIS friend's share, so the receivable must be attributed per friend.
  if (payerType(expense) === 'friend') return 0;
  return Math.max(0, shareAmount - paidBy(expense, friendId));
}

function initialPayable(expense: Expense, friendId: string) {
  if (payerType(expense) === 'me') return 0;
  const friendPaid = paidBy(expense, friendId);
  return Math.min(expense.owner_share, friendPaid);
}

export function buildFinancialSummary(source: ExportSourceData, range: ExportDateRange): FinancialSummary {
  const expenses = source.expenses.filter((expense) => dateInRange(expense.expense_date, range));
  const repayments = source.repayments.filter((repayment) => dateInRange(repayment.repayment_date, range));
  const totalPaidByMe = roundCurrency(expenses.reduce((sum, expense) => sum + paidBy(expense, 'owner'), 0));
  const paidByFriendsForMe = roundCurrency(expenses.reduce((sum, expense) => sum + Math.min(expense.owner_share, payments(expense).filter((payment) => payment.payer_id !== 'owner').reduce((inner, payment) => inner + payment.amount, 0)), 0));
  const personalSpending = roundCurrency(expenses.reduce((sum, expense) => sum + expense.owner_share, 0));
  const spentForFriends = roundCurrency(expenses.reduce((sum, expense) => {
    const friendPaid = payments(expense).filter((payment) => payment.payer_id !== 'owner').reduce((inner, payment) => inner + payment.amount, 0);
    return sum + (payerType(expense) === 'me' ? expense.recoverable_amount : Math.max(0, expense.recoverable_amount - friendPaid));
  }, 0));
  const totalReceived = roundCurrency(repayments.filter((repayment) => repayment.direction !== 'to_friend').reduce((sum, repayment) => sum + repayment.amount, 0));
  const friendsOweMe = roundCurrency(source.friends.reduce((sum, friend) => sum + buildFriendReport(source, friend.id, range).amountOwedToMe, 0));
  const iOweFriends = roundCurrency(source.friends.reduce((sum, friend) => sum + buildFriendReport(source, friend.id, range).amountIOwe, 0));
  const netBalance = roundCurrency(friendsOweMe - iOweFriends);
  return {
    personalSpending,
    spentForFriends,
    paidByFriendsForMe,
    totalPaidByMe,
    totalReceived,
    friendsOweMe,
    iOweFriends,
    netBalance,
    netDirection: netBalance > 0 ? 'NET_RECEIVABLE' : netBalance < 0 ? 'NET_PAYABLE' : 'SETTLED',
    expenseCount: expenses.length,
    friendCount: source.friends.filter((friend) => !friend.is_archived).length,
    repaymentCount: repayments.length,
    currency: source.preferences.currency_code,
    dateFrom: range.from,
    dateTo: range.to,
  };
}

export function buildFriendReport(source: ExportSourceData, friendId: string, range: ExportDateRange): FriendReport {
  const friend = source.friends.find((item) => item.id === friendId);
  const parts = source.expenseParticipants.filter((part) => part.friend_id === friendId);
  const expenses = source.expenses.filter((expense) => parts.some((part) => part.expense_id === expense.id) && dateInRange(expense.expense_date, range));
  const repayments = source.repayments.filter((repayment) => repayment.friend_id === friendId && dateInRange(repayment.repayment_date, range));
  const received = roundCurrency(repayments.filter((repayment) => repayment.direction !== 'to_friend').reduce((sum, repayment) => sum + repayment.amount, 0));
  const toFriend = roundCurrency(repayments.filter((repayment) => repayment.direction === 'to_friend').reduce((sum, repayment) => sum + repayment.amount, 0));
  const myShare = roundCurrency(expenses.reduce((sum, expense) => sum + expense.owner_share, 0));
  const friendShare = roundCurrency(expenses.reduce((sum, expense) => sum + (parts.find((part) => part.expense_id === expense.id)?.share_amount || 0), 0));
  const totalPaidByMe = roundCurrency(expenses.reduce((sum, expense) => sum + (payerType(expense) === 'friend' ? 0 : paidBy(expense, 'owner')), 0));
  const totalPaidByFriend = roundCurrency(expenses.reduce((sum, expense) => sum + paidBy(expense, friendId), 0));
  const owedBeforeRepayment = roundCurrency(expenses.reduce((sum, expense) => sum + initialOwed(expense, parts.find((part) => part.expense_id === expense.id)?.share_amount || 0, friendId), 0));
  const payableBeforeRepayment = roundCurrency(expenses.reduce((sum, expense) => sum + initialPayable(expense, friendId), 0));
  const amountOwedToMe = roundCurrency(Math.max(0, owedBeforeRepayment - received));
  const creditAmount = roundCurrency(Math.max(0, received - owedBeforeRepayment));
  const amountIOwe = roundCurrency(Math.max(0, payableBeforeRepayment - toFriend) + creditAmount);
  const netBalance = roundCurrency(amountOwedToMe - amountIOwe);
  const allDates = [...expenses.map((expense) => expense.expense_date), ...repayments.map((repayment) => repayment.repayment_date)].sort();
  const repaymentDates = repayments.map((repayment) => repayment.repayment_date).sort();
  return {
    friendId,
    friendName: friend?.name || 'Unknown friend',
    totalExpenses: roundCurrency(expenses.reduce((sum, expense) => sum + expense.total_amount, 0)),
    myShare,
    friendShare,
    totalPaidByMe,
    totalPaidByFriend,
    totalRepaidByFriend: received,
    totalRepaidToFriend: toFriend,
    creditAmount,
    amountOwedToMe,
    amountIOwe,
    netBalance,
    balanceDirection: netBalance > 0 ? 'OWES_ME' : netBalance < 0 ? 'I_OWE' : 'SETTLED',
    lastTransactionDate: allDates.at(-1),
    lastRepaymentDate: repaymentDates.at(-1),
    status: netBalance === 0 && (owedBeforeRepayment > 0 || payableBeforeRepayment > 0) ? 'settled' : (received > 0 || toFriend > 0) ? 'partial' : 'pending',
  };
}

export function buildCategories(source: ExportSourceData, range: ExportDateRange): CategoryReport[] {
  const map = new Map<string, CategoryReport>();
  source.expenses.filter((expense) => dateInRange(expense.expense_date, range)).forEach((expense) => {
    const current = map.get(expense.category) || { category: expense.category, yourShare: 0, friendsShare: 0, total: 0 };
    current.yourShare = roundCurrency(current.yourShare + expense.owner_share);
    current.friendsShare = roundCurrency(current.friendsShare + expense.recoverable_amount);
    current.total = roundCurrency(current.yourShare + current.friendsShare);
    map.set(expense.category, current);
  });
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category));
}

export function buildExpenseReports(source: ExportSourceData, range: ExportDateRange): ExpenseReport[] {
  const friends = new Map(source.friends.map((friend) => [friend.id, friend]));
  const groups = new Map(source.groups.map((group) => [group.id, group]));
  const reports: ExpenseReport[] = [];
  source.expenses.filter((expense) => dateInRange(expense.expense_date, range)).forEach((expense) => {
    const participants = source.expenseParticipants.filter((part) => part.expense_id === expense.id);
    const rows = participants.length ? participants : [undefined];
    rows.forEach((part) => {
      const friend = part ? friends.get(part.friend_id) : undefined;
      const friendPayment = friend ? paidBy(expense, friend.id) : 0;
      const ownerPayment = paidBy(expense, 'owner');
      reports.push({
        recordType: 'expense', expenseId: expense.id, expenseName: expense.merchant_name || expense.title,
        expenseTitle: expense.title, category: expense.category, friendName: friend?.name || '', friendId: friend?.id || '',
        groupName: expense.group_id ? groups.get(expense.group_id)?.name || '' : '', totalAmount: expense.total_amount,
        ownerShare: expense.owner_share, recoverableAmount: expense.recoverable_amount, shareAmount: part?.share_amount || 0,
        paidAmount: part?.paid_amount || 0, pendingAmount: part?.pending_amount || 0,
        paymentAmount: friend ? friendPayment : ownerPayment, paymentDirection: friend && friendPayment > 0 ? 'PAID_BY_FRIEND' : 'PAID_BY_ME',
        paymentMethod: payments(expense).map((payment) => payment.payment_method || '').filter(Boolean).join(' | '),
        payer: expense.payer_type || 'me', expenseDate: expense.expense_date, expenseTime: expense.expense_time,
        currency: expense.currency, status: expense.status, notes: expense.notes || expense.description || '',
        createdAt: expense.created_at, updatedAt: expense.updated_at,
      });
    });
  });
  return reports;
}

export function buildRepaymentReports(source: ExportSourceData, range: ExportDateRange): RepaymentReport[] {
  const names = new Map(source.friends.map((friend) => [friend.id, friend.name]));
  return source.repayments.filter((repayment) => dateInRange(repayment.repayment_date, range)).map((repayment) => ({
    recordType: 'repayment', repaymentId: repayment.id, friendId: repayment.friend_id, friendName: names.get(repayment.friend_id) || 'Unknown friend',
    amount: repayment.amount, direction: repayment.direction === 'to_friend' ? 'TO_FRIEND' : 'FROM_FRIEND', paymentMethod: repayment.payment_method,
    repaymentDate: repayment.repayment_date, repaymentTime: repayment.repayment_time, transactionReference: repayment.transaction_reference || '', notes: repayment.notes || '',
  }));
}

export function buildExportBundle(range: ExportDateRange, exportType: ExportBundle['exportType'] = 'report', source = getExportData() as ExportSourceData): ExportBundle {
  const friends = source.friends.filter((friend) => !friend.is_archived).map((friend) => buildFriendReport(source, friend.id, range));
  return {
    schemaVersion: 1, exportType, app: 'Owezy', exportedAt: new Date().toISOString(), range,
    currency: source.preferences.currency_code, summary: buildFinancialSummary(source, range), friends,
    categories: buildCategories(source, range), expenses: buildExpenseReports(source, range), repayments: buildRepaymentReports(source, range), source,
  };
}
