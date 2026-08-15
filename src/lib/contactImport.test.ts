import { describe, expect, it } from 'vitest';
import type { Friend } from '../types';
import {
  classifyContactDraft,
  clearContactImportDraft,
  createContactImportDraft,
  loadContactImportDraft,
  normalizePhoneToE164,
  saveContactImportDraft,
} from './contactImport';

function friend(overrides: Partial<Friend>): Friend {
  return {
    id: 'friend-1',
    owner_id: 'owner-1',
    name: 'Existing Friend',
    is_archived: false,
    created_at: '2026-08-15T00:00:00.000Z',
    updated_at: '2026-08-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('contact import validation', () => {
  it('normalizes common Indian phone formats to E.164', () => {
    expect(normalizePhoneToE164('98765 43210')).toBe('+919876543210');
    expect(normalizePhoneToE164('09876543210')).toBe('+919876543210');
    expect(normalizePhoneToE164('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhoneToE164('not a phone')).toBeUndefined();
  });

  it('does not guess when a contact has multiple phone numbers', () => {
    const draft = createContactImportDraft([
      { name: ['Karthik'], tel: ['98765 43210', '99887 66554'] },
    ], 'friends', 'user-1');

    expect(draft.items[0].selectedPhoneId).toBeUndefined();
    expect(classifyContactDraft(draft.items, [])[0]).toMatchObject({
      status: 'attention',
      message: 'Choose WhatsApp number',
    });
  });

  it('detects existing friends and duplicates within the selection', () => {
    const draft = createContactImportDraft([
      { name: ['Arun'], tel: ['+91 98765 43210'] },
      { name: ['Vijay'], tel: ['+91 99887 66554'] },
      { name: ['Vijay duplicate'], tel: ['99887 66554'] },
    ], 'friends', 'user-1');
    const reviews = classifyContactDraft(draft.items, [friend({ whatsapp_e164: '+919876543210' })]);

    expect(reviews.map((review) => [review.status, review.message])).toEqual([
      ['already', 'Already a Friend'],
      ['ready', 'Ready to add'],
      ['attention', 'Duplicate in selection'],
    ]);
  });

  it('requires both a name and WhatsApp number', () => {
    const draft = createContactImportDraft([{ name: [], tel: [] }], 'friends', 'user-1');
    expect(classifyContactDraft(draft.items, [])[0]).toMatchObject({ status: 'attention', message: 'Add a name' });
  });

  it('keeps an active draft in local memory when IndexedDB is unavailable', async () => {
    const draft = createContactImportDraft([{ name: ['Arun'], tel: ['98765 43210'] }], 'friends', 'user-1');
    await saveContactImportDraft(draft);
    expect((await loadContactImportDraft('user-1'))?.items[0].name).toBe('Arun');
    expect(await loadContactImportDraft('user-2')).toBeUndefined();
    await clearContactImportDraft('user-1');
    expect(await loadContactImportDraft('user-1')).toBeUndefined();
  });
});
