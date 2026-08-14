import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { hasRecentAuthentication, SecurityServiceError } from '../../lib/securityService';
import { PinPad } from './PinPad';

export function RequireReauthentication({
  open,
  purpose,
  onVerified,
  onCancel,
  allowRecentAuthentication = true,
  pinTitle = 'Enter App PIN',
}: {
  open: boolean;
  purpose: string;
  onVerified: () => void | Promise<void>;
  onCancel: () => void;
  allowRecentAuthentication?: boolean;
  pinTitle?: string;
}) {
  const { userId, status, unlockWithDevice, unlockWithPin } = useSecurity();
  const [checking, setChecking] = useState(false);
  const [method, setMethod] = useState<'choose' | 'pin'>('choose');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod(status?.webAuthnEnabled && status.webAuthnAvailableHere ? 'choose' : 'pin');
    setMessage('');
    if (!allowRecentAuthentication) {
      setChecking(false);
      return;
    }
    setChecking(true);
    let active = true;
    void hasRecentAuthentication(userId)
      .then(({ fresh }) => { if (active && fresh) void onVerified(); })
      .catch(() => undefined)
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [allowRecentAuthentication, onVerified, open, status?.webAuthnAvailableHere, status?.webAuthnEnabled, userId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !working) onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onCancel, open, working]);

  const device = useCallback(async () => {
    setWorking(true); setMessage('Verify your identity on your device');
    try { await unlockWithDevice(); await onVerified(); }
    catch (caught) {
      if (caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled') setMessage('');
      else setMessage(caught instanceof Error ? caught.message : "Couldn't verify your identity.");
    } finally { setWorking(false); }
  }, [onVerified, unlockWithDevice]);

  const pin = useCallback(async (value: string) => {
    setWorking(true); setMessage('');
    try { await unlockWithPin(value); await onVerified(); }
    catch (caught) {
      setMessage(caught instanceof SecurityServiceError && caught.code === 'pin_incorrect'
        ? 'Incorrect PIN. Try again.'
        : caught instanceof Error ? caught.message : 'Incorrect PIN. Try again.');
    }
    finally { setWorking(false); }
  }, [onVerified, unlockWithPin]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[var(--color-surface)] p-5 safe-bottom shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <span className="size-11 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center"><ShieldCheck size={22} /></span>
          <div className="min-w-0 flex-1"><h2 id="reauth-title" className="font-bold">Verify it's you</h2><p className="text-xs text-[var(--color-text-muted)] mt-0.5">Required to {purpose}.</p></div>
          <button type="button" onClick={onCancel} disabled={working} aria-label="Cancel verification" className="size-11 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)]"><X size={20} /></button>
        </div>
        {checking ? <div className="min-h-36 flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]"><LoaderCircle className="animate-spin" size={18} /> Checking recent verification…</div> : method === 'choose' ? (
          <div>
            <button type="button" onClick={device} disabled={working} className="w-full min-h-14 rounded-2xl bg-[var(--color-primary)] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{working ? <LoaderCircle className="animate-spin" size={19} /> : <Fingerprint size={20} />}Use Device Security</button>
            {message && <p className="text-sm text-center text-[var(--color-text-secondary)] mt-3" role="status">{message}</p>}
            {status?.pinEnabled && <button type="button" onClick={() => { setMethod('pin'); setMessage(''); }} className="w-full min-h-12 mt-2 text-sm font-semibold text-[var(--color-primary)]"><KeyRound size={17} className="inline mr-2" />Use App PIN</button>}
          </div>
        ) : (
          <PinPad title={pinTitle} description="Use your 6-digit App PIN to continue." disabled={working} error={message} onComplete={pin} />
        )}
      </div>
    </div>
  );
}
