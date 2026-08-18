import { useEffect, useState } from 'react';
import { CloudOff, CloudUpload, LoaderCircle, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from './SecurityContext';
import { getSyncSnapshot } from '../services/sync/syncManager';
import type { SyncStatusSnapshot } from '../services/sync/types';

function labelFor(snapshot: SyncStatusSnapshot): { text: string; icon: typeof Check; tone: string } {
  if (snapshot.state === 'syncing') {
    return { text: 'Syncing…', icon: LoaderCircle, tone: 'text-[var(--color-primary)]' };
  }
  if (snapshot.state === 'offline') {
    const suffix = snapshot.pendingCount > 0 ? ` · ${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? '' : 's'} saved locally` : '';
    return { text: `Offline${suffix}`, icon: CloudOff, tone: 'text-[var(--color-text-secondary)]' };
  }
  if (snapshot.state === 'error') {
    return { text: `Sync failed${snapshot.pendingCount > 0 ? ` · ${snapshot.pendingCount} waiting` : ''} · Retry`, icon: AlertTriangle, tone: 'text-[var(--color-error)]' };
  }
  if (snapshot.pendingCount > 0) {
    return { text: `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? '' : 's'} waiting to sync`, icon: CloudUpload, tone: 'text-[var(--color-text-secondary)]' };
  }
  return { text: 'Synced', icon: Check, tone: 'text-[var(--color-success)]' };
}

export function SyncStatusBadge() {
  const { userId } = useSecurity();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>(() => getSyncSnapshot(userId));

  useEffect(() => {
    const update = (event: Event) => setSnapshot((event as CustomEvent<SyncStatusSnapshot>).detail);
    setSnapshot(getSyncSnapshot(userId));
    window.addEventListener('tab-sync-state', update);
    return () => window.removeEventListener('tab-sync-state', update);
  }, [userId]);

  const { text, icon: Icon, tone } = labelFor(snapshot);
  return (
    <button
      type="button"
      onClick={() => navigate('/profile/data-sync')}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] min-h-8"
      aria-label="Sync status"
    >
      <Icon size={13} className={snapshot.state === 'syncing' ? `${tone} animate-spin` : tone} />
      <span className={tone}>{text}</span>
      {snapshot.state === 'error' && <RefreshCw size={12} className="text-[var(--color-error)]" />}
    </button>
  );
}