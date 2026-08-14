import { describe, expect, it } from 'vitest';
import {
  isPasswordRecoveryLocation,
  maskRecoveryEmail,
  passwordRecoveryRedirectUrl,
  recoveryCooldownRemaining,
  validateNewPassword,
} from './passwordRecovery';

describe('password recovery helpers', () => {
  it('builds the dedicated recovery route', () => {
    expect(passwordRecoveryRedirectUrl('https://owezy.example/')).toBe('https://owezy.example/reset-password');
  });

  it('masks the email without exposing the full local part', () => {
    expect(maskRecoveryEmail('vikram@gmail.com')).toBe('vi••••@gmail.com');
    expect(maskRecoveryEmail('a@example.com')).toBe('a••••@example.com');
  });

  it('calculates and expires the resend cooldown', () => {
    expect(recoveryCooldownRemaining(1_000, 31_000, 60)).toBe(30);
    expect(recoveryCooldownRemaining(1_000, 61_000, 60)).toBe(0);
  });

  it('validates new password length and confirmation', () => {
    expect(validateNewPassword('short', 'short')).toBe('Password must contain at least 8 characters.');
    expect(validateNewPassword('long-enough', 'different')).toBe('Passwords do not match.');
    expect(validateNewPassword('long-enough', 'long-enough')).toBeUndefined();
  });

  it('recognizes both the recovery path and Supabase recovery hash', () => {
    expect(isPasswordRecoveryLocation({ pathname: '/reset-password', hash: '' } as Location)).toBe(true);
    expect(isPasswordRecoveryLocation({ pathname: '/', hash: '#access_token=token&type=recovery' } as Location)).toBe(true);
    expect(isPasswordRecoveryLocation({ pathname: '/', hash: '#/' } as Location)).toBe(false);
  });
});
