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

// ---------------------------------------------------------------------------
// Share App
// ---------------------------------------------------------------------------

export const APP_URL = 'https://share-gilt-three.vercel.app';

// Referral codes are designed but not yet enabled. When enabled, pass the
// user's referral code to buildAppShareUrl and it will append ?ref=USER123.
const REFERRALS_ENABLED = false;

export function buildAppShareUrl(referralCode?: string): string {
  if (REFERRALS_ENABLED && referralCode) return `${APP_URL}?ref=${encodeURIComponent(referralCode)}`;
  return APP_URL;
}

export const APP_SHARE_SUBJECT = 'Check out Owezy';
export const APP_SHARE_SHORT_TEXT = 'Track shared expenses and repayments with friends.';

export function buildAppShareMessage(url = buildAppShareUrl()): string {
  return [
    'Hey! 👋',
    '',
    "I've been using Owezy to track shared expenses, repayments, and pending balances with friends.",
    '',
    "It's simple, clean, and makes splitting bills super easy.",
    '',
    'Download Owezy here:',
    url,
    '',
    "Let's keep our expenses organized!",
  ].join('\n');
}

export function openShareUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildTelegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function buildSmsShareUrl(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export function buildEmailShareUrl(subject: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export type NativeShareResult = 'shared' | 'cancelled' | 'failed' | 'unsupported';

export async function shareAppNatively(title: string, text: string, url: string): Promise<NativeShareResult> {
  if (!navigator.share) return 'unsupported';
  try {
    await navigator.share({ title, text, url });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

export async function copyAppLink(): Promise<boolean> {
  return copyToClipboard(buildAppShareUrl());
}
