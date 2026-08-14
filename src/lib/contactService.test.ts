import { describe, expect, it } from 'vitest';
import { filterLocalContacts, normalizeContactPhone, platformContactsToLocal } from './contactService';

describe('local device contact service', () => {
  it('maps only explicitly selected contact fields into the local cache shape', () => {
    const [contact] = platformContactsToLocal([{
      name: ['Arun Kumar'],
      tel: ['+91 98765 43210', '+91 99887 66554'],
      email: ['ARUN@example.com'],
    }], '2026-08-14T10:00:00.000Z');
    expect(contact).toMatchObject({
      name: 'Arun Kumar',
      phone_numbers: ['+91 98765 43210', '+91 99887 66554'],
      email: 'arun@example.com',
      normalized_phone: '+919876543210',
      selected_at: '2026-08-14T10:00:00.000Z',
      last_seen_at: '2026-08-14T10:00:00.000Z',
      source: 'device_contact',
    });
  });

  it('searches cached contacts instantly by name, formatted number, or normalized number', () => {
    const contacts = platformContactsToLocal([
      { name: ['Arun Kumar'], tel: ['+91 98765 43210'] },
      { name: ['Vijay'], tel: ['+91 99887 66554'] },
    ]);
    expect(filterLocalContacts(contacts, 'aru').map((contact) => contact.name)).toEqual(['Arun Kumar']);
    expect(filterLocalContacts(contacts, '9876').map((contact) => contact.name)).toEqual(['Arun Kumar']);
    expect(filterLocalContacts(contacts, '+919988').map((contact) => contact.name)).toEqual(['Vijay']);
  });

  it('normalizes valid WhatsApp numbers to E.164', () => {
    expect(normalizeContactPhone('98765 43210')).toBe('+919876543210');
  });
});
