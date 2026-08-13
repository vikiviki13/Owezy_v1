import { createContext, useContext } from 'react';

export type UpdateCheckResult = 'available' | 'up-to-date' | 'offline' | 'unavailable' | 'failed';

export interface AppUpdateContextValue {
  needRefresh: boolean;
  offlineReady: boolean;
  updating: boolean;
  updateFailed: boolean;
  requiredUpdate: boolean;
  isOnline: boolean;
  checking: boolean;
  applyUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  dismissUpdate: () => void;
}

export const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function useAppUpdate() {
  const value = useContext(AppUpdateContext);
  if (!value) throw new Error('useAppUpdate must be used inside AppUpdateProvider');
  return value;
}
