import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ContactRound, LoaderCircle, Search, Plus, UserPlus, Users2 } from 'lucide-react';
import { createFriend, listFriendBalances, onDBChange } from '../lib/db';
import { formatCurrency, formatDateShort } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { BottomSheet } from '../components/BottomSheet';
import { useToast } from '../components/ToastContext';
import { createContactImportDraft, pickDeviceContacts, saveContactImportDraft } from '../lib/contactImport';
import { useSecurity } from '../components/SecurityContext';

type Tab = 'all' | 'pending' | 'settled';

export function Friends() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);

  let balances = listFriendBalances();
  const newFriendIds = new Set((params.get('new') || '').split(',').filter(Boolean));
  if (newFriendIds.size) balances = [...balances].sort((a, b) => Number(newFriendIds.has(b.friend.id)) - Number(newFriendIds.has(a.friend.id)));
  if (tab === 'pending') balances = balances.filter((b) => b.pending > 0);
  if (tab === 'settled') balances = balances.filter((b) => b.pending <= 0);
  if (query.trim()) balances = balances.filter((b) => b.friend.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="px-4 pt-6 safe-top">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Friends</h1>
        <button onClick={() => setAddOpen(true)} className="w-11 h-11 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center" aria-label="Add friend">
          <Plus size={18} />
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends"
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'settled'] as Tab[]).map((t) => (
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

      {balances.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={query ? 'No friends match your search.' : 'Invite Friends'}
          subtitle={query ? 'Try a different name.' : 'Share Owezy with your friends so you can easily manage expenses together.'}
          action={
            query ? (
              <button onClick={() => setAddOpen(true)} className="text-sm font-medium text-white bg-[var(--color-primary)] px-4 py-2 rounded-xl">
                Add Friend
              </button>
            ) : (
              <div className="flex flex-col gap-2 w-52">
                <button onClick={() => navigate('/profile/share')} className="text-sm font-medium text-white bg-[var(--color-primary)] px-4 py-2 rounded-xl">
                  Share App
                </button>
                <button onClick={() => setAddOpen(true)} className="text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2 rounded-xl">
                  Add Friend
                </button>
              </div>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {balances.map((b) => (
            <button
              key={b.friend.id}
              onClick={() => navigate(`/friends/${b.friend.id}`)}
              className="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-left"
            >
              <Avatar name={b.friend.name} size={46} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{b.friend.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {b.lastActivityAt ? `Last activity ${formatDateShort(b.lastActivityAt.slice(0, 10))}` : 'No transactions yet'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold amount-tabular">{formatCurrency(Math.abs(b.pending))}</p>
                <StatusBadge status={b.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      <AddFriendSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddFriendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const { userId } = useSecurity();

  function save() {
    if (!name.trim()) return;
    const friend = createFriend({ name: name.trim(), phone: phone.trim() || undefined, nickname: nickname.trim() || undefined, whatsapp_number: phone.trim() || undefined });
    toast(`${friend.name} added`);
    setName(''); setPhone(''); setNickname('');
    onClose();
    navigate(`/friends/${friend.id}`);
  }

  async function importContacts() {
    setPickerBusy(true);
    setPickerError('');
    try {
      const contacts = await pickDeviceContacts();
      if (!contacts.length) return;
      const draft = createContactImportDraft(contacts, 'friends', userId);
      await saveContactImportDraft(draft);
      onClose();
      navigate('/friends/import?from=friends');
    } catch (caught) {
      setPickerError(caught instanceof Error ? caught.message : 'Contacts could not be opened.');
    } finally {
      setPickerBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Friend">
      <div className="flex flex-col gap-4">
        <button
          onClick={() => void importContacts()}
          disabled={pickerBusy}
          className="min-h-14 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-left disabled:opacity-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            {pickerBusy ? <LoaderCircle size={20} className="animate-spin" /> : <ContactRound size={20} />}
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Import from Contacts</span>
            <span className="block text-xs leading-5 text-[var(--color-text-muted)]">Select and review multiple contacts</span>
          </span>
        </button>
        {pickerError && <p role="alert" className="text-sm leading-5 text-[var(--color-error)]">{pickerError}</p>}
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"><span className="h-px flex-1 bg-[var(--color-border)]" />or add manually<span className="h-px flex-1 bg-[var(--color-border)]" /></div>
        <Field label="Name" required>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arun Kumar" className="input" />
        </Field>
        <Field label="Nickname">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Optional" className="input" />
        </Field>
        <Field label="Phone / WhatsApp">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 98765 43210" className="input" inputMode="tel" />
        </Field>
        <button
          onClick={save}
          disabled={!name.trim()}
          className="mt-2 flex items-center justify-center gap-2 bg-[var(--color-primary)] disabled:opacity-40 text-white font-medium rounded-xl py-3"
        >
          <UserPlus size={17} /> Add Friend
        </button>
      </div>
    </BottomSheet>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
        {label} {required && <span className="text-[var(--color-error)]">*</span>}
      </span>
      {children}
    </label>
  );
}
