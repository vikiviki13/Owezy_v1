import type { Friend } from '../types';
import { formatCurrency, formatDate, todayDate } from './utils';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoToDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function shiftIsoDate(date: string, days: number): string {
  const shifted = isoToDate(date);
  shifted.setDate(shifted.getDate() + days);
  return dateToIso(shifted);
}

export function expenseDateLabel(date: string, currentDate = todayDate()): string {
  if (date === currentDate) return `Today, ${formatDate(date)}`;
  if (date === shiftIsoDate(currentDate, -1)) return `Yesterday, ${formatDate(date)}`;
  return formatDate(date);
}

export function expenseDateError(date: string, currentDate = todayDate()): string | undefined {
  if (!ISO_DATE_PATTERN.test(date) || dateToIso(isoToDate(date)) !== date) {
    return 'Choose a valid expense date.';
  }
  if (date > currentDate) return 'Expense date cannot be in the future.';
  return undefined;
}

function preferredFriendName(friend: Friend): string {
  const nickname = friend.nickname?.trim();
  if (nickname) return nickname;
  return friend.name.trim().split(/\s+/)[0] || friend.name;
}

export function buildExpenseWhatsAppMessage({
  friend,
  amount,
  reason,
  expenseDate,
  pendingBalance,
}: {
  friend: Friend;
  amount: number;
  reason: string;
  expenseDate: string;
  pendingBalance: number;
}): string {
  return [
    `Hi ${preferredFriendName(friend)}`,
    '',
    `I paid ${formatCurrency(amount)} for ${reason} on ${formatDate(expenseDate)}.`,
    '',
    `Your pending balance is now ${formatCurrency(pendingBalance)}.`,
  ].join('\n');
}
