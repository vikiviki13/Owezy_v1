import type { User } from '@supabase/supabase-js';
import { defaultPreferences } from './preferences';
import { readPrivateData, SecurityServiceError, writePrivateData } from './securityService';

const RUNTIME_DB_KEY = 'tab_db_session_v2';
const LEGACY_DB_KEY = 'tab_db_v1';

export type LegacyMigrationDecision = 'import' | 'discard';

export class LegacyDataChoiceRequired extends Error {
  constructor() {
    super('Older data was found on this device and needs your confirmation.');
    this.name = 'LegacyDataChoiceRequired';
  }
}

type StoredData = Record<string, unknown> & {
  rev?: number;
  updated_at?: string;
  profile: Record<string, unknown>;
};

let activeUserId: string | null = null;
let syncHandler: (() => void) | null = null;
let onlineHandler: (() => void) | null = null;
let focusHandler: (() => void) | null = null;
let retryTimer: number | undefined = undefined;
let pendingSync: Promise<void> = Promise.resolve();
let lastSyncError: Error | null = null;

function emptyData(user: User): StoredData {
  const now = new Date().toISOString();
  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : '';

  return {
    rev: 0,
    updated_at: now,
    profile: {
      id: user.id,
      full_name: metadataName || user.email?.split('@')[0] || 'You',
      email: user.email,
      default_currency: 'INR',
      created_at: now,
      updated_at: now,
    },
    preferences: defaultPreferences(user.id),
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
  };
}

function prepareData(value: unknown, user: User): StoredData {
  const fallback = emptyData(user);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const stored = value as Record<string, unknown>;
  const storedProfile = stored.profile && typeof stored.profile === 'object' && !Array.isArray(stored.profile)
    ? stored.profile as Record<string, unknown>
    : {};
  const storedPreferences = stored.preferences && typeof stored.preferences === 'object' && !Array.isArray(stored.preferences)
    ? stored.preferences as Record<string, unknown>
    : {};

  return {
    ...fallback,
    ...stored,
    rev: typeof stored.rev === 'number' ? stored.rev : 0,
    updated_at: typeof stored.updated_at === 'string' && stored.updated_at
      ? stored.updated_at
      : typeof storedProfile.updated_at === 'string' ? storedProfile.updated_at : fallback.updated_at,
    profile: {
      ...fallback.profile,
      ...storedProfile,
      id: user.id,
      email: user.email,
    },
    preferences: {
      ...defaultPreferences(user.id),
      ...storedPreferences,
      user_id: user.id,
    },
  };
}

async function upload(userId: string, data: StoredData) {
  await writePrivateData(userId, data);
}

function queueUpload() {
  if (!activeUserId) return;
  const raw = localStorage.getItem(RUNTIME_DB_KEY);
  if (!raw) return;

  const userId = activeUserId;
  let snapshot: StoredData;
  try {
    snapshot = JSON.parse(raw) as StoredData;
  } catch {
    return;
  }

  window.clearTimeout(retryTimer);
  retryTimer = undefined;

  pendingSync = pendingSync
    .then(async () => {
      await upload(userId, snapshot);
      lastSyncError = null;
      window.dispatchEvent(new CustomEvent('tab-cloud-synced'));
    })
    .catch((caught: unknown) => {
      lastSyncError = caught instanceof Error ? caught : new Error('Cloud sync failed.');
      window.dispatchEvent(new CustomEvent('tab-cloud-sync-error', { detail: lastSyncError.message }));
      // Keep retrying in the background so a temporary failure (offline,
      // expired unlock grant, transient server error) self-heals without
      // any user action or data loss.
      retryTimer = window.setTimeout(() => { if (activeUserId) queueUpload(); }, 30_000);
    });
}

export async function initializeCloudData(user: User, legacyDecision?: LegacyMigrationDecision) {
  stopCloudData();
  lastSyncError = null;

  let data: StoredData;
  let recovered = false;
  try {
    const result = await readPrivateData<StoredData>(user.id);
    const storedData = result.data;

    // The local runtime copy may be newer than the server copy (a previous
    // sync failed, so the server still holds older data). Compare the write
    // revisions and keep whichever is newer — never let a stale server
    // snapshot clobber freshly saved local changes.
    const cachedRaw = localStorage.getItem(RUNTIME_DB_KEY);
    let cachedData: StoredData | null = null;
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw) as StoredData;
        cachedData = prepareData(parsed, user);
      } catch {
        cachedData = null;
      }
    }

    if (storedData) {
      const localNewer = cachedData && (cachedData.rev || 0) > (prepareData(storedData, user).rev || 0);
      if (localNewer) {
        data = cachedData!;
        recovered = true;
      } else {
        data = prepareData(storedData, user);
        // A confirmed server copy supersedes plaintext persistence used by older
        // releases, so remove that residual shared-browser copy immediately.
        localStorage.removeItem(LEGACY_DB_KEY);
        localStorage.removeItem('tab_legacy_migrated_v1');
      }
    } else if (cachedData) {
      // No server copy yet (first ever sync never succeeded). Keep the local
      // copy instead of discarding it, and upload it below.
      data = cachedData;
      recovered = true;
    } else {
      const legacy = localStorage.getItem(LEGACY_DB_KEY);
      if (legacy && !legacyDecision) throw new LegacyDataChoiceRequired();
      if (legacy && legacyDecision === 'import') {
        try {
          data = prepareData(JSON.parse(legacy), user);
        } catch {
          data = emptyData(user);
        }
      } else {
        data = emptyData(user);
      }
      await upload(user.id, data);
      // Remove the unbound legacy copy only after the chosen server operation
      // succeeds, so a failed migration is never silently marked complete.
      if (legacy && legacyDecision) localStorage.removeItem(LEGACY_DB_KEY);
    }
  } catch (caught) {
    // The user is already authenticated with a valid session. If the server is
    // unreachable (offline / network error), fall back to the last locally
    // persisted copy so the app stays usable instead of forcing a sign-in.
    const isOffline = navigator.onLine === false
      || (caught instanceof SecurityServiceError && caught.code === 'network_failure');
    if (isOffline) {
      const cached = localStorage.getItem(RUNTIME_DB_KEY);
      if (cached) {
        try {
          data = prepareData(JSON.parse(cached), user);
        } catch {
          throw caught;
        }
      } else {
        throw caught;
      }
    } else {
      throw caught;
    }
  }

  localStorage.setItem(RUNTIME_DB_KEY, JSON.stringify(data));
  activeUserId = user.id;
  syncHandler = queueUpload;
  window.addEventListener('tab-db-changed', syncHandler);
  onlineHandler = () => { if (activeUserId) queueUpload(); };
  window.addEventListener('online', onlineHandler);
  focusHandler = () => { if (activeUserId) queueUpload(); };
  window.addEventListener('focus', focusHandler);
  if (recovered) queueUpload();
}

export function stopCloudData() {
  if (syncHandler) window.removeEventListener('tab-db-changed', syncHandler);
  if (onlineHandler) window.removeEventListener('online', onlineHandler);
  if (focusHandler) window.removeEventListener('focus', focusHandler);
  window.clearTimeout(retryTimer);
  retryTimer = undefined;
  syncHandler = null;
  onlineHandler = null;
  focusHandler = null;
  activeUserId = null;
}

export function clearCloudRuntimeState() {
  stopCloudData();
  pendingSync = Promise.resolve();
  lastSyncError = null;
}

export async function flushCloudData() {
  await pendingSync;
  if (lastSyncError) throw lastSyncError;
}
