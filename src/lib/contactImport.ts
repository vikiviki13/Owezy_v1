import type { Friend } from '../types';
import { uid } from './utils';

export type ContactImportOrigin = 'friends' | 'expense';

export interface ContactPhoneCandidate {
  id: string;
  label: string;
  value: string;
}

export interface ContactImportItem {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  phones: ContactPhoneCandidate[];
  selectedPhoneId?: string;
  manualPhone: string;
  included: boolean;
}

export interface ContactImportDraft {
  version: 1;
  origin: ContactImportOrigin;
  expenseFriendIds: string[];
  items: ContactImportItem[];
  savedAt: string;
}

export type ContactReviewStatus = 'ready' | 'already' | 'attention' | 'unselected' | 'failed';

export interface ContactReviewItem {
  item: ContactImportItem;
  status: ContactReviewStatus;
  message: string;
  whatsappE164?: string;
  rawPhone?: string;
}

interface DeviceContactInfo {
  name?: string[];
  tel?: string[];
  email?: string[];
}

interface ContactsManagerLike {
  getProperties?: () => Promise<string[]>;
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<DeviceContactInfo[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManagerLike;
  }
}

const CACHE_DB = 'tab-local-contact-cache';
const CACHE_STORE = 'drafts';
const CACHE_KEY = 'active-import';
const EXPENSE_HANDOFF_KEY = 'tab-expense-contact-handoff';
let memoryDraft: ContactImportDraft | undefined;
let memoryExpenseHandoff: ExpenseContactHandoff | undefined;

export interface ExpenseContactHandoff {
  selectedFriendIds: string[];
  newFriendIds: string[];
}

export function isContactPickerSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.contacts?.select === 'function';
}

export async function pickDeviceContacts(): Promise<DeviceContactInfo[]> {
  if (!isContactPickerSupported() || !navigator.contacts) {
    throw new Error('Contact selection is not available in this browser. Try Chrome on an Android device, or add a friend manually.');
  }

  const supported = navigator.contacts.getProperties
    ? await navigator.contacts.getProperties()
    : ['name', 'tel', 'email'];
  const properties = ['name', 'tel', 'email'].filter((property) => supported.includes(property));
  if (!properties.includes('tel')) {
    throw new Error('This contact picker cannot share phone numbers. Add the friend manually instead.');
  }

  try {
    return await navigator.contacts.select(properties, { multiple: true });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') return [];
    throw caught;
  }
}

export function createContactImportDraft(
  contacts: DeviceContactInfo[],
  origin: ContactImportOrigin,
  expenseFriendIds: string[] = [],
): ContactImportDraft {
  return {
    version: 1,
    origin,
    expenseFriendIds,
    savedAt: new Date().toISOString(),
    items: contacts.map((contact) => {
      const phoneValues = Array.from(new Set((contact.tel || []).map((value) => value.trim()).filter(Boolean)));
      const phones = phoneValues.map((value, index) => ({
        id: uid(),
        label: phoneValues.length === 1 ? 'Phone' : `Phone ${index + 1}`,
        value,
      }));
      return {
        id: uid(),
        name: contact.name?.find((value) => value.trim())?.trim() || '',
        email: contact.email?.find((value) => value.trim())?.trim() || undefined,
        phones,
        selectedPhoneId: phones.length === 1 ? phones[0].id : undefined,
        manualPhone: '',
        included: true,
      };
    }),
  };
}

export function normalizePhoneToE164(value?: string, defaultCallingCode = '91'): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  let digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;

  let normalized: string;
  if (raw.startsWith('+')) {
    normalized = `+${digits}`;
  } else if (digits.startsWith('00')) {
    normalized = `+${digits.slice(2)}`;
  } else if (digits.length === 10) {
    normalized = `+${defaultCallingCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    normalized = `+${defaultCallingCode}${digits.slice(1)}`;
  } else if (digits.startsWith(defaultCallingCode)) {
    normalized = `+${digits}`;
  } else {
    return undefined;
  }

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : undefined;
}

export function formatE164(value?: string) {
  if (!value) return '';
  if (/^\+91\d{10}$/.test(value)) return `${value.slice(0, 3)} ${value.slice(3, 8)} ${value.slice(8)}`;
  return value;
}

export function selectedPhoneValue(item: ContactImportItem) {
  if (item.selectedPhoneId === 'manual') return item.manualPhone.trim();
  return item.phones.find((phone) => phone.id === item.selectedPhoneId)?.value.trim() || '';
}

export function classifyContactDraft(
  items: ContactImportItem[],
  friends: Friend[],
  failures: Record<string, string> = {},
): ContactReviewItem[] {
  const existingNumbers = new Set(
    friends
      .map((friend) => normalizePhoneToE164(friend.whatsapp_e164 || friend.whatsapp_number || friend.phone_number || friend.phone))
      .filter((value): value is string => Boolean(value)),
  );
  const selectedNumbers = new Set<string>();

  return items.map((item) => {
    const rawPhone = selectedPhoneValue(item);
    const whatsappE164 = normalizePhoneToE164(rawPhone);

    if (!item.included) return { item, status: 'unselected', message: 'Not selected', rawPhone, whatsappE164 };
    if (failures[item.id]) return { item, status: 'failed', message: failures[item.id], rawPhone, whatsappE164 };
    if (!item.name.trim()) return { item, status: 'attention', message: 'Add a name', rawPhone, whatsappE164 };
    if (!rawPhone && item.phones.length > 1) {
      return { item, status: 'attention', message: 'Choose WhatsApp number', rawPhone };
    }
    if (!rawPhone) return { item, status: 'attention', message: 'Add a WhatsApp number', rawPhone };
    if (!whatsappE164) return { item, status: 'attention', message: 'Enter a valid WhatsApp number', rawPhone };
    if (existingNumbers.has(whatsappE164)) {
      return { item, status: 'already', message: 'Already a Friend', rawPhone, whatsappE164 };
    }
    if (selectedNumbers.has(whatsappE164)) {
      return { item, status: 'attention', message: 'Duplicate in selection', rawPhone, whatsappE164 };
    }

    selectedNumbers.add(whatsappE164);
    return { item, status: 'ready', message: 'Ready to add', rawPhone, whatsappE164 };
  });
}

function openCache(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(CACHE_DB, 1);
    const timeout = setTimeout(() => {
      settled = true;
      resolve(undefined);
    }, 1500);
    const finish = (database?: IDBDatabase, error?: DOMException | null) => {
      if (settled) {
        database?.close();
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(database);
    };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CACHE_STORE)) request.result.createObjectStore(CACHE_STORE);
    };
    request.onsuccess = () => finish(request.result);
    request.onerror = () => finish(undefined, request.error);
    request.onblocked = () => finish();
  });
}

export async function saveContactImportDraft(draft: ContactImportDraft) {
  memoryDraft = { ...draft, savedAt: new Date().toISOString() };
  try {
    const database = await openCache();
    if (!database) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE, 'readwrite');
      transaction.objectStore(CACHE_STORE).put(memoryDraft, CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // The in-memory draft keeps the active SPA flow working when IndexedDB is unavailable.
  }
}

export async function loadContactImportDraft(): Promise<ContactImportDraft | undefined> {
  if (memoryDraft) return memoryDraft;
  try {
    const database = await openCache();
    if (!database) return undefined;
    const value = await new Promise<ContactImportDraft | undefined>((resolve, reject) => {
      const request = database.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result as ContactImportDraft | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    memoryDraft = value?.version === 1 ? value : undefined;
    return memoryDraft;
  } catch {
    return undefined;
  }
}

export async function clearContactImportDraft() {
  memoryDraft = undefined;
  try {
    const database = await openCache();
    if (!database) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE, 'readwrite');
      transaction.objectStore(CACHE_STORE).delete(CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // Clearing a best-effort cache should never block sign-out or settings actions.
  }
}

export function saveExpenseContactHandoff(value: ExpenseContactHandoff) {
  memoryExpenseHandoff = value;
  try {
    sessionStorage.setItem(EXPENSE_HANDOFF_KEY, JSON.stringify(value));
  } catch {
    // The in-memory handoff is enough while the current tab remains open.
  }
}

export function consumeExpenseContactHandoff(): ExpenseContactHandoff | undefined {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(EXPENSE_HANDOFF_KEY);
    sessionStorage.removeItem(EXPENSE_HANDOFF_KEY);
  } catch {
    // Use the in-memory value below.
  }
  const memoryValue = memoryExpenseHandoff;
  memoryExpenseHandoff = undefined;
  if (!raw) return memoryValue;
  try {
    const value = JSON.parse(raw) as ExpenseContactHandoff;
    if (!Array.isArray(value.selectedFriendIds) || !Array.isArray(value.newFriendIds)) return memoryValue;
    return value;
  } catch {
    return memoryValue;
  }
}
