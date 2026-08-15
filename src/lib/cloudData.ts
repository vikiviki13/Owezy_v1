import type { User } from '@supabase/supabase-js';
import { defaultPreferences } from './preferences';
import { readPrivateData, writePrivateData } from './securityService';

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
  profile: Record<string, unknown>;
};

let activeUserId: string | null = null;
let syncHandler: (() => void) | null = null;
let pendingSync: Promise<void> = Promise.resolve();
let lastSyncError: Error | null = null;

function emptyData(user: User): StoredData {
  const now = new Date().toISOString();
  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : '';

  return {
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
  const raw = sessionStorage.getItem(RUNTIME_DB_KEY);
  if (!raw) return;

  const userId = activeUserId;
  let snapshot: StoredData;
  try {
    snapshot = JSON.parse(raw) as StoredData;
  } catch {
    return;
  }

  pendingSync = pendingSync
    .then(async () => {
      await upload(userId, snapshot);
      lastSyncError = null;
      window.dispatchEvent(new CustomEvent('tab-cloud-synced'));
    })
    .catch((caught: unknown) => {
      lastSyncError = caught instanceof Error ? caught : new Error('Cloud sync failed.');
      window.dispatchEvent(new CustomEvent('tab-cloud-sync-error', { detail: lastSyncError.message }));
    });
}

export async function initializeCloudData(user: User, legacyDecision?: LegacyMigrationDecision) {
  stopCloudData();
  lastSyncError = null;

  const storedData = await readPrivateData<StoredData>(user.id);

  let data: StoredData;
  if (storedData) {
    data = prepareData(storedData, user);
    // A confirmed server copy supersedes plaintext persistence used by older
    // releases, so remove that residual shared-browser copy immediately.
    localStorage.removeItem(LEGACY_DB_KEY);
    localStorage.removeItem('tab_legacy_migrated_v1');
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

  sessionStorage.setItem(RUNTIME_DB_KEY, JSON.stringify(data));
  activeUserId = user.id;
  syncHandler = queueUpload;
  window.addEventListener('tab-db-changed', syncHandler);
}

export function stopCloudData() {
  if (syncHandler) window.removeEventListener('tab-db-changed', syncHandler);
  syncHandler = null;
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
