import { FormEvent, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
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
    <main className="min-h-screen flex flex-col items-center px-5 pt-6 pb-8 safe-top relative overflow-hidden">
      {/* Background radial glow */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-[320px] h-[320px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0) 70%)' }}
      />

      <div className="w-full max-w-[350px] mx-auto relative z-1 flex flex-col flex-1 justify-center">
        {/* Illustration scene */}
        <div className={`relative w-full flex items-center justify-center mb-4 ${mode === 'sign-up' ? 'h-[130px]' : 'h-[140px]'}`}>
          {/* Background blob */}
          <div
            className="absolute w-[150px] h-[150px] rounded-full"
            style={{ background: 'radial-gradient(circle, #ecfdf5 0%, #f0fdf4 65%, rgba(240,253,244,0) 100%)' }}
          />

          {/* Dotted ring */}
          <svg width="180" height="180" className="absolute" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="82" fill="none" stroke="#d1fae5" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
          </svg>

          {mode === 'sign-in' ? (
            <>
              {/* Floating shield badge — top right */}
              <div
                className="absolute top-2 right-[48px] w-[34px] h-[34px] bg-[var(--color-primary)] rounded-full flex items-center justify-center z-4"
                style={{ boxShadow: '0 6px 14px -3px rgba(5,150,105,0.5)', transform: 'rotate(8deg)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>

              {/* Floating "256-bit" lock chip — bottom left */}
              <div className="absolute bottom-2.5 left-[40px] z-4" style={{ transform: 'rotate(-6deg)' }}>
                <div
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] px-2 py-[5px] flex items-center gap-[5px]"
                  style={{ boxShadow: '0 6px 14px -4px rgba(28,25,23,0.11)' }}
                >
                  <div className="w-[14px] h-[14px] bg-[var(--color-primary-soft)] rounded flex items-center justify-center">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--color-text-primary)]">256-bit</span>
                </div>
              </div>

              {/* Accent dots */}
              <div className="absolute top-6 left-14 w-[7px] h-[7px] bg-[#a7f3d0] rounded-full" />
              <div className="absolute bottom-6 right-[54px] w-[5px] h-[5px] bg-[var(--color-border)] rounded-full" />

              {/* Cloud sync stub card behind */}
              <div
                className="absolute w-[140px] h-[66px] bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-[14px]"
                style={{ transform: 'rotate(8deg) translate(36px, 22px)' }}
              />

              {/* Main cloud sync card */}
              <div
                className="relative w-[172px] h-[92px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl z-2 p-3 flex flex-col justify-between"
                style={{
                  boxShadow: '0 16px 32px -10px rgba(28,25,23,0.14), 0 4px 10px rgba(28,25,23,0.04)',
                  transform: 'rotate(-3deg)',
                  boxSizing: 'border-box',
                }}
              >
                {/* Top status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[5px]">
                    <div className="w-[6px] h-[6px] bg-[var(--color-primary)] rounded-full" />
                    <span className="text-[9.5px] font-semibold text-[var(--color-text-secondary)]">Cloud Synced</span>
                  </div>
                  <span className="text-[9px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)] border border-[#d1fae5] px-1.5 py-[2px] rounded">Live</span>
                </div>

                {/* Sync graphic */}
                <div className="flex items-center justify-between px-1">
                  <div className="w-7 h-7 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                      <path d="M12 18h.01" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-[3px]">
                    <div className="w-4 h-[1.5px] bg-[#a7f3d0]" />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <div className="w-4 h-[1.5px] bg-[#a7f3d0]" />
                  </div>
                  <div className="w-7 h-7 bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-lg flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
                    </svg>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Floating star badge — top right */}
              <div
                className="absolute top-[6px] right-[48px] w-[34px] h-[34px] bg-[var(--color-primary)] rounded-full flex items-center justify-center z-4"
                style={{ boxShadow: '0 6px 14px -3px rgba(5,150,105,0.5)', transform: 'rotate(8deg)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 17l-6.2 4 2.4-7.3L2 9.2h7.6z" />
                </svg>
              </div>

              {/* Floating "Welcome!" chip — bottom left */}
              <div className="absolute bottom-2 left-[40px] z-4" style={{ transform: 'rotate(-6deg)' }}>
                <div
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] px-2 py-[5px] flex items-center gap-[5px]"
                  style={{ boxShadow: '0 6px 14px -4px rgba(28,25,23,0.11)' }}
                >
                  <span className="text-[13px] leading-none">&#x1F389;</span>
                  <span className="text-[10px] font-semibold text-[var(--color-text-primary)]">Welcome!</span>
                </div>
              </div>

              {/* Accent dots */}
              <div className="absolute top-6 left-14 w-[7px] h-[7px] bg-[#a7f3d0] rounded-full" />
              <div className="absolute bottom-[22px] right-[54px] w-[5px] h-[5px] bg-[var(--color-border)] rounded-full" />

              {/* Mint stub card behind */}
              <div
                className="absolute w-[140px] h-[66px] bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-[14px]"
                style={{ transform: 'rotate(8deg) translate(34px, 22px)' }}
              />

              {/* Main new account preview card */}
              <div
                className="relative w-[172px] h-[90px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl z-2 p-3"
                style={{
                  boxShadow: '0 16px 32px -10px rgba(28,25,23,0.14), 0 4px 10px rgba(28,25,23,0.04)',
                  transform: 'rotate(-3deg)',
                  boxSizing: 'border-box',
                }}
              >
                {/* Top row: avatar + NEW badge */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-[7px]">
                    <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center border-[1.5px] border-[#a7f3d0]" style={{ background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <div className="h-[5px] w-[52px] bg-[var(--color-border)] rounded-[3px] mb-[3px]" />
                      <div className="h-1 w-9 bg-[var(--color-surface-secondary)] rounded-[3px]" />
                    </div>
                  </div>
                  <div className="bg-[var(--color-primary)] rounded-[5px] px-[7px] py-[2px]">
                    <span className="text-[9px] font-bold text-white">NEW</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-medium text-[var(--color-text-muted)]">Profile setup</span>
                    <span className="text-[9px] font-semibold text-[var(--color-primary)]">10%</span>
                  </div>
                  <div className="h-1 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden">
                    <div className="h-full w-[10%] bg-[var(--color-primary)] rounded-full" />
                  </div>
                </div>

                {/* Step dots */}
                <div className="flex items-center gap-[5px]">
                  <div className="w-[6px] h-[6px] bg-[var(--color-primary)] rounded-full" />
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <div className="w-[6px] h-[6px] bg-[var(--color-border)] rounded-full" />
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <div className="w-[6px] h-[6px] bg-[var(--color-border)] rounded-full" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Logo and app name */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-2xl bg-[var(--color-primary-soft)] border border-[#d1fae5] flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 8px 18px -6px rgba(5,150,105,0.3), 0 2px 6px rgba(28,25,23,0.04)' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[var(--color-text-primary)] leading-tight tracking-tight">Owezy</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">You Pay, We Remember.</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5"
          style={{ boxShadow: '0 20px 40px -16px rgba(28,25,23,0.10), 0 4px 10px rgba(28,25,23,0.04)' }}
        >
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 bg-[var(--color-surface-secondary)] rounded-2xl p-1 mb-6">
            <ModeButton active={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Sign in</ModeButton>
            <ModeButton active={mode === 'sign-up'} onClick={() => changeMode('sign-up')}>Create account</ModeButton>
          </div>

          <form onSubmit={submit}>
            {mode === 'sign-up' && (
              <label className="block mb-4">
                <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Name</span>
                <div className="relative">
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    className="input !pl-[42px]"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    maxLength={120}
                    required
                  />
                </div>
              </label>
            )}
            <label className="block mb-4">
              <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Email</span>
              <div className="relative">
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  className="input !pl-[42px]"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  maxLength={254}
                  required
                />
              </div>
            </label>
            <label className="block mb-5">
              <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Password</span>
              <div className="relative">
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  className="input !pl-[42px]"
                  type="password"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>
            </label>

            {error && <p role="alert" className="text-sm text-[var(--color-error)] mb-4">{error}</p>}
            {message && <p role="status" className="text-sm text-[var(--color-success)] mb-4">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 text-white text-base font-medium rounded-2xl py-4 flex items-center justify-center gap-2"
              style={{ boxShadow: '0 4px 12px -2px rgba(5,150,105,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}
            >
              {loading ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <>
                  {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-xs text-center text-[var(--color-text-muted)] leading-relaxed">
            Your account keeps your expense data private and synced across devices.
          </p>
        </div>
      </div>
    </main>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${active ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
    >
      {children}
    </button>
  );
}
