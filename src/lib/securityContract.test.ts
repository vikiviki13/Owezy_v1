import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const schema = readFileSync(resolve(root, 'supabase/schema.sql'), 'utf8');
const edgeFunction = readFileSync(resolve(root, 'supabase/functions/security/index.ts'), 'utf8');
const changePinFlow = readFileSync(resolve(root, 'src/components/security/ChangePinFlow.tsx'), 'utf8');
const securityService = readFileSync(resolve(root, 'src/lib/securityService.ts'), 'utf8');
const lockScreen = readFileSync(resolve(root, 'src/components/security/LockScreen.tsx'), 'utf8');
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
    expect(securityService).toContain("userVerification: 'required'");
  });

  it('automatically requests device security once and supports an abortable PIN fallback', () => {
    expect(lockScreen).toContain('shouldAutoTriggerDeviceAuthentication');
    expect(lockScreen).toContain('automaticAttempted.current = true');
    expect(lockScreen).toContain('cancelWebAuthnAuthentication()');
    expect(lockScreen).toContain('Use PIN Instead');
    expect(lockScreen).toContain('Try Device Security Again');
    expect(securityService).toContain('WebAuthnAbortService.cancelCeremony()');
  });

  it('does not implement a fake biometric retry counter', () => {
    expect(lockScreen).not.toMatch(/(fingerprint|face|biometric)(Attempt|Retry|Failure)Count/i);
    expect(lockScreen).not.toContain('five biometric attempts');
  });

  it('has removed the legacy browser PIN verifier', () => {
    expect(() => readFileSync(legacyLockPath, 'utf8')).toThrow();
  });

  it('requires a one-purpose current-PIN grant before changing the PIN', () => {
    expect(edgeFunction).toContain("if (action === 'pin/change/verify')");
    expect(edgeFunction).toContain("authenticationMethod: 'pin_change'");
    expect(edgeFunction).toContain("data.authentication_method === 'pin_change'");
    expect(edgeFunction).toContain("body.changeToken");
    expect(edgeFunction).toContain("'pin_unchanged'");
    expect(schema).toContain("'pin_change'");
    expect(securityService).toContain("return result.grant.token");
    expect(changePinFlow).toContain('Enter your current PIN');
    expect(changePinFlow).toContain("useState<ChangePinStep>('current')");
    expect(changePinFlow).toContain('Your new PIN must be different from your current PIN.');
    expect(changePinFlow).toContain("PINs don't match. Try again.");
  });
});
