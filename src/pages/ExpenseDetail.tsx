import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Share2, Pencil } from 'lucide-react';
import { deleteExpense, getExpense, getExpenseParticipants, getFriend, updateExpense } from '../lib/db';
import { formatCurrency, formatDate, formatTime, formatTimestamp } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastContext';
import { nativeShare } from '../lib/share';

export function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  if (!id) return null;
  const expense = getExpense(id);
  if (!expense) return <div className="p-6 text-center text-[var(--color-text-muted)]">Expense not found.</div>;

  const participants = getExpenseParticipants(id);
  const paidByMe = expense.payment_contributions?.filter((payment) => payment.payer_id === 'owner').reduce((sum, payment) => sum + payment.amount, 0) ?? expense.total_amount;
  const paidByFriends = expense.total_amount - paidByMe;
  const payerLabel = expense.payer_type === 'friend' ? getFriend(expense.payer_friend_id || '')?.name || 'Friend' : expense.payer_type === 'multiple' ? 'Multiple people' : 'Me';

  async function handleShare() {
    if (!expense) return;
    const lines = [
      `${expense.title} — ${formatCurrency(expense.total_amount)}`,
      `Paid by ${payerLabel} on ${formatDate(expense.expense_date)}`,
      '',
      ...participants.map((p) => `${getFriend(p.friend_id)?.name}: ${formatCurrency(p.share_amount)} (${p.status})`),
    ];
    await nativeShare(lines.join('\n'), expense.title);
    toast('Ready to share');
  }

  function handleDelete() {
    if (!expense) return;
    deleteExpense(expense.id);
    toast('Expense deleted');
    navigate(-1);
  }

  function handleEditSave() {
    if (!expense) return;
    updateExpense(expense.id, { title: editName.trim() || expense.category });
    setEditOpen(false);
    toast('Expense name updated');
  }

  return (
    <div className="px-4 pt-6 pb-8 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold">{expense.title}</h1>
          <p className="text-xs text-[var(--color-text-muted)]">{expense.occurred_at ? formatTimestamp(expense.occurred_at) : `${formatDate(expense.expense_date)} · ${formatTime(expense.expense_time)}`}</p>
        </div>
        <StatusBadge status={expense.status} />
      </div>

      <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-5 text-center">
        <p className="text-3xl font-extrabold amount-tabular">{formatCurrency(expense.total_amount)}</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Paid by {payerLabel}{expense.merchant_name ? ` at ${expense.merchant_name}` : ''}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Metric label="My share" value={expense.owner_share} />
        <Metric label="Friends' share" value={expense.recoverable_amount} />
        <Metric label="Paid by me" value={paidByMe} />
        <Metric label={paidByFriends > 0 ? 'Paid by friends' : 'Recoverable'} value={paidByFriends > 0 ? paidByFriends : expense.recoverable_amount} />
      </div>

      <p className="text-sm font-semibold mb-2">Participants</p>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] mb-6">
        <div className="flex items-center justify-between p-4">
          <span className="font-medium text-sm">You</span>
          <span className="font-semibold amount-tabular text-sm">{formatCurrency(expense.owner_share)}</span>
        </div>
        {participants.map((p) => {
          const f = getFriend(p.friend_id);
          if (!f) return null;
          return (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <Avatar name={f.name} size={32} />
              <div className="flex-1">
                <p className="font-medium text-sm">{f.name}</p>
                {p.paid_amount > 0 && p.pending_amount > 0 && (
                  <p className="text-[11px] text-[var(--color-text-muted)]">Received {formatCurrency(p.paid_amount)} · Pending {formatCurrency(p.pending_amount)}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold amount-tabular text-sm">{formatCurrency(p.share_amount)}</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
          );
        })}
      </div>

      {expense.notes && (
        <div className="mb-6">
          <p className="text-sm font-semibold mb-1">Notes</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{expense.notes}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => { setEditName(expense.title); setEditOpen(true); }} className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-medium rounded-xl py-3">
          <Pencil size={16} /> Edit
        </button>
        <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-medium rounded-xl py-3">
          <Share2 size={16} /> Share
        </button>
        <button onClick={() => setConfirmDelete(true)} className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-[var(--color-error)] font-medium rounded-xl py-3">
          <Trash2 size={16} /> Delete
        </button>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditOpen(false)} />
          <div className="relative bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold mb-3">Edit Expense Name</p>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Barbeque Nation, Taj Hotel, PVR" className="input" autoFocus />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] font-medium text-sm">Cancel</button>
              <button onClick={handleEditSave} className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-medium text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-xs">
            <p className="font-semibold mb-1">Delete this expense?</p>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">This can't be undone. Balances will recalculate.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] font-medium text-sm">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-[var(--color-error)] text-white font-medium text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-1 font-semibold amount-tabular">{formatCurrency(value)}</p></div>;
}
