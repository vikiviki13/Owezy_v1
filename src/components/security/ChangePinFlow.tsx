import { useCallback, useState } from 'react';
import {
  changePin,
  SecurityServiceError,
  validateNewPinForChange,
  verifyCurrentPinForChange,
} from '../../lib/securityService';
import { PinPad } from './PinPad';

type ChangePinStep = 'current' | 'new' | 'confirm';

export function ChangePinFlow({
  userId,
  onChanged,
  onForgot,
}: {
  userId: string;
  onChanged: () => Promise<void> | void;
  onForgot: () => void;
}) {
  const [step, setStep] = useState<ChangePinStep>('current');
  const [changeToken, setChangeToken] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const verifyCurrent = useCallback(async (pin: string) => {
    setBusy(true);
    setError('');
    try {
      const token = await verifyCurrentPinForChange(userId, pin);
      setChangeToken(token);
      setCurrentPin(pin);
      setStep('new');
    } catch (caught) {
      if (caught instanceof SecurityServiceError && caught.code === 'pin_incorrect') {
        setError('Incorrect PIN. Try again.');
      } else {
        setError(caught instanceof Error ? caught.message : 'The current PIN could not be verified.');
      }
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const acceptNewPin = useCallback(async (pin: string) => {
    if (pin === currentPin) {
      setError('Your new PIN must be different from your current PIN.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await validateNewPinForChange(userId, changeToken, pin);
      setNewPin(pin);
      setStep('confirm');
    } catch (caught) {
      if (caught instanceof SecurityServiceError && caught.code === 'pin_unchanged') {
        setError('Your new PIN must be different from your current PIN.');
      } else if (caught instanceof SecurityServiceError && caught.code === 'pin_change_verification_required') {
        setChangeToken('');
        setCurrentPin('');
        setStep('current');
        setError(caught.message);
      } else {
        setError(caught instanceof Error ? caught.message : 'The new PIN could not be validated.');
      }
    } finally {
      setBusy(false);
    }
  }, [changeToken, currentPin, userId]);

  const confirmNewPin = useCallback(async (pin: string) => {
    if (pin !== newPin) {
      setError("PINs don't match. Try again.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      await changePin(userId, changeToken, currentPin, pin);
      await onChanged();
    } catch (caught) {
      if (caught instanceof SecurityServiceError && (caught.code === 'pin_change_verification_required' || caught.code === 'pin_incorrect')) {
        setChangeToken('');
        setCurrentPin('');
        setNewPin('');
        setStep('current');
        if (caught.code === 'pin_incorrect') {
          setError('Incorrect PIN. Try again.');
          return;
        }
      }
      setError(caught instanceof Error ? caught.message : 'The PIN could not be changed.');
    } finally {
      setBusy(false);
    }
  }, [changeToken, currentPin, newPin, onChanged, userId]);

  if (step === 'current') {
    return <PinPad title="Enter your current PIN" description="Verify your identity before changing your App PIN." disabled={busy} error={error} onComplete={verifyCurrent} onForgot={onForgot} />;
  }
  if (step === 'new') {
    return <PinPad title="Create a new PIN" description="Enter a new 6-digit PIN for App Lock." disabled={busy} error={error} onComplete={acceptNewPin} />;
  }
  return <PinPad title="Confirm your new PIN" description="Enter your new 6-digit PIN again." disabled={busy} error={error} onComplete={confirmNewPin} />;
}
