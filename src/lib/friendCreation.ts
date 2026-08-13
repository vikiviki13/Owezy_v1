import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import type { Friend } from '../types';
import { createFriend, listFriends } from './db';

export interface FriendFormValues {
  avatarUrl: string;
  name: string;
  nickname: string;
  whatsappCountry: CountryCode;
  whatsappNumber: string;
  phoneNumber: string;
  email: string;
  notes: string;
}

export interface FriendFormErrors {
  name?: string;
  whatsappNumber?: string;
  phoneNumber?: string;
  email?: string;
}

export interface ValidatedFriendDetails {
  avatarUrl?: string;
  name: string;
  nickname?: string;
  whatsappNumber: string;
  phoneNumber: string;
  email?: string;
  notes?: string;
}

export function normalizePhoneNumber(value: string, defaultCountry: CountryCode): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

function normalizedExistingWhatsApp(friend: Friend, defaultCountry: CountryCode) {
  const stored = friend.whatsapp_number || friend.phone || '';
  return normalizePhoneNumber(stored, defaultCountry);
}

export function validateFriendDetails(
  values: FriendFormValues,
  existingFriends: Friend[],
): { errors: FriendFormErrors; details: ValidatedFriendDetails | null } {
  const errors: FriendFormErrors = {};
  const name = values.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2) errors.name = 'Enter a name with at least 2 characters.';
  else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer.';

  const whatsappNumber = normalizePhoneNumber(values.whatsappNumber, values.whatsappCountry);
  if (!values.whatsappNumber.trim()) errors.whatsappNumber = 'WhatsApp number is required.';
  else if (!whatsappNumber) errors.whatsappNumber = 'Enter a valid WhatsApp number for the selected country.';
  else {
    const duplicate = existingFriends.find((friend) => normalizedExistingWhatsApp(friend, values.whatsappCountry) === whatsappNumber);
    if (duplicate) errors.whatsappNumber = `This WhatsApp number already belongs to ${duplicate.name}.`;
  }

  let phoneNumber: string | null = null;
  if (values.phoneNumber.trim()) {
    phoneNumber = normalizePhoneNumber(values.phoneNumber, values.whatsappCountry);
    if (!phoneNumber) errors.phoneNumber = 'Enter a valid phone number or leave this field empty.';
  }

  const email = values.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (Object.keys(errors).length > 0 || !whatsappNumber) return { errors, details: null };
  return {
    errors,
    details: {
      avatarUrl: values.avatarUrl || undefined,
      name,
      nickname: values.nickname.trim() || undefined,
      whatsappNumber,
      phoneNumber: phoneNumber || whatsappNumber,
      email: email || undefined,
      notes: values.notes.trim() || undefined,
    },
  };
}

export class FriendCreationError extends Error {
  errors: FriendFormErrors;

  constructor(errors: FriendFormErrors) {
    super(Object.values(errors)[0] || 'Friend details are invalid.');
    this.name = 'FriendCreationError';
    this.errors = errors;
  }
}

export function createFriendFromDetails(values: FriendFormValues): Friend {
  const validation = validateFriendDetails(values, listFriends(true));
  if (!validation.details) throw new FriendCreationError(validation.errors);
  const details = validation.details;
  return createFriend({
    name: details.name,
    nickname: details.nickname,
    whatsapp_number: details.whatsappNumber,
    phone: details.phoneNumber,
    email: details.email,
    notes: details.notes,
    avatar_url: details.avatarUrl,
  });
}
