import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CloudOff, LoaderCircle, RefreshCw, AlertTriangle, Database } from 'lucide-react';
import { SettingsPage, SettingsSection, ToggleRow } from '../../components/SettingsUI';
import { useSecurity } from '../../components/SecurityContext';
import { useToast } from '../../components/ToastContext';
import { getSyncOnMobileData, getSyncSnapshot, setSyncOnMobileData, syncNow } from '../../services/sync/syncManager';
import { listQueueItems } from '../../services/sync/syncQueue';
import type { SyncQueueItem, SyncStatusSnapshot } from '../../services/sync/types';
import { formatTimestamp } from '../../lib/utils';

const ENTITY_LABELS: Record<string, string> = {
  profile: 'Profile',
  preferences: 'Preferences',
  friend: 'Friend',
  group: 'Group',
  groupMember: 'Group member',
  expense: 'Expense',
  expenseParticipant: 'Expense share',
  expenseItem: 'Expense item',
  expenseItemAssignment: 'Expense item assignment',
  expenseAdjustment: 'Expense adjustment',
  repayment: 'Repayment',
  attachment: 'Attachment',
};

function pendingDetail(item: SyncQueueItem): string | null {
  if (item.entityType !== 'expense' && item.entityType !== 'repayment' && item.entityType !== 'friend') return null;
  try {
    const raw = localStorage.getItem('tab_db_session_v2');
    if (!raw) return null;
    const doc = JSON.parse(raw) as Record<string, unknown>;
    const records = (doc[item.entityType === 'repayment' ? 'repayments' : item.entityType === 'expense' ? 'expenses' : 'friends'] as Array<Record<string, unknown>> | undefined) ?? [];
    const record = records.find((entry) => entry.id === item.entityId);
    if (!record) return null;
    if (item.entityType === 'friend') return String(record.name ?? '');
    const description = item.entityType === 'repayment' ? 'Settlement' : String(record.description ?? '');
    const amount = typeof record.amount === 'number' ? `₹${record.amount.toLocaleString('en-IN')}` : '';
    return [description, amount].filter(Boolean).join(' — ');
  } catch {
    return null;
  }
}

export function DataSyncSettings() {
  const { userId } = useSecurity();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>(() => getSyncSnapshot(userId));
  const [pendingItems, setPendingItems] = useState<SyncQueueItem[]>(() => listQueueItems());
  const [syncing, setSyncing] = useState(false);
  const hadPendingRef = useRef(false);

  useEffect(() => {
    const update = (event: Event) => setSnapshot((event as CustomEvent<SyncStatusSnapshot>).detail);
    window.addEventListener('tab-sync-state', update);
    const visible = () => {
      if (document.visibilityState === 'visible') {
        setPendingItems(listQueueItems());
      }
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('tab-sync-state', update);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId]);

  useEffect(() => {
    hadPendingRef.current = snapshot.pendingCount > 0;
  }, [snapshot.pendingCount]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow(userId);
      setSnapshot(getSyncSnapshot(userId));
      setPendingItems(listQueueItems());
      toast(hadPendingRef.current ? 'Changes were saved on this device and will sync shortly' : 'Everything is up to date');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Sync could not be completed');
    } finally {
      setSyncing(false);
    }
  }, [toast, userId]);

  const stateIcon = snapshot.state === 'error'
    ? <AlertTriangle size={20} className="text-[var(--color-error)]" />
    : snapshot.state === 'offline'
      ? <CloudOff size={20} className="text-[var(--color-text-secondary)]" />
      : <Check size={20} className="text-[var(--color-success)]" />;
  const stateLabel = snapshot.state === 'syncing' ? 'Synchronizing…'
    : snapshot.state === 'offline'
      ? `Offline · ${snapshot.pendingCount > 0 ? `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? '' : 's'} saved on this device` : 'changes saved on this device will sync when you’re back online'}`
      : snapshot.state === 'error'
        ? `Couldn’t sync · ${snapshot.pendingCount > 0 ? `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? '' : 's'} waiting` : 'check your connection'}`
        : snapshot.pendingCount > 0 ? `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? '' : 's'} waiting to sync`
          : 'Up to date';

  return (
    <SettingsPage title="Data & Sync" description="Your records are stored in Supabase and synchronized across all devices. This device keeps an offline copy only.">
      <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-7">
        <div className="flex items-center gap-4">
          <span className="size-12 rounded-2xl bg-[var(--color-surface-secondary)] flex items-center justify-center">{stateIcon}</span>
          <div className="flex-1">
            <h2 className="font-bold">Sync Status</h2>
            <p className={`text-xs font-semibold mt-1 ${snapshot.state === 'error' ? 'text-[var(--color-error)]' : snapshot.state === 'offline' ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-success)]'}`}>{stateLabel}</p>
          </div>
          <RefreshCw size={17} className="text-[var(--color-text-muted)]" />
        </div>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing}
          className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold flex items-center justify-center gap-2 mt-5 disabled:opacity-60"
        >
          {syncing ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          {syncing ? 'Synchronizing…' : 'Sync Now'}
        </button>
      </div>

      {(snapshot.state === 'offline' || snapshot.state === 'error') && (
        <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-7">
          <h3 className="font-bold flex items-center gap-2">
            {snapshot.state === 'offline' ? <CloudOff size={18} className="text-[var(--color-text-secondary)]" /> : <AlertTriangle size={18} className="text-[var(--color-error)]" />}
            {snapshot.state === 'offline' ? "You're offline" : "Couldn't sync your changes"}
          </h3>
          <p className="text-xs leading-5 text-[var(--color-text-muted)] mt-2">
            {snapshot.state === 'offline'
              ? 'Your change was saved on this device but hasn’t been synced to the cloud yet. It will sync automatically when you’re back online.'
              : 'Your data is saved on this device, but the latest change hasn’t reached the cloud. Tap Retry Sync to try again.'}
          </p>
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncing}
            className="w-full min-h-11 rounded-xl border border-[var(--color-border)] font-semibold flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
          >
            {syncing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Retry Sync
          </button>
        </div>
      )}

      {pendingItems.length > 0 && (
        <SettingsSection title={`Pending Changes (${pendingItems.length})`}>
          <ul className="divide-y divide-[var(--color-border)]">
            {pendingItems.map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`size-2 rounded-full shrink-0 ${item.status === 'FAILED' ? 'bg-[var(--color-error)]' : 'bg-[var(--color-text-muted)]'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {ENTITY_LABELS[item.entityType] ?? item.entityType}
                      {pendingDetail(item) ? ` — ${pendingDetail(item)}` : ''}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {item.operation.toLowerCase()} · saved on this device · waiting to sync
                    </p>
                  </div>
                </div>
                {item.lastError && (
                  <p className="text-[10px] leading-4 text-[var(--color-error)] text-right shrink-0 max-w-32 truncate" title={item.lastError}>{item.lastError}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="px-4 pb-4 text-xs text-[var(--color-text-muted)]">Changes are uploaded to Supabase in order: new records first, then edits, then deletions. Nothing is lost when sync fails.</p>
        </SettingsSection>
      )}

      <SettingsSection title="Last Sync">
        <div className="px-4 py-4">
          <p className="text-sm font-semibold">Last successful sync</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{snapshot.lastSyncedAt ? formatTimestamp(snapshot.lastSyncedAt) : 'Never (offline or not yet synced)'}</p>
          {snapshot.lastError && snapshot.lastErrorAt && (
            <>
              <p className="text-sm font-semibold mt-4">Last sync failed</p>
              <p className="text-xs text-[var(--color-error)] mt-1">{formatTimestamp(snapshot.lastErrorAt)}</p>
              <p className="text-xs leading-5 text-[var(--color-error)] mt-1">{snapshot.lastError}</p>
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="On This Device">
        <ToggleRow
          title="Sync over mobile data"
          description="When off, automatic sync pauses on cellular connections. Manual Sync Now still works."
          checked={getSyncOnMobileData()}
          onChange={(checked) => { setSyncOnMobileData(checked); toast(checked ? 'Sync over mobile data enabled' : 'Sync over mobile data paused'); }}
        />
        <div className="px-4 py-4 flex items-center gap-3">
          <Database size={18} className="text-[var(--color-text-secondary)] shrink-0" />
          <div>
            <p className="text-sm font-semibold">Local data migration</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{snapshot.migrationCompleted ? 'Completed — existing local records are uploaded and merged with the cloud.' : 'Pending — existing local records will be uploaded on the next successful sync.'}</p>
          </div>
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}