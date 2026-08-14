import type { ExpenseStatus } from '../types';
import { Badge } from './ui/badge';

const styles: Record<ExpenseStatus, string> = {
  pending: 'text-warning',
  partial: 'text-info',
  settled: 'text-success',
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge variant="secondary" className={styles[status]}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}
