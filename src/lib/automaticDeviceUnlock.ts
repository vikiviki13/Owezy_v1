import type { SecurityStatus } from '../types/security';

export function shouldAutoTriggerDeviceAuthentication({
  status,
  isLocked,
  platformAvailable,
  pinFallbackVisible,
  automaticAttempted,
}: {
  status: SecurityStatus | null;
  isLocked: boolean;
  platformAvailable: boolean | null;
  pinFallbackVisible: boolean;
  automaticAttempted: boolean;
}) {
  return Boolean(
    isLocked
    && status?.appLockEnabled
    && status.webAuthnEnabled
    && status.webAuthnAvailableHere
    && platformAvailable === true
    && !pinFallbackVisible
    && !automaticAttempted,
  );
}
