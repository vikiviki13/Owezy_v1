import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { calculateFriendBalance, listExpensesForFriend, listFriends, recordRepayment, getExpenseParticipants } from '../lib/db';
import { formatCurrency } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { PaymentMethod } from '../types';

const METHODS: PaymentMethod[] = ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other'];

export function RecordRepayment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const friends = listFriends();

  const [friendId, setFriendId] = useState(params.get('friend') || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [mode, setMode] = useState<'general' | 'specific'>('general');
  const [expenseId, setExpenseId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(!friendId);

  const balance = friendId ? calculateFriendBalance(friendId) : null;
  const pendingExpenses = friendId ? listExpensesForFriend(friendId).filter((e) => e.status !== 'settled') : [];

  const amountNum = parseFloat(amount) || 0;
  const maxAmount = balance?.pending ?? 0;
  const overpaying = mode === 'general' && amountNum > maxAmount && maxAmount > 0;

  function save() {
    if (!friendId || amountNum <= 0) return;
    const friend = friends.find((f) => f.id === friendId);
    recordRepayment({
      friend_id: friendId,
      amount: amountNum,
      payment_method: method,
      expense_id: mode === 'specific' ? expenseId || undefined : undefined,
      transaction_reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    const updated = calculateFriendBalance(friendId);
    toast(`${formatCurrency(amountNum)} received from ${friend?.name}. Updated balance: ${formatCurrency(Math.max(updated.pending, 0))} pending`);
    navigate(`/friends/${friendId}`);
  }

  if (pickerOpen) {
    return (
      <div className="px-4 pt-6 safe-top">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-semibold text-lg">Record Repayment</h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">Who paid you back?</p>
        <div className="flex flex-col gap-1">
          {friends.map((f) => {
            const b = calculateFriendBalance(f.id);
            return (
              <button
                key={f.id}
                onClick={() => { setFriendId(f.id); setPickerOpen(false); }}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-secondary)] text-left"
              >
                <Avatar name={f.name} size={40} />
                <span className="flex-1 font-medium">{f.name}</span>
                <span className="text-sm text-[var(--color-text-muted)] amount-tabular">{formatCurrency(b.pending)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const friend = friends.find((f) => f.id === friendId);

  return (
    <div className="px-4 pt-6 pb-8 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPickerOpen(true)} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <Avatar name={friend?.name || ''} size={36} />
        <div>
          <h1 className="font-semibold">{friend?.name}</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Owes you {formatCurrency(balance?.pending || 0)}</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-2">Amount received</p>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-3xl font-bold text-[var(--color-text-muted)]">₹</span>
        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          inputMode="decimal"
          className="text-4xl font-extrabold bg-transparent outline-none w-full amount-tabular"
        />
      </div>
      {maxAmount > 0 && (
        <button onClick={() => setAmount(String(maxAmount))} className="text-xs font-medium text-[var(--color-primary)] mb-4">
          Mark full amount ({formatCurrency(maxAmount)})
        </button>
      )}
      {overpaying && <p className="text-xs text-[var(--color-warning)] mb-4">This is more than what {friend?.name} currently owes.</p>}

      <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Payment method</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${method === m ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Apply to</p>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('general')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'general' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}>
          General repayment
        </button>
        <button onClick={() => setMode('specific')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'specific' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}>
          Specific expense
        </button>
      </div>

      {mode === 'specific' && (
        <div className="flex flex-col gap-2 mb-5">
          {pendingExpenses.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No pending expenses for this friend.</p>
          ) : (
            pendingExpenses.map((e) => {
              const part = getExpenseParticipants(e.id).find((p) => p.friend_id === friendId);
              return (
                <button
                  key={e.id}
                  onClick={() => setExpenseId(e.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left ${expenseId === e.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]'}`}
                >
                  <span className="font-medium text-sm">{e.title}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {formatCurrency(part?.pending_amount || 0)} pending
                    {expenseId === e.id && <Check size={14} className="text-[var(--color-primary)]" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference (optional)" className="input mb-3" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="input resize-none mb-6" />

      <button
        onClick={save}
        disabled={amountNum <= 0 || (mode === 'specific' && !expenseId)}
        className="w-full bg-[var(--color-primary)] disabled:opacity-40 text-white font-medium rounded-xl py-3.5"
      >
        Record Repayment
      </button>
    </div>
  );
}
