import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

const DATABASE_NAME = 'tab_device_contacts_v1';
const DATABASE_VERSION = 1;
const STORE_NAME = 'device_contacts_cache';

export interface LocalDeviceContact {
  local_id: string;
  name: string;
  phone_numbers: string[];
  email?: string;
  normalized_phone: string;
  selected_at: string;
  last_seen_at: string;
  source: 'device_contact';
}

export interface PlatformContact {
  name?: string[];
  tel?: string[];
  email?: string[];
}

type ContactsNavigator = Navigator & {
  contacts?: {
    select: (
      properties: Array<'name' | 'tel' | 'email'>,
      options: { multiple: boolean },
    ) => Promise<PlatformContact[]>;
  };
};

export class ContactServiceError extends Error {
  code: 'unsupported' | 'permission_denied' | 'picker_cancelled' | 'cache_unavailable' | 'picker_failed';

  constructor(code: ContactServiceError['code'], message: string) {
    super(message);
    this.name = 'ContactServiceError';
    this.code = code;
  }
}

export function normalizeContactPhone(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const parsed = parsePhoneNumberFromString(raw, 'IN');
  if (parsed?.isValid()) return parsed.number;
  const digits = raw.replace(/\D/g, '');
  return raw.startsWith('+') && digits ? `+${digits}` : digits;
}

function localContactId(name: string, normalizedPhone: string): string {
  const value = `${name.toLowerCase()}|${normalizedPhone}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `device-contact-${(hash >>> 0).toString(36)}`;
}

export function platformContactsToLocal(
  contacts: PlatformContact[],
  now = new Date().toISOString(),
): LocalDeviceContact[] {
  return contacts.flatMap((contact) => {
    const phoneNumbers = [...new Set((contact.tel || []).map((phone) => phone.trim()).filter(Boolean))];
    if (!phoneNumbers.length) return [];
    const normalizedPhone = normalizeContactPhone(phoneNumbers[0]);
    const name = contact.name?.find((value) => value.trim())?.trim() || phoneNumbers[0];
    return [{
      local_id: localContactId(name, normalizedPhone || phoneNumbers[0]),
      name,
      phone_numbers: phoneNumbers,
      email: contact.email?.find((value) => value.trim())?.trim().toLowerCase() || undefined,
      normalized_phone: normalizedPhone,
      selected_at: now,
      last_seen_at: now,
      source: 'device_contact' as const,
    }];
  });
}

export function filterLocalContacts(contacts: LocalDeviceContact[], query: string): LocalDeviceContact[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return contacts;
  const phoneQuery = normalizedQuery.replace(/\D/g, '');
  return contacts.filter((contact) => {
    if (contact.name.toLowerCase().includes(normalizedQuery)) return true;
    const searchableNumbers = [contact.normalized_phone, ...contact.phone_numbers];
    return Boolean(phoneQuery) && searchableNumbers.some((phone) => phone.replace(/\D/g, '').includes(phoneQuery));
  });
}

function openContactDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new ContactServiceError('cache_unavailable', 'Local contact storage is not available in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'local_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ContactServiceError('cache_unavailable', 'Local contact storage could not be opened.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new ContactServiceError('cache_unavailable', 'Local contact storage could not be updated.'));
    transaction.onabort = () => reject(new ContactServiceError('cache_unavailable', 'Local contact storage could not be updated.'));
  });
}

export function isSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const contacts = (navigator as ContactsNavigator).contacts;
  return Boolean(contacts && typeof contacts.select === 'function');
}

export async function requestAccess(): Promise<void> {
  // The web Contact Picker has no background permission grant. The operating
  // system asks only when select() is called from the user's Continue action.
  if (!isSupported()) {
    throw new ContactServiceError('unsupported', "Device contact import isn't available in this browser.");
  }
}

export async function openContactPicker(multiple = true): Promise<LocalDeviceContact[]> {
  if (!isSupported()) {
    throw new ContactServiceError('unsupported', "Device contact import isn't available in this browser.");
  }
  try {
    // Call select() synchronously from the click handler before the first await
    // so browsers retain the required transient user activation.
    const selection = (navigator as ContactsNavigator).contacts!.select(['name', 'tel', 'email'], { multiple });
    const selected = await selection;
    return platformContactsToLocal(selected);
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw new ContactServiceError('picker_cancelled', 'Contact selection was cancelled.');
    }
    if (caught instanceof DOMException && (caught.name === 'NotAllowedError' || caught.name === 'SecurityError')) {
      throw new ContactServiceError('permission_denied', "Contact access wasn't allowed.");
    }
    throw new ContactServiceError('picker_failed', 'Device contacts could not be opened.');
  }
}

export async function getLocalContacts(): Promise<LocalDeviceContact[]> {
  const database = await openContactDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as LocalDeviceContact[]).sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at)));
      request.onerror = () => reject(new ContactServiceError('cache_unavailable', 'Locally saved contacts could not be read.'));
    });
  } finally {
    database.close();
  }
}

export async function searchLocalContacts(query: string): Promise<LocalDeviceContact[]> {
  return filterLocalContacts(await getLocalContacts(), query);
}

export async function cacheContacts(contacts: LocalDeviceContact[]): Promise<void> {
  if (!contacts.length) return;
  const existing = await getLocalContacts().catch(() => []);
  const existingById = new Map(existing.map((contact) => [contact.local_id, contact]));
  const database = await openContactDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    contacts.forEach((contact) => {
      const previous = existingById.get(contact.local_id);
      store.put({ ...contact, selected_at: previous?.selected_at || contact.selected_at });
    });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function selectContact(localId: string): Promise<LocalDeviceContact | undefined> {
  const database = await openContactDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(localId);
      request.onsuccess = () => resolve(request.result as LocalDeviceContact | undefined);
      request.onerror = () => reject(new ContactServiceError('cache_unavailable', 'That local contact could not be read.'));
    });
  } finally {
    database.close();
  }
}

export async function clearContactCache(): Promise<void> {
  const database = await openContactDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export const contactService = {
  isSupported,
  requestAccess,
  openContactPicker,
  getLocalContacts,
  searchLocalContacts,
  cacheContacts,
  selectContact,
  clearContactCache,
};
