import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Check, Utensils, Plane, Film, ShoppingBag, Building2, MoreHorizontal, UserPlus, CalendarDays, CheckCircle2, ContactRound, Eye, MessageCircle } from 'lucide-react';
import { calculateFriendBalance, createExpense, listFriends, getGroupMembers } from '../lib/db';
import { currencySymbol, formatCurrency, roundCurrency, todayDate } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/ToastContext';
import { ExpenseCategory, SplitMode } from '../types';
import { AddFriendForm } from '../components/AddFriendForm';
import { buildExpenseWhatsAppMessage, dateToIso, expenseDateError, expenseDateLabel, isoToDate } from '../lib/expenseDraft';
import { shareToWhatsApp } from '../lib/share';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Switch } from '../components/ui/switch';
import { ContactImportFlow, type ImportedFriendDraft } from '../components/contacts/ContactImportFlow';

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
  const friends = listFriends();
  const scopedFriend = preselectFriend ? friends.find((friend) => friend.id === preselectFriend) : undefined;
  const isFriendScoped = Boolean(scopedFriend && !groupId);

  const groupMemberIds = groupId ? getGroupMembers(groupId).map((f) => f.id) : [];
  const [step, setStep] = useState<1 | 2 | 3>(isFriendScoped ? 2 : 1);
  const [selected, setSelected] = useState<string[]>(scopedFriend ? [scopedFriend.id] : groupMemberIds);
  const [search, setSearch] = useState('');
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [contactImportOpen, setContactImportOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ImportedFriendDraft>();

  const [total, setTotal] = useState('');
  const [includeOwner, setIncludeOwner] = useState(true);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => todayDate());
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [savedExpense, setSavedExpense] = useState<SavedExpenseResult>();

  const filtered = friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  function toggleFriend(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
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
          phone: friend.whatsapp_number,
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

  const canProceedStep1 = selected.length > 0;
  const canProceedStep2 = totalNum > 0 && (splitMode === 'equal' || customDiff === 0);

  if (savedExpense) {
    return (
      <div className="min-h-screen px-4 pt-10 pb-8 safe-top flex flex-col">
        <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center text-center">
          <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 size={34} />
          </span>
          <h1 className="text-2xl font-bold">Expense Added Successfully</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCurrency(savedExpense.total)} was saved with the selected expense date.
          </p>

          <div className="mt-7 flex flex-col gap-3 text-left">
            {savedExpense.messages.map((message) => (
              <div key={message.friendId} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-semibold"><span className="amount-tabular">{formatCurrency(message.amount)}</span> added for {message.friendName}</p>
                <p className="mt-1 text-xs text-muted-foreground">Pending balance: <span className="amount-tabular">{formatCurrency(message.pendingBalance)}</span></p>
                <Button
                  className="mt-4 w-full"
                  disabled={!message.phone}
                  onClick={() => shareToWhatsApp(message.text, message.phone)}
                >
                  <MessageCircle />
                  {savedExpense.messages.length === 1 ? 'Send on WhatsApp' : `Send on WhatsApp — ${message.friendName}`}
                </Button>
                {!message.phone && <p className="mt-2 text-center text-xs text-muted-foreground">No WhatsApp number is saved for this friend.</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-7 flex w-full max-w-sm flex-col gap-2">
          <Button variant="outline" onClick={() => navigate(`/expense/${savedExpense.expenseId}`)}><Eye />View Expense</Button>
          <Button variant="ghost" onClick={() => navigate('/home')}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8 safe-top min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => (step === 1 || (isFriendScoped && step === 2) ? navigate(-1) : setStep((s) => (s - 1) as 1 | 2))} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
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
                <Avatar name={f.name} src={f.avatar_url} size={38} />
                <span className="flex-1 font-medium">{f.name}</span>
                {selected.includes(f.id) && (
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                    <Check size={13} className="text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <button onClick={() => setAddFriendOpen(true)} className="w-full min-h-12 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] font-semibold text-sm flex items-center justify-center gap-2">
              <UserPlus size={18} /> Add New Friend
            </button>
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setContactImportOpen(true)}>
              <ContactRound />Import from Contacts
            </Button>
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
            <span className="text-3xl font-bold text-[var(--color-text-muted)]">{currencySymbol()}</span>
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
            <label htmlFor="include-owner" className="text-sm font-medium">Include my share</label>
            <Switch id="include-owner" checked={includeOwner} onCheckedChange={setIncludeOwner} />
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
            <p className="mb-2 text-sm font-medium text-muted-foreground">Expense date</p>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between rounded-xl bg-card font-medium"
              onClick={() => setDateDialogOpen(true)}
            >
              <span className="flex items-center gap-2"><CalendarDays />{expenseDateLabel(date)}</span>
              <span className="text-xs text-muted-foreground">Change</span>
            </Button>
          </div>

          <div className="bg-secondary rounded-xl p-3 mb-6 text-sm text-muted-foreground">
            {expenseDateLabel(date)} · Paid by you · <span className="amount-tabular">{formatCurrency(totalNum)}</span> total
          </div>

          <button onClick={save} className="w-full bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5">
            Add Expense
          </button>
        </div>
      )}

      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Select expense date</DialogTitle>
            <DialogDescription>Choose today or any earlier date. Future dates are unavailable.</DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={isoToDate(date)}
            defaultMonth={isoToDate(date)}
            disabled={{ after: isoToDate(todayDate()) }}
            onSelect={(selectedDate) => {
              if (!selectedDate) return;
              const nextDate = dateToIso(selectedDate);
              if (expenseDateError(nextDate)) return;
              setDate(nextDate);
              setDateDialogOpen(false);
            }}
            className="mx-auto"
          />
        </DialogContent>
      </Dialog>

      <Sheet open={addFriendOpen} onOpenChange={(open) => { setAddFriendOpen(open); if (!open) setContactDraft(undefined); }}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl px-4 pb-6">
          <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
          <SheetHeader className="px-0 pb-2 text-left">
            <SheetTitle>Add New Friend</SheetTitle>
            <SheetDescription>Create a friend and select them for this expense.</SheetDescription>
          </SheetHeader>
          <AddFriendForm
            initialContact={contactDraft}
            submitLabel="Save and Continue"
            onExistingFriendSelected={(friend) => {
              setSelected((current) => current.includes(friend.id) ? current : [...current, friend.id]);
              setAddFriendOpen(false);
              setContactDraft(undefined);
              setStep(2);
              toast(`${friend.name} selected`);
            }}
            onCreated={(friend) => {
              setSelected((current) => current.includes(friend.id) ? current : [...current, friend.id]);
              setAddFriendOpen(false);
              setContactDraft(undefined);
              setStep(2);
              toast(`${friend.name} added and selected`);
            }}
          />
        </SheetContent>
      </Sheet>
      <ContactImportFlow
        open={contactImportOpen}
        onOpenChange={setContactImportOpen}
        onContactSelected={(draft) => { setContactDraft(draft); setContactImportOpen(false); setAddFriendOpen(true); }}
        onExistingFriendSelected={(friend) => {
          setSelected((current) => current.includes(friend.id) ? current : [...current, friend.id]);
          setContactImportOpen(false);
          setStep(2);
          toast(`${friend.name} selected`);
        }}
        onAddManually={() => setAddFriendOpen(true)}
      />
    </div>
  );
}
