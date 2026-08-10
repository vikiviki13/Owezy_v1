import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Copy, Share2 } from 'lucide-react';
import { calculateStatement, getFriend } from '../lib/db';
import { formatCurrency, formatDateShort, todayDate } from '../lib/utils';
import { buildStatementMessage, copyToClipboard, nativeShare, shareToWhatsApp } from '../lib/share';
import { useToast } from '../components/Toast';

type Preset = 'week' | 'month' | 'lastMonth' | '3months' | 'year' | 'all' | 'custom';

function presetRange(preset: Preset): { from: string; to: string } {
  const to = todayDate();
  const now = new Date();
  switch (preset) {
    case 'week': {
      const d = new Date(Date.now() - 7 * 86400000);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: from.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    case '3months': {
      const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return { from: d.toISOString().slice(0, 10), to };
    }
    case 'year': {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case 'all':
      return { from: '2000-01-01', to };
    default:
      return { from: to, to };
  }
}

export function Statement() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState(todayDate());
  const [customTo, setCustomTo] = useState(todayDate());

  const friend = friendId ? getFriend(friendId) : undefined;
  const range = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset);
  const stmt = useMemo(() => (friendId ? calculateStatement(friendId, range.from, range.to) : null), [friendId, range.from, range.to]);

  if (!friend || !stmt) return <div className="p-6 text-center text-[var(--color-text-muted)]">Friend not found.</div>;

  const message = buildStatementMessage(friend, range.from, range.to, stmt);

  const pending = stmt.entries.filter((e) => e.kind === 'expense' && e.status !== 'settled');
  const settled = stmt.entries.filter((e) => e.kind === 'expense' && e.status === 'settled');

  return (
    <div className="px-4 pt-6 pb-10 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-semibold">Statement</h1>
          <p className="text-xs text-[var(--color-text-muted)]">{friend.name}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
        {([
          ['week', 'This Week'], ['month', 'This Month'], ['lastMonth', 'Last Month'],
          ['3months', 'Last 3 Months'], ['year', 'This Year'], ['all', 'All Time'], ['custom', 'Custom'],
        ] as [Preset, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${preset === key ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex gap-2 mb-4">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input" />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input" />
        </div>
      )}

      <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-6">
        <p className="text-xs text-[var(--color-text-muted)] mb-3">{formatDateShort(range.from)} – {formatDateShort(range.to)}</p>
        <div className="grid grid-cols-2 gap-4">
          <SummaryRow label="Opening Balance" value={stmt.openingBalance} />
          <SummaryRow label="You Paid" value={stmt.periodExpenses} />
          <SummaryRow label="Received" value={stmt.periodRepayments} />
          <SummaryRow label="Closing Balance" value={stmt.closingBalance} highlight />
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        <button
          onClick={() => { shareToWhatsApp(message, friend.whatsapp_number || friend.phone); }}
          className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white font-medium rounded-xl py-3 text-sm"
        >
          <MessageCircle size={16} /> WhatsApp
        </button>
        <button
          onClick={async () => { const ok = await copyToClipboard(message); toast(ok ? 'Copied to clipboard' : 'Could not copy'); }}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-medium rounded-xl py-3 text-sm"
        >
          <Copy size={16} /> Copy Text
        </button>
        <button
          onClick={async () => { await nativeShare(message, 'Statement'); }}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-medium rounded-xl py-3 text-sm"
        >
          <Share2 size={16} /> Share
        </button>
      </div>

      {stmt.entries.length > 0 && (
        <>
          <p className="text-sm font-semibold mb-2">Transactions</p>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] mb-6">
            {stmt.entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-sm">{e.kind === 'repayment' ? 'Payment received' : e.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDateShort(e.date)}</p>
                </div>
                <p className={`font-semibold amount-tabular text-sm ${e.kind === 'repayment' ? 'text-[var(--color-primary)]' : ''}`}>
                  {e.kind === 'repayment' ? '-' : ''}{formatCurrency(e.amount)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {pending.length > 0 && (
        <Section title="Pending expenses" entries={pending} />
      )}
      {settled.length > 0 && (
        <Section title="Settled expenses" entries={settled} />
      )}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={`font-semibold amount-tabular mt-0.5 ${highlight ? 'text-[var(--color-primary)] text-lg' : ''}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function Section({ title, entries }: { title: string; entries: { id: string; title: string; date: string; amount: number }[] }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-sm">{e.title}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{formatDateShort(e.date)}</p>
            </div>
            <p className="font-semibold amount-tabular text-sm">{formatCurrency(e.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
