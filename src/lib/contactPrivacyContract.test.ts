import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const contactServiceSource = readFileSync(resolve(root, 'src/lib/contactService.ts'), 'utf8');
const cloudDataSource = readFileSync(resolve(root, 'src/lib/cloudData.ts'), 'utf8');
const databaseSource = readFileSync(resolve(root, 'src/lib/db.ts'), 'utf8');
const contactFlowSource = readFileSync(resolve(root, 'src/components/contacts/ContactImportFlow.tsx'), 'utf8');

describe('device contact privacy boundary', () => {
  it('stores selected contacts in a dedicated IndexedDB store', () => {
    expect(contactServiceSource).toContain("const STORE_NAME = 'device_contacts_cache'");
    expect(contactServiceSource).toContain('indexedDB.open');
    expect(contactServiceSource).toContain("source: 'device_contact'");
  });

  it('never connects the local contact cache to application or cloud synchronization', () => {
    expect(contactServiceSource).not.toContain('supabase');
    expect(contactServiceSource).not.toContain("dispatchEvent(new CustomEvent('tab-db-changed'");
    expect(cloudDataSource).not.toContain('device_contacts_cache');
    expect(cloudDataSource).not.toContain('contactService');
    expect(databaseSource).not.toContain('device_contacts_cache');
    expect(contactFlowSource).not.toContain('createFriend');
    expect(contactFlowSource).not.toContain('supabase');
  });

  it('requests only name, telephone, and optional email from the platform picker', () => {
    expect(contactServiceSource).toContain("select(['name', 'tel', 'email']");
    expect(contactServiceSource).not.toMatch(/address|birthday|organization|photo/);
  });
});
