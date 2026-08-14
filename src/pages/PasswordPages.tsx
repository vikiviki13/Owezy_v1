import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, BrandLogo } from '../components/Brand';
import { SettingsPage } from '../components/SettingsUI';
import { useToast } from '../components/ToastContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { supabase } from '../lib/supabase';
import { validateNewPassword } from '../lib/passwordRecovery';

type RecoveryPhase = 'checking' | 'form' | 'invalid' | 'success';

export function ResetPasswordPage({
  recoverySessionValidated,
  onReturnToSignIn,
}: {
  recoverySessionValidated: boolean;
  onReturnToSignIn: () => void;
}) {
  const [phase, setPhase] = useState<RecoveryPhase>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recoverySessionValidated) {
      const timeout = window.setTimeout(() => setPhase('invalid'), 3500);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setPhase(!sessionError && data.session?.user ? 'form' : 'invalid');
    });
    return () => { active = false; };
  }, [recoverySessionValidated]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        setPhase('invalid');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmation('');
      setPhase('success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password could not be updated. Request a new recovery link and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function continueToSignIn() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      onReturnToSignIn();
    } catch {
      setError('Your password was updated, but this recovery session could not be closed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-10 safe-top flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo size={48} className="rounded-2xl" />
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          {phase === 'checking' ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />Validating recovery link…</div>
          ) : phase === 'invalid' ? (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><LockKeyhole size={27} /></span>
              <h2 className="mt-5 text-xl font-bold">Recovery link unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">This password reset link is invalid or has expired. Request a new link from the sign-in screen.</p>
              <Button className="mt-6 w-full" onClick={onReturnToSignIn}>Back to Sign In</Button>
            </div>
          ) : phase === 'success' ? (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 size={29} /></span>
              <h2 className="mt-5 text-xl font-bold">Password updated successfully</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">You can now sign in using your new password.</p>
              {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              <Button className="mt-6 w-full" disabled={busy} onClick={() => void continueToSignIn()}>
                {busy && <LoaderCircle className="animate-spin" />}Continue to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={updatePassword}>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound /></span>
              <h2 className="mt-5 text-xl font-bold">Create new password</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a new password for your account. Your old password is not required.</p>
              <PasswordField id="new-password" label="New Password" value={password} onChange={setPassword} autoComplete="new-password" />
              <PasswordField id="confirm-new-password" label="Confirm New Password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
              {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="mt-6 w-full" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" />}Update Password
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(newPassword, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (currentPassword === newPassword) {
      setError('Choose a new password that is different from your current password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new Error('Your account email is unavailable.');
      const { error: verificationError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verificationError) {
        setError('Current password is incorrect.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      toast('Password updated successfully');
      navigate('/profile/security');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage title="Change Password" description="Update your account password after verifying the password you currently use.">
      <form onSubmit={changePassword} className="rounded-3xl border border-border bg-card p-5">
        <PasswordField id="current-password" label="Current Password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
        <PasswordField id="settings-new-password" label="New Password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <PasswordField id="settings-confirm-password" label="Confirm New Password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy || !currentPassword || !newPassword || !confirmation}>
          {busy && <LoaderCircle className="animate-spin" />}Update Password
        </Button>
      </form>
    </SettingsPage>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="mt-5 space-y-2 first:mt-0">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
        className="min-h-12 rounded-xl"
        required
      />
    </div>
  );
}
