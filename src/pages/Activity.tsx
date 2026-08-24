import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Activity as ActivityIcon } from 'lucide-react';
import { listAllRepayments, listExpenses, getFriend, getExpenseParticipants } from '../lib/db';
import { formatCurrency, formatTime, formatTimestampTime, todayDate } from '../lib/utils';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { shiftIsoDate } from '../lib/expenseDraft';

type Filter = 'all' | 'expense' | 'repayment';

export function Activity() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();

  const items = useMemo(() => {
    const expenses = listExpenses().map((e) => ({
      type: 'expense' as const,
      id: e.id,
      title: e.title,
      subtitle: e.expense_type === 'personal' ? 'Self' : getExpenseParticipants(e.id).map((p) => getFriend(p.friend_id)?.name).filter(Boolean).join(', '),
      amount: e.expense_type === 'personal' ? e.total_amount : e.recoverable_amount,
      date: e.expense_date,
      time: e.expense_time,
      occurredAt: e.occurred_at,
      status: e.status,
    }));
    const repayments = listAllRepayments().map((r) => ({
      type: 'repayment' as const,
      id: r.id,
      title: 'Payment received',
      subtitle: `${getFriend(r.friend_id)?.name || ''} · ${r.payment_method}`,
      amount: r.amount,
      date: r.repayment_date,
      time: r.repayment_time,
      occurredAt: r.occurred_at,
      status: undefined,
    }));
    let merged = [...expenses, ...repayments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    if (filter !== 'all') merged = merged.filter((m) => m.type === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      merged = merged.filter((m) => m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q));
    }
    return merged;
  }, [query, filter]);

  const groups = groupByDate(items);

  return (
    <div className="px-4 pt-6 safe-top">
      <h1 className="text-xl font-semibold mb-4">Activity</h1>
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, reason, amount" className="input pl-10" />
      </div>
      <div className="flex gap-2 mb-5">
        {(['all', 'expense', 'repayment'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
          >
            {f === 'all' ? 'All' : f === 'expense' ? 'Expenses' : 'Repayments'}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity yet." subtitle="Expenses and repayments will show up here." />
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(groups).map(([label, rows]) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">{label}</p>
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => r.type === 'expense' && navigate(`/expense/${r.id}`)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{r.subtitle} · {r.occurredAt ? formatTimestampTime(r.occurredAt) : formatTime(r.time)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`font-semibold amount-tabular ${r.type === 'repayment' ? 'text-[var(--color-primary)]' : ''}`}>
                        {r.type === 'repayment' ? '+' : ''}{formatCurrency(r.amount)}
                      </p>
                      {r.status && <StatusBadge status={r.status} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  const today = todayDate();
  const yesterday = shiftIsoDate(today, -1);
  const weekAgo = shiftIsoDate(today, -7);
  const groups: Record<string, T[]> = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] };
  items.forEach((item) => {
    if (item.date === today) groups['Today'].push(item);
    else if (item.date === yesterday) groups['Yesterday'].push(item);
    else if (item.date >= weekAgo) groups['This Week'].push(item);
    else groups['Earlier'].push(item);
  });
  Object.keys(groups).forEach((k) => { if (groups[k].length === 0) delete groups[k]; });
  return groups;
}
