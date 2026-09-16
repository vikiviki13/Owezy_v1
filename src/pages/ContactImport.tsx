import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  UserRoundPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import {
  classifyContactDraft,
  clearContactImportDraft,
  createContactImportDraft,
  formatE164,
  loadContactImportDraft,
  pickDeviceContacts,
  saveContactImportDraft,
  saveExpenseContactHandoff,
  type ContactImportDraft,
  type ContactImportItem,
  type ContactImportOrigin,
  type ContactReviewItem,
  type ContactReviewStatus,
} from '../lib/contactImport';
import {
  createImportedFriendsBatch,
  type FriendImportFailure,
  type FriendImportSuccess,
} from '../lib/friendImportService';
import { listFriends } from '../lib/db';
import { useSecurity } from '../components/SecurityContext';

type Phase = 'select' | 'saving' | 'result' | 'success';
type ReviewFilter = 'all' | 'ready' | 'already' | 'attention';

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function ContactImport({ initialDraft }: { initialDraft?: ContactImportDraft } = {}) {
  const navigate = useNavigate();
  const { userId } = useSecurity();
  const [params] = useSearchParams();
  const routeOrigin: ContactImportOrigin = params.get('from') === 'expense' ? 'expense' : 'friends';
  const [origin, setOrigin] = useState<ContactImportOrigin>(initialDraft?.origin || routeOrigin);
  const [expenseBaseIds, setExpenseBaseIds] = useState<string[]>(initialDraft?.expenseFriendIds || []);
  const [draft, setDraft] = useState<ContactImportDraft | undefined>(initialDraft);
  const [phase, setPhase] = useState<Phase>('select');
  const [loading, setLoading] = useState(!initialDraft);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [editingId, setEditingId] = useState<string>();
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [lastFailures, setLastFailures] = useState<FriendImportFailure[]>([]);
  const [completed, setCompleted] = useState<FriendImportSuccess[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);

  useEffect(() => {
    if (initialDraft) return;
    let active = true;
    void loadContactImportDraft(userId)
      .then((stored) => {
        if (!active) return;
        if (stored) {
          setDraft(stored);
          setOrigin(stored.origin);
          setExpenseBaseIds(stored.expenseFriendIds);
        } else {
          const now = Date.now();
          setDraft({ version: 2, ownerUserId: userId, origin: routeOrigin, expenseFriendIds: [], items: [], savedAt: new Date(now).toISOString(), expiresAt: new Date(now + 30 * 60_000).toISOString() });
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialDraft, routeOrigin, userId]);

  useEffect(() => {
    if (!draft?.items.length || phase === 'success') return;
    const timeout = window.setTimeout(() => { void saveContactImportDraft(draft); }, 250);
    return () => window.clearTimeout(timeout);
  }, [draft, phase]);

  const friends = listFriends();
  const reviews = useMemo(
    () => classifyContactDraft(draft?.items || [], friends, failures),
    [draft?.items, failures, friends],
  );
  const selectedCount = reviews.filter((review) => review.item.included).length;
  const ready = reviews.filter((review) => review.status === 'ready');
  const already = reviews.filter((review) => review.item.included && review.status === 'already');
  const attention = reviews.filter((review) => review.item.included && (review.status === 'attention' || review.status === 'failed'));

  const visibleReviews = reviews.filter((review) => {
    const haystack = `${review.item.name} ${review.item.phones.map((phone) => phone.value).join(' ')} ${review.item.manualPhone}`.toLowerCase();
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'attention') return review.status === 'attention' || review.status === 'failed';
    return review.status === filter;
  });

  const updateItem = useCallback((id: string, patch: Partial<ContactImportItem>) => {
    setDraft((value) => value ? { ...value, items: value.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : value);
    setFailures((value) => {
      if (!value[id]) return value;
      const next = { ...value };
      delete next[id];
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setDraft((value) => value ? { ...value, items: value.items.filter((item) => item.id !== id) } : value);
    setEditingId((value) => value === id ? undefined : value);
  }, []);

  const chooseContacts = useCallback(async () => {
    setPickerBusy(true);
    setPickerError('');
    try {
      const contacts = await pickDeviceContacts();
      if (!contacts.length) return;
      const next = createContactImportDraft(contacts, origin, userId, expenseBaseIds);
      setDraft((current) => ({
        ...next,
        items: [...(current?.items || []), ...next.items],
      }));
    } catch (caught) {
      setPickerError(caught instanceof Error ? caught.message : 'Contacts could not be opened.');
    } finally {
      setPickerBusy(false);
    }
  }, [expenseBaseIds, origin, userId]);

  const continueToExpense = useCallback((newFriends = completed) => {
    if (!newFriends.length) return;
    const newFriendIds = newFriends.map((result) => result.friend.id);
    saveExpenseContactHandoff(userId, {
      selectedFriendIds: Array.from(new Set([...expenseBaseIds, ...newFriendIds])),
      newFriendIds,
    });
    navigate('/add-expense?contactImport=1', { replace: true });
  }, [completed, expenseBaseIds, navigate, userId]);

  useEffect(() => {
    if (phase !== 'success' || origin !== 'expense' || !completed.length) return;
    const timeout = window.setTimeout(() => continueToExpense(completed), 900);
    return () => window.clearTimeout(timeout);
  }, [completed, continueToExpense, origin, phase]);

  const runImport = useCallback(async (itemsToImport: ContactReviewItem[]) => {
    if (!itemsToImport.length) return;
    setPhase('saving');
    const result = await createImportedFriendsBatch(itemsToImport.map((review) => ({
      clientId: review.item.id,
      name: review.item.name.trim(),
      nickname: review.item.nickname?.trim() || undefined,
      whatsappE164: review.whatsappE164 || '',
      phoneNumber: review.rawPhone || review.whatsappE164 || '',
      email: review.item.email?.trim() || undefined,
    })));

    const allCompleted = [...completed, ...result.successes].filter(
      (entry, index, values) => values.findIndex((candidate) => candidate.friend.id === entry.friend.id) === index,
    );
    setCompleted(allCompleted);

    if (result.failures.length) {
      const nextFailures = Object.fromEntries(result.failures.map((failure) => [failure.clientId, failure.reason]));
      setFailures(nextFailures);
      setLastFailures(result.failures);
      setDraft((value) => value ? {
        ...value,
        items: value.items.filter((item) => result.failures.some((failure) => failure.clientId === item.id)),
      } : value);
      setPhase('result');
      return;
    }

    setLastFailures([]);
    setDraft((value) => value ? { ...value, items: [] } : value);
    await clearContactImportDraft(userId);
    setPhase('success');
  }, [completed, userId]);

  function requestImport() {
    if (selectedCount > 20) {
      setConfirmLarge(true);
      return;
    }
    void runImport(ready);
  }

  function retryFailed() {
    const retryReviews = classifyContactDraft(draft?.items || [], listFriends());
      void runImport(retryReviews.filter((review) => review.status === 'ready'));
  }

  function finishFriends(destination: 'friends' | 'expense' | 'done') {
    const ids = completed.map((entry) => entry.friend.id);
    if (destination === 'expense') {
      saveExpenseContactHandoff(userId, { selectedFriendIds: ids, newFriendIds: ids });
      navigate('/add-expense?contactImport=1');
      return;
    }
    void clearContactImportDraft(userId);
    navigate(destination === 'friends' && ids.length ? `/friends?new=${ids.join(',')}` : '/friends');
  }

  function goBack() {
    void clearContactImportDraft(userId);
    navigate(origin === 'expense' ? '/add-expense' : '/friends');
  }

  if (loading) {
    return <div className="min-h-[70vh] grid place-items-center"><LoaderCircle className="animate-spin text-[var(--color-primary)]" aria-label="Loading selected contacts" /></div>;
  }

  if (phase === 'saving') {
    return (
      <main className="min-h-[72vh] px-5 grid place-items-center text-center safe-top">
        <div>
          <LoaderCircle size={36} className="animate-spin text-[var(--color-primary)] mx-auto mb-4" />
          <h1 className="text-xl font-bold">Adding your friends</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">Successful contacts are saved as they finish.</p>
        </div>
      </main>
    );
  }

  if (phase === 'success') {
    return (
      <main className="min-h-[72vh] px-5 grid place-items-center text-center safe-top">
        <div className="w-full max-w-sm">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <CheckCircle2 size={34} />
          </span>
          <h1 className="text-2xl font-bold">{plural(completed.length, 'friend')} added</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">They're ready for expenses and payments.</p>
          {origin === 'expense' ? (
            <button onClick={() => continueToExpense()} className="mt-8 min-h-12 w-full rounded-xl bg-[var(--color-primary)] text-white font-semibold">
              Continue to Expense
            </button>
          ) : (
            <div className="mt-8 flex flex-col gap-3">
              <button onClick={() => finishFriends('friends')} className="min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold">View Friends</button>
              <button onClick={() => finishFriends('expense')} className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold">Add Expense</button>
              <button onClick={() => finishFriends('done')} className="min-h-11 text-sm font-semibold text-[var(--color-text-secondary)]">Done</button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (phase === 'result') {
    const attempted = completed.length + lastFailures.length;
    return (
      <main className="px-4 pt-6 pb-10 safe-top min-h-screen">
         <button onClick={() => { setFailures({}); setPhase('select'); }} className="size-11 -ml-1 rounded-full grid place-items-center" aria-label="Back to selection"><ArrowLeft size={20} /></button>
        <div className="mt-3">
          <span className="grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><CircleAlert size={28} /></span>
          <h1 className="text-2xl font-bold mt-5">{completed.length} of {attempted} friends added</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">The friends below still need your attention. Everyone else remains added.</p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {lastFailures.map((failure) => (
            <div key={failure.clientId} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-start gap-3">
                <Avatar name={failure.name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{failure.name || 'Unnamed contact'} couldn't be added</p>
                  <p className="text-sm leading-5 text-[var(--color-error)] mt-1">{failure.reason}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 pl-[54px]">
                <button onClick={() => { setFailures({}); setEditingId(failure.clientId); setPhase('select'); }} className="min-h-11 px-4 rounded-xl border border-[var(--color-border)] text-sm font-semibold">Fix</button>
                <button onClick={retryFailed} className="min-h-11 px-4 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)] text-sm font-semibold inline-flex items-center gap-2"><RefreshCw size={15} /> Try Again</button>
              </div>
            </div>
          ))}
        </div>
        {completed.length > 0 && (
          <button onClick={() => origin === 'expense' ? continueToExpense() : finishFriends('friends')} className="mt-6 min-h-12 w-full rounded-xl bg-[var(--color-primary)] text-white font-semibold">
            {origin === 'expense' ? `Continue with ${plural(completed.length, 'friend')}` : 'View added friends'}
          </button>
        )}
      </main>
    );
  }

   return (
     <main className="min-h-screen px-4 pt-5 pb-36 safe-top">
       <header className="flex items-center gap-3">
         <button onClick={goBack} className="size-11 -ml-1 rounded-full grid place-items-center" aria-label="Go back"><ArrowLeft size={20} /></button>
         <div className="min-w-0 flex-1">
           <h1 className="text-xl font-bold">Add Friends</h1>
           <p className="text-sm text-[var(--color-text-secondary)]">{plural(selectedCount, 'contact')} selected</p>
         </div>
         <button onClick={() => void chooseContacts()} disabled={pickerBusy} className="min-h-11 px-3 rounded-xl text-sm font-semibold text-[var(--color-primary)] inline-flex items-center gap-2 disabled:opacity-50">
           {pickerBusy ? <LoaderCircle size={17} className="animate-spin" /> : <UserRoundPlus size={17} />} Add more
         </button>
       </header>

       {!draft?.items.length ? (
         <section className="min-h-[62vh] grid place-items-center text-center">
           <div className="max-w-sm">
             <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Users size={27} /></span>
             <h2 className="text-lg font-bold mt-4">Choose friends from your contacts</h2>
             <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">You can review and edit details before adding.</p>
             <button onClick={() => void chooseContacts()} disabled={pickerBusy} className="mt-6 min-h-12 px-5 rounded-xl bg-[var(--color-primary)] text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50">
               {pickerBusy ? <LoaderCircle size={18} className="animate-spin" /> : <Phone size={18} />} Select contacts
             </button>
             {pickerError && <p role="alert" className="text-sm leading-5 text-[var(--color-error)] mt-4">{pickerError}</p>}
           </div>
         </section>
       ) : (
         <>
           <section className="mt-5">
             <div className="grid grid-cols-3 gap-2">
               <SummaryCount label="Ready to Add" value={ready.length} tone="ready" />
               <SummaryCount label="Already Added" value={already.length} tone="already" />
               <SummaryCount label="Needs Attention" value={attention.length} tone="attention" />
             </div>
             <div className="flex gap-2 mt-3 overflow-x-auto pb-1" aria-label="Filter contacts">
               {(['all', 'ready', 'already', 'attention'] as ReviewFilter[]).map((value) => (
                 <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${filter === value ? 'bg-[var(--color-text-primary)] text-[var(--color-bg)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}>
                   {value === 'all' ? 'All' : value === 'already' ? 'Already Added' : value === 'attention' ? 'Needs Attention' : 'Ready'}
                 </button>
               ))}
             </div>
           </section>

           <div className="relative mt-4">
             <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
             <input value={query} maxLength={120} onChange={(event) => setQuery(event.target.value)} className="input !pl-10 min-h-11" placeholder="Search contacts" aria-label="Search contacts" />
           </div>

           <div className="mt-3 grid grid-cols-3 items-center">
             <button onClick={() => setDraft((value) => value ? { ...value, items: value.items.map((item) => ({ ...item, included: true })) } : value)} className="min-h-10 text-xs sm:text-sm font-semibold text-[var(--color-primary)]">Select All</button>
             <button onClick={() => setDraft((value) => value ? { ...value, items: value.items.map((item) => ({ ...item, included: false })) } : value)} className="min-h-10 text-xs sm:text-sm font-semibold text-[var(--color-text-secondary)]">Deselect All</button>
             <button onClick={() => setConfirmClear(true)} className="min-h-10 text-xs sm:text-sm font-semibold text-[var(--color-error)]">Clear Selection</button>
           </div>

           {pickerError && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-[var(--color-error)] mt-2">{pickerError}</p>}

           <section className="mt-2 flex flex-col gap-3" aria-live="polite">
             {visibleReviews.length ? visibleReviews.map((review) => (
               <ContactReviewRow
                 key={review.item.id}
                 review={review}
                 editing={editingId === review.item.id}
                 onToggle={() => updateItem(review.item.id, { included: !review.item.included })}
                 onEdit={() => setEditingId((value) => value === review.item.id ? undefined : review.item.id)}
                 onUpdate={(patch) => updateItem(review.item.id, patch)}
                 onRemove={() => removeItem(review.item.id)}
               />
             )) : (
               <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No contacts match this view.</p>
             )}
           </section>

           <aside className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--color-primary-soft)] p-4 text-sm leading-5 text-[var(--color-text-secondary)]">
             <LockKeyhole size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
             <p>Only the friends you confirm will be saved. Your other contacts stay on your device.</p>
           </aside>

           <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
             <div className="mx-auto max-w-2xl">
               {attention.length > 0 && <p className="mb-2 text-center text-xs font-medium text-[var(--color-warning)]">Fix or remove {plural(attention.length, 'contact')} that need attention.</p>}
               <button
                 onClick={requestImport}
                 disabled={ready.length === 0 || attention.length > 0 || selectedCount === 0}
                 className="min-h-12 w-full rounded-xl bg-[var(--color-primary)] px-4 text-white font-semibold disabled:cursor-not-allowed disabled:opacity-40"
               >
                 {selectedCount > 0 ? `Add ${plural(ready.length, 'Friend')}` : 'Select friends to add'}
               </button>
             </div>
           </div>
         </>
       )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear selection?"
          description={`This will deselect all ${selectedCount} contacts. You can select individual contacts again without reopening the picker.`}
          confirmLabel="Clear Selection"
          destructive
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setDraft((value) => value ? { ...value, items: value.items.map((item) => ({ ...item, included: false })) } : value);
            setConfirmClear(false);
          }}
        />
      )}
      {confirmLarge && (
        <ConfirmDialog
          title={`Add ${ready.length} friends?`}
          description="Only these selected contacts will be added to your Tab account."
          confirmLabel="Continue"
          onCancel={() => setConfirmLarge(false)}
          onConfirm={() => { setConfirmLarge(false); void runImport(ready); }}
        />
      )}
    </main>
  );
}

function SummaryCount({ label, value, tone }: { label: string; value: number; tone: 'ready' | 'already' | 'attention' }) {
  const toneClass = tone === 'ready'
    ? 'text-[var(--color-success)] bg-[var(--color-primary-soft)]'
    : tone === 'already'
      ? 'text-[var(--color-info)] bg-sky-50 dark:bg-sky-950/40'
      : 'text-[var(--color-warning)] bg-amber-50 dark:bg-amber-950/40';
  return (
    <div className={`min-w-0 rounded-2xl p-3 ${toneClass}`}>
      <p className="text-xl font-bold amount-tabular">{value}</p>
      <p className="mt-1 text-xs leading-4 font-semibold break-words">{label}</p>
    </div>
  );
}

function ContactReviewRow({
  review,
  editing,
  onToggle,
  onEdit,
  onUpdate,
  onRemove,
}: {
  review: ContactReviewItem;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<ContactImportItem>) => void;
  onRemove: () => void;
}) {
  const item = review.item;
  const displayPhone = review.whatsappE164 ? formatE164(review.whatsappE164) : review.rawPhone || (item.phones.length > 1 ? 'Choose WhatsApp number' : 'WhatsApp number required');
  const status = statusPresentation(review.status, review.message);
  const StatusIcon = status.icon;
  const needsFix = review.status === 'attention' || review.status === 'failed' || item.phones.length > 1;

  return (
    <article className={`rounded-2xl border bg-[var(--color-surface)] p-3.5 ${review.status === 'attention' || review.status === 'failed' ? 'border-amber-300 dark:border-amber-800' : 'border-[var(--color-border)]'} ${!item.included ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2.5">
        <button onClick={onToggle} role="checkbox" aria-checked={item.included} aria-label={`${item.included ? 'Deselect' : 'Select'} ${item.name || 'contact'}`} className="-ml-2 -mt-2 grid size-11 shrink-0 place-items-center">
          <span className={`grid size-5 place-items-center rounded-md border-2 ${item.included ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-text-muted)]'}`}>
            {item.included && <Check size={13} strokeWidth={3} />}
          </span>
        </button>
         <Avatar name={item.name || item.rawName || '?'} size={42} />
         <div className="min-w-0 flex-1">
           <p className="font-semibold truncate">{item.name || item.rawName || 'Name required'}</p>
          <p className={`mt-0.5 text-sm truncate ${review.whatsappE164 ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-warning)]'}`}>{displayPhone}</p>
          {item.email && <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate">{item.email}</p>}
          <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${status.className}`}><StatusIcon size={14} /> {status.label}</p>
        </div>
        <button onClick={onRemove} className="-mr-2 -mt-2 grid min-h-11 shrink-0 px-2 place-items-center text-xs font-semibold text-[var(--color-error)]" aria-label={`Remove ${item.name || 'contact'}`}><span className="inline-flex items-center gap-1"><Trash2 size={14} /> Remove</span></button>
      </div>

      {needsFix && !editing && (
        <button onClick={onEdit} className="mt-3 ml-[54px] min-h-10 px-3 rounded-xl bg-[var(--color-surface-secondary)] text-sm font-semibold inline-flex items-center gap-2">
          Fix Details <ChevronDown size={15} />
        </button>
      )}

      {editing && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Name <span className="text-[var(--color-error)]">*</span></span>
            <input value={item.name} maxLength={120} onChange={(event) => onUpdate({ name: event.target.value })} className="input mt-1.5 min-h-11" placeholder="Friend's name" />
          </label>

          {item.phones.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold text-[var(--color-text-secondary)]">Choose WhatsApp Number <span className="text-[var(--color-error)]">*</span></legend>
              <div className="mt-2 space-y-2">
                {item.phones.map((phone) => (
                  <label key={phone.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 ${item.selectedPhoneId === phone.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]'}`}>
                    <input type="radio" name={`phone-${item.id}`} checked={item.selectedPhoneId === phone.id} onChange={() => onUpdate({ selectedPhoneId: phone.id })} className="size-4 accent-[var(--color-primary)]" />
                    <span className="min-w-0"><span className="block text-xs font-semibold text-[var(--color-text-muted)]">{phone.label}</span><span className="block text-sm font-medium mt-0.5">{phone.value}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{item.phones.length ? 'Use another number' : 'WhatsApp Number'} <span className="text-[var(--color-error)]">*</span></span>
            <input
              value={item.manualPhone}
              onFocus={() => onUpdate({ selectedPhoneId: 'manual' })}
              onChange={(event) => onUpdate({ manualPhone: event.target.value, selectedPhoneId: 'manual' })}
              className="input mt-1.5 min-h-11"
              placeholder="e.g. +91 98765 43210"
              inputMode="tel"
              maxLength={32}
            />
            <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">Include the country code. Indian 10-digit numbers use +91 automatically.</span>
          </label>
          <button onClick={onEdit} className="min-h-11 w-full rounded-xl bg-[var(--color-text-primary)] text-[var(--color-bg)] text-sm font-semibold">Done</button>
        </div>
      )}
    </article>
  );
}

function statusPresentation(status: ContactReviewStatus, message: string): { icon: typeof CheckCircle2; label: string; className: string } {
  if (status === 'ready') return { icon: CheckCircle2, label: message, className: 'text-[var(--color-success)]' };
  if (status === 'already') return { icon: CheckCircle2, label: 'Already added', className: 'text-[var(--color-info)]' };
  if (status === 'failed') return { icon: XCircle, label: message, className: 'text-[var(--color-error)]' };
  if (status === 'attention') return { icon: AlertTriangle, label: message, className: 'text-[var(--color-warning)]' };
  return { icon: XCircle, label: 'Not selected', className: 'text-[var(--color-text-muted)]' };
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button className="absolute inset-0 bg-black/50" onClick={onCancel} aria-label="Cancel" />
      <div className="relative w-full max-w-sm rounded-3xl bg-[var(--color-surface)] p-5 shadow-2xl">
        <h2 id="confirm-title" className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="min-h-12 rounded-xl border border-[var(--color-border)] font-semibold">Cancel</button>
          <button onClick={onConfirm} className={`min-h-12 rounded-xl text-white font-semibold ${destructive ? 'bg-[var(--color-error)]' : 'bg-[var(--color-primary)]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
