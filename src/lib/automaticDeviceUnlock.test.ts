import { describe, expect, it } from 'vitest';
import type { SecurityStatus } from '../types/security';
import { shouldAutoTriggerDeviceAuthentication } from './automaticDeviceUnlock';

const eligibleStatus: SecurityStatus = {
  appLockEnabled: true,
  pinEnabled: true,
  webAuthnEnabled: true,
  webAuthnAvailableHere: true,
  autoLockDuration: '5m',
  preferredUnlockMethod: 'device',
  failedPinAttempts: 0,
  lockedUntil: null,
  grantValid: false,
  lastVerifiedAt: null,
  authenticators: [{
    id: 'device-1',
    deviceName: 'This Device',
    authenticatorType: 'singleDevice',
    backedUp: false,
    transports: ['internal'],
    createdAt: '2026-08-14T00:00:00.000Z',
    lastUsedAt: null,
    isActive: true,
    usableHere: true,
  }],
};

describe('automatic device unlock policy', () => {
  it('triggers for a locked app with an enabled usable credential', () => {
    expect(shouldAutoTriggerDeviceAuthentication({
      status: eligibleStatus,
      isLocked: true,
      platformAvailable: true,
      pinFallbackVisible: false,
      automaticAttempted: false,
    })).toBe(true);
  });

  it('does not trigger again during the same lock-screen activation', () => {
    expect(shouldAutoTriggerDeviceAuthentication({
      status: eligibleStatus,
      isLocked: true,
      platformAvailable: true,
      pinFallbackVisible: false,
      automaticAttempted: true,
    })).toBe(false);
  });

  it('does not trigger after the user switches to PIN', () => {
    expect(shouldAutoTriggerDeviceAuthentication({
      status: eligibleStatus,
      isLocked: true,
      platformAvailable: true,
      pinFallbackVisible: true,
      automaticAttempted: false,
    })).toBe(false);
  });

  it('requires App Lock, WebAuthn, a local credential, and platform support', () => {
    for (const status of [
      { ...eligibleStatus, appLockEnabled: false },
      { ...eligibleStatus, webAuthnEnabled: false },
      { ...eligibleStatus, webAuthnAvailableHere: false },
    ]) {
      expect(shouldAutoTriggerDeviceAuthentication({
        status,
        isLocked: true,
        platformAvailable: true,
        pinFallbackVisible: false,
        automaticAttempted: false,
      })).toBe(false);
    }
    expect(shouldAutoTriggerDeviceAuthentication({
      status: eligibleStatus,
      isLocked: true,
      platformAvailable: false,
      pinFallbackVisible: false,
      automaticAttempted: false,
    })).toBe(false);
  });
});
