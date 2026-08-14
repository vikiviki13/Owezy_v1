import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fingerprint, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../SecurityContext';
import {
  cancelWebAuthnAuthentication,
  isPlatformAuthenticatorAvailable,
  SecurityServiceError,
} from '../../lib/securityService';
import { shouldAutoTriggerDeviceAuthentication } from '../../lib/automaticDeviceUnlock';
import { PinPad } from './PinPad';
import { APP_NAME, BrandLogo, BrandWordmark } from '../Brand';
import { Button } from '../ui/button';

type DeviceAttemptState = 'idle' | 'requesting' | 'cancelled' | 'failed';

export function LockScreen() {
  const { status, unlockWithDevice, unlockWithPin, isLocked, serviceError, refresh } = useSecurity();
  const navigate = useNavigate();
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [showPin, setShowPin] = useState(Boolean(status?.pinEnabled && !status?.webAuthnAvailableHere));
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [deviceAttemptState, setDeviceAttemptState] = useState<DeviceAttemptState>('idle');
  const [retryUntil, setRetryUntil] = useState(() => status?.lockedUntil ? new Date(status.lockedUntil).getTime() : 0);
  const [now, setNow] = useState(Date.now());
  const automaticAttempted = useRef(false);
  const attemptSequence = useRef(0);

  useEffect(() => {
    let active = true;
    void isPlatformAuthenticatorAvailable().then((available) => {
      if (active) setPlatformAvailable(available);
    });
    return () => { active = false; cancelWebAuthnAuthentication(); };
  }, []);

  useEffect(() => { if (!isLocked) navigate('/home', { replace: true }); }, [isLocked, navigate]);
  useEffect(() => {
    if (retryUntil <= Date.now()) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [retryUntil]);

  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const deviceUsable = Boolean(
    status?.appLockEnabled
    && status.webAuthnEnabled
    && status.webAuthnAvailableHere
    && platformAvailable === true,
  );

  const requestDeviceAuthentication = useCallback(async () => {
    const attempt = ++attemptSequence.current;
    setWorking(true);
    setDeviceAttemptState('requesting');
    setMessage('');
    try {
      await unlockWithDevice();
    } catch (caught) {
      if (attempt !== attemptSequence.current) return;
      if (caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled') {
        setDeviceAttemptState('cancelled');
        setMessage('');
      } else {
        setDeviceAttemptState('failed');
        setMessage(caught instanceof Error ? caught.message : "Couldn't verify your identity.");
      }
    } finally {
      if (attempt === attemptSequence.current) setWorking(false);
    }
  }, [unlockWithDevice]);

  useEffect(() => {
    if (!status || platformAvailable !== false || !status.pinEnabled || deviceAttemptState === 'requesting') return;
    setShowPin(true);
  }, [deviceAttemptState, platformAvailable, status]);

  useEffect(() => {
    if (!shouldAutoTriggerDeviceAuthentication({
      status,
      isLocked,
      platformAvailable,
      pinFallbackVisible: showPin,
      automaticAttempted: automaticAttempted.current,
    })) return;
    automaticAttempted.current = true;
    void requestDeviceAuthentication();
  }, [isLocked, platformAvailable, requestDeviceAuthentication, showPin, status]);

  const switchToPin = useCallback(() => {
    attemptSequence.current += 1;
    cancelWebAuthnAuthentication();
    setWorking(false);
    setDeviceAttemptState('idle');
    setMessage('');
    setShowPin(true);
  }, []);

  const retryDevice = useCallback(() => {
    setShowPin(false);
    setMessage('');
    void requestDeviceAuthentication();
  }, [requestDeviceAuthentication]);

  const usePin = useCallback(async (pin: string) => {
    if (retrySeconds > 0) return;
    setWorking(true);
    setMessage('');
    try {
      await unlockWithPin(pin);
    } catch (caught) {
      if (caught instanceof SecurityServiceError) {
        if (caught.retryAfter > 0) setRetryUntil(Date.now() + caught.retryAfter * 1000);
        setMessage(caught.message);
      } else setMessage('Incorrect PIN.');
    } finally {
      setWorking(false);
    }
  }, [retrySeconds, unlockWithPin]);

  const pinError = useMemo(() => retrySeconds > 0 ? `Too many attempts. Try again in ${retrySeconds} seconds.` : message, [message, retrySeconds]);
  const deviceFailed = deviceAttemptState === 'failed';
  const deviceCancelled = deviceAttemptState === 'cancelled';

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-[var(--color-bg)] px-5 py-8 safe-top safe-bottom">
      <div className="min-h-full w-full max-w-sm mx-auto flex flex-col justify-center text-center">
        <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] mb-8" aria-label={`${APP_NAME} expense tracker`}>
          <BrandLogo size={28} className="rounded-xl" />
          <BrandWordmark className="font-bold tracking-tight" />
        </div>
        <span className="size-20 rounded-[26px] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-sm">
          {deviceAttemptState === 'requesting' ? <LoaderCircle className="animate-spin" size={34} /> : deviceFailed ? <ShieldCheck size={34} /> : <LockKeyhole size={34} />}
        </span>
        <h1 className="text-2xl font-bold mt-5">App Locked</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          {deviceFailed ? "Couldn't verify your identity" : 'Verify your identity to continue'}
        </p>

        {serviceError && (
          <div className="mt-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
            <WifiOff className="mx-auto mb-2" size={21} />
            <p>{serviceError.message}</p>
            <Button type="button" variant="ghost" onClick={() => void refresh().catch(() => undefined)} className="mt-2">Try Again</Button>
          </div>
        )}

        {status && !showPin && !serviceError && (
          <div className="mt-8">
            {deviceAttemptState === 'requesting' ? (
              <div className="min-h-14 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 flex items-center justify-center gap-2.5 text-sm font-semibold" role="status" aria-live="polite">
                <LoaderCircle className="animate-spin text-[var(--color-primary)]" size={20} /> Waiting for Device Security…
              </div>
            ) : platformAvailable === null ? (
              <div className="min-h-14 flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]" role="status">
                <LoaderCircle className="animate-spin" size={19} /> Checking Device Security…
              </div>
            ) : (
              <Button type="button" onClick={retryDevice} disabled={!deviceUsable} className="w-full min-h-14 rounded-2xl font-semibold gap-2.5">
                <Fingerprint size={21} /> {deviceUsable ? 'Try Device Security Again' : 'Device Security Unavailable'}
              </Button>
            )}

            {deviceFailed && <div role="alert" className="mt-3 text-sm text-[var(--color-error)]"><p className="font-semibold">Couldn't verify your identity</p>{message && message !== "Couldn't verify your identity." && <p className="text-xs leading-5 mt-1">{message}</p>}</div>}
            {deviceCancelled && <p className="text-xs leading-5 text-[var(--color-text-muted)] mt-3">Device authentication was cancelled. It will not reopen until you try again.</p>}

            {status.pinEnabled && (
              <Button type="button" variant="ghost" onClick={switchToPin} className="mt-3 text-[var(--color-primary)]">
                <KeyRound size={17} /> {working ? 'Try PIN Instead' : 'Use PIN Instead'}
              </Button>
            )}
            {!deviceUsable && platformAvailable === false && status.pinEnabled && <p className="text-xs leading-5 text-[var(--color-text-muted)] mt-2">Your App PIN remains available as a secure fallback.</p>}
          </div>
        )}

        {status?.pinEnabled && showPin && (
          <div className="mt-7">
            <PinPad
              description="Enter your 6-digit App PIN."
              disabled={working || retrySeconds > 0}
              error={pinError}
              onComplete={usePin}
              onForgot={() => { window.location.hash = '#/account-recovery'; }}
            />
            {deviceUsable && <Button type="button" variant="ghost" onClick={retryDevice} className="mt-2 text-[var(--color-primary)]"><Fingerprint size={17} />Try Device Security Again</Button>}
          </div>
        )}

        <p className="text-xs leading-5 text-[var(--color-text-muted)] mt-8">Your biometric information stays on your device. {APP_NAME} only receives confirmation that verification succeeded.</p>
      </div>
    </main>
  );
}
