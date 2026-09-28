import type { Friend } from '../types';
import { commitImportedFriends } from './db';
import { normalizePhoneToE164 } from './contactImport';
import { supabase } from './supabase';
import { importConfirmedFriends, reclaimConfirmedFriend, SecurityServiceError } from './securityService';

export interface ConfirmedFriendImport {
  clientId: string;
  name: string;
  nickname?: string;
  whatsappE164: string;
  phoneNumber: string;
  email?: string;
}

export interface FriendImportSuccess {
  clientId: string;
  friend: Friend;
}

export interface FriendImportFailure {
  clientId: string;
  name: string;
  reason: string;
}

export interface FriendImportBatchResult {
  successes: FriendImportSuccess[];
  failures: FriendImportFailure[];
}

interface FriendInsertRow {
  id: string;
  owner_id: string;
  name: string;
  nickname: string | null;
  whatsapp_e164: string;
  phone_number: string;
  email: string | null;
  created_at: string;
}

function secureBatchError(error: unknown) {
  if (error instanceof SecurityServiceError && error.code === 'unlock_required') return 'Unlock the app and try again.';
  if (error instanceof SecurityServiceError && error.code === 'rate_limited') return 'Too many import requests. Wait briefly and try again.';
  return 'This friend could not be added. Please try again.';
}

function rowToFriend(row: FriendInsertRow): Friend {
  // A re-imported contact reuses the server row created on its first import,
  // so that row's own `created_at` predates the deletion that removed the
  // friend locally. Stamp the re-add time as `updated_at`: the sync layer only
  // keeps a record while its timestamp is newer than its deletion tombstone,
  // otherwise the restored friend would vanish again on the next sync merge.
  const now = new Date().toISOString();
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    nickname: row.nickname || undefined,
    whatsapp_e164: row.whatsapp_e164,
    whatsapp_number: row.whatsapp_e164,
    phone_number: row.phone_number,
    phone: row.phone_number,
    email: row.email || undefined,
    is_archived: false,
    created_at: row.created_at,
    updated_at: now,
  };
}

async function claimImportedFriendRow(userId: string, input: ConfirmedFriendImport): Promise<FriendInsertRow | undefined> {
  const whatsappE164 = normalizePhoneToE164(input.whatsappE164);
  if (!whatsappE164) return undefined;
  const { data, error } = await supabase
    .from('friends')
    .select('id, owner_id, name, nickname, whatsapp_e164, phone_number, email, created_at')
    .eq('owner_id', userId)
    .eq('whatsapp_e164', whatsappE164)
    .maybeSingle();
  if (error || !data) return undefined;
  return data as FriendInsertRow;
}

function reclaimPayload(input: ConfirmedFriendImport): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    whatsappE164: normalizePhoneToE164(input.whatsappE164) || '',
    phoneNumber: input.phoneNumber.trim(),
  };
  if (input.nickname?.trim()) payload.nickname = input.nickname.trim();
  if (input.email?.trim()) payload.email = input.email.trim();
  return payload;
}

// Recovers a number the server rejected so the owner can add that contact
// again. Deleting a friend only removes it from the synced app document, so
// the account's `friends` row for that number survives and a back-end without
// the re-add upsert reports the number as a duplicate.
//
// The reclaim runs on the service role inside the Edge Function. Reading the
// row from the browser is not a valid substitute: security_enforcement.sql
// revokes all access to `friends` from `authenticated`, so that select returns
// a permission error and the contact can never be re-added. The direct read is
// kept only as a fallback for a not-yet-deployed `friends/reclaim` action.
async function reclaimImportedFriend(userId: string, input: ConfirmedFriendImport): Promise<FriendInsertRow | undefined> {
  const whatsappE164 = normalizePhoneToE164(input.whatsappE164);
  if (!whatsappE164) return undefined;
  try {
    const { row } = await reclaimConfirmedFriend<FriendInsertRow>(userId, reclaimPayload(input));
    return row || undefined;
  } catch (caught) {
    if (caught instanceof SecurityServiceError && caught.code === 'unknown_action') {
      return claimImportedFriendRow(userId, input);
    }
    return undefined;
  }
}

export async function createImportedFriendsBatch(inputs: ConfirmedFriendImport[]): Promise<FriendImportBatchResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    const reason = 'Your session expired. Sign in again and retry.';
    return { successes: [], failures: inputs.map((input) => ({ clientId: input.clientId, name: input.name, reason })) };
  }

  const successes: FriendImportSuccess[] = [];
  const failures: FriendImportFailure[] = [];
  const valid: Array<{ input: ConfirmedFriendImport; payload: Record<string, unknown> }> = [];

  for (const input of inputs) {
      const whatsappE164 = normalizePhoneToE164(input.whatsappE164);
      const name = input.name.trim();
      const phoneNumber = input.phoneNumber.trim();
      if (!name || name.length > 120 || !whatsappE164 || !phoneNumber || phoneNumber.length > 32) {
        failures.push({ clientId: input.clientId, name: input.name, reason: 'Name and a valid WhatsApp number are required.' });
        continue;
      }
      const payload: Record<string, unknown> = {
        clientId: input.clientId,
        name,
        whatsappE164,
        phoneNumber,
      };
      if (input.nickname?.trim()) payload.nickname = input.nickname.trim();
      if (input.email?.trim()) payload.email = input.email.trim();
      valid.push({ input, payload });
  }

  // Server batches are capped to bound request size and resource use. Larger
  // user-confirmed selections are processed in controlled chunks.
  for (let offset = 0; offset < valid.length; offset += 100) {
    const chunk = valid.slice(offset, offset + 100);
    try {
      const result = await importConfirmedFriends<FriendInsertRow>(user.id, chunk.map((entry) => entry.payload));
      // A number the user imported and later deleted is still rejected as a
      // duplicate by a back-end that predates the re-add upsert. Reclaim the
      // account's own row for it so the contact can be added again. Every
      // failure is retried rather than matched on its message text: an
      // invalid contact is rejected again by the same field validation, so it
      // falls through to its original reason.
      const recoveredById = new Map<string, FriendInsertRow>();
      for (const failure of result.failures) {
        const target = chunk.find((entry) => entry.input.clientId === failure.clientId);
        if (!target) continue;
        const row = await reclaimImportedFriend(user.id, target.input);
        if (row) recoveredById.set(failure.clientId, row);
      }
      for (const imported of result.successes) {
        successes.push({ clientId: imported.clientId, friend: rowToFriend(imported.row) });
      }
      for (const failure of result.failures) {
        if (recoveredById.has(failure.clientId)) {
          successes.push({ clientId: failure.clientId, friend: rowToFriend(recoveredById.get(failure.clientId)!) });
        } else {
          failures.push(failure);
        }
      }
    } catch (caught) {
      const reason = secureBatchError(caught);
      failures.push(...chunk.map(({ input }) => ({ clientId: input.clientId, name: input.name, reason })));
    }
  }

  if (successes.length) commitImportedFriends(successes.map((result) => result.friend));
  return { successes, failures };
}
