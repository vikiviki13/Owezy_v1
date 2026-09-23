import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, PiggyBank, ArrowUpRight, FileText, HandCoins } from 'lucide-react';
import { dashboardTotals, getProfile, listFriendBalances, onDBChange, listAllRepayments, listExpenses } from '../lib/db';
import { formatCurrency, formatDateTimeRelative, formatTimestampRelative, greeting } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { SyncStatusBadge } from '../components/SyncStatusBadge';

export function Home() {
  const [, setTick] = useState(0);
  const navigate = useNavigate();
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);

  const profile = getProfile();
  const totals = dashboardTotals();
  const balances = listFriendBalances().filter((b) => b.pending > 0);
  const owing = balances.slice(0, 8);

  const activity = [
    ...listExpenses().slice(0, 6).map((e) => ({ type: 'expense' as const, id: e.id, title: e.title, amount: e.expense_type === 'personal' ? e.total_amount : e.recoverable_amount, date: e.expense_date, time: e.expense_time, occurredAt: e.occurred_at, status: e.status })),
    ...listAllRepayments().slice(0, 6).map((r) => ({ type: 'repayment' as const, id: r.id, title: r.direction === 'to_friend' ? 'Paid to friend' : 'Payment received', received: r.direction !== 'to_friend', amount: r.amount, date: r.repayment_date, time: r.repayment_time, occurredAt: r.occurred_at, status: undefined })),
  ]
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, 6);

  return (
    <div className="px-4 pt-6 safe-top">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">{greeting()},</p>
          <h1 className="text-xl font-semibold">{profile.full_name}</h1>
        </div>
        <SyncStatusBadge />
      </div>

      {/* Main balance card */}
      <div className="rounded-3xl bg-[var(--color-primary)] text-white p-6 mb-8 receipt-edge relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <p className="text-sm font-medium text-white/80 tracking-wide uppercase">You'll get back</p>
        <p className="text-4xl font-extrabold mt-1 amount-tabular">{formatCurrency(totals.totalPending)}</p>
        <p className="text-sm text-white/80 mt-1">From {totals.friendsOwing} friend{totals.friendsOwing === 1 ? '' : 's'}</p>
        <div className="flex items-center gap-6 mt-5 pt-4 border-t border-white/20">
          <div>
            <p className="text-xs text-white/70">Total Paid</p>
            <p className="font-semibold amount-tabular">{formatCurrency(totals.totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">Received</p>
            <p className="font-semibold amount-tabular">{formatCurrency(totals.totalReceived)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">Pending</p>
            <p className="font-semibold amount-tabular">{formatCurrency(totals.totalPending)}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <QuickAction icon={<ArrowUpRight size={18} />} label="Add Expense" onClick={() => navigate('/add-expense')} />
        <QuickAction icon={<HandCoins size={18} />} label="Record Payment" onClick={() => navigate('/record-repayment')} />
        <QuickAction icon={<FileText size={18} />} label="Statement" onClick={() => navigate('/friends')} />
      </div>

      {/* Friends who owe you */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Friends who owe you</h2>
          <button onClick={() => navigate('/friends')} className="text-sm text-[var(--color-primary)] font-medium">See all</button>
        </div>
        {owing.length === 0 ? (
          <EmptyState icon={Users2} title="No one owes you anything yet." subtitle="Add an expense to start tracking." />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
            {owing.map((b) => (
              <button
                key={b.friend.id}
                onClick={() => navigate(`/friends/${b.friend.id}`)}
                className="flex flex-col items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 min-w-[104px] text-center"
              >
                <Avatar name={b.friend.name} size={44} />
                <p className="text-sm font-medium truncate max-w-[80px]">{b.friend.name}</p>
                <p className="text-sm font-semibold text-[var(--color-primary)] amount-tabular">{formatCurrency(b.pending)}</p>
                {b.lastActivityAt && <p className="text-[10px] text-[var(--color-text-muted)]">{b.lastActivityAt.slice(0, 10)}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent activity</h2>
          <button onClick={() => navigate('/activity')} className="text-sm text-[var(--color-primary)] font-medium">See all</button>
        </div>
        {activity.length === 0 ? (
          <EmptyState icon={PiggyBank} title="No expenses yet." subtitle="Your first expense will appear here." />
        ) : (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{a.occurredAt ? formatTimestampRelative(a.occurredAt) : formatDateTimeRelative(a.date, a.time)}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`font-semibold amount-tabular ${a.type === 'expense' ? 'text-[var(--color-text-primary)]' : a.received ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {a.type === 'expense' ? '' : a.received ? '+' : '-'}{formatCurrency(a.amount)}
                  </p>
                  {a.status && <StatusBadge status={a.status} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl py-4 hover:border-[var(--color-primary)] transition-colors">
      <div className="w-9 h-9 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">{icon}</div>
      <span className="text-xs font-medium text-center px-1">{label}</span>
    </button>
  );
}
