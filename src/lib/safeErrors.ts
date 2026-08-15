type ErrorLike = { code?: unknown; message?: unknown; status?: unknown };

function errorLike(value: unknown): ErrorLike {
  return value && typeof value === 'object' ? value as ErrorLike : {};
}

export function authenticationErrorMessage(caught: unknown, mode: 'sign-in' | 'sign-up') {
  const error = errorLike(caught);
  const code = typeof error.code === 'string' ? error.code : '';
  const status = Number(error.status || 0);
  if (code === 'over_request_rate_limit' || status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (mode === 'sign-up') return 'Account creation could not be completed. If you already registered, try signing in.';
  if (code === 'invalid_credentials' || status === 400) return 'Email or password is incorrect.';
  return 'Sign-in could not be completed. Check your connection and try again.';
}

export function privateDataErrorMessage(caught: unknown) {
  const code = typeof errorLike(caught).code === 'string' ? String(errorLike(caught).code) : '';
  if (code === 'unlock_required' || code === 'reauthentication_required') return 'Unlock the app and try again.';
  if (code === 'app_data_too_large' || code === 'request_too_large') return 'Your account data has reached the current storage limit.';
  if (code === 'rate_limited') return 'Too many requests. Wait briefly and try again.';
  return 'Your private data could not be loaded securely. Please try again.';
}

export function signOutErrorMessage() {
  return 'Local data was cleared, but the server could not confirm sign-out. Close this tab before leaving the device.';
}

