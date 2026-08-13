import type { SecurityStatus } from '../types/security';

export interface SecurityBootstrapResult {
  status: SecurityStatus | null;
  isLocked: boolean;
}

export function disabledSecurityStatus(): SecurityStatus {
  return {
    appLockEnabled: false,
    pinEnabled: false,
    webAuthnEnabled: false,
    webAuthnAvailableHere: false,
    autoLockDuration: '5m',
    preferredUnlockMethod: 'pin',
    failedPinAttempts: 0,
    lockedUntil: null,
    grantValid: false,
    lastVerifiedAt: null,
    authenticators: [],
  };
}

export function resolveFailedSecurityBootstrap(errorCode: string, cachedStatus: SecurityStatus | null): SecurityBootstrapResult {
  // A missing function means server-backed App Lock could not have been enabled
  // for a new installation. Preserve fail-closed behavior if this browser has
  // previously observed App Lock as enabled.
  if (errorCode === 'security_service_not_deployed' && !cachedStatus?.appLockEnabled) {
    return { status: disabledSecurityStatus(), isLocked: false };
  }

  if (cachedStatus?.appLockEnabled) {
    return { status: { ...cachedStatus, grantValid: false }, isLocked: true };
  }

  // Network and unknown verification failures remain fail-closed.
  return { status: null, isLocked: true };
}
