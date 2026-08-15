import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity, Check, ChevronRight, Fingerprint, KeyRound, Laptop, LoaderCircle,
  LockKeyhole, Pencil, Plus, Shield, ShieldCheck, Smartphone, Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { SettingsPage, SettingsRow, SettingsSection } from '../../components/SettingsUI';
import { Switch } from '../../components/ui/switch';
import { useSecurity } from '../../components/SecurityContext';
import { SecuritySetupFlow } from '../../components/security/SecuritySetupFlow';
import { RequireReauthentication } from '../../components/security/RequireReauthentication';
import { PinCreationFlow } from '../../components/security/PinCreationFlow';
import { useToast } from '../../components/ToastContext';
import {
  changePin, disableAppLock, isPlatformAuthenticatorAvailable, listSecurityEvents,
  recoverPin, registerAuthenticator, removeAuthenticator, renameAuthenticator,
  SecurityServiceError, verifyAccountPassword,
} from '../../lib/securityService';
import { formatTimestamp } from '../../lib/utils';
import type { AutoLockDuration, SecurityAuthenticator, SecurityEvent } from '../../types/security';

const LOCK_OPTIONS: { value: AutoLockDuration; label: string; recommended?: boolean }[] = [
  { value: 'immediately', label: 'Immediately' },
  { value: '1m', label: 'After 1 minute' },
  { value: '5m', label: 'After 5 minutes', recommended: true },
  { value: '15m', label: 'After 15 minutes' },
  { value: '30m', label: 'After 30 minutes' },
];

export function SecuritySettings() {
  const { status } = useSecurity();
  const deviceCount = status?.authenticators.filter((item) => item.isActive).length || 0;
  const protection = !status?.appLockEnabled ? 'Off' : status.webAuthnEnabled ? 'Protected' : 'Basic';
  return <SettingsPage title="Security" description="Manage app access, verification methods, trusted devices and recent security changes.">
    <SecurityStatusCard />
    <SettingsSection title="Security Status"><SettingsRow icon={LockKeyhole} title="App Lock" value={status?.appLockEnabled ? 'Enabled' : 'Off'} to="/profile/app-lock" /></SettingsSection>
    <SettingsSection title="Unlock Methods">
      <SettingsRow icon={Fingerprint} title="Device Security" value={status?.webAuthnEnabled ? 'Enabled' : 'Not Set Up'} to="/profile/security/devices" />
      <SettingsRow icon={KeyRound} title="App PIN" value={status?.pinEnabled ? 'Enabled' : 'Not Set Up'} to={status?.pinEnabled ? '/profile/security/change-pin' : '/profile/app-lock'} />
    </SettingsSection>
    <SettingsSection title="Auto-lock"><SettingsRow icon={Shield} title="Automatically Lock" value={lockLabel(status?.autoLockDuration)} to="/profile/app-lock" /></SettingsSection>
    <SettingsSection title="Devices"><SettingsRow icon={Laptop} title="Security Devices" value={`${deviceCount} device${deviceCount === 1 ? '' : 's'}`} to="/profile/security/devices" /></SettingsSection>
    <SettingsSection title="Activity"><SettingsRow icon={Activity} title="Security Activity" to="/profile/security/activity" /></SettingsSection>
    <SettingsSection title="Account Security"><SettingsRow icon={KeyRound} title="Change PIN" to="/profile/security/change-pin" /><SettingsRow icon={ShieldCheck} title="Recovery Options" to="/account-recovery" /></SettingsSection>
    <p className="text-xs text-[var(--color-text-muted)] px-1">Current protection level: {protection}. Account access remains protected separately by your Supabase sign-in session and database Row Level Security.</p>
  </SettingsPage>;
}

function SecurityStatusCard() {
  const { status } = useSecurity();
  const protectedWithDevice = Boolean(status?.appLockEnabled && status.webAuthnEnabled && status.pinEnabled);
  const basic = Boolean(status?.appLockEnabled && status.pinEnabled && !status.webAuthnEnabled);
  return <section className={`rounded-3xl p-5 mb-7 border ${status?.appLockEnabled ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]/20' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
    <span className={`size-12 rounded-2xl flex items-center justify-center ${status?.appLockEnabled ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'}`}>{status?.appLockEnabled ? <ShieldCheck size={24} /> : <Shield size={24} />}</span>
    <h2 className="text-lg font-bold mt-4">{protectedWithDevice ? 'Your app is protected' : basic ? 'Basic protection' : 'App protection is off'}</h2>
    <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-1">{protectedWithDevice ? 'Device authentication and App PIN are enabled.' : basic ? 'App PIN is enabled. Add Device Security for faster, stronger verification.' : 'Anyone with access to this device may be able to open your financial records.'}</p>
    {basic && <Link to="/profile/security/devices" className="inline-flex min-h-11 items-center font-semibold text-sm text-[var(--color-primary)] mt-2">Add Device Security <ChevronRight size={16} /></Link>}
    {!status?.appLockEnabled && <Link to="/profile/app-lock" className="inline-flex min-h-11 items-center font-semibold text-sm text-[var(--color-primary)] mt-2">Protect App <ChevronRight size={16} /></Link>}
  </section>;
}

export function AppLockSettings() {
  const { userId, status, refresh, setAutoLockDuration } = useSecurity();
  const toast = useToast();
  const [setup, setSetup] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [addDeviceReauth, setAddDeviceReauth] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [addingDevice, setAddingDevice] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  useEffect(() => { void isPlatformAuthenticatorAvailable().then(setPlatformAvailable); }, []);

  const verifiedDisable = useCallback(() => { setReauth(false); setConfirmDisable(true); }, []);
  const turnOff = useCallback(async () => {
    try { await disableAppLock(userId); await refresh(); setConfirmDisable(false); toast('App Lock turned off'); }
    catch (caught) { toast(caught instanceof Error ? caught.message : 'App Lock could not be turned off'); }
  }, [refresh, toast, userId]);

  const addDevice = useCallback(async () => {
    setAddDeviceReauth(false);
    setAddingDevice(true);
    try { await registerAuthenticator(userId); await refresh(); toast('Device Security enabled'); }
    catch (caught) { if (!(caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled')) toast(caught instanceof Error ? caught.message : 'Device Security could not be set up'); }
    finally { setAddingDevice(false); }
  }, [refresh, toast, userId]);

  if (!status) return <SettingsPage title="App Lock"><div className="min-h-48 flex items-center justify-center"><LoaderCircle className="animate-spin" /></div></SettingsPage>;
  return <SettingsPage title="App Lock" description="Protect your expense, repayment and financial records when you open the app.">
    <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-7">
      <div className="flex items-center gap-4"><span className={`size-12 rounded-2xl flex items-center justify-center ${status.appLockEnabled ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'}`}><LockKeyhole size={24} /></span><div className="flex-1"><h2 className="font-bold">App Lock</h2><p className="text-xs text-[var(--color-text-muted)] mt-1">{status.appLockEnabled ? 'ON' : 'OFF'}</p></div><Switch checked={status.appLockEnabled} onCheckedChange={(checked) => checked ? setSetup(true) : setReauth(true)} aria-label="App Lock" /></div>
    </div>
    {!status.appLockEnabled ? <div className="rounded-3xl bg-[var(--color-surface-secondary)] p-5 text-center"><Shield size={30} className="mx-auto text-[var(--color-text-muted)]" /><h2 className="font-bold mt-3">App Lock is currently disabled</h2><p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">Anyone with access to this device may be able to open your financial records.</p><button type="button" onClick={() => setSetup(true)} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold mt-5">Turn On App Lock</button></div> : <>
      <SecurityStatusCard />
      <SettingsSection title="Unlock Methods">
        <MethodRow icon={Fingerprint} recommended title="Use Device Security" description="Use your device's fingerprint, face recognition, PIN, pattern, Windows Hello, Touch ID or other supported security." status={status.webAuthnEnabled ? 'Enabled' : 'Not Set Up'} actionLabel={status.webAuthnEnabled ? undefined : 'Set Up'} onAction={platformAvailable ? () => setAddDeviceReauth(true) : undefined} busy={addingDevice} />
        <MethodRow icon={KeyRound} title="App PIN" description="Use a PIN created specifically for this app." status={status.pinEnabled ? 'Enabled' : 'Not Set Up'} actionLabel={status.pinEnabled ? 'Change PIN' : undefined} actionTo={status.pinEnabled ? '/profile/security/change-pin' : undefined} />
      </SettingsSection>
      <SettingsSection title="Automatically Lock">{LOCK_OPTIONS.map((option) => <button type="button" key={option.value} onClick={() => void setAutoLockDuration(option.value).then(() => toast('Auto-lock updated')).catch((caught) => toast(caught instanceof Error ? caught.message : 'Could not update auto-lock'))} className="w-full min-h-14 px-4 py-3 flex items-center gap-3 text-left"><span className={`size-5 rounded-full border-2 flex items-center justify-center ${status.autoLockDuration === option.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>{status.autoLockDuration === option.value && <Check size={12} className="text-white" strokeWidth={3} />}</span><span className="flex-1 text-sm font-medium">{option.label}</span>{option.recommended && <span className="text-xs font-semibold text-[var(--color-primary)]">Recommended</span>}</button>)}</SettingsSection>
    </>}
    {setup && <SecuritySetupFlow onCancel={() => { setSetup(false); void refresh(); }} onDone={() => { setSetup(false); void refresh(); }} />}
    <RequireReauthentication open={reauth} purpose="turn off App Lock" onCancel={() => setReauth(false)} onVerified={verifiedDisable} />
    <RequireReauthentication open={addDeviceReauth} purpose="add a security device" onCancel={() => setAddDeviceReauth(false)} onVerified={addDevice} />
    <BottomSheet open={confirmDisable} onClose={() => setConfirmDisable(false)} title="Turn off App Lock?">
      <p className="text-sm leading-6 text-[var(--color-text-secondary)] mb-5">Anyone who can access this device may be able to view your expense and repayment information.</p>
      <div className="flex gap-3"><button type="button" onClick={() => setConfirmDisable(false)} className="flex-1 min-h-12 rounded-xl bg-[var(--color-surface-secondary)] font-semibold">Cancel</button><button type="button" onClick={turnOff} className="flex-1 min-h-12 rounded-xl bg-[var(--color-error)] text-white font-semibold">Turn Off</button></div>
    </BottomSheet>
  </SettingsPage>;
}

function MethodRow({ icon: Icon, title, description, status, recommended, actionLabel, actionTo, onAction, busy }: { icon: typeof Fingerprint; title: string; description: string; status: string; recommended?: boolean; actionLabel?: string; actionTo?: string; onAction?: () => void; busy?: boolean }) {
  const actionClass = 'inline-flex items-center min-h-9 text-sm font-semibold text-[var(--color-primary)]';
  return <div className="px-4 py-4 flex gap-3"><span className="size-10 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center shrink-0"><Icon size={20} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold text-sm">{title}</p>{recommended && <span className="rounded-full bg-[var(--color-primary-soft)] text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)] px-2 py-0.5">Recommended</span>}</div><p className="text-xs leading-5 text-[var(--color-text-muted)] mt-1">{description}</p><p className="text-xs font-semibold mt-2">{status}</p>{actionTo ? <Link to={actionTo} className={actionClass}>{actionLabel}</Link> : actionLabel && onAction ? <button type="button" onClick={onAction} disabled={busy} className={actionClass}>{busy ? 'Setting up…' : actionLabel}</button> : null}</div></div>;
}

export function SecurityDevices() {
  const { userId, status, refresh } = useSecurity();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [rename, setRename] = useState<SecurityAuthenticator | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [remove, setRemove] = useState<SecurityAuthenticator | null>(null);
  const [reauth, setReauth] = useState(false);
  const [addReauth, setAddReauth] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const devices = status?.authenticators.filter((item) => item.isActive) || [];
  const add = useCallback(async () => { setAddReauth(false); setAdding(true); try { await registerAuthenticator(userId); await refresh(); toast('Security device added'); } catch (caught) { if (!(caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled')) toast(caught instanceof Error ? caught.message : 'Could not add device'); } finally { setAdding(false); } }, [refresh, toast, userId]);
  const verifiedRemove = useCallback(() => { setReauth(false); setConfirmRemove(true); }, []);
  const finishRemove = useCallback(async () => { if (!remove) return; try { await removeAuthenticator(userId, remove.id); await refresh(); toast('Security device removed'); setConfirmRemove(false); setRemove(null); } catch (caught) { toast(caught instanceof Error ? caught.message : 'Could not remove device'); } }, [refresh, remove, toast, userId]);
  return <SettingsPage title="Device Authentication" description="Registered credentials can verify you with device security. Private keys and biometric information never leave the authenticator.">
    <button type="button" onClick={() => setAddReauth(true)} disabled={adding} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold flex items-center justify-center gap-2 mb-7 disabled:opacity-50">{adding ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}Add This Device</button>
    <SettingsSection title="Security Devices">{devices.length ? devices.map((device) => <DeviceRow key={device.id} device={device} onRename={() => { setRename(device); setRenameValue(device.deviceName); }} onRemove={() => { setRemove(device); setReauth(true); }} />) : <div className="p-5 text-center text-sm text-[var(--color-text-muted)]">No Device Security methods are registered.</div>}</SettingsSection>
    <p className="text-xs leading-5 text-[var(--color-text-muted)] px-1">A synced passkey may work across devices in the same platform account. Each registered credential remains independently removable.</p>
    <BottomSheet open={Boolean(rename)} onClose={() => setRename(null)} title="Rename security device"><label className="block"><span className="text-sm font-semibold">Device name</span><input className="input min-h-12 mt-2" value={renameValue} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} /></label><button type="button" onClick={() => { if (!rename) return; void renameAuthenticator(userId, rename.id, renameValue).then(refresh).then(() => { toast('Device renamed'); setRename(null); }).catch((caught) => toast(caught instanceof Error ? caught.message : 'Could not rename device')); }} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold mt-4">Save</button></BottomSheet>
    <RequireReauthentication open={reauth} purpose="remove this security device" onCancel={() => { setReauth(false); setRemove(null); }} onVerified={verifiedRemove} />
    <RequireReauthentication open={addReauth} purpose="add this security device" onCancel={() => setAddReauth(false)} onVerified={add} />
    <BottomSheet open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove this security method?"><p className="text-sm leading-6 text-[var(--color-text-secondary)]">You will no longer be able to use this device credential to unlock your account.</p><div className="flex gap-3 mt-5"><button type="button" onClick={() => setConfirmRemove(false)} className="flex-1 min-h-12 rounded-xl bg-[var(--color-surface-secondary)] font-semibold">Cancel</button><button type="button" onClick={finishRemove} className="flex-1 min-h-12 rounded-xl bg-[var(--color-error)] text-white font-semibold">Remove</button></div></BottomSheet>
  </SettingsPage>;
}

function DeviceRow({ device, onRename, onRemove }: { device: SecurityAuthenticator; onRename: () => void; onRemove: () => void }) {
  return <div className="p-4"><div className="flex items-start gap-3"><span className="size-10 rounded-xl bg-[var(--color-surface-secondary)] flex items-center justify-center"><Smartphone size={20} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold text-sm truncate">{device.deviceName}</p><span className="text-[10px] font-bold uppercase text-[var(--color-success)]">Active</span></div><p className="text-xs text-[var(--color-text-muted)] mt-1">Device Security · Added {formatTimestamp(device.createdAt)}</p><p className="text-xs text-[var(--color-text-muted)] mt-1">Last used {device.lastUsedAt ? formatTimestamp(device.lastUsedAt) : 'Never'}{device.usableHere ? ' · Available here' : ''}</p></div></div><div className="flex gap-2 mt-3 ml-12"><button type="button" onClick={onRename} className="min-h-10 px-3 rounded-xl text-xs font-semibold bg-[var(--color-surface-secondary)]"><Pencil size={14} className="inline mr-1.5" />Rename</button><button type="button" onClick={onRemove} className="min-h-10 px-3 rounded-xl text-xs font-semibold text-[var(--color-error)]"><Trash2 size={14} className="inline mr-1.5" />Remove</button></div></div>;
}

export function SecurityActivityPage() {
  const { userId } = useSecurity();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void listSecurityEvents(userId).then(setEvents).finally(() => setLoading(false)); }, [userId]);
  return <SettingsPage title="Security Activity" description="Important recent security changes and verification events. History is limited to a reasonable recent window."><SettingsSection title="Recent Activity">{loading ? <div className="min-h-32 flex items-center justify-center"><LoaderCircle className="animate-spin" /></div> : events.length ? events.map((event) => <div key={event.id} className="px-4 py-4 flex gap-3"><span className="size-9 rounded-xl bg-[var(--color-surface-secondary)] flex items-center justify-center"><Activity size={17} /></span><div><p className="text-sm font-semibold">{eventLabel(event.event_type)}</p>{event.device_label && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{event.device_label}</p>}<p className="text-xs text-[var(--color-text-muted)] mt-1">{formatTimestamp(event.created_at)}</p></div></div>) : <div className="p-5 text-center text-sm text-[var(--color-text-muted)]">No security activity yet.</div>}</SettingsSection></SettingsPage>;
}

export function ChangePinPage() {
  const { userId, refresh } = useSecurity();
  const navigate = useNavigate();
  const toast = useToast();
  const [verified, setVerified] = useState(false);
  const [reauth, setReauth] = useState(true);
  const [busy, setBusy] = useState(false);
  const allow = useCallback(() => { setReauth(false); setVerified(true); }, []);
  const save = useCallback(async (pin: string) => { setBusy(true); try { await changePin(userId, pin); await refresh(); toast('PIN changed successfully'); navigate('/profile/security'); } catch (caught) { toast(caught instanceof Error ? caught.message : 'PIN could not be changed'); } finally { setBusy(false); } }, [navigate, refresh, toast, userId]);
  return <SettingsPage title="Change PIN" description="Fresh verification is required before changing your App PIN.">{verified && <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5"><PinCreationFlow title="Create New PIN" busy={busy} onConfirmed={save} /></div>}<RequireReauthentication open={reauth} purpose="change your App PIN" onCancel={() => navigate(-1)} onVerified={allow} /></SettingsPage>;
}

export function AccountRecoveryPage() {
  const { userId, status, unlockWithDevice, refresh } = useSecurity();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [usePassword, setUsePassword] = useState(!status?.webAuthnAvailableHere);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stepUpToken, setStepUpToken] = useState('');
  const verifyAccount = useCallback(async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const proof = await verifyAccountPassword(userId, password, 'pin_recovery'); setStepUpToken(proof); setVerified(true); setPassword(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Account verification failed.'); }
    finally { setBusy(false); }
  }, [password, userId]);
  const verifyDevice = useCallback(async () => {
    setBusy(true); setError('');
    try { await unlockWithDevice(); setVerified(true); }
    catch (caught) {
      if (!(caught instanceof SecurityServiceError && caught.code === 'authentication_cancelled')) setError(caught instanceof Error ? caught.message : 'Device verification failed.');
    } finally { setBusy(false); }
  }, [unlockWithDevice]);
  const reset = useCallback(async (pin: string) => { setBusy(true); setError(''); try { await recoverPin(userId, pin, status?.autoLockDuration || '5m', stepUpToken || undefined); await refresh(); toast('App PIN reset successfully'); window.location.hash = '#/'; } catch (caught) { setError(caught instanceof Error ? caught.message : 'PIN recovery failed.'); } finally { setBusy(false); } }, [refresh, status?.autoLockDuration, stepUpToken, toast, userId]);
  return <main className="min-h-screen px-5 py-8 safe-top safe-bottom bg-[var(--color-bg)]"><div className="w-full max-w-sm mx-auto"><span className="size-16 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center"><ShieldCheck size={30} /></span><h1 className="text-2xl font-bold mt-5">Recover App PIN</h1><p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">Verify your account identity, then create a new PIN. Your existing PIN is never revealed or emailed.</p>{!verified && status?.webAuthnAvailableHere && !usePassword ? <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mt-7"><h2 className="font-bold">Verify with Device Security</h2><p className="text-xs leading-5 text-[var(--color-text-muted)] mt-1">Use a registered device credential to confirm this recovery.</p><button type="button" onClick={verifyDevice} disabled={busy} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold mt-5 flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Fingerprint size={18} />}Verify with Device Security</button>{error && <p role="alert" className="text-sm text-[var(--color-error)] mt-3">{error}</p>}<button type="button" onClick={() => { setUsePassword(true); setError(''); }} className="w-full min-h-11 mt-2 text-sm font-semibold text-[var(--color-primary)]">Use Account Password Instead</button></div> : !verified ? <form onSubmit={verifyAccount} className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mt-7"><label className="block"><span className="text-sm font-semibold">Account password</span><input type="password" autoComplete="current-password" className="input min-h-12 mt-2" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p role="alert" className="text-sm text-[var(--color-error)] mt-3">{error}</p>}<button disabled={busy || !password} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold mt-5 disabled:opacity-50">{busy ? 'Verifying…' : 'Verify Account'}</button>{status?.webAuthnAvailableHere && <button type="button" onClick={() => { setUsePassword(false); setError(''); }} className="w-full min-h-11 mt-2 text-sm font-semibold text-[var(--color-primary)]">Use Device Security Instead</button>}</form> : <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mt-7"><PinCreationFlow title="Create New PIN" busy={busy} onConfirmed={reset} />{error && <p role="alert" className="text-sm text-center text-[var(--color-error)] mt-3">{error}</p>}</div>}<button type="button" onClick={() => { window.location.hash = '#/'; }} className="min-h-11 px-4 mt-4 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button></div></main>;
}

function eventLabel(type: string) {
  return ({ app_lock_enabled: 'App Lock enabled', app_lock_disabled: 'App Lock disabled', pin_created: 'App PIN created', pin_changed: 'App PIN changed', pin_failed: 'Failed PIN attempts', webauthn_registered: 'Device security added', webauthn_removed: 'Security device removed', webauthn_verified: 'App unlocked using device security', account_recovery: 'Account recovery completed', data_export_verified: 'Data export verified' } as Record<string, string>)[type] || 'Security setting changed';
}

function lockLabel(duration?: AutoLockDuration) {
  return LOCK_OPTIONS.find((option) => option.value === duration)?.label || 'After 5 minutes';
}
