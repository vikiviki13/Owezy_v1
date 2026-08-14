import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import { Camera, ContactRound, LoaderCircle, Save, Trash2, UserPlus } from 'lucide-react';
import type { Friend } from '../types';
import {
  createFriendFromDetails,
  FriendCreationError,
  updateFriendFromDetails,
  validateFriendDetails,
  type FriendFormErrors,
  type FriendFormValues,
} from '../lib/friendCreation';
import { listFriends } from '../lib/db';
import { Avatar } from './Avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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

const emptyValues: FriendFormValues = {
  avatarUrl: '',
  name: '',
  nickname: '',
  whatsappCountry: 'IN',
  whatsappNumber: '',
  phoneNumber: '',
  email: '',
  notes: '',
};

function valuesForFriend(friend?: Friend): FriendFormValues {
  if (!friend) return emptyValues;
  const storedWhatsApp = friend.whatsapp_number || '';
  const parsed = storedWhatsApp ? parsePhoneNumberFromString(storedWhatsApp) : undefined;
  return {
    avatarUrl: friend.avatar_url || '',
    name: friend.name,
    nickname: friend.nickname || '',
    whatsappCountry: parsed?.country || 'IN',
    whatsappNumber: parsed?.formatNational() || storedWhatsApp,
    phoneNumber: friend.phone && friend.phone !== storedWhatsApp ? friend.phone : '',
    email: friend.email || '',
    notes: friend.notes || '',
  };
}

export function AddFriendForm({
  onCreated,
  submitLabel = 'Add Friend',
}: {
  onCreated: (friend: Friend) => void;
  submitLabel?: string;
}) {
  return <FriendForm onSaved={onCreated} submitLabel={submitLabel} />;
}

export function FriendForm({
  friend,
  onSaved,
  submitLabel = friend ? 'Save Changes' : 'Add Friend',
}: {
  friend?: Friend;
  onSaved: (friend: Friend) => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<FriendFormValues>(() => valuesForFriend(friend));
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [submittedErrors, setSubmittedErrors] = useState<FriendFormErrors>({});
  const [formError, setFormError] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  const validation = useMemo(
    () => validateFriendDetails(values, listFriends(true), { excludeFriendId: friend?.id, requireWhatsApp: !friend }),
    [friend, values],
  );

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
      const saved = friend
        ? updateFriendFromDetails(friend.id, values)
        : createFriendFromDetails(values);
      onSaved(saved);
    } catch (caught) {
      if (caught instanceof FriendCreationError) setSubmittedErrors(caught.errors);
      else setFormError(caught instanceof Error ? caught.message : `Could not ${friend ? 'update' : 'add'} this friend.`);
      setSaving(false);
    }
  }

  const visibleErrors = { ...validation.errors, ...submittedErrors };

  return (
    <form onSubmit={(event) => { event.preventDefault(); save(); }} className="flex flex-col gap-5">
      <div className="flex flex-col items-center pt-1">
        <Button type="button" variant="ghost" onClick={() => avatarInput.current?.click()} className="relative size-auto rounded-full p-0" aria-label="Choose friend avatar">
          <Avatar name={values.name || 'Friend'} src={values.avatarUrl} size={82} />
          <span className="absolute -right-1 -bottom-1 size-9 rounded-full bg-primary text-primary-foreground border-4 border-card flex items-center justify-center"><Camera size={15} /></span>
        </Button>
        <div className="flex items-center gap-1 mt-2">
          <Button type="button" variant="link" onClick={() => avatarInput.current?.click()} className="min-h-9 px-2">{values.avatarUrl ? 'Change photo' : 'Add photo'}</Button>
          {values.avatarUrl && <Button type="button" variant="ghost" onClick={() => patch('avatarUrl', '')} className="min-h-9 px-2 text-destructive"><Trash2 />Remove</Button>}
        </div>
        <Input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => readAvatar(event.target.files?.[0])} />
      </div>

      <Button type="button" variant="secondary" onClick={() => void importContact()} disabled={importing} className="min-h-12 rounded-xl font-semibold">
        {importing ? <LoaderCircle className="animate-spin" /> : <ContactRound />} Import from Contacts
      </Button>

      <FormField label="Name" required error={values.name ? visibleErrors.name : undefined}>
        <Input autoFocus value={values.name} onChange={(event) => patch('name', event.target.value)} maxLength={80} autoComplete="name" placeholder="e.g. Arun Kumar" className="min-h-12 rounded-xl" />
      </FormField>

      <FormField label="Nickname">
        <Input value={values.nickname} onChange={(event) => patch('nickname', event.target.value)} maxLength={50} placeholder="Optional" className="min-h-12 rounded-xl" />
      </FormField>

      <FormField label="WhatsApp Number" required={!friend} error={values.whatsappNumber ? visibleErrors.whatsappNumber : undefined} helper="Used for statements and payment reminders.">
        <span className="flex">
          <Select value={values.whatsappCountry} onValueChange={(value) => patch('whatsappCountry', value as CountryCode)}>
            <SelectTrigger aria-label="WhatsApp country code" className="w-[43%] min-h-12 rounded-l-xl rounded-r-none border-r-0 bg-secondary px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {countryOptions.map((option) => <SelectItem key={option.country} value={option.country}>{option.name} +{option.dialCode}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={values.whatsappNumber} onChange={(event) => patch('whatsappNumber', event.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" className="min-h-12 rounded-l-none rounded-r-xl" />
        </span>
      </FormField>

      <FormField label="Phone Number" error={values.phoneNumber ? visibleErrors.phoneNumber : undefined} helper="Optional. Leave blank if it is the same as the WhatsApp number.">
        <Input value={values.phoneNumber} onChange={(event) => patch('phoneNumber', event.target.value)} inputMode="tel" autoComplete="tel" placeholder="Different phone number" className="min-h-12 rounded-xl" />
      </FormField>

      <FormField label="Email" error={values.email ? visibleErrors.email : undefined}>
        <Input value={values.email} onChange={(event) => patch('email', event.target.value)} type="email" autoComplete="email" placeholder="Optional" className="min-h-12 rounded-xl" />
      </FormField>

      <FormField label="Notes">
        <Textarea value={values.notes} onChange={(event) => patch('notes', event.target.value)} maxLength={500} rows={3} placeholder="Optional notes" className="rounded-xl" />
      </FormField>

      {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
      <Button type="submit" disabled={!validation.details || saving} className="min-h-13 w-full rounded-xl font-semibold">
        {saving ? <LoaderCircle className="animate-spin" /> : friend ? <Save /> : <UserPlus />} {saving ? 'Saving…' : submitLabel}
      </Button>
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
  children: ReactNode;
}) {
  return <div className="flex flex-col gap-1.5">
    <Label className="text-sm font-semibold text-muted-foreground">{label}{required && <span className="text-destructive">*</span>}</Label>
    {children}
    {error ? <span className="text-xs text-destructive">{error}</span> : helper && <span className="text-xs text-muted-foreground">{helper}</span>}
  </div>;
}
