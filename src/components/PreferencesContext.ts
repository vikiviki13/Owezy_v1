import { createContext, useContext } from 'react';
import type { UserPreferences } from '../types';

export type PreferencesContextValue = {
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
};

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
