import { createContext, useContext } from 'react';
import type { AutoLockDuration, SecurityStatus } from '../types/security';

export interface SecurityContextValue {
  userId: string;
  status: SecurityStatus | null;
  loading: boolean;
  isLocked: boolean;
  unlockMessage: string;
  refresh: () => Promise<SecurityStatus>;
  unlockWithPin: (pin: string) => Promise<void>;
  unlockWithDevice: () => Promise<void>;
  lock: () => Promise<void>;
  setAutoLockDuration: (duration: AutoLockDuration) => Promise<void>;
  markVerified: () => Promise<void>;
}

export const SecurityContext = createContext<SecurityContextValue | null>(null);

export function useSecurity() {
  const value = useContext(SecurityContext);
  if (!value) throw new Error('useSecurity must be used inside SecurityProvider');
  return value;
}
