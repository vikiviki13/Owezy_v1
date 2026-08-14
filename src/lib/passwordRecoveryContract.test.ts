import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const authPage = readFileSync(resolve(root, 'src/pages/Auth.tsx'), 'utf8');
const passwordPages = readFileSync(resolve(root, 'src/pages/PasswordPages.tsx'), 'utf8');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const vercel = readFileSync(resolve(root, 'vercel.json'), 'utf8');

describe('password recovery contract', () => {
  it('starts recovery with email only and neutral account-enumeration copy', () => {
    expect(authPage).toContain('resetPasswordForEmail');
    expect(authPage).toContain('Send Recovery Link');
    expect(authPage).toContain('If an account exists for');
    expect(authPage).toContain('Resend Link in');
  });

  it('validates a Supabase recovery event before accepting a new password', () => {
    expect(app).toContain("event === 'PASSWORD_RECOVERY'");
    expect(app).toContain('recoverySessionValidated');
    expect(passwordPages).toContain('if (!recoverySessionValidated)');
    expect(passwordPages).toContain('supabase.auth.updateUser({ password })');
    expect(passwordPages).toContain('New Password');
    expect(passwordPages).toContain('Confirm New Password');
  });

  it('serves the dedicated reset-password route in production', () => {
    expect(vercel).toContain('"source": "/reset-password"');
    expect(vercel).toContain('"destination": "/index.html"');
  });
});
