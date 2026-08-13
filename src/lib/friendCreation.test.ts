import { describe, expect, it } from 'vitest';
import type { Friend } from '../types';
import { normalizePhoneNumber, validateFriendDetails, type FriendFormValues } from './friendCreation';

const base: FriendFormValues = {
  avatarUrl: '',
  name: 'Arun Kumar',
  nickname: '',
  whatsappCountry: 'IN',
  whatsappNumber: '98765 43210',
  phoneNumber: '',
  email: '',
  notes: '',
};

function existingFriend(whatsappNumber: string): Friend {
  return {
    id: 'friend-1',
    owner_id: 'owner',
    name: 'Existing Friend',
    whatsapp_number: whatsappNumber,
    is_archived: false,
    created_at: '2026-08-13T00:00:00.000Z',
    updated_at: '2026-08-13T00:00:00.000Z',
  };
}

describe('friend creation validation', () => {
  it('normalizes a valid WhatsApp number to E.164', () => {
    expect(normalizePhoneNumber('98765 43210', 'IN')).toBe('+919876543210');
    expect(validateFriendDetails(base, []).details?.whatsappNumber).toBe('+919876543210');
  });

  it('requires a valid name and WhatsApp number', () => {
    const result = validateFriendDetails({ ...base, name: ' ', whatsappNumber: '123' }, []);
    expect(result.details).toBeNull();
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.whatsappNumber).toBeTruthy();
  });

  it('rejects a duplicate WhatsApp number after normalization', () => {
    const result = validateFriendDetails(base, [existingFriend('+91 98765 43210')]);
    expect(result.details).toBeNull();
    expect(result.errors.whatsappNumber).toContain('Existing Friend');
  });
});
