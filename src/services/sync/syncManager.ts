// Centralized synchronization manager. Supabase is the source of truth; the
// browser document is an offline cache + pending-change queue.
//
// Triggers:
//   LOGIN / APP START  -> initializeSync() (pull -> merge -> push)
//   LOCAL MUTATION     -> 'tab-db-changed' event (debounced push)
//   NETWORK RESTORED   -> 'online' event
//   TAB VISIBLE        -> 'visibilitychange' / 'focus' (lightweight sync)
//   PERIODIC           -> 5-minute timer while visible
//   REALTIME           -> Supabase postgres_changes on app_data (other devices)
//   MANUAL             -> syncNow() (Settings -> Data & Sync)

import { markQueueFailed, markQueueSynced, markQueueSyncing, markQueueItemFailed, pendingCount } from './syncQueue';
import { mergeAppData, type StoredDoc } from './conflictResolver';
import type { SyncStatusSnapshot, SyncState } from './types';
import { readPrivateData, SecurityServiceError, writePrivateData } from '../../lib/securityService';
import { invalidateCache } from '../../lib/db';
import { isMigrationCompleted, markMigrationCompleted } from './migration';
import { subscribeToAppData } from './realtime';

const RUNTIME_DB_KEY = 'tab_db_session_v2';
const SNAPSHOT_PREFIX = 'tab_sync_snapshot_v2_';
const LAST_SYNCED_PREFIX = 'tab_last_synced_at_v2_';
const MOBILE_DATA_PREF_KEY = 'tab_sync_on_mobile_data_v2';
const PERIODIC_MS = 5 * 60_000;
const PUSH_DEBOUNCE_MS = 600;
const REALTIME_DEBOUNCE_MS = 1200;
// Exponential backoff for automatic retries: 30s, 60s, 120s, 240s, then capped
// at 5 minutes until a trigger (network restored, manual Sync Now) resets it.
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;

let activeUserId: string | null = null;
let running = false;
let retryAttempt = 0;
let retryTimer: number | undefined = undefined;
let pushTimer: number | undefined = undefined;
let periodicTimer: number | undefined = undefined;
let realtimeTimer: number | undefined = undefined;
let realtimeDirty = false;
let realtimeUnsub: (() => void) | null = null;

const listeners = {
  dbChanged: null as (() => void) | null,
  online: null as (() => void) | null,
  visible: null as (() => void) | null,
  focus: null as (() => void) | null,
};

function readDoc(): StoredDoc | null {
  const raw = localStorage.getItem(RUNTIME_DB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDoc;
  } catch {
    return null;
  }
}

function writeDoc(doc: StoredDoc) {
  const previous = readDoc();
  const serialized = JSON.stringify(doc);
  localStorage.setItem(RUNTIME_DB_KEY, serialized);
  if (!previous || JSON.stringify(previous) !== serialized) {
    // The cache document changed (cloud records downloaded / tombstones
    // applied): drop db.ts's in-memory copy and refresh the UI.
    invalidateCache();
    window.dispatchEvent(new CustomEvent('tab-db-changed'));
  }
}

function readSnapshot(userId: string): SyncStatusSnapshot {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw) as SyncStatusSnapshot;
  } catch { /* fall through */ }
  return {
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: localStorage.getItem(`${LAST_SYNCED_PREFIX}${userId}`),
    lastError: null,
    lastErrorAt: null,
    migrationCompleted: isMigrationCompleted(userId),
  };
}

function emit(userId: string, snapshot: SyncStatusSnapshot) {
  localStorage.setItem(`${SNAPSHOT_PREFIX}${userId}`, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent('tab-sync-state', { detail: snapshot }));
}

function snapshotOf(userId: string, state: SyncState, lastError: string | null = null): SyncStatusSnapshot {
  return {
    state,
    pendingCount: pendingCount(),
    lastSyncedAt: localStorage.getItem(`${LAST_SYNCED_PREFIX}${userId}`),
    lastError,
    lastErrorAt: lastError ? new Date().toISOString() : null,
    migrationCompleted: isMigrationCompleted(userId),
  };
}

function isCellularConnection() {
  const connection = (navigator as unknown as { connection?: { type?: string } }).connection;
  return Boolean(connection && connection.type === 'cellular');
}

function shouldSyncNow() {
  if (!navigator.onLine) return false;
  if (getSyncOnMobileData() || !isCellularConnection()) return true;
  // The user disabled syncing over mobile data; fall back to the periodic
  // timer by marking this attempt as skipped silently.
  return false;
}

async function pullAndMerge(userId: string): Promise<{ needsPush: boolean; doc: StoredDoc }> {
  const result = await readPrivateData<StoredDoc>(userId);
  const cloudRaw = result.data as StoredDoc | null;
  const localRaw = readDoc();
  if (!cloudRaw) {
    // No server copy yet: keep the local copy untouched (it will be pushed).
    const doc = localRaw ?? emptyDocFor(userId);
    writeDoc(doc);
    return { needsPush: Boolean(localRaw), doc };
  }
  if (!localRaw) {
    // Fresh device: adopt the cloud document as the cache. No push needed.
    writeDoc(cloudRaw);
    return { needsPush: false, doc: cloudRaw };
  }
  const merged = mergeAppData(localRaw, cloudRaw);
  // The merged union is the new cache: cloud records this device had not seen
  // yet are downloaded now, local-only records are preserved for the push.
  writeDoc(merged.merged);
  return { needsPush: merged.needsPush, doc: merged.merged };
}

function emptyDocFor(userId: string): StoredDoc {
  const now = new Date().toISOString();
  return {
    rev: 0,
    updated_at: now,
    profile: { id: userId, full_name: 'You', default_currency: 'INR', created_at: now, updated_at: now },
    preferences: { user_id: userId, currency_code: 'INR', number_format: 'indian', decimal_display: 'automatic', date_format: 'DD MMM YYYY', time_format: '12h', week_starts_on: 'automatic', timezone: 'Asia/Kolkata', timezone_mode: 'automatic', language: 'en', theme: 'system', notifications_enabled: true, payment_reminders_enabled: true, pending_balance_reminders_enabled: true, app_updates_enabled: true, default_reminder_days: 3, default_reminder_time: '19:00', app_lock_enabled: false, auto_lock_duration: '5m', created_at: now, updated_at: now },
    friends: [],
    groups: [],
    groupMembers: [],
    expenses: [],
    expenseParticipants: [],
    expenseItems: [],
    expenseItemAssignments: [],
    expenseAdjustments: [],
    repayments: [],
    attachments: [],
    deleted: [],
  };
}

async function pushDoc(userId: string, doc: StoredDoc) {
  try {
    await writePrivateData(userId, doc as unknown as Record<string, unknown>);
    return true;
  } catch (caught) {
    // Graceful degradation while the deployed Edge Function still rejects the
    // tombstone section: retry once without tombstones so sync keeps working.
    if (caught instanceof SecurityServiceError && caught.code === 'invalid_app_data' && (doc.deleted || []).length > 0) {
      const stripped = { ...doc, deleted: [] };
      await writePrivateData(userId, stripped as unknown as Record<string, unknown>);
      return true;
    }
    throw caught;
  }
}

async function syncOnce(userId: string) {
  if (running) return;
  running = true;
  try {
    if (!shouldSyncNow()) return;
    emit(userId, snapshotOf(userId, 'syncing'));
    const { needsPush, doc } = await pullAndMerge(userId);
    if (needsPush) {
      markQueueSyncing();
      await pushDoc(userId, doc);
      markQueueSynced();
          }
    if (!isMigrationCompleted(userId)) markMigrationCompleted(userId);
    localStorage.setItem(`${LAST_SYNCED_PREFIX}${userId}`, new Date().toISOString());
    retryAttempt = 0;
    emit(userId, snapshotOf(userId, 'synced'));
    window.dispatchEvent(new CustomEvent('tab-cloud-synced'));
  } catch (caught) {
    const message = caught instanceof SecurityServiceError ? caught.message : caught instanceof Error ? caught.message : 'Cloud sync failed.';
    const offline = !navigator.onLine || (caught instanceof SecurityServiceError && caught.code === 'network_failure');
    markQueueFailed(message);
    emit(userId, snapshotOf(userId, offline ? 'offline' : 'error', message));
    window.dispatchEvent(new CustomEvent('tab-cloud-sync-error', { detail: message }));
    scheduleRetry(userId);
  } finally {
    running = false;
    // A Realtime event may have arrived while this sync was in flight; run
    // once more so the other device's change is not missed.
    if (realtimeDirty && activeUserId === userId) {
      realtimeDirty = false;
      window.setTimeout(() => { if (activeUserId === userId) void syncOnce(userId); }, 150);
    }
  }
}

function scheduleRetry(userId: string) {
  window.clearTimeout(retryTimer);
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retryAttempt);
  retryAttempt += 1;
  retryTimer = window.setTimeout(() => { if (activeUserId === userId) void syncOnce(userId); }, delay);
}

function onRealtimeEvent(userId: string) {
  realtimeDirty = true;
  if (activeUserId !== userId) return;
  window.clearTimeout(realtimeTimer);
  realtimeTimer = window.setTimeout(() => {
    if (activeUserId !== userId) return;
    realtimeDirty = false;
    void syncOnce(userId);
  }, REALTIME_DEBOUNCE_MS);
}

function schedulePush(userId: string) {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    if (activeUserId === userId) void syncOnce(userId);
  }, PUSH_DEBOUNCE_MS);
}

function startPeriodic(userId: string) {
  window.clearInterval(periodicTimer);
  periodicTimer = window.setInterval(() => {
    if (!document.hidden && activeUserId === userId) void syncOnce(userId);
  }, PERIODIC_MS);
}

function wireListeners(userId: string) {
  listeners.dbChanged = () => schedulePush(userId);
  listeners.online = () => {
    if (activeUserId === userId) {
      // Fresh connection: restart the backoff sequence for automatic retries.
      retryAttempt = 0;
      void syncOnce(userId);
    }
  };
  listeners.visible = () => {
    if (document.visibilityState === 'visible' && activeUserId === userId) void syncOnce(userId);
  };
  listeners.focus = () => { if (activeUserId === userId) void syncOnce(userId); };
  window.addEventListener('tab-db-changed', listeners.dbChanged);
  window.addEventListener('online', listeners.online);
  document.addEventListener('visibilitychange', listeners.visible);
  window.addEventListener('focus', listeners.focus);
}

function unwireListeners() {
  if (listeners.dbChanged) window.removeEventListener('tab-db-changed', listeners.dbChanged);
  if (listeners.online) window.removeEventListener('online', listeners.online);
  if (listeners.visible) document.removeEventListener('visibilitychange', listeners.visible);
  if (listeners.focus) window.removeEventListener('focus', listeners.focus);
  listeners.dbChanged = null;
  listeners.online = null;
  listeners.visible = null;
  listeners.focus = null;
}

export async function initializeSync(userId: string) {
  stopSync();
  activeUserId = userId;
  retryAttempt = 0;
  window.clearTimeout(retryTimer);
  wireListeners(userId);
  startPeriodic(userId);
  realtimeUnsub = subscribeToAppData(userId, () => onRealtimeEvent(userId));
  await syncOnce(userId);
}

export function stopSync() {
  unwireListeners();
  window.clearTimeout(retryTimer);
  window.clearTimeout(pushTimer);
  window.clearInterval(periodicTimer);
  window.clearTimeout(realtimeTimer);
  realtimeUnsub?.();
  realtimeUnsub = null;
  realtimeDirty = false;
  retryTimer = undefined;
  pushTimer = undefined;
  periodicTimer = undefined;
  realtimeTimer = undefined;
  activeUserId = null;
}

export async function syncNow(userId: string) {
  retryAttempt = 0;
  await syncOnce(userId);
}

export function getSyncSnapshot(userId: string): SyncStatusSnapshot {
  return readSnapshot(userId);
}

export function isSyncActive() {
  return activeUserId !== null;
}

export function getSyncOnMobileData() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(MOBILE_DATA_PREF_KEY) !== '0';
}

export function setSyncOnMobileData(enabled: boolean) {
  localStorage.setItem(MOBILE_DATA_PREF_KEY, enabled ? '1' : '0');
}

export function markQueueFailedItem(itemId: string, error: string) {
  markQueueItemFailed(itemId, error);
}