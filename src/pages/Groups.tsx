import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Plus, Check } from 'lucide-react';
import { calculateGroupBalance, createGroup, getGroupMembers, listFriends, listGroups, onDBChange } from '../lib/db';
import { formatCurrency } from '../lib/utils';
import { AvatarGroup } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { BottomSheet } from '../components/BottomSheet';
import { Field } from './Friends';
import { useToast } from '../components/ToastContext';

export function Groups() {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => onDBChange(() => setTick((t) => t + 1)), []);

  const groups = listGroups();

  return (
    <div className="px-4 pt-6 safe-top">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Groups</h1>
        <button onClick={() => setOpen(true)} className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
          <Plus size={18} />
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No groups yet."
          subtitle="Create a group for recurring outings — office friends, roommates, a trip."
          action={<button onClick={() => setOpen(true)} className="text-sm font-medium text-white bg-[var(--color-primary)] px-4 py-2 rounded-xl">Create Group</button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => {
            const members = getGroupMembers(g.id);
            const balance = calculateGroupBalance(g.id);
            return (
              <button
                key={g.id}
                onClick={() => navigate(`/add-expense?group=${g.id}`)}
                className="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{members.length} member{members.length === 1 ? '' : 's'}</p>
                </div>
                <AvatarGroup names={members.map((m) => m.name)} />
                <div className="text-right shrink-0 ml-2">
                  <p className="font-semibold amount-tabular text-sm">{formatCurrency(balance)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateGroupSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const friends = listFriends();
  const toast = useToast();

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function save() {
    if (!name.trim()) return;
    createGroup({ name: name.trim(), memberIds: selected });
    toast(`${name.trim()} created`);
    setName(''); setSelected([]);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Create Group">
      <div className="flex flex-col gap-4">
        <Field label="Group name" required>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Friends" className="input" />
        </Field>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Members</p>
          {friends.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Add friends first, then create a group.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
              {friends.map((f) => (
                <button key={f.id} onClick={() => toggle(f.id)} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--color-surface-secondary)] text-left">
                  <span className="font-medium text-sm">{f.name}</span>
                  {selected.includes(f.id) && (
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                      <Check size={13} className="text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={save} disabled={!name.trim()} className="bg-[var(--color-primary)] disabled:opacity-40 text-white font-medium rounded-xl py-3">
          Create Group
        </button>
      </div>
    </BottomSheet>
  );
}
