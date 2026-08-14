import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { APP_NAME, APP_TAGLINE, BrandLogo } from '../components/Brand';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  maskRecoveryEmail,
  passwordRecoveryRedirectUrl,
  RECOVERY_RESEND_COOLDOWN_SECONDS,
  recoveryCooldownRemaining,
} from '../lib/passwordRecovery';

type Mode = 'sign-in' | 'sign-up';
type AuthView = 'account' | 'forgot-password' | 'recovery-sent';

export function Auth() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [view, setView] = useState<AuthView>('account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySentAt, setRecoverySentAt] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (view !== 'recovery-sent' || !recoverySentAt) return;
    const update = () => setCooldown(recoveryCooldownRemaining(recoverySentAt));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [recoverySentAt, view]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (mode === 'sign-up' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        window.location.hash = '#/';
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) window.location.hash = '#/';
        if (!data.session) {
          setMessage('Account created. Check your email and confirm your address, then sign in.');
          setMode('sign-in');
          setPassword('');
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function sendRecoveryLink(address: string) {
    const normalizedEmail = address.trim();
    if (!normalizedEmail) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: passwordRecoveryRedirectUrl(window.location.origin),
      });
      if (recoveryError) throw recoveryError;
      setRecoveryEmail(normalizedEmail);
      setRecoverySentAt(Date.now());
      setCooldown(RECOVERY_RESEND_COOLDOWN_SECONDS);
      setView('recovery-sent');
    } catch {
      setError('Could not send a recovery link. Please wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  }

  function openForgotPassword() {
    setRecoveryEmail(email.trim());
    setView('forgot-password');
    setError('');
    setMessage('');
  }

  function backToSignIn() {
    setView('account');
    setMode('sign-in');
    setError('');
    setMessage('');
  }

  return (
    <main className="min-h-screen px-5 py-10 safe-top flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <BrandLogo size={48} className="rounded-2xl" />
          <div>
            <h1 className="text-2xl font-bold">{APP_NAME}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{APP_TAGLINE}</p>
          </div>
        </div>

        {view === 'forgot-password' ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void sendRecoveryLink(recoveryEmail); }}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Mail /></span>
            <h2 className="mt-5 text-xl font-bold">Reset your password</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the email address associated with your account. We'll send you a password reset link.</p>
            <div className="mt-6 space-y-2">
              <Label htmlFor="recovery-email">Email Address</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                placeholder="name@example.com"
                className="min-h-12 rounded-xl"
                required
              />
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-6 w-full">
              {loading ? <LoaderCircle className="animate-spin" /> : <Mail />}Send Recovery Link
            </Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={backToSignIn}><ArrowLeft />Back to Sign In</Button>
          </form>
        ) : view === 'recovery-sent' ? (
          <div className="rounded-3xl border border-border bg-card p-5 text-center shadow-sm">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 size={28} /></span>
            <h2 className="mt-5 text-xl font-bold">Check your email</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">If an account exists for <span className="font-semibold text-foreground">{maskRecoveryEmail(recoveryEmail)}</span>, a recovery link has been sent.</p>
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
            <Button asChild className="mt-6 w-full"><a href="mailto:"><Mail />Open Email App</a></Button>
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full"
              disabled={loading || cooldown > 0}
              onClick={() => void sendRecoveryLink(recoveryEmail)}
            >
              {loading ? <LoaderCircle className="animate-spin" /> : null}
              {cooldown > 0 ? `Resend Link in ${cooldown}s` : 'Resend Link'}
            </Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={backToSignIn}>Back to Sign In</Button>
          </div>
        ) : <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-1 bg-[var(--color-surface-secondary)] rounded-xl p-1 mb-6">
            <ModeButton active={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Sign in</ModeButton>
            <ModeButton active={mode === 'sign-up'} onClick={() => changeMode('sign-up')}>Create account</ModeButton>
          </div>

          <form onSubmit={submit}>
            {mode === 'sign-up' && (
              <label className="block mb-4">
                <span className="block text-sm font-medium mb-1.5">Name</span>
                <input
                  className="input"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </label>
            )}
            <label className="block mb-4">
              <span className="block text-sm font-medium mb-1.5">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <div className="block mb-5">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium">
                <label htmlFor="account-password">Password</label>
                {mode === 'sign-in' && <button type="button" onClick={openForgotPassword} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary">Forgot Password?</button>}
              </span>
              <input
                id="account-password"
                className="input"
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            {error && <p role="alert" className="text-sm text-[var(--color-error)] mb-4">{error}</p>}
            {message && <p role="status" className="text-sm text-[var(--color-success)] mb-4">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 text-white font-medium rounded-xl py-3.5 flex items-center justify-center gap-2"
            >
              {loading && <LoaderCircle size={17} className="animate-spin" />}
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>}

        <p className="text-xs text-center text-[var(--color-text-muted)] mt-5">
          Your account keeps your expense data private and synced across devices.
        </p>
      </div>
    </main>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg py-2 text-xs font-semibold transition-colors ${active ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
    >
      {children}
    </button>
  );
}
