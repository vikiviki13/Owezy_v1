import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Check, Utensils, Plane, Film, ShoppingBag, Building2, MoreHorizontal } from 'lucide-react';
import { createFriend, createExpense, listFriends, getGroupMembers } from '../lib/db';
import { formatCurrency, roundCurrency, todayDate } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/ToastContext';
import { ExpenseCategory, SplitMode } from '../types';

const CATEGORIES: { key: ExpenseCategory; icon: React.ReactNode }[] = [
  { key: 'Food', icon: <Utensils size={16} /> },
  { key: 'Travel', icon: <Plane size={16} /> },
  { key: 'Movie', icon: <Film size={16} /> },
  { key: 'Shopping', icon: <ShoppingBag size={16} /> },
  { key: 'Stay', icon: <Building2 size={16} /> },
  { key: 'Other', icon: <MoreHorizontal size={16} /> },
];

export function AddExpense() {
  const [params] = useSearchParams();
  const preselectFriend = params.get('friend');
  const groupId = params.get('group');
  const navigate = useNavigate();
  const toast = useToast();
  const friends = listFriends();

  const groupMemberIds = groupId ? getGroupMembers(groupId).map((f) => f.id) : [];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<string[]>(preselectFriend ? [preselectFriend] : groupMemberIds);
  const [search, setSearch] = useState('');
  const [newFriendName, setNewFriendName] = useState('');

  const [total, setTotal] = useState('');
  const [includeOwner, setIncludeOwner] = useState(true);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [date] = useState(todayDate());

  const filtered = friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  function toggleFriend(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addNewFriend() {
    if (!newFriendName.trim()) return;
    const f = createFriend({ name: newFriendName.trim() });
    setSelected((s) => [...s, f.id]);
    setNewFriendName('');
  }

  const totalNum = parseFloat(total) || 0;
  const participantCount = selected.length + (includeOwner ? 1 : 0);

  const equalShares = useMemo(() => {
    if (participantCount === 0) return {};
    const each = roundCurrency(totalNum / participantCount);
    const shares: Record<string, number> = {};
    let running = 0;
    selected.forEach((id, i) => {
      const share = i === selected.length - 1 && !includeOwner ? roundCurrency(totalNum - running) : each;
      shares[id] = share;
      running = roundCurrency(running + share);
    });
    return shares;
  }, [selected, totalNum, includeOwner, participantCount]);

  const ownerShareEqual = includeOwner ? roundCurrency(totalNum - selected.reduce((s, id) => s + (equalShares[id] || 0), 0)) : 0;

  const customTotal = selected.reduce((s, id) => s + (parseFloat(customShares[id]) || 0), 0);
  const ownerCustom = parseFloat(customShares['__owner__']) || 0;
  const customAssigned = roundCurrency(customTotal + ownerCustom);
  const customDiff = roundCurrency(totalNum - customAssigned);

  function save() {
    const participants = selected.map((id) => ({
      friend_id: id,
      share_amount: splitMode === 'equal' ? equalShares[id] || 0 : parseFloat(customShares[id]) || 0,
    }));
    const ownerShare = splitMode === 'equal' ? ownerShareEqual : ownerCustom;

    createExpense({
      title: title.trim() || category,
      category,
      merchant_name: merchant.trim() || undefined,
      total_amount: totalNum,
      owner_share: ownerShare,
      expense_date: date,
      notes: notes.trim() || undefined,
      split_mode: splitMode,
      participants,
    });

    const friendNames = selected.map((id) => friends.find((f) => f.id === id)?.name).filter(Boolean).join(', ');
    toast(`${formatCurrency(totalNum)} added for ${friendNames}`);
    navigate('/');
  }

  const canProceedStep1 = selected.length > 0;
  const canProceedStep2 = totalNum > 0 && (splitMode === 'equal' || customDiff === 0);

  return (
    <div className="px-4 pt-6 pb-8 safe-top min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => (step === 1 ? navigate(-1) : setStep((s) => (s - 1) as 1 | 2))} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-lg">Add Expense</h1>
        <div className="ml-auto flex gap-1">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 rounded-full transition-all ${n === step ? 'w-6 bg-[var(--color-primary)]' : 'w-1.5 bg-[var(--color-border)]'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">Who's this for?</p>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends" className="input pl-9" />
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selected.map((id) => {
                const f = friends.find((x) => x.id === id);
                if (!f) return null;
                return (
                  <span key={id} onClick={() => toggleFriend(id)} className="flex items-center gap-1.5 bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)] text-sm font-medium px-3 py-1.5 rounded-full cursor-pointer">
                    {f.name} ✕
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-1 mb-4">
            {filtered.map((f) => (
              <button key={f.id} onClick={() => toggleFriend(f.id)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface-secondary)] text-left">
                <Avatar name={f.name} size={38} />
                <span className="flex-1 font-medium">{f.name}</span>
                {selected.includes(f.id) && (
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                    <Check size={13} className="text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
            <input
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              placeholder="Add a new friend by name"
              className="input"
              onKeyDown={(e) => e.key === 'Enter' && addNewFriend()}
            />
            <button onClick={addNewFriend} className="shrink-0 px-4 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] font-medium text-sm">Add</button>
          </div>

          <button
            disabled={!canProceedStep1}
            onClick={() => setStep(2)}
            className="w-full mt-6 bg-[var(--color-primary)] disabled:opacity-40 text-white font-medium rounded-xl py-3.5 sticky bottom-4"
          >
            Continue {selected.length > 0 && `(${selected.length} selected)`}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">Total bill amount</p>
          <div className="flex items-center gap-1 mb-6">
            <span className="text-3xl font-bold text-[var(--color-text-muted)]">₹</span>
            <input
              autoFocus
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              inputMode="decimal"
              className="text-4xl font-extrabold bg-transparent outline-none w-full amount-tabular"
            />
          </div>

          <div className="flex items-center justify-between bg-[var(--color-surface-secondary)] rounded-xl p-3 mb-4">
            <span className="text-sm font-medium">Include my share</span>
            <button
              onClick={() => setIncludeOwner((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${includeOwner ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${includeOwner ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            {(['equal', 'custom'] as SplitMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSplitMode(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${splitMode === m ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
              >
                {m} split
              </button>
            ))}
          </div>

          {splitMode === 'equal' && totalNum > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {includeOwner && (
                <div className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
                  <span className="font-medium text-sm">You</span>
                  <span className="font-semibold amount-tabular text-sm">{formatCurrency(ownerShareEqual)}</span>
                </div>
              )}
              {selected.map((id) => {
                const f = friends.find((x) => x.id === id);
                return (
                  <div key={id} className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
                    <span className="font-medium text-sm">{f?.name}</span>
                    <span className="font-semibold amount-tabular text-sm">{formatCurrency(equalShares[id] || 0)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {splitMode === 'custom' && (
            <div className="flex flex-col gap-2 mb-2">
              {includeOwner && (
                <div className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
                  <span className="font-medium text-sm">You</span>
                  <input
                    value={customShares['__owner__'] || ''}
                    onChange={(e) => setCustomShares((s) => ({ ...s, __owner__: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder="0"
                    inputMode="decimal"
                    className="w-24 text-right font-semibold bg-transparent outline-none amount-tabular"
                  />
                </div>
              )}
              {selected.map((id) => {
                const f = friends.find((x) => x.id === id);
                return (
                  <div key={id} className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
                    <span className="font-medium text-sm">{f?.name}</span>
                    <input
                      value={customShares[id] || ''}
                      onChange={(e) => setCustomShares((s) => ({ ...s, [id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-24 text-right font-semibold bg-transparent outline-none amount-tabular"
                    />
                  </div>
                );
              })}
              {totalNum > 0 && (
                <p className={`text-sm text-center mt-1 ${customDiff === 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-error)]'}`}>
                  {customDiff === 0 ? 'Fully assigned' : `${customDiff > 0 ? 'Unassigned' : 'Over by'} ${formatCurrency(Math.abs(customDiff))}`}
                </p>
              )}
            </div>
          )}

          <button
            disabled={!canProceedStep2}
            onClick={() => setStep(3)}
            className="w-full mt-4 bg-[var(--color-primary)] disabled:opacity-40 text-white font-medium rounded-xl py-3.5"
          >
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">What was it for?</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => { setCategory(c.key); if (!title) setTitle(c.key); }}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${category === c.key ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
              >
                {c.icon}
                <span className="text-xs font-medium">{c.key}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Dinner at Truffles)" className="input" />
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Restaurant / place (optional)" className="input" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="input resize-none" />
          </div>

          <div className="bg-[var(--color-surface-secondary)] rounded-xl p-3 mb-6 text-sm text-[var(--color-text-secondary)]">
            Today, now · Paid by you · {formatCurrency(totalNum)} total
          </div>

          <button onClick={save} className="w-full bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5">
            Add Expense
          </button>
        </div>
      )}
    </div>
  );
}
