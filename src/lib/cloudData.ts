// Cloud data bootstrap. Keeps the historical public API used by App.tsx and
// Profile.tsx; the actual synchronization now lives in src/services/sync.

import type { User } from '@supabase/supabase-js';
import { defaultPreferences } from './preferences';
import { initializeSync, stopSync, syncNow } from '../services/sync/syncManager';
import type { StoredDoc } from '../services/sync/conflictResolver';
import { clearSyncQueue } from '../services/sync/syncQueue';
import { readPrivateData, SecurityServiceError } from './securityService';

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

let activeUser: User | null = null;

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

export async function initializeCloudData(user: User, legacyDecision?: LegacyMigrationDecision) {
  stopSync();
  activeUser = user;

  let serverData: StoredData | null = null;
  let serverReadSucceeded = false;
  try {
    const result = await readPrivateData<StoredData>(user.id);
    serverData = result.data;
    serverReadSucceeded = true;
  } catch (caught) {
    const isOffline = navigator.onLine === false
      || (caught instanceof SecurityServiceError && caught.code === 'network_failure');
    if (!isOffline) throw caught;
  }

  const cached = localStorage.getItem(RUNTIME_DB_KEY);
  const legacy = localStorage.getItem(LEGACY_DB_KEY);

  // Offline with an unassigned legacy copy and no runtime cache: keep the
  // previous behavior of surfacing a startup error instead of silently
  // opening with an empty document.
  if (!serverReadSucceeded && !cached && legacy) {
    throw new SecurityServiceError('offline', "You're offline. Connect to the internet to open your data.");
  }

  // The unbound legacy copy is only offered when the cloud has no document at
  // all; a confirmed server copy supersedes it.
  if (serverReadSucceeded && !serverData && !cached && legacy && !legacyDecision) {
    throw new LegacyDataChoiceRequired();
  }

  if (!serverData && !cached) {
    let data: StoredData;
    if (legacy && legacyDecision === 'import') {
      try {
        data = prepareData(JSON.parse(legacy), user);
      } catch {
        data = emptyData(user);
      }
    } else {
      data = emptyData(user);
    }
    localStorage.setItem(RUNTIME_DB_KEY, JSON.stringify(data));
    if (legacy && legacyDecision) localStorage.removeItem(LEGACY_DB_KEY);
  }

  if (serverData) {
    // A confirmed server copy supersedes the plaintext legacy copy.
    localStorage.removeItem(LEGACY_DB_KEY);
    localStorage.removeItem('tab_legacy_migrated_v1');
  }

  // Pull the cloud document (already fetched above — reuse it so the app
  // opens after a single server round-trip), merge it with the local cache
  // record-by-record, push local-only records back, and wire all sync
  // triggers. The fetched copy is passed only to the first sync; later
  // triggers re-fetch on their own.
  await initializeSync(user.id, serverData as StoredDoc | null);
}

export function stopCloudData() {
  stopSync();
}

export function clearCloudRuntimeState() {
  stopSync();
  clearSyncQueue();
  activeUser = null;
}

export async function flushCloudData() {
  if (!activeUser) return;
  await syncNow(activeUser.id);
}