import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateSpendingSummary, listExpenses, onDBChange } from '../lib/db';
import { formatCurrency, formatDate, todayDate } from '../lib/utils';
import { shiftIsoDate } from '../lib/expenseDraft';

type Range = 'today' | 'week' | 'month' | 'last-month' | 'custom';

export function SpendingOverview() {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [range, setRange] = useState<Range>('month');
  const [statementFilter, setStatementFilter] = useState<'all' | 'self'>('all');
  const [customFrom, setCustomFrom] = useState(() => shiftIsoDate(todayDate(), -30));
  const [customTo, setCustomTo] = useState(() => todayDate());

  useEffect(() => onDBChange(() => setTick((tick) => tick + 1)), []);

  const today = todayDate();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const dates = range === 'today'
    ? [today, today]
    : range === 'week'
      ? [shiftIsoDate(today, -6), today]
      : range === 'last-month'
        ? [`${shiftIsoDate(firstOfMonth, -1).slice(0, 7)}-01`, shiftIsoDate(firstOfMonth, -1)]
        : range === 'custom' ? [customFrom, customTo] : [firstOfMonth, today];
  const spending = calculateSpendingSummary(dates[0], dates[1]);
  const expenses = listExpenses().filter((expense) => expense.expense_date >= dates[0] && expense.expense_date <= dates[1]);
  const selfExpenses = expenses.filter((expense) => expense.expense_type === 'personal');
  const statementExpenses = statementFilter === 'self' ? selfExpenses : expenses;
  const selfTotal = selfExpenses.reduce((sum, expense) => sum + expense.total_amount, 0);
  const selfByCategory = selfExpenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.total_amount;
    return totals;
  }, {});

  return (
    <div className="px-4 pt-6 pb-10 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="md:hidden w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Spending Overview</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Review your spending at month end.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {(['today', 'week', 'month', 'last-month', 'custom'] as Range[]).map((value) => (
          <button key={value} onClick={() => setRange(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize ${range === value ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}>
            {value.replace('-', ' ')}
          </button>
        ))}
      </div>
      {range === 'custom' && <div className="flex gap-2 mb-4"><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input text-xs" /><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input text-xs" /></div>}
      <p className="text-xs text-[var(--color-text-muted)] mb-4">{dates[0]} → {dates[1]}</p>

      <div className="grid grid-cols-2 gap-3">
        <SummaryMetric label="My actual spending" amount={spending.myActualSpending} />
        <SummaryMetric label="Self spending" amount={selfTotal} onClick={() => setStatementFilter('self')} active={statementFilter === 'self'} />
        <SummaryMetric label="Spent for friends" amount={spending.spentForFriends} />
        <SummaryMetric label="Paid by friends for me" amount={spending.paidByFriendsForMe} />
        <SummaryMetric label="Net personal spending" amount={spending.netPersonalSpending} />
        <SummaryMetric label="Total paid by me" amount={spending.totalPaidByMe} />
        <SummaryMetric label="Total paid by friends" amount={spending.totalPaidByFriends} />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{statementFilter === 'self' ? 'My self spending' : 'Your spending statement'}</h2>
          <button onClick={() => setStatementFilter(statementFilter === 'self' ? 'all' : 'self')} className="text-xs font-semibold text-[var(--color-primary)]">{statementFilter === 'self' ? 'Show all' : 'Show self only'}</button>
        </div>
        {statementFilter === 'self' && selfExpenses.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Object.entries(selfByCategory).map(([category, amount]) => <SummaryMetric key={category} label={category} amount={amount} />)}
          </div>
        )}
        {statementExpenses.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center text-sm text-[var(--color-text-muted)]">
            No expenses recorded for this period.
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {statementExpenses.map((expense) => {
              const amount = expense.expense_type === 'personal' ? expense.total_amount : expense.owner_share;
              return (
                <button key={expense.id} onClick={() => navigate(`/expense/${expense.id}`)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{expense.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{expense.category} · {expense.expense_type === 'personal' ? 'Self' : 'Shared'} · {formatDate(expense.expense_date)}</p>
                  </div>
                  <p className="shrink-0 font-semibold amount-tabular">{formatCurrency(amount)}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryMetric({ label, amount, onClick, active }: { label: string; amount: number; onClick?: () => void; active?: boolean }) {
  const className = `rounded-2xl border bg-[var(--color-surface)] p-4 text-left ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]'} ${onClick ? 'w-full cursor-pointer' : ''}`;
  if (onClick) return <button onClick={onClick} className={className}><p className="text-xs leading-4 text-[var(--color-text-muted)]">{label}</p><p className="mt-2 font-semibold amount-tabular">{formatCurrency(amount)}</p></button>;
  return <div className={className}><p className="text-xs leading-4 text-[var(--color-text-muted)]">{label}</p><p className="mt-2 font-semibold amount-tabular">{formatCurrency(amount)}</p></div>;
}
