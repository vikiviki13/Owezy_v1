import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, Camera, Check, ChevronRight, CircleDollarSign, ContactRound, FileDown, Mail, MessageCircle, Pencil, Phone, ShieldAlert, Trash2, X } from 'lucide-react';
import { archiveFriend, calculateFriendBalance, clearFriendData, clearFriendDues, deleteFriend, getFriend, listExpensesForFriend, listRepaymentsForFriend, onDBChange, updateFriend } from '../lib/db';
import { compressAvatar } from '../lib/avatar';
import { formatCurrency, todayDate } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/ToastContext';
import { BottomSheet } from '../components/BottomSheet';
import { ExpenseCalendar } from '../components/ExpenseCalendar';
import { expenseDateError, expenseDateLabel, shiftIsoDate } from '../lib/expenseDraft';
import { PaymentMethod } from '../types';

const METHODS: PaymentMethod[] = ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other'];

export function ManageFriend() {
  const { id } = useParams();
  const [, setTick] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);

  const [mode, setMode] = useState<'manage' | 'clear-data'>('manage');
  const [editOpen, setEditOpen] = useState(false);
  const [duesOpen, setDuesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!id) return null;
  const friend = getFriend(id);
  if (!friend) return null;

  const balance = calculateFriendBalance(id);
  const hasHistory = listExpensesForFriend(id).length > 0 || listRepaymentsForFriend(id).length > 0;
  const pending = Math.max(balance.pending, 0);

  const onEditSaved = (name: string) => {
    setEditOpen(false);
    toast(`${name}'s profile updated`);
  };

  const onDuesCleared = () => {
    setDuesOpen(false);
    toast(`All dues cleared for ${friend.name}`);
    navigate(`/friends/${friend.id}`, { replace: true });
  };

  const onArchived = () => {
    toast(friend.is_archived ? `${friend.name} restored` : `${friend.name} archived`);
    if (friend.is_archived) navigate(`/friends/${friend.id}`);
  };

  const onClearData = () => {
    clearFriendData(friend.id);
    toast(`Financial history cleared for ${friend.name}`);
    navigate('/friends');
  };

  const onDelete = () => {
    deleteFriend(friend.id);
    toast(`${friend.name} deleted`);
    navigate('/friends');
  };

  if (mode === 'clear-data') {
    return <ClearDataScreen friendName={friend.name} onCancel={() => setMode('manage')} onConfirm={onClearData} />;
  }

  const whatsapp = friend.whatsapp_number || friend.whatsapp_e164 || friend.phone || friend.phone_number;

  return (
    <div className="px-4 pt-6 pb-8 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-lg">Manage Friend</h1>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Avatar name={friend.name} size={52} src={friend.avatar_url} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{friend.name}</p>
          {friend.nickname && <p className="text-xs text-[var(--color-text-muted)]">Known as {friend.nickname}</p>}
        </div>
        <button onClick={() => setEditOpen(true)} className="shrink-0 flex items-center gap-1.5 bg-[var(--color-surface-secondary)] rounded-xl px-3.5 py-2 text-sm font-medium">
          <Pencil size={14} /> Edit
        </button>
      </div>

      <Section title="Friend Information">
        <Row icon={<ContactRound size={17} />} title="Edit Profile" subtitle="Photo, name, nickname, contact details" onClick={() => setEditOpen(true)} />
        {whatsapp && <Row icon={<MessageCircle size={17} />} title="WhatsApp Number" subtitle={whatsapp} onClick={() => window.open(`https://wa.me/${whatsapp.replace(/\D/g, '')}`, '_blank')} />}
        {friend.phone && <Row icon={<Phone size={17} />} title="Phone" subtitle={friend.phone} />}
        {friend.email && <Row icon={<Mail size={17} />} title="Email" subtitle={friend.email} />}
        {friend.notes && <Row icon={<Pencil size={17} />} title="Notes" subtitle={friend.notes} />}
      </Section>

      <Section title="Financial">
        <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 mb-1 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">Current Pending</p>
            <p className={`text-2xl font-extrabold mt-1 amount-tabular ${pending > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}>
              {formatCurrency(pending)}
            </p>
          </div>
          <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <CircleDollarSign size={20} />
          </span>
        </div>
        <Row
          icon={<Check size={17} />}
          title="Clear All Dues"
          subtitle={pending > 0 ? `Mark the complete outstanding balance as settled` : 'Nothing pending to clear'}
          disabled={pending <= 0}
          danger={false}
          onClick={() => pending > 0 && setDuesOpen(true)}
        />
        <Row icon={<FileDown size={17} />} title="Export Statement" subtitle="Share a statement summary over WhatsApp" onClick={() => navigate(`/statement/${friend.id}`)} />
      </Section>

      <Section title="Data">
        <Row
          icon={friend.is_archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
          title={friend.is_archived ? 'Restore Friend' : 'Archive Friend'}
          subtitle={friend.is_archived ? 'Bring this friend back to active lists' : 'Hide from Add Expense while keeping all history'}
          onClick={() => { archiveFriend(friend.id, !friend.is_archived); onArchived(); }}
        />
        <Row
          icon={<ShieldAlert size={17} />}
          title="Clear Friend Data"
          subtitle="Permanently remove this friend's financial history"
          danger
          onClick={() => setMode('clear-data')}
        />
        <Row
          icon={<Trash2 size={17} />}
          title="Delete Friend"
          subtitle={hasHistory ? 'Archive first, or clear data and delete' : 'Remove this friend profile'}
          danger
          onClick={() => setDeleteOpen(true)}
        />
      </Section>

      <EditFriendSheet open={editOpen} friendId={friend.id} onSaved={onEditSaved} onClose={() => setEditOpen(false)} />

      <ClearDuesSheet open={duesOpen} friendId={friend.id} friendName={friend.name} pending={pending} onConfirm={onDuesCleared} onClose={() => setDuesOpen(false)} />

      <DeleteFriendSheet
        open={deleteOpen}
        friendName={friend.name}
        hasHistory={hasHistory}
        onArchive={() => { setDeleteOpen(false); archiveFriend(friend.id, true); toast(`${friend.name} archived`); navigate(`/friends/${friend.id}`); }}
        onClearAndDelete={() => { setDeleteOpen(false); onDelete(); }}
        onDelete={() => { setDeleteOpen(false); onDelete(); }}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">{title}</p>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden divide-y divide-[var(--color-border)]">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon, title, subtitle, onClick, danger, disabled,
}: {
  icon: React.ReactNode; title: string; subtitle?: string; onClick?: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-40 ${onClick ? 'hover:bg-[var(--color-surface-secondary)] transition-colors' : 'cursor-default'}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-primary)]'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium ${danger ? 'text-[var(--color-error)]' : ''}`}>{title}</span>
        {subtitle && <span className="block text-xs leading-5 text-[var(--color-text-muted)] truncate">{subtitle}</span>}
      </span>
      <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
    </button>
  );
}

function EditFriendSheet({ open, friendId, onSaved, onClose }: { open: boolean; friendId: string; onSaved: (name: string) => void; onClose: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);
  const friend = getFriend(friendId);
  const [name, setName] = useState(friend?.name || '');
  const [nickname, setNickname] = useState(friend?.nickname || '');
  const [whatsapp, setWhatsapp] = useState(friend?.whatsapp_number || friend?.whatsapp_e164 || friend?.phone || '');
  const [phone, setPhone] = useState(friend?.phone_number || friend?.phone || '');
  const [email, setEmail] = useState(friend?.email || '');
  const [notes, setNotes] = useState(friend?.notes || '');
  const [avatarUrl, setAvatarUrl] = useState(friend?.avatar_url || '');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!friend) return null;

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    void compressAvatar(file).then((url) => setAvatarUrl(url)).catch(() => undefined);
  }

  const save = () => {
    if (!name.trim()) return;
    updateFriend(friend.id, {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      whatsapp_number: whatsapp.trim() || undefined,
      phone: phone.trim() || whatsapp.trim() || undefined,
      phone_number: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      avatar_url: avatarUrl || undefined,
    });
    onSaved(name.trim());
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit Friend">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={name || friend.name} size={64} src={avatarUrl || undefined} />
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] min-h-9"
            >
              <Camera size={15} /> {avatarUrl ? 'Change photo' : 'Add photo'}
            </button>
            {avatarUrl && (
              <button onClick={() => setAvatarUrl('')} className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] min-h-9">
                <X size={15} /> Remove photo
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </div>

        <Field label="Name" required>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arun Kumar" className="input" />
        </Field>
        <Field label="Nickname">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Optional" className="input" />
        </Field>
        <Field label="WhatsApp number">
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="e.g. 98765 43210" className="input" inputMode="tel" />
        </Field>
        <Field label="Phone number">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className="input" inputMode="tel" />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" className="input" inputMode="email" />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={2} className="input resize-none" />
        </Field>

        <button
          onClick={save}
          disabled={!name.trim()}
          className="mt-2 flex items-center justify-center gap-2 bg-[var(--color-primary)] disabled:opacity-40 text-white font-medium rounded-xl py-3"
        >
          <Check size={17} /> Save Changes
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
        {label} {required && <span className="text-[var(--color-error)]">*</span>}
      </span>
      {children}
    </label>
  );
}

function ClearDuesSheet({ open, friendId, friendName, pending, onConfirm, onClose }: { open: boolean; friendId: string; friendName: string; pending: number; onConfirm: () => void; onClose: () => void }) {
  const [date, setDate] = useState(() => todayDate());
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [sheetMode, setSheetMode] = useState<'quick' | 'calendar'>('quick');

  function chooseDate(nextDate: string) {
    if (expenseDateError(nextDate)) return;
    setDate(nextDate);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Clear All Dues">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Clear <span className="font-bold amount-tabular">{formatCurrency(pending)}</span> pending for <span className="font-semibold">{friendName}</span>?</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">A settlement record will be created. Past expenses and repayments stay in history.</p>
        </div>

        <Field label="Settlement date">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => chooseDate(todayDate())} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${date === todayDate() ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)]'}`}>Today</button>
              <button type="button" onClick={() => chooseDate(shiftIsoDate(todayDate(), -1))} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${date === shiftIsoDate(todayDate(), -1) ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)]'}`}>Yesterday</button>
              <button type="button" onClick={() => setSheetMode((m) => (m === 'calendar' ? 'quick' : 'calendar'))} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${sheetMode === 'calendar' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)]'}`}>Select Date</button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">{expenseDateLabel(date)}</p>
            {sheetMode === 'calendar' && <ExpenseCalendar selected={date} onSelect={chooseDate} />}
          </div>
        </Field>

        <Field label="Payment method (optional)">
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod((current) => (current === m ? '' : m))}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${method === m ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Settled outside the app" rows={2} className="input resize-none" />
        </Field>

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] py-3 font-medium text-[var(--color-text-secondary)]">Cancel</button>
          <button
            onClick={() => {
              clearFriendDues(friendId, {
                repayment_date: date,
                payment_method: method || undefined,
                notes: notes.trim() || undefined,
              });
              onConfirm();
            }}
            className="flex-1 rounded-xl bg-[var(--color-primary)] py-3 font-medium text-white"
          >
            Clear Dues
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function DeleteFriendSheet({
  open, friendName, hasHistory, onArchive, onClearAndDelete, onDelete, onClose,
}: {
  open: boolean; friendName: string; hasHistory: boolean;
  onArchive: () => void; onClearAndDelete: () => void; onDelete: () => void; onClose: () => void;
}) {
  if (!hasHistory) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Delete Friend">
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          Remove <span className="font-semibold">{friendName}</span> from your friends list? There is no financial history attached to this profile.
        </p>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] py-3 font-medium text-[var(--color-text-secondary)]">Cancel</button>
          <button onClick={onDelete} className="flex-1 rounded-xl bg-[var(--color-error)] py-3 font-medium text-white">Delete</button>
        </div>
      </BottomSheet>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Delete Friend">
      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
        <span className="font-semibold">{friendName}</span> has financial history. Deleting the profile immediately would also remove it — instead, choose how to proceed.
      </p>
      <div className="flex flex-col gap-2 mt-4">
        <button onClick={onArchive} className="w-full flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-left">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Archive size={17} /></span>
          <span className="flex-1"><span className="block text-sm font-medium">Archive Friend</span><span className="block text-xs leading-5 text-[var(--color-text-muted)]">Recommended — keeps all history and balances</span></span>
        </button>
        <button onClick={onClearAndDelete} className="w-full flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-left">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]"><Trash2 size={17} /></span>
          <span className="flex-1"><span className="block text-sm font-medium text-[var(--color-error)]">Clear Data & Delete</span><span className="block text-xs leading-5 text-[var(--color-text-muted)]">Removes the profile and all financial history</span></span>
        </button>
      </div>
      <button onClick={onClose} className="w-full rounded-xl py-3 mt-2 font-medium text-[var(--color-text-secondary)]">Cancel</button>
    </BottomSheet>
  );
}

function ClearDataScreen({ friendName, onCancel, onConfirm }: { friendName: string; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toUpperCase() === 'CLEAR';

  return (
    <div className="px-4 pt-6 pb-8 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-lg">Clear Friend Data</h1>
      </div>

      <div className="rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert size={18} className="text-[var(--color-error)]" />
          <p className="font-semibold text-sm">This action cannot be undone.</p>
        </div>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          This will permanently remove <span className="font-semibold">{friendName}</span>'s financial history from your account:
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
          {[
            'Expenses linked to this friend',
            'Repayments and settlement history',
            'Statements and reminders',
            'Attachments for those transactions',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2"><X size={13} className="text-[var(--color-error)] shrink-0" /> {item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">The friend profile itself is kept — use Delete Friend to remove it too.</p>
      </div>

      <label className="flex flex-col gap-1.5 mb-4">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">Type <span className="font-bold tracking-widest">CLEAR</span> to continue</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="CLEAR" className="input tracking-widest" autoCapitalize="characters" />
      </label>

      <button
        onClick={onConfirm}
        disabled={!confirmed}
        className="w-full flex items-center justify-center gap-2 bg-[var(--color-error)] disabled:opacity-40 text-white font-semibold rounded-xl py-3.5"
      >
        <Trash2 size={17} /> Clear Data Permanently
      </button>
    </div>
  );
}