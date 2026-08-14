import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from '../lib/release';
import { AppUpdateContext, type UpdateCheckResult } from './AppUpdateContext';
import { AppUpdatePrompt } from './AppUpdatePrompt';

const UPDATE_INTERVAL_MS = 45 * 60_000;

interface VersionMetadata {
  version?: string;
  required_update?: boolean;
}

function waitForInstallation(worker: ServiceWorker) {
  if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const changed = () => {
      if (worker.state !== 'installed' && worker.state !== 'activated' && worker.state !== 'redundant') return;
      worker.removeEventListener('statechange', changed);
      resolve();
    };
    worker.addEventListener('statechange', changed);
  });
}

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const lastCheckAt = useRef(0);
  const [requiredUpdate, setRequiredUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isOnline, setOnline] = useState(() => navigator.onLine);
  const shouldForceUpdate = useRef(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedRefresh: () => {
      if (shouldForceUpdate.current) setRequiredUpdate(true);
    },
    onRegisteredSW: (_scriptUrl, nextRegistration) => {
      registration.current = nextRegistration || null;
    },
  });

  const readVersionMetadata = useCallback(async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const metadata = await response.json() as VersionMetadata;
      const isNewVersion = typeof metadata.version === 'string' && metadata.version !== APP_VERSION;
      shouldForceUpdate.current = Boolean(isNewVersion && metadata.required_update);
      setRequiredUpdate(shouldForceUpdate.current);
      return metadata;
    } catch {
      return null;
    }
  }, []);

  const resolveRegistration = useCallback(async () => {
    if (registration.current) return registration.current;
    if (!('serviceWorker' in navigator)) return null;
    const nextRegistration = await navigator.serviceWorker.getRegistration();
    registration.current = nextRegistration || null;
    return nextRegistration || null;
  }, []);

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!navigator.onLine) return 'offline';
    setChecking(true);
    lastCheckAt.current = Date.now();
    try {
      const nextRegistration = await resolveRegistration();
      if (!nextRegistration) return 'unavailable';
      await readVersionMetadata();
      await nextRegistration.update();
      if (nextRegistration.installing) await waitForInstallation(nextRegistration.installing);
      if (nextRegistration.waiting) {
        setUpdateFailed(false);
        setNeedRefresh(true);
        return 'available';
      }
      return 'up-to-date';
    } catch {
      return 'failed';
    } finally {
      setChecking(false);
    }
  }, [readVersionMetadata, resolveRegistration, setNeedRefresh]);

  useEffect(() => {
    const check = () => { void checkForUpdates(); };
    const becameVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckAt.current > 60_000) check();
    };
    const cameOnline = () => {
      setOnline(true);
      setUpdateFailed(false);
      check();
    };
    const wentOffline = () => setOnline(false);

    check();
    const interval = window.setInterval(check, UPDATE_INTERVAL_MS);
    document.addEventListener('visibilitychange', becameVisible);
    window.addEventListener('online', cameOnline);
    window.addEventListener('offline', wentOffline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', becameVisible);
      window.removeEventListener('online', cameOnline);
      window.removeEventListener('offline', wentOffline);
    };
  }, [checkForUpdates]);

  const applyUpdate = useCallback(async () => {
    if (!navigator.onLine) return;
    setUpdating(true);
    setUpdateFailed(false);
    try {
      await updateServiceWorker(true);
    } catch {
      setUpdating(false);
      setUpdateFailed(true);
    }
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    if (requiredUpdate || updating) return;
    setUpdateFailed(false);
    setNeedRefresh(false);
  }, [requiredUpdate, setNeedRefresh, updating]);

  const value = useMemo(() => ({
    needRefresh,
    offlineReady,
    updating,
    updateFailed,
    requiredUpdate,
    isOnline,
    checking,
    applyUpdate,
    checkForUpdates,
    dismissUpdate,
  }), [applyUpdate, checkForUpdates, checking, dismissUpdate, isOnline, needRefresh, offlineReady, requiredUpdate, updateFailed, updating]);

  return <AppUpdateContext.Provider value={value}>{children}<AppUpdatePrompt /></AppUpdateContext.Provider>;
}
