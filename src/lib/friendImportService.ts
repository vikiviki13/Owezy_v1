import type { Friend } from '../types';
import { commitImportedFriends } from './db';
import { normalizePhoneToE164 } from './contactImport';
import { supabase } from './supabase';
import { importConfirmedFriends, SecurityServiceError } from './securityService';

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
      for (const failure of result.failures) failures.push(failure);
      for (const imported of result.successes) {
        const row = imported.row;
        const friend: Friend = {
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
          updated_at: row.created_at,
        };
        successes.push({ clientId: imported.clientId, friend });
      }
    } catch (caught) {
      const reason = secureBatchError(caught);
      failures.push(...chunk.map(({ input }) => ({ clientId: input.clientId, name: input.name, reason })));
    }
  }

  if (successes.length) commitImportedFriends(successes.map((result) => result.friend));
  return { successes, failures };
}
