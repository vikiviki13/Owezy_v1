export const PASSWORD_MIN_LENGTH = 8;
export const RECOVERY_RESEND_COOLDOWN_SECONDS = 60;

export function passwordRecoveryRedirectUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/reset-password`;
}

export function maskRecoveryEmail(email: string): string {
  const [local = '', domain = ''] = email.trim().split('@');
  if (!local || !domain) return 'your email address';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}••••@${domain}`;
}

export function recoveryCooldownRemaining(
  sentAt: number | null,
  now = Date.now(),
  cooldownSeconds = RECOVERY_RESEND_COOLDOWN_SECONDS,
): number {
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil((sentAt + cooldownSeconds * 1000 - now) / 1000));
}

export function validateNewPassword(password: string, confirmation: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password !== confirmation) return 'Passwords do not match.';
  return undefined;
}

export function isPasswordRecoveryLocation(location: Pick<Location, 'pathname' | 'hash'>): boolean {
  return location.pathname === '/reset-password' || /(?:^|[&#])type=recovery(?:&|$)/.test(location.hash);
}
