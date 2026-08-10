import { ExpenseStatus } from '../types';

const STYLES: Record<ExpenseStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e', label: 'Pending' },
  partial: { bg: '#dbeafe', fg: '#1e40af', label: 'Partial' },
  settled: { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary-hover)', label: 'Settled' },
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  const s = STYLES[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
