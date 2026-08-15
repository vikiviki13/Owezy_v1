import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Check, ContactRound, LoaderCircle, X, Utensils, Plane, Film, ShoppingBag, Building2, MoreHorizontal, CalendarDays, CheckCircle2, Eye, MessageCircle } from 'lucide-react';
import { calculateFriendBalance, createFriend, createExpense, listFriends, getGroupMembers } from '../lib/db';
import { formatCurrency, roundCurrency, todayDate } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/ToastContext';
import { ExpenseCategory, SplitMode } from '../types';
import { consumeExpenseContactHandoff, createContactImportDraft, pickDeviceContacts, saveContactImportDraft } from '../lib/contactImport';
import { useSecurity } from '../components/SecurityContext';
import { buildExpenseWhatsAppMessage, expenseDateError, expenseDateLabel, shiftIsoDate } from '../lib/expenseDraft';
import { shareToWhatsApp } from '../lib/share';
import { BottomSheet } from '../components/BottomSheet';
import { ExpenseCalendar } from '../components/ExpenseCalendar';

const CATEGORIES: { key: ExpenseCategory; icon: React.ReactNode }[] = [
  { key: 'Food', icon: <Utensils size={16} /> },
  { key: 'Travel', icon: <Plane size={16} /> },
  { key: 'Movie', icon: <Film size={16} /> },
  { key: 'Shopping', icon: <ShoppingBag size={16} /> },
  { key: 'Stay', icon: <Building2 size={16} /> },
  { key: 'Other', icon: <MoreHorizontal size={16} /> },
];

interface SavedExpenseMessage {
  friendId: string;
  friendName: string;
  amount: number;
  pendingBalance: number;
  phone?: string;
  text: string;
}

interface SavedExpenseResult {
  expenseId: string;
  total: number;
  messages: SavedExpenseMessage[];
}

export function AddExpense() {
  const [params] = useSearchParams();
  const preselectFriend = params.get('friend');
  const groupId = params.get('group');
  const navigate = useNavigate();
  const toast = useToast();
  const { userId } = useSecurity();
  const [contactHandoff] = useState(() => params.get('contactImport') === '1' ? consumeExpenseContactHandoff(userId) : undefined);
  const friends = listFriends();
  const newFriendIds = new Set(contactHandoff?.newFriendIds || []);
  const orderedFriends = newFriendIds.size
    ? [...friends].sort((a, b) => Number(newFriendIds.has(b.id)) - Number(newFriendIds.has(a.id)))
    : friends;

  const groupMemberIds = groupId ? getGroupMembers(groupId).map((f) => f.id) : [];
  const initialFriendIds = Array.from(new Set([
    ...(preselectFriend ? [preselectFriend] : []),
    ...groupMemberIds,
    ...(contactHandoff?.selectedFriendIds || []),
  ]));
  const [step, setStep] = useState<1 | 2 | 3>(contactHandoff?.newFriendIds.length ? 2 : 1);
  const [selected, setSelected] = useState<string[]>(initialFriendIds);
  const [search, setSearch] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const [total, setTotal] = useState('');
  const [includeOwner, setIncludeOwner] = useState(true);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => todayDate());
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [dateSheetMode, setDateSheetMode] = useState<'quick' | 'calendar'>('quick');
  const [savedExpense, setSavedExpense] = useState<SavedExpenseResult>();

  const filtered = orderedFriends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  function toggleFriend(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addNewFriend() {
    if (!newFriendName.trim()) return;
    const f = createFriend({ name: newFriendName.trim() });
    setSelected((s) => [...s, f.id]);
    setNewFriendName('');
  }

  async function importContacts() {
    setPickerBusy(true);
    setPickerError('');
    try {
      const contacts = await pickDeviceContacts();
      if (!contacts.length) return;
      const draft = createContactImportDraft(contacts, 'expense', userId, selected);
      await saveContactImportDraft(draft);
      navigate('/friends/import?from=expense');
    } catch (caught) {
      setPickerError(caught instanceof Error ? caught.message : 'Contacts could not be opened.');
    } finally {
      setPickerBusy(false);
    }
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

    const reason = title.trim() || category;
    try {
      const expense = createExpense({
        title: reason,
        category,
        merchant_name: merchant.trim() || undefined,
        total_amount: totalNum,
        owner_share: ownerShare,
        expense_date: date,
        notes: notes.trim() || undefined,
        split_mode: splitMode,
        participants,
      });

      const messages = participants.flatMap((participant) => {
        const friend = friends.find((candidate) => candidate.id === participant.friend_id);
        if (!friend) return [];
        const pendingBalance = calculateFriendBalance(friend.id).pending;
        return [{
          friendId: friend.id,
          friendName: friend.nickname?.trim() || friend.name,
          amount: participant.share_amount,
          pendingBalance,
          phone: friend.whatsapp_number || friend.whatsapp_e164 || friend.phone || friend.phone_number,
          text: buildExpenseWhatsAppMessage({
            friend,
            amount: participant.share_amount,
            reason,
            expenseDate: date,
            pendingBalance,
          }),
        }];
      });

      setSavedExpense({ expenseId: expense.id, total: totalNum, messages });
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not add this expense.');
    }
  }

  function chooseDate(nextDate: string) {
    if (expenseDateError(nextDate)) return;
    setDate(nextDate);
    setDateSheetOpen(false);
    setDateSheetMode('quick');
  }

  const canProceedStep1 = selected.length > 0;
  const canProceedStep2 = totalNum > 0 && (splitMode === 'equal' || customDiff === 0);

  if (savedExpense) {
    return (
      <div className="min-h-screen px-4 pt-10 pb-8 safe-top flex flex-col">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center text-center">
          <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <CheckCircle2 size={34} />
          </span>
          <h1 className="text-2xl font-bold">Expense Added Successfully</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {formatCurrency(savedExpense.total)} was saved for {expenseDateLabel(date)}.
          </p>

          <div className="mt-7 flex flex-col gap-3 text-left">
            {savedExpense.messages.map((message) => (
              <div key={message.friendId} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="font-semibold"><span className="amount-tabular">{formatCurrency(message.amount)}</span> added for {message.friendName}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Pending balance: <span className="amount-tabular">{formatCurrency(message.pendingBalance)}</span></p>
                <button
                  onClick={() => shareToWhatsApp(message.text, message.phone)}
                  disabled={!message.phone}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white font-medium rounded-xl py-3 disabled:opacity-40"
                >
                  <MessageCircle size={16} />
                  {savedExpense.messages.length === 1 ? 'Send on WhatsApp' : `Send on WhatsApp — ${message.friendName}`}
                </button>
                {!message.phone && <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">No WhatsApp number is saved for this friend.</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-7 flex w-full max-w-sm flex-col gap-2">
          <button onClick={() => navigate(`/expense/${savedExpense.expenseId}`)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] font-medium py-3.5">
            <Eye size={16} /> View Expense
          </button>
          <button onClick={() => navigate('/')} className="w-full rounded-xl py-3.5 text-[var(--color-text-secondary)] font-medium">
            Done
          </button>
        </div>
      </div>
    );
  }

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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends" className="input !pl-9" />
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selected.map((id) => {
                const f = friends.find((x) => x.id === id);
                if (!f) return null;
                return (
                  <button key={id} onClick={() => toggleFriend(id)} className="min-h-10 flex items-center gap-1.5 bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)] text-sm font-medium px-3 rounded-full">
                    {f.name} <X size={14} aria-hidden="true" />
                  </button>
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

          <button
            onClick={() => void importContacts()}
            disabled={pickerBusy}
            className="mb-4 min-h-14 w-full flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-left disabled:opacity-50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              {pickerBusy ? <LoaderCircle size={20} className="animate-spin" /> : <ContactRound size={20} />}
            </span>
            <span className="flex-1"><span className="block font-semibold">Import Contacts</span><span className="block text-xs leading-5 text-[var(--color-text-muted)]">Add and select several friends at once</span></span>
          </button>
          {pickerError && <p role="alert" className="mb-4 text-sm leading-5 text-[var(--color-error)]">{pickerError}</p>}

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

          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">Expense date</p>
            <button
              type="button"
              onClick={() => setDateSheetOpen(true)}
              className="w-full flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 font-medium"
            >
              <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[var(--color-text-secondary)]" />{expenseDateLabel(date)}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Change</span>
            </button>
          </div>

          <div className="bg-[var(--color-surface-secondary)] rounded-xl p-3 mb-6 text-sm text-[var(--color-text-secondary)]">
            {expenseDateLabel(date)} · Paid by you · {formatCurrency(totalNum)} total
          </div>

          <button onClick={save} className="w-full bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5">
            Add Expense
          </button>
        </div>
      )}

      <BottomSheet open={dateSheetOpen} onClose={() => { setDateSheetOpen(false); setDateSheetMode('quick'); }} title="Expense date">
        <div className="flex flex-col gap-2">
          {(['today', 'yesterday', 'custom'] as const).map((option) => {
            const value = option === 'today' ? todayDate() : option === 'yesterday' ? shiftIsoDate(todayDate(), -1) : undefined;
            const label = option === 'today' ? 'Today' : option === 'yesterday' ? 'Yesterday' : 'Select Date';
            const isActive = value ? date === value : false;
            return (
              <button
                key={option}
                type="button"
                onClick={() => option === 'custom' ? setDateSheetMode('calendar') : chooseDate(value!)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3.5 font-medium text-left
                  ${isActive ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
              >
                {label}
                {isActive && <Check size={16} />}
              </button>
            );
          })}
          {dateSheetMode === 'calendar' && (
            <div className="mt-2 border-t border-[var(--color-border)] pt-4">
              <ExpenseCalendar
                selected={date}
                onSelect={(nextDate) => {
                  if (expenseDateError(nextDate)) return;
                  chooseDate(nextDate);
                }}
              />
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
