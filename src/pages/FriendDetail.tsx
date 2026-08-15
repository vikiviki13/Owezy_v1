import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Receipt, HandCoins, Share2, Phone, MoreHorizontal } from 'lucide-react';
import { calculateFriendBalance, friendLedger, getFriend, listExpensesForFriend, listRepaymentsForFriend, onDBChange } from '../lib/db';
import { formatCurrency, formatDateShort, formatTime, formatTimestamp } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

type Tab = 'overview' | 'transactions' | 'repayments';

export function FriendDetail() {
  const { id } = useParams();
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');
  const navigate = useNavigate();
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);

  if (!id) return null;
  const friend = getFriend(id);
  if (!friend) return <EmptyState icon={Receipt} title="Friend not found" />;

  const balance = calculateFriendBalance(id);
  const ledger = friendLedger(id);
  const expenses = listExpensesForFriend(id);
  const repayments = listRepaymentsForFriend(id);

  return (
    <div className="pb-6 safe-top">
      <div className="flex items-center gap-3 px-4 pt-6 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <Avatar name={friend.name} size={40} />
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{friend.name}</h1>
          {friend.phone && <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1"><Phone size={11} /> {friend.phone}</p>}
        </div>
        <button
          onClick={() => navigate(`/friends/${friend.id}/manage`)}
          className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center"
          aria-label="Manage friend"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="px-4">
        <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-5">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
            {balance.pending >= 0 ? 'Owes you' : 'You owe'}
          </p>
          <p className={`text-3xl font-extrabold mt-1 amount-tabular ${balance.pending > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}>
            {formatCurrency(Math.abs(balance.pending))}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <ActionBtn icon={<Receipt size={16} />} label="Add Expense" onClick={() => navigate(`/add-expense?friend=${friend.id}`)} />
            <ActionBtn icon={<HandCoins size={16} />} label="Repayment" onClick={() => navigate(`/record-repayment?friend=${friend.id}`)} />
            <ActionBtn icon={<Share2 size={16} />} label="Statement" onClick={() => navigate(`/statement/${friend.id}`)} />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {(['overview', 'transactions', 'repayments'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total Paid" value={formatCurrency(balance.totalPaidByYou)} />
              <Stat label="Total Repaid" value={formatCurrency(balance.totalRepaid)} />
              <Stat label="Pending" value={formatCurrency(balance.pending)} highlight />
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mt-1">Recent transactions</p>
            <LedgerList ledger={ledger.slice(-5).reverse()} />
          </div>
        )}

        {tab === 'transactions' && (
          expenses.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses yet." subtitle="Expenses you add for this friend show up here." />
          ) : (
            <div className="flex flex-col gap-2">
              {expenses.map((e) => (
                <button key={e.id} onClick={() => navigate(`/expense/${e.id}`)} className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{e.occurred_at ? formatTimestamp(e.occurred_at) : `${formatDateShort(e.expense_date)} · ${formatTime(e.expense_time)}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold amount-tabular">{formatCurrency(e.recoverable_amount)}</p>
                    <StatusBadge status={e.status} />
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'repayments' && (
          repayments.length === 0 ? (
            <EmptyState icon={HandCoins} title="No repayments yet." subtitle="Payments this friend makes will show up here." />
          ) : (
            <div className="flex flex-col gap-2">
              {repayments.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
                  <div>
                    <p className="font-medium">{r.payment_method}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{r.occurred_at ? formatTimestamp(r.occurred_at) : `${formatDateShort(r.repayment_date)} · ${formatTime(r.repayment_time)}`}</p>
                  </div>
                  <p className="font-semibold amount-tabular text-[var(--color-primary)]">+{formatCurrency(r.amount)}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 bg-[var(--color-surface-secondary)] rounded-xl py-3 hover:opacity-80 transition-opacity">
      <span className="text-[var(--color-primary)]">{icon}</span>
      <span className="text-[11px] font-medium text-center leading-tight px-1">{label}</span>
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-center">
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p className={`font-semibold amount-tabular text-sm mt-0.5 ${highlight ? 'text-[var(--color-primary)]' : ''}`}>{value}</p>
    </div>
  );
}

function LedgerList({ ledger }: { ledger: ReturnType<typeof friendLedger> }) {
  if (ledger.length === 0) return <EmptyState icon={Receipt} title="No transactions yet." />;
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
      {ledger.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">{entry.title}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{formatDateShort(entry.date)}</p>
          </div>
          <div className="text-right">
            <p className={`font-semibold amount-tabular ${entry.kind === 'repayment' ? 'text-[var(--color-primary)]' : ''}`}>
              {entry.kind === 'repayment' ? '+' : ''}{formatCurrency(entry.amount)}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Balance {formatCurrency(entry.runningBalance)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
