import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ContactRound, LoaderCircle, Search, ShieldCheck, Smartphone, UserPlus, X } from 'lucide-react';
import type { Friend } from '../../types';
import { listFriends } from '../../lib/db';
import {
  cacheContacts,
  ContactServiceError,
  filterLocalContacts,
  getLocalContacts,
  isSupported,
  normalizeContactPhone,
  openContactPicker,
  type LocalDeviceContact,
} from '../../lib/contactService';
import { Avatar } from '../Avatar';
import { useToast } from '../ToastContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

type Stage = 'permission' | 'browse' | 'numbers' | 'existing' | 'denied' | 'unsupported';

export interface ImportedFriendDraft {
  name: string;
  whatsappNumber: string;
  email?: string;
  sourceContactId: string;
}

export function ContactImportFlow({
  open,
  onOpenChange,
  onContactSelected,
  onExistingFriendSelected,
  onAddManually,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactSelected: (draft: ImportedFriendDraft) => void;
  onExistingFriendSelected?: (friend: Friend) => void;
  onAddManually?: () => void;
}) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('permission');
  const [contacts, setContacts] = useState<LocalDeviceContact[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [activeContact, setActiveContact] = useState<LocalDeviceContact>();
  const [selectedPhone, setSelectedPhone] = useState('');
  const [existingFriend, setExistingFriend] = useState<Friend>();
  const friends = listFriends(true);

  useEffect(() => {
    if (!open) return;
    setStage(isSupported() ? 'permission' : 'unsupported');
    setQuery('');
    setMessage('');
    setActiveContact(undefined);
    setExistingFriend(undefined);
    void getLocalContacts()
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [open]);

  const matchingFriends = useMemo(() => {
    const search = query.trim().toLowerCase();
    const digits = search.replace(/\D/g, '');
    return friends.filter((friend) => {
      if (!search) return true;
      if (`${friend.name} ${friend.nickname || ''}`.toLowerCase().includes(search)) return true;
      const phone = friend.whatsapp_number || friend.phone || '';
      return Boolean(digits) && phone.replace(/\D/g, '').includes(digits);
    });
  }, [friends, query]);
  const matchingContacts = useMemo(() => filterLocalContacts(contacts, query), [contacts, query]);

  function duplicateForPhone(phone: string) {
    const normalized = normalizeContactPhone(phone);
    return friends.find((friend) => normalizeContactPhone(friend.whatsapp_number || friend.phone || '') === normalized);
  }

  function showExisting(friend: Friend) {
    setExistingFriend(friend);
    setStage('existing');
  }

  function finishContact(contact: LocalDeviceContact, phone: string) {
    const duplicate = duplicateForPhone(phone);
    if (duplicate) {
      showExisting(duplicate);
      return;
    }
    onContactSelected({
      name: contact.name,
      whatsappNumber: normalizeContactPhone(phone) || phone,
      email: contact.email,
      sourceContactId: contact.local_id,
    });
    onOpenChange(false);
  }

  function chooseContact(contact: LocalDeviceContact) {
    if (contact.phone_numbers.length > 1) {
      setActiveContact(contact);
      setSelectedPhone(contact.phone_numbers[0]);
      setStage('numbers');
      return;
    }
    finishContact(contact, contact.phone_numbers[0]);
  }

  async function openPhoneContacts() {
    setBusy(true);
    setMessage('');
    try {
      const selected = await openContactPicker(true);
      if (!selected.length) {
        setMessage('No contacts were selected.');
        setStage('browse');
        return;
      }
      const merged = [...selected, ...contacts.filter((cached) => !selected.some((next) => next.local_id === cached.local_id))];
      setContacts(merged);
      try { await cacheContacts(selected); }
      catch { setMessage('These contacts are available now, but could not be saved for offline search.'); }
      setStage('browse');
    } catch (caught) {
      if (caught instanceof ContactServiceError && caught.code === 'picker_cancelled') {
        setMessage('No contacts were selected.');
        setStage(contacts.length ? 'browse' : 'permission');
      } else if (caught instanceof ContactServiceError && caught.code === 'permission_denied') {
        setStage('denied');
      } else if (caught instanceof ContactServiceError && caught.code === 'unsupported') {
        setStage('unsupported');
      } else {
        setMessage(caught instanceof Error ? caught.message : 'Device contacts could not be opened.');
      }
    } finally {
      setBusy(false);
    }
  }

  function addManually() {
    onOpenChange(false);
    onAddManually?.();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[94dvh] overflow-y-auto rounded-t-3xl px-4 pb-6">
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />

        {stage === 'permission' && (
          <div className="py-4 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ContactRound size={31} /></span>
            <SheetHeader className="px-0 pt-5">
              <SheetTitle className="text-xl font-bold">Find friends from your contacts</SheetTitle>
              <SheetDescription className="text-sm leading-6">Allow Owezy to access contacts you choose so you can add friends faster. Your contacts aren't uploaded to your account unless you add someone as a friend.</SheetDescription>
            </SheetHeader>
            {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
            <Button className="mt-6 w-full" disabled={busy} onClick={() => void openPhoneContacts()}>
              {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}Continue
            </Button>
            <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => onOpenChange(false)}>Not Now</Button>
          </div>
        )}

        {stage === 'browse' && (
          <div className="pt-2">
            <div className="mb-5 flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Back"><ArrowLeft /></Button>
              <div className="min-w-0 flex-1"><SheetTitle className="text-lg font-semibold">Contacts</SheetTitle><SheetDescription>Choose a Contact</SheetDescription></div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close"><X /></Button>
            </div>
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or number" className="min-h-12 rounded-xl pl-9" />
            </div>
            {message && <p role="status" className="mb-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{message}</p>}

            {matchingFriends.length > 0 && <ContactSection title="Already Friends">
              {matchingFriends.map((friend) => <FriendContactRow key={friend.id} friend={friend} onClick={() => showExisting(friend)} />)}
            </ContactSection>}

            <ContactSection title="Recent Contacts">
              {matchingContacts.length ? matchingContacts.map((contact) => {
                const duplicate = contact.phone_numbers.length === 1 ? duplicateForPhone(contact.phone_numbers[0]) : undefined;
                return <DeviceContactRow key={contact.local_id} contact={contact} alreadyFriend={duplicate} onClick={() => chooseContact(contact)} />;
              }) : <p className="px-1 py-5 text-sm text-muted-foreground">{query ? 'No cached contacts match your search.' : 'Contacts you choose will appear here for offline search.'}</p>}
            </ContactSection>

            <ContactSection title="Choose From Phone">
              <Button variant="outline" className="w-full justify-start" disabled={busy} onClick={() => void openPhoneContacts()}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Smartphone />}Open Device Contacts
              </Button>
            </ContactSection>
          </div>
        )}

        {stage === 'numbers' && activeContact && (
          <div className="py-3">
            <Button variant="ghost" className="mb-3 px-2" onClick={() => setStage('browse')}><ArrowLeft />Back</Button>
            <SheetHeader className="px-0">
              <SheetTitle>Which number does {activeContact.name} use on WhatsApp?</SheetTitle>
              <SheetDescription>Select the number that should be saved as the mandatory WhatsApp number.</SheetDescription>
            </SheetHeader>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
              {activeContact.phone_numbers.map((phone, index) => {
                const duplicate = duplicateForPhone(phone);
                return <button key={phone} type="button" onClick={() => setSelectedPhone(phone)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                  <span className={`flex size-5 items-center justify-center rounded-full border-2 ${selectedPhone === phone ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{selectedPhone === phone && <Check size={12} />}</span>
                  <span className="flex-1"><span className="block text-sm font-medium">{phone}</span><span className="block text-xs text-muted-foreground">Phone {index + 1}</span></span>
                  {duplicate && <span className="text-xs font-semibold text-primary">Already Added</span>}
                </button>;
              })}
            </div>
            <Button className="mt-5 w-full" onClick={() => finishContact(activeContact, selectedPhone)}>Use This Number</Button>
          </div>
        )}

        {stage === 'existing' && existingFriend && (
          <div className="py-5 text-center">
            <Avatar name={existingFriend.name} src={existingFriend.avatar_url} size={72} />
            <SheetHeader className="px-0 pt-4">
              <SheetTitle>{existingFriend.name} is already in your friends.</SheetTitle>
              <SheetDescription>No duplicate was created. You can select the existing friend instead.</SheetDescription>
            </SheetHeader>
            <Button className="mt-6 w-full" onClick={() => {
              if (onExistingFriendSelected) onExistingFriendSelected(existingFriend);
              else toast(`${existingFriend.name} is already in your friends`);
              onOpenChange(false);
            }}><Check />Select {existingFriend.name}</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setStage('browse')}>Back to Contacts</Button>
          </div>
        )}

        {(stage === 'denied' || stage === 'unsupported') && (
          <div className="py-5 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"><ContactRound size={30} /></span>
            <SheetHeader className="px-0 pt-5">
              <SheetTitle>{stage === 'denied' ? "Contact access wasn't allowed" : "Device contact import isn't available in this browser."}</SheetTitle>
              <SheetDescription>{stage === 'denied' ? 'You can still add a friend manually.' : 'You can enter the friend’s details manually instead.'}</SheetDescription>
            </SheetHeader>
            <Button className="mt-6 w-full" onClick={addManually}><UserPlus />Add Friend Manually</Button>
            {stage === 'denied' && <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={() => void openPhoneContacts()}>Try Again</Button>}
            {contacts.length > 0 && <Button variant="ghost" className="mt-2 w-full" onClick={() => setStage('browse')}>Browse Recent Contacts</Button>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ContactSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6"><h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}

function FriendContactRow({ friend, onClick }: { friend: Friend; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary">
    <Avatar name={friend.name} src={friend.avatar_url} size={42} />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{friend.name}</span><span className="block truncate text-xs text-muted-foreground">{friend.whatsapp_number || friend.phone || 'No phone number'}</span></span>
    <span className="flex items-center gap-1 text-xs font-semibold text-primary"><Check size={14} />Already Added</span>
  </button>;
}

function DeviceContactRow({ contact, alreadyFriend, onClick }: { contact: LocalDeviceContact; alreadyFriend?: Friend; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary">
    <Avatar name={contact.name} size={42} />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{contact.name}</span><span className="block truncate text-xs text-muted-foreground">{contact.phone_numbers[0]}</span></span>
    {alreadyFriend && <span className="flex items-center gap-1 text-xs font-semibold text-primary"><Check size={14} />Already Added</span>}
  </button>;
}
