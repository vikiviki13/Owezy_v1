import { Friend } from '../types';
import { StatementResult } from './db';
import { formatCurrency, formatDate, formatDateShort } from './utils';

export function buildStatementMessage(friend: Friend, fromDate: string, toDate: string, stmt: StatementResult): string {
  const lines: string[] = [];
  lines.push(`Hi ${friend.name.split(' ')[0]} 👋`);
  lines.push('');
  lines.push('Here is the expense summary I have noted.');
  lines.push('');
  lines.push(`Period: ${formatDate(fromDate)} – ${formatDate(toDate)}`);
  lines.push('');
  lines.push(`Opening Balance: ${formatCurrency(stmt.openingBalance)}`);
  lines.push(`Expenses Added: ${formatCurrency(stmt.periodExpenses)}`);
  lines.push(`Amount Received: ${formatCurrency(stmt.periodRepayments)}`);
  lines.push('');
  lines.push(`Pending Amount: ${formatCurrency(stmt.closingBalance)}`);

  if (stmt.entries.length) {
    lines.push('');
    lines.push('Transactions:');
    lines.push('');
    stmt.entries.forEach((e) => {
      const label = e.kind === 'repayment' ? 'Received' : e.title;
      lines.push(`${formatDateShort(e.date)} — ${label} — ${formatCurrency(e.amount)}`);
    });
  }

  lines.push('');
  lines.push(`Total Pending: ${formatCurrency(stmt.closingBalance)}`);
  return lines.join('\n');
}

export function buildReminderMessage(friend: Friend, pending: number): string {
  return `Hey ${friend.name.split(' ')[0]} 👋\nJust sharing the pending amount I have recorded.\nCurrent balance: ${formatCurrency(pending)}.`;
}

export function shareToWhatsApp(text: string, phone?: string) {
  const encoded = encodeURIComponent(text);
  const base = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : 'https://wa.me/';
  window.open(`${base}?text=${encoded}`, '_blank');
}

export async function nativeShare(text: string, title: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text, title });
      return true;
    } catch {
      return false;
    }
  }
  return copyToClipboard(text);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
