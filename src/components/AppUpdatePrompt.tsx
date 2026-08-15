import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CheckCircle2, LoaderCircle, RefreshCw, Sparkles, WifiOff, X } from 'lucide-react';
import { APP_VERSION, isRequiredUpdate, latestReleaseNotes } from '../lib/appRelease';

type UpdatePhase = 'idle' | 'updating' | 'failed';

const CHECK_INTERVAL_MS = 45 * 60 * 1000;

export function AppUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [showNotes, setShowNotes] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const refreshingRef = useRef(false);

  // Keep the app usable while the new service worker waits in the background.
  const required = isRequiredUpdate(APP_VERSION);

  const checkForUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) void registration.update();
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdate]);

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

  async function applyUpdate() {
    if (!online) return;
    setPhase('updating');
    setShowNotes(false);
    try {
      await updateServiceWorker(true);
      // controllerchange listener reloads once the new worker activates.
    } catch {
      setPhase('failed');
    }
  }

  function dismiss() {
    setNeedRefresh(false);
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

  if (offlineReady && !needRefresh) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <CheckCircle2 size={18} />
          </span>
          <p className="flex-1 text-sm font-medium">Tab is ready to work offline</p>
          <button onClick={dismissOfflineReady} aria-label="Dismiss" className="size-8 rounded-full grid place-items-center hover:bg-[var(--color-surface-secondary)]">
            <X size={16} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>
    );
  }

  if (!needRefresh) return null;

  if (required) {
    return (
      <div className="fixed inset-0 z-[60] bg-[var(--color-bg)]/95 backdrop-blur-sm flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            {phase === 'updating' ? <LoaderCircle size={26} className="animate-spin" /> : <RefreshCw size={26} />}
          </span>
          <h2 className="text-lg font-bold mt-4">{phase === 'updating' ? 'Updating Tab…' : 'Update required'}</h2>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">
            {phase === 'failed'
              ? 'Check your internet connection and try again.'
              : phase === 'updating'
                ? 'This will only take a moment.'
                : 'Please update Tab to continue securely.'}
          </p>
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
              <p className="font-semibold text-sm">Updating Tab…</p>
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
                <p className="font-semibold text-sm">New update available</p>
                <p className="text-xs leading-5 text-[var(--color-text-secondary)] mt-0.5">A newer version of Tab is ready with the latest improvements and fixes.</p>
              </div>
              <button onClick={dismiss} aria-label="Dismiss" className="size-8 rounded-full grid place-items-center hover:bg-[var(--color-surface-secondary)]">
                <X size={16} className="text-[var(--color-text-muted)]" />
              </button>
            </div>

            {showNotes && latestReleaseNotes() && (
              <div className="mt-3 rounded-xl bg-[var(--color-surface-secondary)] p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <Sparkles size={12} /> What's New in {latestReleaseNotes()!.version}
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {latestReleaseNotes()!.notes.map((note) => (
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
              <button onClick={() => setShowNotes((v) => !v)} className="w-full text-center text-xs font-medium text-[var(--color-primary)] mt-3 min-h-8">
                {showNotes ? 'Hide' : 'What\u2019s New'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

