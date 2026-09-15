import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Fingerprint, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import type { AutoLockDuration } from '../../types/security';
import { createPin, enableAppLock, isPlatformAuthenticatorAvailable, registerAuthenticator, SecurityServiceError, verifyAccountPassword } from '../../lib/securityService';
import { useSecurity } from '../SecurityContext';
import { PinCreationFlow } from './PinCreationFlow';

type SetupStep = 'intro' | 'verify-account' | 'device' | 'pin' | 'auto-lock' | 'success';

const AUTO_LOCK_OPTIONS: { value: AutoLockDuration; label: string; description?: string }[] = [
  { value: 'immediately', label: 'Immediately' },
  { value: '1m', label: 'After 1 minute' },
  { value: '5m', label: 'After 5 minutes', description: 'Recommended' },
  { value: '15m', label: 'After 15 minutes' },
  { value: '30m', label: 'After 30 minutes' },
];

export function SecuritySetupFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { userId, refresh, status } = useSecurity();
  const [step, setStep] = useState<SetupStep>('intro');
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [autoLockDuration, setAutoLockDuration] = useState<AutoLockDuration>('5m');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [stepUpToken, setStepUpToken] = useState('');

  useEffect(() => {
    if (step === 'device' && platformAvailable === null) void isPlatformAuthenticatorAvailable().then(setPlatformAvailable);
  }, [platformAvailable, step]);

  const setupDevice = useCallback(async () => {
    setBusy(true); setError('');
    try {
      await registerAuthenticator(userId, undefined, stepUpToken);
      setDeviceEnabled(true);
      setStep(status?.pinEnabled ? 'auto-lock' : 'pin');
    } catch (caught) {
      if (caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled') setError('');
      else setError(caught instanceof Error ? caught.message : 'Device Security could not be set up.');
    } finally { setBusy(false); }
  }, [status, stepUpToken, userId]);

  const savePin = useCallback(async (pin: string) => {
    setBusy(true); setError('');
    try { await createPin(userId, pin, stepUpToken); setStep('auto-lock'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The PIN could not be saved.'); }
    finally { setBusy(false); }
  }, [stepUpToken, userId]);

  const verifyAccount = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const proof = await verifyAccountPassword(userId, password, 'security_setup');
      setStepUpToken(proof);
      setPassword('');
      setStep('device');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account verification failed.');
    } finally { setBusy(false); }
  }, [password, userId]);

  const finish = useCallback(async () => {
    setBusy(true); setError('');
    try {
      await enableAppLock(userId, autoLockDuration, stepUpToken);
      await refresh();
      setStep('success');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'App Lock could not be enabled.'); }
    finally { setBusy(false); }
  }, [autoLockDuration, refresh, stepUpToken, userId]);

  return (
    <main className="fixed inset-0 z-[250] overflow-y-auto bg-[var(--color-bg)] px-5 py-7 safe-top safe-bottom">
      <div className="w-full max-w-md min-h-full mx-auto flex flex-col">
        {step !== 'success' && <div className="flex items-center justify-between mb-6"><span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Security Setup</span><button type="button" onClick={onCancel} disabled={busy} className="size-11 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)]" aria-label="Cancel security setup"><X size={20} /></button></div>}

        <div className="flex-1 flex flex-col justify-center">
          {step === 'intro' && (
            <section className="text-center">
              <span className="size-20 rounded-[26px] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><ShieldCheck size={36} /></span>
              <p className="text-sm font-semibold text-[var(--color-primary)] mt-6">Protect Your App</p>
              <h1 className="text-2xl font-bold mt-2">Keep your financial records private</h1>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-3">Use your device security or an app PIN to unlock your records.</p>
              <div className="text-left rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mt-7 space-y-3">
                {['Protect expense history', 'Protect friend balances', 'Protect repayment information', 'Protect statements', 'Protect attachments'].map((benefit) => <div key={benefit} className="flex items-center gap-3 text-sm"><span className="size-6 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center"><Check size={14} strokeWidth={3} /></span>{benefit}</div>)}
              </div>
              <button type="button" onClick={() => setStep('verify-account')} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold mt-7">Continue</button>
              <button type="button" onClick={onCancel} className="min-h-12 px-5 text-sm font-semibold text-[var(--color-text-secondary)] mt-2">Not Now</button>
            </section>
          )}

          {step === 'verify-account' && (
            <form onSubmit={verifyAccount} className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
              <div className="text-center"><span className="size-16 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><ShieldCheck size={28} /></span><h1 className="text-2xl font-bold mt-5">Verify Your Account</h1><p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">Enter your current account password before adding unlock methods. This proof is valid only for this setup and expires after five minutes.</p></div>
              <label className="block mt-6"><span className="text-sm font-semibold">Account password</span><input type="password" autoComplete="current-password" className="input min-h-12 mt-2" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} required /></label>
              {error && <p className="text-sm text-[var(--color-error)] mt-3" role="alert">{error}</p>}
              <button disabled={busy || !password} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold mt-5 flex items-center justify-center gap-2 disabled:opacity-50">{busy && <LoaderCircle className="animate-spin" size={18} />}Verify and Continue</button>
            </form>
          )}

          {step === 'device' && (
            <section className="text-center">
              <span className="size-20 rounded-[26px] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><Fingerprint size={34} /></span>
              <h1 className="text-2xl font-bold mt-6">{platformAvailable === false ? "Device authentication isn't available" : 'Use Device Security'}</h1>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-3">{platformAvailable === false ? "This browser or device doesn't support secure device authentication for this app." : "Unlock using the security method configured on your device—such as fingerprint, face recognition, device PIN, pattern, Windows Hello or Touch ID."}</p>
              <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4 mt-6 text-xs leading-5 text-[var(--color-text-secondary)]">Your biometric information stays on your device. Tab stores only a public credential and receives confirmation that verification succeeded.</div>
              {platformAvailable === null ? <div className="min-h-14 mt-7 flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]"><LoaderCircle className="animate-spin" size={18} />Checking this device…</div> : platformAvailable ? <button type="button" onClick={setupDevice} disabled={busy} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold mt-7 flex items-center justify-center gap-2 disabled:opacity-50">{busy && <LoaderCircle className="animate-spin" size={18} />}Set Up Device Unlock</button> : <button type="button" onClick={() => setStep(status?.pinEnabled ? 'auto-lock' : 'pin')} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold mt-7">Use App PIN Instead</button>}
              {platformAvailable && <button type="button" onClick={() => setStep(status?.pinEnabled ? 'auto-lock' : 'pin')} disabled={busy} className="min-h-12 px-5 text-sm font-semibold text-[var(--color-primary)] mt-2">{status?.pinEnabled ? 'Continue with Existing PIN' : 'Set Up PIN First'}</button>}
              {error && <p className="text-sm text-[var(--color-error)] mt-3" role="alert">{error}</p>}
            </section>
          )}

          {step === 'pin' && (
            <section>
              <div className="text-center mb-6"><span className="size-16 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><KeyRound size={28} /></span><p className="text-xs leading-5 text-[var(--color-text-muted)] mt-4">Your PIN is Argon2id-hashed on the server with a unique salt. It is never stored in plain text.</p></div>
              <PinCreationFlow onConfirmed={savePin} busy={busy} />
              {error && <p className="text-sm text-center text-[var(--color-error)] mt-3" role="alert">{error}</p>}
            </section>
          )}

          {step === 'auto-lock' && (
            <section>
              <div className="text-center"><span className="size-16 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><LockKeyhole size={28} /></span><h1 className="text-2xl font-bold mt-5">Automatically Lock</h1><p className="text-sm text-[var(--color-text-secondary)] mt-2">Choose how quickly Tab locks when you stop using it.</p></div>
              <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden divide-y divide-[var(--color-border)]">
                {AUTO_LOCK_OPTIONS.map((option) => <button type="button" key={option.value} onClick={() => setAutoLockDuration(option.value)} className="w-full min-h-14 px-4 py-3 flex items-center gap-3 text-left"><span className={`size-5 rounded-full border-2 flex items-center justify-center ${autoLockDuration === option.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>{autoLockDuration === option.value && <Check size={12} className="text-white" strokeWidth={3} />}</span><span className="flex-1 text-sm font-medium">{option.label}</span>{option.description && <span className="text-xs font-semibold text-[var(--color-primary)]">{option.description}</span>}</button>)}
              </div>
              <button type="button" onClick={finish} disabled={busy} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold mt-7 flex items-center justify-center gap-2 disabled:opacity-50">{busy && <LoaderCircle className="animate-spin" size={18} />}Turn On App Lock</button>
              {error && <p className="text-sm text-center text-[var(--color-error)] mt-3" role="alert">{error}</p>}
            </section>
          )}

          {step === 'success' && (
            <section className="text-center">
              <span className="size-20 rounded-[26px] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><ShieldCheck size={38} /></span>
              <h1 className="text-2xl font-bold mt-6">{deviceEnabled ? 'Device Security Enabled' : 'App Lock Enabled'}</h1>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-3">{deviceEnabled ? "You can now use your device's secure authentication method to unlock the app, with your App PIN as fallback." : 'Your financial records are now protected by your App PIN.'}</p>
              <button type="button" onClick={onDone} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold mt-8">Done</button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
