import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fingerprint, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, WifiOff } from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { isPlatformAuthenticatorAvailable, SecurityServiceError } from '../../lib/securityService';
import { PinPad } from './PinPad';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, BrandWordmark } from '../Brand';

export function LockScreen() {
  const { status, unlockWithDevice, unlockWithPin, unlockMessage, isLocked, serviceError, refresh } = useSecurity();
  const navigate = useNavigate();
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [showPin, setShowPin] = useState(Boolean(status?.pinEnabled && !status?.webAuthnAvailableHere));
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [retryUntil, setRetryUntil] = useState(() => status?.lockedUntil ? new Date(status.lockedUntil).getTime() : 0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { void isPlatformAuthenticatorAvailable().then(setPlatformAvailable); }, []);
  useEffect(() => { if (!isLocked) navigate('/home', { replace: true }); }, [isLocked, navigate]);
  useEffect(() => {
    if (retryUntil <= Date.now()) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [retryUntil]);

  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const deviceUsable = Boolean(status?.webAuthnAvailableHere && platformAvailable);

  const useDevice = useCallback(async () => {
    setWorking(true);
    setMessage('Verify your identity on your device');
    try {
      await unlockWithDevice();
    } catch (caught) {
      if (caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled') setMessage('');
      else setMessage(caught instanceof Error ? caught.message : "Couldn't verify your identity.");
    } finally {
      setWorking(false);
    }
  }, [unlockWithDevice]);

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

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-[var(--color-bg)] px-5 py-8 safe-top safe-bottom">
      <div className="min-h-full w-full max-w-sm mx-auto flex flex-col justify-center text-center">
        <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] mb-8" aria-label={`${APP_NAME} expense tracker`}>
          <ShieldCheck size={22} />
          <BrandWordmark className="font-bold tracking-tight" />
        </div>
        <span className="size-20 rounded-[26px] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-sm">
          <LockKeyhole size={34} />
        </span>
        <h1 className="text-2xl font-bold mt-5">App Locked</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">Your financial records are protected.</p>

        {serviceError && (
          <div className="mt-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
            <WifiOff className="mx-auto mb-2" size={21} />
            <p>{serviceError.message}</p>
            <button type="button" onClick={() => void refresh().catch(() => undefined)} className="min-h-11 px-4 mt-2 font-semibold text-[var(--color-primary)]">Try Again</button>
          </div>
        )}

        {status && !showPin && !serviceError && (
          <div className="mt-8">
            <button type="button" onClick={useDevice} disabled={!deviceUsable || working} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold flex items-center justify-center gap-2.5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              {working ? <LoaderCircle className="animate-spin" size={20} /> : <Fingerprint size={21} />}
              {deviceUsable ? 'Unlock with Device Security' : 'Device Security Unavailable'}
            </button>
            {message && <p className={`text-sm mt-3 ${unlockMessage === 'Verified' ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`} role="status">{message}</p>}
            {status.pinEnabled && <button type="button" onClick={() => { setShowPin(true); setMessage(''); }} className="min-h-12 px-4 mt-3 text-sm font-semibold text-[var(--color-primary)] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"><KeyRound size={17} className="inline mr-2" />Use App PIN Instead</button>}
            {!deviceUsable && status.pinEnabled && <p className="text-xs leading-5 text-[var(--color-text-muted)] mt-2">Your App PIN remains available as a secure fallback.</p>}
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
            {deviceUsable && <button type="button" onClick={() => { setShowPin(false); setMessage(''); }} className="min-h-11 px-4 mt-2 text-sm font-semibold text-[var(--color-primary)] rounded-xl"><Fingerprint size={17} className="inline mr-2" />Try Device Security Again</button>}
          </div>
        )}

        <p className="text-xs leading-5 text-[var(--color-text-muted)] mt-8">Your biometric information stays on your device. {APP_NAME} only receives confirmation that verification succeeded.</p>
      </div>
    </main>
  );
}
