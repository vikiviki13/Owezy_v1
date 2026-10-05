import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CheckCircle2, LoaderCircle, RefreshCw, Sparkles, WifiOff, X } from 'lucide-react';
import { usePreferences } from './PreferencesContext';
import { APP_VERSION, compareVersions, getReleaseNotesForVersion, isRequiredUpdate, latestReleaseNotes } from '../lib/appRelease';
import { checkRemoteUpdate, RemoteReleaseInfo } from '../services/appUpdateService';

type UpdatePhase = 'idle' | 'updating' | 'failed';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function AppUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const { preferences } = usePreferences();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [showNotes, setShowNotes] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteReleaseInfo | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dismissed_update_version');
    } catch {
      return null;
    }
  });
  const refreshingRef = useRef(false);

  const checkForUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) void registration.update();
      }).catch(() => undefined);
    }
  }, []);

  const checkAllUpdates = useCallback(async () => {
    checkForUpdate();
    try {
      const res = await checkRemoteUpdate(APP_VERSION);
      if (res?.hasUpdate) {
        setRemoteUpdate(res);
      }
    } catch {
      // Ignore network errors on passive check
    }
  }, [checkForUpdate]);

  // Run update check when app opens, on visibility change, and on interval
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkAllUpdates();
    }, 50);

    const handleOnline = () => {
      setOnline(true);
      void checkAllUpdates();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = window.setInterval(checkAllUpdates, CHECK_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkAllUpdates();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkAllUpdates]);

  // Once the new service worker takes control, reload to run the latest build.
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const isSWUpdate = needRefresh;
  const isRemoteNewer = Boolean(
    remoteUpdate?.hasUpdate &&
    remoteUpdate.version &&
    compareVersions(remoteUpdate.version, APP_VERSION) > 0
  );
  // If user previously dismissed this version (or an even newer version), don't prompt again
  const isDismissed = Boolean(
    !isSWUpdate &&
    isRemoteNewer &&
    dismissedVersion &&
    remoteUpdate?.version &&
    compareVersions(dismissedVersion, remoteUpdate.version) >= 0
  );
  const hasUpdate = (isSWUpdate || isRemoteNewer) && !isDismissed;

  const required = isRequiredUpdate(APP_VERSION) || remoteUpdate?.required === true;

  const targetVersion = remoteUpdate?.version || (needRefresh ? 'Latest' : APP_VERSION);
  const incomingNotes = (remoteUpdate?.notes && remoteUpdate.notes.length > 0)
    ? remoteUpdate.notes
    : getReleaseNotesForVersion(targetVersion)?.notes || latestReleaseNotes()?.notes;

  async function applyUpdate() {
    if (!online) return;
    setPhase('updating');
    setShowNotes(false);
    if (remoteUpdate?.version) {
      try {
        localStorage.setItem('dismissed_update_version', remoteUpdate.version);
        setDismissedVersion(remoteUpdate.version);
      } catch { /* ignore */ }
    }
    // Flag the next page load so the boot splash shows "Applying update…".
    try { sessionStorage.setItem('tab_boot_mode', 'updating'); } catch { /* ignore */ }
    try {
      if (needRefresh) {
        await updateServiceWorker(true);
      } else {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else {
            await reg?.update();
          }
        }
        window.setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch {
      try { sessionStorage.removeItem('tab_boot_mode'); } catch { /* ignore */ }
      setPhase('failed');
    }
  }

  function dismiss() {
    setNeedRefresh(false);
    if (remoteUpdate?.version) {
      try {
        localStorage.setItem('dismissed_update_version', remoteUpdate.version);
        setDismissedVersion(remoteUpdate.version);
      } catch { /* ignore */ }
    }
    setShowNotes(false);
    setPhase('idle');
  }

  function dismissOfflineReady() {
    setOfflineReady(false);
  }

  useEffect(() => {
    if (phase === 'updating') {
      const timer = window.setTimeout(() => {
        if (phase === 'updating') setPhase('failed');
      }, 20000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  if (offlineReady && !hasUpdate) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <CheckCircle2 size={18} />
          </span>
          <p className="flex-1 text-sm font-medium">Owezy is ready to work offline</p>
          <button onClick={dismissOfflineReady} aria-label="Dismiss" className="size-8 rounded-full grid place-items-center hover:bg-[var(--color-surface-secondary)]">
            <X size={16} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>
    );
  }

  if (!hasUpdate) return null;

  // Critical updates are always shown. The informational update prompt respects
  // the App Updates toggle in settings.
  if (!required && !preferences.app_updates_enabled) return null;

  if (required) {
    return (
      <div className="fixed inset-0 z-[60] bg-[var(--color-bg)]/95 backdrop-blur-sm flex items-center justify-center px-5" data-no-swipe>
        <div className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            {phase === 'updating' ? <LoaderCircle size={26} className="animate-spin" /> : <RefreshCw size={26} />}
          </span>
          <h2 className="text-lg font-bold mt-4">{phase === 'updating' ? 'Updating Owezy…' : 'Update required'}</h2>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">
            {phase === 'failed'
              ? 'Check your internet connection and try again.'
              : phase === 'updating'
                ? 'This will only take a moment.'
                : 'Please update Owezy to continue securely.'}
          </p>

          {incomingNotes && incomingNotes.length > 0 && (
            <div className="mt-4 rounded-xl bg-[var(--color-surface-secondary)] p-3 text-left">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <Sparkles size={12} /> Features in {targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {incomingNotes.map((note) => (
                  <li key={note} className="text-xs leading-5 text-[var(--color-text-secondary)] flex gap-1.5">
                    <span className="text-[var(--color-primary)]">•</span>{note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === 'failed' ? (
            <button onClick={() => setPhase('idle')} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold mt-6">Try Again</button>
          ) : (
            <button onClick={() => void applyUpdate()} disabled={!online} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] disabled:opacity-40 text-white font-semibold mt-6">
              Update Now
            </button>
          )}
          {!online && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-3">
              <WifiOff size={13} /> Connect to the internet to install the latest version.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
        {phase === 'failed' ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)]">
                <RefreshCw size={17} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Couldn't update the app</p>
                <p className="text-xs leading-5 text-[var(--color-text-secondary)] mt-0.5">Check your internet connection and try again.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => void applyUpdate()} className="flex-1 min-h-11 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium">Try Again</button>
              <button onClick={dismiss} className="flex-1 min-h-11 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)]">Later</button>
            </div>
          </>
        ) : phase === 'updating' ? (
          <div className="flex items-center gap-3">
            <LoaderCircle size={22} className="animate-spin text-[var(--color-primary)] shrink-0" />
            <div>
              <p className="font-semibold text-sm">Updating Owezy…</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">This will only take a moment.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <RefreshCw size={17} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Update is available</p>
                <p className="text-xs leading-5 text-[var(--color-text-secondary)] mt-0.5">
                  A new version of Owezy is ready with new features and improvements.
                </p>
              </div>
              <button onClick={dismiss} aria-label="Dismiss" className="size-8 rounded-full grid place-items-center hover:bg-[var(--color-surface-secondary)]">
                <X size={16} className="text-[var(--color-text-muted)]" />
              </button>
            </div>

            {showNotes && incomingNotes && incomingNotes.length > 0 && (
              <div className="mt-3 rounded-xl bg-[var(--color-surface-secondary)] p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <Sparkles size={12} /> What's New in {targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`}
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {incomingNotes.map((note) => (
                    <li key={note} className="text-xs leading-5 text-[var(--color-text-secondary)] flex gap-1.5">
                      <span className="text-[var(--color-primary)]">•</span>{note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => void applyUpdate()} disabled={!online} className="flex-1 min-h-11 rounded-xl bg-[var(--color-primary)] disabled:opacity-40 text-white text-sm font-medium">
                Update Now
              </button>
              <button onClick={dismiss} className="flex-1 min-h-11 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)]">
                Later
              </button>
            </div>

            {!online ? (
              <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-3">
                <WifiOff size={13} /> Connect to the internet to install the latest version.
              </p>
            ) : (
              incomingNotes && incomingNotes.length > 0 && (
                <button onClick={() => setShowNotes((v) => !v)} className="w-full text-center text-xs font-medium text-[var(--color-primary)] mt-3 min-h-8">
                  {showNotes ? 'Hide' : 'What\u2019s New'}
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
