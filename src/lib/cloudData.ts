import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { defaultPreferences } from './preferences';

const LOCAL_DB_KEY = 'tab_db_v1';
const LEGACY_MIGRATION_KEY = 'tab_legacy_migrated_v1';

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
  const { error } = await supabase
    .from('app_data')
    .upsert(
      { user_id: userId, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

function queueUpload() {
  if (!activeUserId) return;
  const raw = localStorage.getItem(LOCAL_DB_KEY);
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

export async function initializeCloudData(user: User) {
  stopCloudData();
  lastSyncError = null;

  const { data: row, error } = await supabase
    .from('app_data')
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  let data: StoredData;
  if (row?.data) {
    data = prepareData(row.data, user);
  } else {
    const legacy = localStorage.getItem(LOCAL_DB_KEY);
    const legacyAlreadyClaimed = localStorage.getItem(LEGACY_MIGRATION_KEY) === '1';
    if (legacy && !legacyAlreadyClaimed) {
      try {
        data = prepareData(JSON.parse(legacy), user);
      } catch {
        data = emptyData(user);
      }
      localStorage.setItem(LEGACY_MIGRATION_KEY, '1');
    } else {
      data = emptyData(user);
    }
    await upload(user.id, data);
  }

  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data));
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
