import { quoteCsvCell } from '../exportSecurity';
import type { ExportBundle } from './exportTypes';

function row(values: unknown[]) { return values.map(quoteCsvCell).join(','); }

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function balanceText(bundle: ExportBundle, friend: ExportBundle['friends'][number]) {
  if (friend.amountIOwe > 0) return `You owe ${money(friend.amountIOwe, bundle.currency)}`;
  if (friend.amountOwedToMe > 0) return `${money(friend.amountOwedToMe, bundle.currency)} owed to you`;
  return 'Settled';
}

function payerText(expense: ExportBundle['expenses'][number]) {
  if (expense.payer === 'friend') return expense.friendName || 'Friend';
  if (expense.payer === 'multiple') return 'Me and friends';
  return 'Me';
}

/** A deliberately human-facing report. Database IDs and implementation fields stay in JSON only. */
export function bundleToCsv(bundle: ExportBundle): string {
  const lines: string[] = [];
  const s = bundle.summary;
  lines.push('SUMMARY', row(['Metric', 'Amount']));
  for (const [label, value] of [
    ['My Spending', s.personalSpending], ['Spent for Friends', s.spentForFriends], ['Total Paid by Me', s.totalPaidByMe],
    ['Received from Friends', s.totalReceived], ['Friends Owe Me', s.friendsOweMe], ['I Owe Friends', s.iOweFriends],
  ] as const) lines.push(row([label, money(value, bundle.currency)]));
  const netText = s.netDirection === 'NET_RECEIVABLE' ? `${money(s.netBalance, bundle.currency)} owed to you` : s.netDirection === 'NET_PAYABLE' ? `You owe ${money(Math.abs(s.netBalance), bundle.currency)}` : 'Settled';
  lines.push(row(['Net Balance', netText]));

  lines.push('', 'FRIENDS', row(['Friend', 'You Paid', 'They Repaid', 'Balance']));
  bundle.friends.forEach((friend) => lines.push(row([friend.friendName, money(friend.totalPaidByMe, bundle.currency), money(friend.totalRepaidByFriend, bundle.currency), balanceText(bundle, friend)])));

  lines.push('', 'EXPENSES', row(['Date', 'Expense', 'Category', 'For', 'Amount', 'Paid By']));
  bundle.expenses.forEach((expense) => {
    const amount = expense.friendName ? expense.shareAmount : expense.ownerShare;
    lines.push(row([expense.expenseDate, expense.expenseName, expense.category, expense.friendName || 'Myself', money(amount, expense.currency), payerText(expense)]));
  });

  lines.push('', 'REPAYMENTS', row(['Date', 'Person', 'Amount', 'Method', 'Direction']));
  bundle.repayments.forEach((repayment) => lines.push(row([repayment.repaymentDate, repayment.friendName, money(repayment.amount, bundle.currency), repayment.paymentMethod, repayment.direction === 'FROM_FRIEND' ? 'Received' : 'Paid'])));
  return lines.join('\n');
}

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
