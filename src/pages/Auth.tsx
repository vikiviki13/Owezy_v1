import { FormEvent, useState } from 'react';
import { Wallet, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authenticationErrorMessage } from '../lib/safeErrors';

type Mode = 'sign-in' | 'sign-up';

export function Auth() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    if (password.length > 128) {
      setError('Password must contain no more than 128 characters.');
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
        if (!data.session) {
          setMessage('Account created. Check your email and confirm your address, then sign in.');
          setMode('sign-in');
          setPassword('');
        }
      }
    } catch (caught) {
      setError(authenticationErrorMessage(caught, mode));
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  return (
    <main className="min-h-screen px-5 py-10 safe-top flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tab</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Friend expense tracker</p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm">
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
                  maxLength={120}
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
                maxLength={254}
                required
              />
            </label>
            <label className="block mb-5">
              <span className="block text-sm font-medium mb-1.5">Password</span>
              <input
                className="input"
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={128}
                required
              />
            </label>

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
        </div>

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
