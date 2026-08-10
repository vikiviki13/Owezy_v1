export function uid(): string {
  return crypto.randomUUID();
}

// All money is stored in the DB layer as rupees with 2 decimal precision,
// but arithmetic is done in integer paise internally to avoid float drift.
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}
export function roundCurrency(n: number): number {
  return fromPaise(toPaise(n));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency + ' ';
  const rounded = roundCurrency(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(rounded));
  return `${rounded < 0 ? '-' : ''}${symbol}${formatted}`;
}

export function todayDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
export function nowTime(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
export function formatDateTimeRelative(dateStr: string, timeStr: string): string {
  const today = todayDate();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return `Today, ${formatTime(timeStr)}`;
  if (dateStr === yesterday) return `Yesterday, ${formatTime(timeStr)}`;
  return `${formatDate(dateStr)}, ${formatTime(timeStr)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic pastel avatar color from name
const AVATAR_HUES = [160, 190, 25, 340, 260, 45, 200, 10];
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
  return `hsl(${hue}, 55%, 45%)`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
