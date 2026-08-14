import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
  WebAuthnError,
} from '@simplewebauthn/browser';
import { supabase } from './supabase';
import type { AutoLockDuration, SecurityEvent, SecurityStatus, UnlockGrant } from '../types/security';

const GRANT_KEY_PREFIX = 'tab_unlock_grant_v2_';
const ACTIVE_KEY_PREFIX = 'tab_last_active_v2_';
const STATUS_KEY_PREFIX = 'tab_security_status_v1_';

export class SecurityServiceError extends Error {
  code: string;
  retryAfter: number;

  constructor(code: string, message: string, retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

type ApiErrorBody = {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string; retryAfter?: number };
};

function normalizeApiError(parsed: ApiErrorBody | null) {
  const upstreamCode = parsed?.error?.code || parsed?.code || 'network_failure';
  if (upstreamCode === 'NOT_FOUND') {
    return {
      code: 'security_service_not_deployed',
      message: 'App Lock setup is incomplete. Deploy the Supabase security function, then try again.',
      retryAfter: 0,
    };
  }
  return {
    code: upstreamCode,
    message: parsed?.error?.message || parsed?.message,
    retryAfter: Number(parsed?.error?.retryAfter || 0),
  };
}

async function invoke<T>(action: string, body: Record<string, unknown> = {}, userId?: string): Promise<T> {
  const unlockToken = userId ? getUnlockGrant(userId) : null;
  const { data, error } = await supabase.functions.invoke('security', {
    body: { action, ...body, unlockToken },
  });
  if (error) {
    let parsed: ApiErrorBody | null = null;
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try { parsed = await context.clone().json() as ApiErrorBody; } catch { /* Use the safe fallback below. */ }
    }
    const normalized = normalizeApiError(parsed);
    throw new SecurityServiceError(
      normalized.code,
      normalized.message || (navigator.onLine ? 'The security request could not be completed.' : "You're offline. Connect to the internet and try again."),
      normalized.retryAfter,
    );
  }
  const response = data as T & ApiErrorBody;
  if (response?.error) {
    throw new SecurityServiceError(
      response.error.code || 'security_error',
      response.error.message || 'The security request could not be completed.',
      Number(response.error.retryAfter || 0),
    );
  }
  return response;
}

export function isWebAuthnSupported() {
  return browserSupportsWebAuthn() && typeof PublicKeyCredential !== 'undefined';
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false;
  try { return await platformAuthenticatorIsAvailable(); } catch { return false; }
}

export function cancelWebAuthnAuthentication() {
  WebAuthnAbortService.cancelCeremony();
}

export function suggestedDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'Apple Device';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Windows/i.test(ua)) return 'Windows Device';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  return 'This Device';
}

export function getUnlockGrant(userId: string) {
  return sessionStorage.getItem(`${GRANT_KEY_PREFIX}${userId}`) || localStorage.getItem(`${GRANT_KEY_PREFIX}${userId}`);
}

export function saveUnlockGrant(userId: string, grant: UnlockGrant, duration: AutoLockDuration) {
  clearUnlockGrant(userId);
  const storage = duration === 'immediately' ? sessionStorage : localStorage;
  storage.setItem(`${GRANT_KEY_PREFIX}${userId}`, grant.token);
  markActive(userId);
}

export function clearUnlockGrant(userId: string) {
  sessionStorage.removeItem(`${GRANT_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${GRANT_KEY_PREFIX}${userId}`);
}

export function markActive(userId: string, timestamp = Date.now()) {
  localStorage.setItem(`${ACTIVE_KEY_PREFIX}${userId}`, String(timestamp));
}

export function getLastActive(userId: string) {
  const stored = Number(localStorage.getItem(`${ACTIVE_KEY_PREFIX}${userId}`));
  return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
}

export function clearLocalSecurityState(userId: string) {
  clearUnlockGrant(userId);
  localStorage.removeItem(`${ACTIVE_KEY_PREFIX}${userId}`);
  document.documentElement.classList.remove('privacy-mode');
}

export function clearLegacySecurityStorage() {
  localStorage.removeItem('tab_app_lock_hash_v1');
  localStorage.removeItem('tab_app_lock_salt_v1');
  sessionStorage.removeItem('tab_app_unlocked');
}

export function cacheSecurityStatus(userId: string, status: SecurityStatus) {
  const safeStatus: SecurityStatus = { ...status, authenticators: [] };
  localStorage.setItem(`${STATUS_KEY_PREFIX}${userId}`, JSON.stringify(safeStatus));
}

export function getCachedSecurityStatus(userId: string): SecurityStatus | null {
  try {
    const stored = localStorage.getItem(`${STATUS_KEY_PREFIX}${userId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SecurityStatus>;
    if (typeof parsed.appLockEnabled !== 'boolean' || typeof parsed.pinEnabled !== 'boolean' || typeof parsed.webAuthnEnabled !== 'boolean') return null;
    return {
      appLockEnabled: parsed.appLockEnabled,
      pinEnabled: parsed.pinEnabled,
      webAuthnEnabled: parsed.webAuthnEnabled,
      webAuthnAvailableHere: Boolean(parsed.webAuthnAvailableHere),
      autoLockDuration: parsed.autoLockDuration || '5m',
      preferredUnlockMethod: parsed.preferredUnlockMethod || 'pin',
      failedPinAttempts: Number(parsed.failedPinAttempts || 0),
      lockedUntil: parsed.lockedUntil || null,
      grantValid: false,
      lastVerifiedAt: parsed.lastVerifiedAt || null,
      authenticators: [],
    };
  } catch {
    return null;
  }
}

export async function getSecurityStatus(userId: string) {
  const status = await invoke<SecurityStatus>('status', {}, userId);
  cacheSecurityStatus(userId, status);
  return status;
}

export async function registerAuthenticator(userId: string, deviceName = suggestedDeviceName()) {
  if (!(await isPlatformAuthenticatorAvailable())) {
    throw new SecurityServiceError('platform_authenticator_unavailable', "Device authentication isn't available on this browser or device.");
  }
  try {
    const start = await invoke<{ options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('webauthn/registration-options', {}, userId);
    const response = await startRegistration({ optionsJSON: start.options });
    await invoke('webauthn/registration-verify', { response, deviceName }, userId);
  } catch (caught) {
    if (caught instanceof WebAuthnError && (caught.name === 'NotAllowedError' || caught.code === 'ERROR_CEREMONY_ABORTED')) {
      throw new SecurityServiceError('authentication_cancelled', '');
    }
    if (caught instanceof SecurityServiceError) throw caught;
    throw new SecurityServiceError('device_registration_failed', 'Device Security could not be set up. Please try again.');
  }
}

export async function authenticateWithWebAuthn(userId: string, duration: AutoLockDuration) {
  if (!isWebAuthnSupported()) throw new SecurityServiceError('webauthn_unsupported', "Device authentication isn't available on this browser.");
  if (!navigator.onLine) throw new SecurityServiceError('offline', "You're offline. Connect to the internet to use Device Security.");
  try {
    const start = await invoke<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('webauthn/authentication-options', {}, userId);
    const response = await startAuthentication({
      optionsJSON: { ...start.options, userVerification: 'required' },
    });
    const verified = await invoke<{ grant: UnlockGrant }>('webauthn/authentication-verify', { response }, userId);
    saveUnlockGrant(userId, verified.grant, duration);
    return verified.grant;
  } catch (caught) {
    if (caught instanceof WebAuthnError && (caught.name === 'NotAllowedError' || caught.code === 'ERROR_CEREMONY_ABORTED')) {
      throw new SecurityServiceError('authentication_cancelled', '');
    }
    if (caught instanceof SecurityServiceError) throw caught;
    throw new SecurityServiceError('device_verification_failed', "Couldn't verify your identity.");
  }
}

export async function createPin(userId: string, pin: string) {
  const result = await invoke<{ grant: UnlockGrant }>('pin/create', { pin }, userId);
  saveUnlockGrant(userId, result.grant, '5m');
}

export async function verifyPin(userId: string, pin: string, duration: AutoLockDuration) {
  if (!navigator.onLine) throw new SecurityServiceError('offline', "You're offline. Connect to the internet to verify your App PIN securely.");
  const result = await invoke<{ grant: UnlockGrant }>('pin/verify', { pin }, userId);
  saveUnlockGrant(userId, result.grant, duration);
  return result.grant;
}

export async function verifyCurrentPinForChange(userId: string, currentPin: string) {
  if (!navigator.onLine) throw new SecurityServiceError('offline', "You're offline. Connect to the internet to verify your App PIN securely.");
  const result = await invoke<{ grant: UnlockGrant }>('pin/change/verify', { currentPin }, userId);
  return result.grant.token;
}

export async function validateNewPinForChange(userId: string, changeToken: string, newPin: string) {
  await invoke('pin/change/check', { changeToken, newPin }, userId);
}

export async function changePin(userId: string, changeToken: string, currentPin: string, newPin: string) {
  const result = await invoke<{ grant: UnlockGrant; autoLockDuration: AutoLockDuration }>('pin/change', { changeToken, currentPin, newPin }, userId);
  saveUnlockGrant(userId, result.grant, result.autoLockDuration);
}

export async function recoverPin(userId: string, pin: string, duration: AutoLockDuration) {
  const result = await invoke<{ grant: UnlockGrant }>('pin/recover', { pin }, userId);
  saveUnlockGrant(userId, result.grant, duration);
  return result.grant;
}

export async function enableAppLock(userId: string, autoLockDuration: AutoLockDuration) {
  const result = await invoke<{ grant?: UnlockGrant }>('lock/enable', { autoLockDuration }, userId);
  if (result.grant) saveUnlockGrant(userId, result.grant, autoLockDuration);
}

export async function disableAppLock(userId: string) {
  await invoke('lock/disable', {}, userId);
  clearLocalSecurityState(userId);
}

export async function setAutoLock(userId: string, autoLockDuration: AutoLockDuration) {
  await invoke('lock/auto-lock', { autoLockDuration }, userId);
  const token = getUnlockGrant(userId);
  if (token) {
    clearUnlockGrant(userId);
    const storage = autoLockDuration === 'immediately' ? sessionStorage : localStorage;
    storage.setItem(`${GRANT_KEY_PREFIX}${userId}`, token);
  }
}

export async function touchUnlockSession(userId: string) {
  markActive(userId);
  if (getUnlockGrant(userId)) await invoke('lock/touch', {}, userId);
}

export async function lockApp(userId: string) {
  const request = getUnlockGrant(userId) ? invoke('lock/revoke', {}, userId).catch(() => undefined) : Promise.resolve();
  clearUnlockGrant(userId);
  await request;
}

export async function revokeAllSecuritySessions(userId: string) {
  try { await invoke('lock/revoke-all', {}, userId); } finally { clearLocalSecurityState(userId); }
}

export async function renameAuthenticator(userId: string, deviceId: string, deviceName: string) {
  await invoke('devices/rename', { deviceId, deviceName }, userId);
}

export async function removeAuthenticator(userId: string, deviceId: string) {
  await invoke('devices/remove', { deviceId }, userId);
}

export async function listSecurityEvents(userId: string) {
  const result = await invoke<{ events: SecurityEvent[] }>('activity/list', {}, userId);
  return result.events;
}

export async function hasRecentAuthentication(userId: string) {
  const result = await invoke<{ fresh: boolean; lastVerifiedAt: string | null }>('reauth/status', {}, userId);
  return result;
}

export async function recordVerifiedExport(userId: string) {
  await invoke('event/export', {}, userId);
}
