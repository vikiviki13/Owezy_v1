import type { Friend } from '../types';
import { commitImportedFriends } from './db';
import { normalizePhoneToE164 } from './contactImport';
import { supabase } from './supabase';

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

function friendlyImportError(error: { code?: string; message: string }) {
  if (error.code === '23505') return 'This WhatsApp number is already being used.';
  if (error.code === '42501') return 'Your session cannot add this friend. Sign in again and retry.';
  return error.message || 'This friend could not be added.';
}

export async function createImportedFriendsBatch(inputs: ConfirmedFriendImport[]): Promise<FriendImportBatchResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    const reason = userError?.message || 'Your session expired. Sign in again and retry.';
    return { successes: [], failures: inputs.map((input) => ({ clientId: input.clientId, name: input.name, reason })) };
  }

  const successes: FriendImportSuccess[] = [];
  const failures: FriendImportFailure[] = [];
  const concurrency = 4;

  for (let offset = 0; offset < inputs.length; offset += concurrency) {
    const chunk = inputs.slice(offset, offset + concurrency);
    const results = await Promise.all(chunk.map(async (input) => {
      const whatsappE164 = normalizePhoneToE164(input.whatsappE164);
      if (!input.name.trim() || !whatsappE164) {
        return { input, error: { message: 'Name and a valid WhatsApp number are required.' } } as const;
      }

      const payload: Record<string, string> = {
        owner_id: user.id,
        name: input.name.trim(),
        whatsapp_e164: whatsappE164,
        phone_number: input.phoneNumber.trim(),
        created_at: new Date().toISOString(),
      };
      if (input.nickname?.trim()) payload.nickname = input.nickname.trim();
      if (input.email?.trim()) payload.email = input.email.trim();

      const { data, error } = await supabase
        .from('friends')
        .insert(payload)
        .select('id, owner_id, name, nickname, whatsapp_e164, phone_number, email, created_at')
        .single();
      return { input, row: data as FriendInsertRow | null, error } as const;
    }));

    for (const result of results) {
      if (result.error || !result.row) {
        failures.push({
          clientId: result.input.clientId,
          name: result.input.name,
          reason: friendlyImportError(result.error || { message: 'This friend could not be added.' }),
        });
        continue;
      }

      const row = result.row;
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
      successes.push({ clientId: result.input.clientId, friend });
    }
  }

  if (successes.length) commitImportedFriends(successes.map((result) => result.friend));
  return { successes, failures };
}
