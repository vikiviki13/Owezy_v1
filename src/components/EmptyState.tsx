import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-surface-secondary)' }}>
        <Icon size={26} className="text-[var(--color-text-muted)]" />
      </div>
      <p className="font-medium text-[var(--color-text-primary)]">{title}</p>
      {subtitle && <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-[240px]">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
