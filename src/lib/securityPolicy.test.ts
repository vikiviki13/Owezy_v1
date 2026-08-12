import { describe, expect, it } from 'vitest';
import { autoLockMilliseconds, isRecentVerification, pinAttemptDelaySeconds, shouldAutoLock } from './securityPolicy';

describe('auto-lock security policy', () => {
  it('locks immediately only after the app backgrounds', () => {
    expect(shouldAutoLock('immediately', 1_000, 1_001, false)).toBe(false);
    expect(shouldAutoLock('immediately', 1_000, 1_001, true)).toBe(true);
  });

  it('keeps a five-minute session available after two minutes', () => {
    expect(shouldAutoLock('5m', 1_000, 1_000 + 2 * 60_000)).toBe(false);
  });

  it('locks a five-minute session after six minutes', () => {
    expect(shouldAutoLock('5m', 1_000, 1_000 + 6 * 60_000)).toBe(true);
  });

  it('maps every supported lock duration', () => {
    expect(autoLockMilliseconds('1m')).toBe(60_000);
    expect(autoLockMilliseconds('5m')).toBe(300_000);
    expect(autoLockMilliseconds('15m')).toBe(900_000);
    expect(autoLockMilliseconds('30m')).toBe(1_800_000);
  });
});

describe('failed PIN protection', () => {
  it('does not delay attempts one through four', () => {
    expect(pinAttemptDelaySeconds(4)).toBe(0);
  });

  it('progressively delays repeated failures', () => {
    expect(pinAttemptDelaySeconds(5)).toBe(30);
    expect(pinAttemptDelaySeconds(8)).toBe(60);
    expect(pinAttemptDelaySeconds(10)).toBe(300);
  });
});

describe('sensitive-action freshness', () => {
  const verifiedAt = new Date(1_000_000).toISOString();

  it('accepts verification younger than five minutes', () => {
    expect(isRecentVerification(verifiedAt, 1_000_000 + 4 * 60_000)).toBe(true);
  });

  it('rejects stale or absent verification', () => {
    expect(isRecentVerification(verifiedAt, 1_000_000 + 6 * 60_000)).toBe(false);
    expect(isRecentVerification(null)).toBe(false);
  });
});
