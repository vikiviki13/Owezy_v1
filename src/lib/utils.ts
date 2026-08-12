import type { DateFormat } from '../types';
import { getPreferenceSnapshot } from './preferences';

export function uid(): string {
  return crypto.randomUUID();
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}
export function roundCurrency(n: number): number {
  return fromPaise(toPaise(n));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'AED', SGD: 'S$',
};

export function currencySymbol(code = getPreferenceSnapshot().currency_code): string {
  return CURRENCY_SYMBOLS[code] || code;
}

export function formatNumber(value: number, options?: { decimalDisplay?: 'automatic' | '0' | '2' }): string {
  const preferences = getPreferenceSnapshot();
  const decimals = options?.decimalDisplay || preferences.decimal_display;
  const rounded = roundCurrency(value);
  const fraction = decimals === '0' ? 0 : decimals === '2' ? 2 : rounded % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat(preferences.number_format === 'indian' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(Math.abs(rounded));
}

export function formatCurrency(amount: number, currency = getPreferenceSnapshot().currency_code): string {
  const rounded = roundCurrency(amount);
  const symbol = currencySymbol(currency);
  const spacer = symbol.length > 1 ? ' ' : '';
  return `${rounded < 0 ? '-' : ''}${symbol}${spacer}${formatNumber(rounded)}`;
}

export function todayDate(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}
export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(`${dateStr}T12:00:00`);
  return new Date(dateStr);
}

function parts(dateStr: string) {
  const d = parseDate(dateStr);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    monthShort: d.toLocaleDateString('en', { month: 'short' }),
    year: String(d.getFullYear()),
    yearShort: String(d.getFullYear()).slice(-2),
  };
}

export function formatDate(dateStr: string, requestedFormat?: DateFormat): string {
  const { day, month, monthShort, year, yearShort } = parts(dateStr);
  switch (requestedFormat || getPreferenceSnapshot().date_format) {
    case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'DD MMM YY': return `${day} ${monthShort} ${yearShort}`;
    default: return `${day} ${monthShort} ${year}`;
  }
}

export function formatDateShort(dateStr: string): string {
  const { day, monthShort } = parts(dateStr);
  return `${day} ${monthShort}`;
}

export function formatTime(timeStr: string): string {
  const [hour = 0, minute = 0] = timeStr.split(':').map(Number);
  if (getPreferenceSnapshot().time_format === '24h') {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatDateTime(dateStr: string, timeStr: string): string {
  return `${formatDate(dateStr)} · ${formatTime(timeStr)}`;
}

export function localDateTimeToUTC(dateStr: string, timeStr: string, timeZone = getPreferenceSnapshot().timezone): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let attempt = 0; attempt < 2; attempt++) {
    const zoned = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(zoned.find((part) => part.type === type)?.value || 0);
    const projected = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    guess += desired - projected;
  }
  return new Date(guess).toISOString();
}

function zonedDateTime(timestamp: string) {
  const preferences = getPreferenceSnapshot();
  const zone = preferences.timezone_mode === 'automatic' ? Intl.DateTimeFormat().resolvedOptions().timeZone : preferences.timezone;
  const zoned = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes) => zoned.find((part) => part.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function formatTimestamp(timestamp: string): string {
  const value = zonedDateTime(timestamp);
  return formatDateTime(value.date, value.time);
}

export function formatTimestampDate(timestamp: string): string {
  return formatDate(zonedDateTime(timestamp).date);
}

export function formatTimestampTime(timestamp: string): string {
  return formatTime(zonedDateTime(timestamp).time);
}

export function formatTimestampRelative(timestamp: string): string {
  const value = zonedDateTime(timestamp);
  return formatDateTimeRelative(value.date, value.time);
}

export function formatRelativeDate(dateStr: string): string {
  if (dateStr === todayDate()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const offset = yesterday.getTimezoneOffset();
  const yesterdayStr = new Date(yesterday.getTime() - offset * 60000).toISOString().slice(0, 10);
  return dateStr === yesterdayStr ? 'Yesterday' : formatDateShort(dateStr);
}

export function formatDateTimeRelative(dateStr: string, timeStr: string): string {
  return `${formatRelativeDate(dateStr)} · ${formatTime(timeStr)}`;
}

export function formatDateRange(fromDate: string, toDate: string): string {
  return `${formatDate(fromDate)} – ${formatDate(toDate)}`;
}

export function initials(name: string): string {
  const names = name.trim().split(/\s+/);
  if (names.length === 1) return names[0].slice(0, 2).toUpperCase();
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
}

const AVATAR_HUES = [160, 190, 25, 340, 260, 45, 200, 10];
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]}, 55%, 45%)`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
