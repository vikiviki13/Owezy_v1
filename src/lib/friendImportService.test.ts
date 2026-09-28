import { describe, expect, it, beforeEach, vi } from 'vitest';

// A friend profile the user deleted keeps its row in the `friends` table
// (deletions only affect the synced app document), so re-adding that contact
// is rejected as a duplicate unless the account's own row is reclaimed. The
// reclaim has to run on the service role: security_enforcement.sql revokes all
// access to `friends` from `authenticated`, so a browser-side read of that row
// returns a permission error and the contact can never be added back.

const readRow = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => {
      const eq = vi.fn(() => ({ maybeSingle: readRow }));
      const select = vi.fn(() => ({ eq: vi.fn(() => ({ eq })) }));
      return { select };
    }),
  },
  isSupabaseConfigured: true,
}));

const importConfirmedFriends = vi.fn();
const reclaimConfirmedFriend = vi.fn();
vi.mock('./securityService', () => ({
  importConfirmedFriends: (...args: unknown[]) => importConfirmedFriends(...args),
  reclaimConfirmedFriend: (...args: unknown[]) => reclaimConfirmedFriend(...args),
  SecurityServiceError: class SecurityServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

const { createFriend, deleteFriend, listFriends, resetDB } = await import('./db');
const { classifyContactDraft, createContactImportDraft } = await import('./contactImport');
const { createImportedFriendsBatch } = await import('./friendImportService');
const { SecurityServiceError } = await import('./securityService');

function stubStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: () => true });
}

const NUMBER = '+919876543210';

// The surviving `friends` row. `created_at` predates the deletion, so the
// re-add only sticks if the client stamps a newer `updated_at`.
const SERVER_ROW = {
  id: 'server-row-uuid',
  owner_id: 'user-1',
  name: 'Arun',
  nickname: null,
  whatsapp_e164: NUMBER,
  phone_number: NUMBER,
  email: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

function rejectedAsDuplicate() {
  return { successes: [], failures: [{ clientId: 'c1', name: 'Arun', reason: 'This WhatsApp number is already being used.' }] };
}

const input = [{ clientId: 'c1', name: 'Arun', whatsappE164: NUMBER, phoneNumber: NUMBER }];

beforeEach(() => {
  stubStorage();
  resetDB();
  readRow.mockReset();
  importConfirmedFriends.mockReset();
  reclaimConfirmedFriend.mockReset();
});

describe('re-adding a friend whose profile was deleted', () => {
  it('offers the contact again once the profile is deleted', () => {
    const friend = createFriend({ name: 'Arun', whatsapp_e164: NUMBER, phone_number: NUMBER, phone: NUMBER });
    const draft = createContactImportDraft([{ name: ['Arun'], tel: [NUMBER] }], 'friends', 'user-1');

    expect(classifyContactDraft(draft.items, listFriends())[0].status).toBe('already');

    deleteFriend(friend.id);
    expect(classifyContactDraft(draft.items, listFriends())[0].status).toBe('ready');
  });

  it('re-adds the contact when the back-end reports the number as a duplicate', async () => {
    reclaimConfirmedFriend.mockResolvedValue({ row: SERVER_ROW });
    importConfirmedFriends.mockResolvedValue(rejectedAsDuplicate());

    const result = await createImportedFriendsBatch(input);

    expect(result.failures).toEqual([]);
    expect(result.successes).toHaveLength(1);
    expect(result.successes[0].friend.id).toBe('server-row-uuid');
  });

  it('re-adds the contact without reading the friends table', async () => {
    // The browser has no grant on `friends`, so a direct select is a 42501.
    readRow.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table friends' } });
    reclaimConfirmedFriend.mockResolvedValue({ row: SERVER_ROW });
    importConfirmedFriends.mockResolvedValue(rejectedAsDuplicate());

    const result = await createImportedFriendsBatch(input);

    expect(result.failures).toEqual([]);
    expect(result.successes).toHaveLength(1);
    expect(readRow).not.toHaveBeenCalled();
  });

  it('stamps the re-add with a fresh updated_at so the deletion tombstone cannot hide it', async () => {
    const friend = createFriend({ name: 'Arun', whatsapp_e164: NUMBER });
    deleteFriend(friend.id);
    reclaimConfirmedFriend.mockResolvedValue({ row: SERVER_ROW });
    importConfirmedFriends.mockResolvedValue(rejectedAsDuplicate());

    const result = await createImportedFriendsBatch(input);

    const reAdded = result.successes[0].friend;
    expect(new Date(reAdded.updated_at).getTime()).toBeGreaterThan(new Date(reAdded.created_at).getTime());
    expect(listFriends().map((entry) => entry.id)).toContain(reAdded.id);
  });

  it('falls back to the direct read while friends/reclaim is not deployed yet', async () => {
    readRow.mockResolvedValue({ data: SERVER_ROW, error: null });
    reclaimConfirmedFriend.mockRejectedValue(new SecurityServiceError('unknown_action', 'This security action is not available.'));
    importConfirmedFriends.mockResolvedValue(rejectedAsDuplicate());

    const result = await createImportedFriendsBatch(input);

    expect(result.successes).toHaveLength(1);
    expect(readRow).toHaveBeenCalled();
  });

  it('still reports its own reason for a contact that is genuinely invalid', async () => {
    // The reclaim runs the same field validation, so an invalid contact is
    // rejected again and the original message is preserved.
    reclaimConfirmedFriend.mockRejectedValue(new SecurityServiceError('invalid_friend', 'Name and a valid WhatsApp number are required.'));
    importConfirmedFriends.mockResolvedValue({
      successes: [],
      failures: [{ clientId: 'c1', name: 'Arun', reason: 'Name and a valid WhatsApp number are required.' }],
    });

    const result = await createImportedFriendsBatch([{ clientId: 'c1', name: 'Arun', whatsappE164: 'not-a-number', phoneNumber: 'x' }]);

    expect(result.successes).toHaveLength(0);
    expect(result.failures[0].reason).toBe('Name and a valid WhatsApp number are required.');
  });
});
