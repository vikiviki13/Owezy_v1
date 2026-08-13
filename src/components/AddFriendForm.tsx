import { useMemo, useRef, useState } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import { Camera, ContactRound, LoaderCircle, Trash2, UserPlus } from 'lucide-react';
import type { Friend } from '../types';
import {
  createFriendFromDetails,
  FriendCreationError,
  validateFriendDetails,
  type FriendFormErrors,
  type FriendFormValues,
} from '../lib/friendCreation';
import { listFriends } from '../lib/db';
import { Avatar } from './Avatar';

type ContactRecord = { name?: string[]; tel?: string[]; email?: string[] };
type ContactsNavigator = Navigator & {
  contacts?: { select: (properties: string[], options: { multiple: boolean }) => Promise<ContactRecord[]> };
};

const regionNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;
const countryOptions = getCountries()
  .map((country) => ({
    country,
    dialCode: getCountryCallingCode(country),
    name: regionNames?.of(country) || country,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const initialValues: FriendFormValues = {
  avatarUrl: '',
  name: '',
  nickname: '',
  whatsappCountry: 'IN',
  whatsappNumber: '',
  phoneNumber: '',
  email: '',
  notes: '',
};

export function AddFriendForm({
  onCreated,
  submitLabel = 'Add Friend',
}: {
  onCreated: (friend: Friend) => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<FriendFormValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [submittedErrors, setSubmittedErrors] = useState<FriendFormErrors>({});
  const [formError, setFormError] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  const validation = useMemo(() => validateFriendDetails(values, listFriends(true)), [values]);

  function patch<K extends keyof FriendFormValues>(key: K, value: FriendFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSubmittedErrors((current) => ({ ...current, [key]: undefined }));
    setFormError('');
  }

  function readAvatar(file?: File) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setFormError('Choose an avatar smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch('avatarUrl', String(reader.result));
    reader.onerror = () => setFormError('Could not read that image.');
    reader.readAsDataURL(file);
  }

  async function importContact() {
    const contacts = (navigator as ContactsNavigator).contacts;
    if (!contacts?.select) {
      setFormError('Contact import is not supported by this browser. You can enter the details manually.');
      return;
    }
    setImporting(true);
    setFormError('');
    try {
      const [contact] = await contacts.select(['name', 'tel', 'email'], { multiple: false });
      if (!contact) return;
      const importedPhone = contact.tel?.[0]?.trim() || '';
      const parsed = importedPhone
        ? parsePhoneNumberFromString(importedPhone, values.whatsappCountry)
        : undefined;
      setValues((current) => ({
        ...current,
        name: contact.name?.[0]?.trim() || current.name,
        email: contact.email?.[0]?.trim() || current.email,
        whatsappCountry: parsed?.country || current.whatsappCountry,
        whatsappNumber: parsed?.formatNational() || importedPhone || current.whatsappNumber,
      }));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setFormError('Could not import that contact. You can enter the details manually.');
    } finally {
      setImporting(false);
    }
  }

  function save() {
    if (!validation.details || saving) {
      setSubmittedErrors(validation.errors);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const friend = createFriendFromDetails(values);
      onCreated(friend);
    } catch (caught) {
      if (caught instanceof FriendCreationError) setSubmittedErrors(caught.errors);
      else setFormError(caught instanceof Error ? caught.message : 'Could not add this friend.');
      setSaving(false);
    }
  }

  const visibleErrors = { ...validation.errors, ...submittedErrors };

  return (
    <form onSubmit={(event) => { event.preventDefault(); save(); }} className="flex flex-col gap-5">
      <div className="flex flex-col items-center pt-1">
        <button type="button" onClick={() => avatarInput.current?.click()} className="relative" aria-label="Choose friend avatar">
          <Avatar name={values.name || 'Friend'} src={values.avatarUrl} size={82} />
          <span className="absolute -right-1 -bottom-1 size-9 rounded-full bg-[var(--color-primary)] text-white border-4 border-[var(--color-surface)] flex items-center justify-center"><Camera size={15} /></span>
        </button>
        <div className="flex items-center gap-3 mt-2">
          <button type="button" onClick={() => avatarInput.current?.click()} className="min-h-9 text-sm font-semibold text-[var(--color-primary)]">Add avatar <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></button>
          {values.avatarUrl && <button type="button" onClick={() => patch('avatarUrl', '')} className="min-h-9 text-sm font-semibold text-[var(--color-error)]"><Trash2 size={14} className="inline mr-1" />Remove</button>}
        </div>
        <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => readAvatar(event.target.files?.[0])} />
      </div>

      <button type="button" onClick={() => void importContact()} disabled={importing} className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
        {importing ? <LoaderCircle size={18} className="animate-spin" /> : <ContactRound size={18} />} Import from Contacts
      </button>

      <FormField label="Name" required error={values.name ? visibleErrors.name : undefined}>
        <input autoFocus value={values.name} onChange={(event) => patch('name', event.target.value)} maxLength={80} autoComplete="name" placeholder="e.g. Arun Kumar" className="input min-h-12" />
      </FormField>

      <FormField label="Nickname">
        <input value={values.nickname} onChange={(event) => patch('nickname', event.target.value)} maxLength={50} placeholder="Optional" className="input min-h-12" />
      </FormField>

      <FormField label="WhatsApp Number" required error={values.whatsappNumber ? visibleErrors.whatsappNumber : undefined} helper="Used for statements and payment reminders.">
        <span className="flex">
          <select
            aria-label="WhatsApp country code"
            value={values.whatsappCountry}
            onChange={(event) => patch('whatsappCountry', event.target.value as CountryCode)}
            className="w-[42%] min-h-12 rounded-l-xl border border-r-0 border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2 text-sm outline-none"
          >
            {countryOptions.map((option) => <option key={option.country} value={option.country}>{option.name} +{option.dialCode}</option>)}
          </select>
          <input
            value={values.whatsappNumber}
            onChange={(event) => patch('whatsappNumber', event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            className="input min-h-12 rounded-l-none"
          />
        </span>
      </FormField>

      <FormField label="Phone Number" error={values.phoneNumber ? visibleErrors.phoneNumber : undefined} helper="Optional. Leave blank if it is the same as the WhatsApp number.">
        <input value={values.phoneNumber} onChange={(event) => patch('phoneNumber', event.target.value)} inputMode="tel" autoComplete="tel" placeholder="Different phone number" className="input min-h-12" />
      </FormField>

      <FormField label="Email" error={values.email ? visibleErrors.email : undefined}>
        <input value={values.email} onChange={(event) => patch('email', event.target.value)} type="email" autoComplete="email" placeholder="Optional" className="input min-h-12" />
      </FormField>

      <FormField label="Notes">
        <textarea value={values.notes} onChange={(event) => patch('notes', event.target.value)} maxLength={500} rows={3} placeholder="Optional notes" className="input resize-none" />
      </FormField>

      {formError && <p role="alert" className="text-sm text-[var(--color-error)]">{formError}</p>}
      <button type="submit" disabled={!validation.details || saving} className="min-h-13 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40">
        {saving ? <LoaderCircle size={18} className="animate-spin" /> : <UserPlus size={18} />} {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

export function FormField({
  label,
  required,
  error,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return <label className="flex flex-col gap-1.5">
    <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}{required && <span className="text-[var(--color-error)]">*</span>}</span>
    {children}
    {error ? <span className="text-xs text-[var(--color-error)]">{error}</span> : helper && <span className="text-xs text-[var(--color-text-muted)]">{helper}</span>}
  </label>;
}
