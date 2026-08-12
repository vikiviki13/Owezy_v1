import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';

export function PinPad({
  title = 'Enter your PIN',
  description,
  disabled = false,
  error,
  onComplete,
  onForgot,
}: {
  title?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  onComplete: (pin: string) => void | Promise<void>;
  onForgot?: () => void;
}) {
  const [pin, setPin] = useState('');
  const submitted = useRef('');

  useEffect(() => {
    if (pin.length !== 6 || disabled || submitted.current === pin) return;
    submitted.current = pin;
    void Promise.resolve(onComplete(pin)).finally(() => {
      setPin('');
      submitted.current = '';
    });
  }, [disabled, onComplete, pin]);

  function addDigit(digit: string) {
    if (!disabled) setPin((value) => `${value}${digit}`.slice(0, 6));
  }

  return (
    <div className="w-full max-w-xs mx-auto" aria-busy={disabled}>
      <div className="text-center mb-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm leading-5 text-[var(--color-text-secondary)] mt-1.5">{description}</p>}
      </div>
      <div className="flex justify-center gap-3 mb-5" role="status" aria-label={`${pin.length} of 6 PIN digits entered`}>
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={`size-3 rounded-full border transition-colors ${index < pin.length ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-transparent border-[var(--color-text-muted)]'}`}
          />
        ))}
      </div>
      <p className={`min-h-5 text-center text-xs mb-3 ${error ? 'text-[var(--color-error)]' : 'text-transparent'}`} role={error ? 'alert' : undefined}>
        {error || 'No error'}
      </p>
      <div className="grid grid-cols-3 gap-2.5" aria-label="Numeric PIN keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => addDigit(digit)}
            className="min-h-14 rounded-2xl bg-[var(--color-surface-secondary)] text-xl font-semibold transition-colors hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50"
            aria-label={`Digit ${digit}`}
          >
            {digit}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" disabled={disabled} onClick={() => addDigit('0')} className="min-h-14 rounded-2xl bg-[var(--color-surface-secondary)] text-xl font-semibold hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50" aria-label="Digit 0">0</button>
        <button type="button" disabled={disabled || pin.length === 0} onClick={() => setPin((value) => value.slice(0, -1))} className="min-h-14 rounded-2xl flex items-center justify-center hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-30" aria-label="Delete last digit"><Delete size={21} /></button>
      </div>
      {onForgot && <button type="button" onClick={onForgot} className="min-h-11 px-4 mt-4 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-xl">Forgot PIN?</button>}
    </div>
  );
}
