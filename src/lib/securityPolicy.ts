import type { AutoLockDuration } from '../types/security';

export function autoLockMilliseconds(duration: AutoLockDuration): number {
  switch (duration) {
    case '1m': return 60_000;
    case '5m': return 5 * 60_000;
    case '15m': return 15 * 60_000;
    case '30m': return 30 * 60_000;
    default: return 0;
  }
}

export function shouldAutoLock(duration: AutoLockDuration, lastActiveAt: number, now = Date.now(), appWasHidden = false) {
  if (duration === 'immediately') return appWasHidden;
  const threshold = autoLockMilliseconds(duration);
  return threshold > 0 && now - lastActiveAt >= threshold;
}

export function pinAttemptDelaySeconds(attempts: number) {
  if (attempts >= 10) return 300;
  if (attempts >= 8) return 60;
  if (attempts >= 5) return 30;
  return 0;
}

export function isRecentVerification(lastVerifiedAt: string | null, now = Date.now(), freshnessMs = 5 * 60_000) {
  return Boolean(lastVerifiedAt && now - new Date(lastVerifiedAt).getTime() <= freshnessMs);
}
