import { useCallback, useState } from 'react';
import { PinPad } from './PinPad';

export function PinCreationFlow({
  onConfirmed,
  busy = false,
  title = 'Create App PIN',
}: {
  onConfirmed: (pin: string) => Promise<void> | void;
  busy?: boolean;
  title?: string;
}) {
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');

  const create = useCallback((pin: string) => {
    setFirstPin(pin);
    setError('');
  }, []);

  const confirm = useCallback(async (pin: string) => {
    if (pin !== firstPin) {
      setError("PINs don't match. Try again.");
      return;
    }
    setError('');
    await onConfirmed(pin);
  }, [firstPin, onConfirmed]);

  return firstPin ? (
    <PinPad title="Confirm your PIN" description="Enter your PIN again." disabled={busy} error={error} onComplete={confirm} />
  ) : (
    <PinPad title={title} description="Choose a 6-digit PIN you can remember. It will be securely hashed and cannot be recovered." disabled={busy} error={error} onComplete={create} />
  );
}
