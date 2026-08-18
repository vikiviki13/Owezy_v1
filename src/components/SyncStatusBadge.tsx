import { useEffect, useState } from 'react';
import { CloudOff, CloudUpload, LoaderCircle, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from './SecurityContext';
import { getSyncSnapshot, syncNow } from '../services/sync/syncManager';
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
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const update = (event: Event) => setSnapshot((event as CustomEvent<SyncStatusSnapshot>).detail);
    setSnapshot(getSyncSnapshot(userId));
    window.addEventListener('tab-sync-state', update);
    return () => window.removeEventListener('tab-sync-state', update);
  }, [userId]);

  const { text, icon: Icon, tone } = labelFor(snapshot);
  const canRetry = snapshot.state === 'offline' || snapshot.state === 'error' || snapshot.pendingCount > 0;

  async function handleClick() {
    if (!canRetry || retrying) {
      navigate('/profile/data-sync');
      return;
    }
    setRetrying(true);
    try {
      await syncNow(userId);
      setSnapshot(getSyncSnapshot(userId));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={retrying}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] min-h-8 ${canRetry ? 'cursor-pointer hover:bg-[var(--color-surface-secondary)]' : ''} disabled:opacity-70`}
      aria-label={canRetry ? 'Retry synchronization' : 'View synchronization details'}
    >
      <Icon size={13} className={retrying || snapshot.state === 'syncing' ? `${tone} animate-spin` : tone} />
      <span className={tone}>{text}</span>
      {canRetry && <RefreshCw size={12} className={tone} />}
    </button>
  );
}
