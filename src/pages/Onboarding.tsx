import { useState } from 'react';
import { LoaderCircle, Wallet, Users, Share2 } from 'lucide-react';

const SLIDES = [
  { icon: Wallet, title: 'You pay.', body: 'Cover the bill at dinner, on a trip, wherever — record it in seconds.' },
  { icon: Users, title: "Track what friends owe you.", body: 'Every friend has a running balance, calculated automatically.' },
  { icon: Share2, title: 'Record repayments and share statements.', body: 'Send a clean summary over WhatsApp whenever you like.' },
];

export function Onboarding({ onDone }: { onDone: (name: string) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setError('');
    try {
      await onDone(name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not finish onboarding. Please try again.');
      setFinishing(false);
    }
  }

  if (showProfile) {
    return (
      <div className="min-h-screen flex flex-col justify-center px-6 safe-top">
        <div className="max-w-sm mx-auto w-full">
          <h1 className="text-2xl font-bold mb-1">What should we call you?</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">You can change this anytime in Profile.</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="input mb-3"
            onKeyDown={(e) => { if (e.key === 'Enter') void finish(); }}
          />
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">Default currency: <span className="font-medium text-[var(--color-text-primary)]">INR ₹</span></p>
          {error && <p role="alert" className="text-sm text-[var(--color-error)] mb-4">{error}</p>}
          <button onClick={() => void finish()} disabled={finishing} className="w-full bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5 mb-2 flex items-center justify-center gap-2 disabled:opacity-60">
            {finishing && <LoaderCircle size={17} className="animate-spin" />} Get Started
          </button>
          <button onClick={() => void finish()} disabled={finishing} className="w-full text-sm text-[var(--color-text-muted)] font-medium py-2 disabled:opacity-60">Skip for now</button>
        </div>
      </div>
    );
  }

  const slide = SLIDES[step];
  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-10 safe-top">
      <div className="flex justify-end">
        <button onClick={() => setShowProfile(true)} className="text-sm font-medium text-[var(--color-text-muted)]">Skip</button>
      </div>
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-[var(--color-primary-soft)] flex items-center justify-center mb-6">
          <slide.icon size={34} className="text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{slide.title}</h1>
        <p className="text-[var(--color-text-secondary)]">{slide.body}</p>
      </div>
      <div>
        <div className="flex justify-center gap-1.5 mb-6">
          {SLIDES.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[var(--color-primary)]' : 'w-1.5 bg-[var(--color-border)]'}`} />
          ))}
        </div>
        <button
          onClick={() => (step < SLIDES.length - 1 ? setStep(step + 1) : setShowProfile(true))}
          className="w-full max-w-sm mx-auto block bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5"
        >
          {step < SLIDES.length - 1 ? 'Next' : "Let's go"}
        </button>
      </div>
    </div>
  );
}
