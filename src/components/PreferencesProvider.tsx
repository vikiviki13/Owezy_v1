import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserPreferences } from '../types';
import { getUserPreferences, onDBChange, updateUserPreferences } from '../lib/db';
import { PreferencesContext } from './PreferencesContext';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(getUserPreferences);

  useEffect(() => onDBChange(() => setPreferences({ ...getUserPreferences() })), []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', preferences.theme === 'dark' || (preferences.theme === 'system' && media.matches));
    apply();
    if (preferences.theme === 'system') media.addEventListener('change', apply);
    localStorage.setItem('tab_theme', preferences.theme);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme]);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences({ ...updateUserPreferences(patch) });
  }, []);

  const value = useMemo(() => ({ preferences, updatePreferences }), [preferences, updatePreferences]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
