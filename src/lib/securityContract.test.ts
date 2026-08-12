import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const schema = readFileSync(resolve(root, 'supabase/schema.sql'), 'utf8');
const edgeFunction = readFileSync(resolve(root, 'supabase/functions/security/index.ts'), 'utf8');
const legacyLockPath = resolve(root, 'src/lib/appLock.ts');

describe('server-side security contract', () => {
  it('stores WebAuthn public material without biometric or private-key fields', () => {
    expect(schema).toContain('create table if not exists public.user_authenticators');
    expect(schema).toContain('public_key text not null');
    expect(schema).not.toMatch(/fingerprint_(image|template)|facial?_(image|template)|private_key\s/);
  });

  it('keeps PIN hashes in a server-only table and uses Argon2id', () => {
    expect(schema).toContain('pin_hash text');
    expect(schema).toContain('revoke all on table public.security_profiles from anon, authenticated');
    expect(edgeFunction).toContain("import { argon2id }");
    expect(edgeFunction).not.toContain('localStorage.setItem(SALT_KEY');
  });

  it('requires verified WebAuthn ceremonies and one-time expiring challenges', () => {
    expect(edgeFunction).toContain('verifyRegistrationResponse');
    expect(edgeFunction).toContain('verifyAuthenticationResponse');
    expect(edgeFunction).toContain('requireUserVerification: true');
    expect(edgeFunction).toContain("used_at: new Date().toISOString()");
  });

  it('has removed the legacy browser PIN verifier', () => {
    expect(() => readFileSync(legacyLockPath, 'utf8')).toThrow();
  });
});
