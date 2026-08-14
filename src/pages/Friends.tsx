import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContactRound, Search, Plus, Users2 } from 'lucide-react';
import { listFriendBalances, onDBChange } from '../lib/db';
import { formatCurrency, formatDateShort } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { AddFriendForm } from '../components/AddFriendForm';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { ContactImportFlow, type ImportedFriendDraft } from '../components/contacts/ContactImportFlow';

type Tab = 'all' | 'pending' | 'settled' | 'archived';

export function Friends() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [contactImportOpen, setContactImportOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ImportedFriendDraft>();
  const navigate = useNavigate();
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);

  let balances = listFriendBalances(tab === 'archived');
  if (tab === 'archived') balances = balances.filter((b) => b.friend.is_archived);
  if (tab === 'pending') balances = balances.filter((b) => b.pending > 0);
  if (tab === 'settled') balances = balances.filter((b) => b.pending <= 0);
  if (query.trim()) balances = balances.filter((b) => `${b.friend.name} ${b.friend.nickname || ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="px-4 pt-6 safe-top">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Friends</h1>
        <button onClick={() => setAddOpen(true)} className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
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

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {(['all', 'pending', 'settled', 'archived'] as Tab[]).map((t) => (
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
          title={query ? 'No friends match your search.' : 'No friends yet.'}
          subtitle="Add a friend to start tracking shared expenses."
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => setAddOpen(true)}><Plus />Add Friend</Button>
              <Button variant="outline" onClick={() => setContactImportOpen(true)}><ContactRound />Import from Contacts</Button>
            </div>
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
              <Avatar name={b.friend.name} src={b.friend.avatar_url} size={46} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{b.friend.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {b.lastActivityAt ? `Last activity ${formatDateShort(b.lastActivityAt.slice(0, 10))}` : 'No transactions yet'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold amount-tabular">{formatCurrency(Math.abs(b.pending))}</p>
                {b.friend.is_archived ? <Badge variant="secondary">Archived</Badge> : <StatusBadge status={b.status} />}
              </div>
            </button>
          ))}
        </div>
      )}

      <AddFriendSheet open={addOpen} onClose={() => { setAddOpen(false); setContactDraft(undefined); }} initialContact={contactDraft} />
      <ContactImportFlow
        open={contactImportOpen}
        onOpenChange={setContactImportOpen}
        onContactSelected={(draft) => { setContactDraft(draft); setContactImportOpen(false); setAddOpen(true); }}
        onExistingFriendSelected={(friend) => { setContactImportOpen(false); navigate(`/friends/${friend.id}`); }}
        onAddManually={() => setAddOpen(true)}
      />
    </div>
  );
}

function AddFriendSheet({ open, onClose, initialContact }: { open: boolean; onClose: () => void; initialContact?: ImportedFriendDraft }) {
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-4 pb-6">
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <SheetHeader className="px-0 text-left"><SheetTitle>Add Friend</SheetTitle><SheetDescription>Review the details before adding this friend.</SheetDescription></SheetHeader>
        <AddFriendForm
          initialContact={initialContact}
          onExistingFriendSelected={(friend) => { onClose(); navigate(`/friends/${friend.id}`); }}
          onCreated={(friend) => {
            toast(`${friend.name} added`);
            onClose();
            navigate(`/friends/${friend.id}`);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
