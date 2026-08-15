import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AutoLockDuration, SecurityStatus } from '../types/security';
import { autoLockMilliseconds, shouldAutoLock } from '../lib/securityPolicy';
import {
  authenticateWithWebAuthn,
  cacheAppLockEnabled,
  clearLegacySecurityStorage,
  getCachedAppLockEnabled,
  getLastActive,
  getSecurityStatus,
  lockApp,
  markActive,
  SecurityServiceError,
  setAutoLock,
  touchUnlockSession,
  verifyPin,
} from '../lib/securityService';
import { SecurityContext } from './SecurityContext';
import { clearLegacyLocalData, clearSensitiveLocalData } from '../lib/db';
import { clearContactImportDraft } from '../lib/contactImport';

function clearLockedData() {
  clearSensitiveLocalData();
  clearLegacyLocalData();
}

export function SecurityProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setLocked] = useState(true);
  const [unlockMessage, setUnlockMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const lastServerTouch = useRef(0);

  const refresh = useCallback(async () => {
    const next = await getSecurityStatus(userId);
    setStatus(next);
    cacheAppLockEnabled(userId, next.appLockEnabled);
    const locallyExpired = next.appLockEnabled && shouldAutoLock(next.autoLockDuration, getLastActive(userId));
    const locked = next.appLockEnabled && (!next.grantValid || locallyExpired);
    setLocked(locked);
    if (locked) { clearLockedData(); void clearContactImportDraft(userId); }
    setLoading(false);
    return next;
  }, [userId]);

  useEffect(() => {
    let active = true;
    clearLegacySecurityStorage();
    setLoading(true);
    getSecurityStatus(userId)
      .then((next) => {
        if (!active) return;
        setStatus(next);
        cacheAppLockEnabled(userId, next.appLockEnabled);
        const locallyExpired = next.appLockEnabled && shouldAutoLock(next.autoLockDuration, getLastActive(userId));
        const locked = next.appLockEnabled && (!next.grantValid || locallyExpired);
        setLocked(locked);
        if (locked) { clearLockedData(); void clearContactImportDraft(userId); }
        if (locallyExpired) void lockApp(userId);
      })
      .catch(() => {
        if (!active) return;
        // Offline: the security state cannot be verified. Only lock when the
        // last known state had App Lock enabled; otherwise let the user keep
        // working with their locally persisted session and data.
        const cachedLocked = getCachedAppLockEnabled(userId);
        setStatus(null);
        setLocked(cachedLocked === true);
        if (cachedLocked === true) { clearLockedData(); void clearContactImportDraft(userId); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const revealLockScreen = () => {
      if (!document.hidden) requestAnimationFrame(() => document.documentElement.classList.remove('privacy-mode'));
    };
    document.addEventListener('visibilitychange', revealLockScreen);
    return () => document.removeEventListener('visibilitychange', revealLockScreen);
  }, []);

  const lock = useCallback(async () => {
    window.clearTimeout(timer.current);
    setLocked(true);
    setUnlockMessage('');
    clearLockedData();
    void clearContactImportDraft(userId);
    await lockApp(userId);
  }, [userId]);

  const schedule = useCallback((currentStatus: SecurityStatus | null) => {
    window.clearTimeout(timer.current);
    if (!currentStatus?.appLockEnabled || currentStatus.autoLockDuration === 'immediately') return;
    const delay = autoLockMilliseconds(currentStatus.autoLockDuration);
    if (delay > 0) timer.current = window.setTimeout(() => void lock(), delay);
  }, [lock]);

  useEffect(() => {
    if (loading || isLocked) return;
    schedule(status);
    const onActivity = () => {
      markActive(userId);
      schedule(status);
      const now = Date.now();
      if (now - lastServerTouch.current > 30_000) {
        lastServerTouch.current = now;
        void touchUnlockSession(userId).catch(() => undefined);
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        document.documentElement.classList.add('privacy-mode');
        markActive(userId);
        if (status?.autoLockDuration === 'immediately') void lock();
        return;
      }
      const expired = status?.appLockEnabled && shouldAutoLock(status.autoLockDuration, getLastActive(userId), Date.now(), true);
      if (expired) void lock();
      else onActivity();
      requestAnimationFrame(() => document.documentElement.classList.remove('privacy-mode'));
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    const onPageHide = () => { if (status?.autoLockDuration === 'immediately') void lock(); };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearTimeout(timer.current);
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [isLocked, loading, lock, schedule, status, userId]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!status) throw new SecurityServiceError('status_unavailable', 'Security settings are still loading.');
    await verifyPin(userId, pin, status.autoLockDuration);
    markActive(userId);
    setUnlockMessage('Verified');
    setStatus((current) => current ? { ...current, grantValid: true, lastVerifiedAt: new Date().toISOString(), failedPinAttempts: 0, lockedUntil: null } : current);
    setLocked(false);
  }, [status, userId]);

  const unlockWithDevice = useCallback(async () => {
    if (!status) throw new SecurityServiceError('status_unavailable', 'Security settings are still loading.');
    await authenticateWithWebAuthn(userId, status.autoLockDuration);
    markActive(userId);
    setUnlockMessage('Verified');
    setStatus((current) => current ? { ...current, grantValid: true, lastVerifiedAt: new Date().toISOString() } : current);
    setLocked(false);
  }, [status, userId]);

  const setAutoLockDuration = useCallback(async (duration: AutoLockDuration) => {
    await setAutoLock(userId, duration);
    setStatus((current) => current ? { ...current, autoLockDuration: duration } : current);
  }, [userId]);

  const markVerified = useCallback(async () => { await refresh(); }, [refresh]);

  const value = useMemo(() => ({
    userId,
    status,
    loading,
    isLocked,
    unlockMessage,
    refresh,
    unlockWithPin,
    unlockWithDevice,
    lock,
    setAutoLockDuration,
    markVerified,
  }), [isLocked, loading, lock, markVerified, refresh, setAutoLockDuration, status, unlockMessage, unlockWithDevice, unlockWithPin, userId]);

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}
