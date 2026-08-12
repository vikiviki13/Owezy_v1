export type AutoLockDuration = 'immediately' | '1m' | '5m' | '15m' | '30m';
export type UnlockMethod = 'device' | 'pin' | 'recovery';

export interface SecurityAuthenticator {
  id: string;
  deviceName: string;
  authenticatorType: 'singleDevice' | 'multiDevice' | string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  usableHere: boolean;
}

export interface SecurityStatus {
  appLockEnabled: boolean;
  pinEnabled: boolean;
  webAuthnEnabled: boolean;
  webAuthnAvailableHere: boolean;
  autoLockDuration: AutoLockDuration;
  preferredUnlockMethod: 'device' | 'pin';
  failedPinAttempts: number;
  lockedUntil: string | null;
  grantValid: boolean;
  lastVerifiedAt: string | null;
  authenticators: SecurityAuthenticator[];
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  device_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UnlockGrant {
  token: string;
  lastVerifiedAt: string;
}
