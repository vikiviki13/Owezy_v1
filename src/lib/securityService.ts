import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser';
import { supabase } from './supabase';
import type { AutoLockDuration, SecurityEvent, SecurityStatus, UnlockGrant } from '../types/security';

const GRANT_KEY_PREFIX = 'tab_unlock_grant_v2_';
const ACTIVE_KEY_PREFIX = 'tab_last_active_v2_';
const APP_LOCK_STATE_KEY_PREFIX = 'tab_app_lock_state_v2_';

export function cacheAppLockEnabled(userId: string, enabled: boolean) {
  localStorage.setItem(`${APP_LOCK_STATE_KEY_PREFIX}${userId}`, enabled ? '1' : '0');
}

export function getCachedAppLockEnabled(userId: string): boolean | null {
  const value = localStorage.getItem(`${APP_LOCK_STATE_KEY_PREFIX}${userId}`);
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

export class SecurityServiceError extends Error {
  code: string;
  retryAfter: number;

  constructor(code: string, message: string, retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

type ApiErrorBody = { error?: { code?: string; message?: string; retryAfter?: number } };

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
    throw new SecurityServiceError(
      parsed?.error?.code || 'network_failure',
      parsed?.error?.message || (navigator.onLine ? 'The security request could not be completed.' : "You're offline. Connect to the internet and try again."),
      Number(parsed?.error?.retryAfter || 0),
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

export function suggestedDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'Apple Device';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Windows/i.test(ua)) return 'Windows Device';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  return 'This Device';
}

export function getUnlockGrant(userId: string) {
  // Drop grants written by older releases; persistent grants are no longer
  // accepted after the security hardening migration.
  localStorage.removeItem(`${GRANT_KEY_PREFIX}${userId}`);
  return sessionStorage.getItem(`${GRANT_KEY_PREFIX}${userId}`);
}

export function saveUnlockGrant(userId: string, grant: UnlockGrant, duration: AutoLockDuration) {
  clearUnlockGrant(userId);
  // Unlock grants never persist beyond the current browser tab. The server is
  // authoritative for the configured idle duration.
  sessionStorage.setItem(`${GRANT_KEY_PREFIX}${userId}`, grant.token);
  markActive(userId);
  void duration;
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
  localStorage.removeItem(`${APP_LOCK_STATE_KEY_PREFIX}${userId}`);
  document.documentElement.classList.remove('privacy-mode');
}

export function clearAllLocalSecurityState() {
  for (const storage of [sessionStorage, localStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(GRANT_KEY_PREFIX) || key?.startsWith(ACTIVE_KEY_PREFIX) || key?.startsWith(APP_LOCK_STATE_KEY_PREFIX)) storage.removeItem(key);
    }
  }
  document.documentElement.classList.remove('privacy-mode');
}

export function clearLegacySecurityStorage() {
  localStorage.removeItem('tab_app_lock_hash_v1');
  localStorage.removeItem('tab_app_lock_salt_v1');
  sessionStorage.removeItem('tab_app_unlocked');
}

export async function getSecurityStatus(userId: string) {
  return invoke<SecurityStatus>('status', {}, userId);
}

export async function registerAuthenticator(userId: string, deviceName = suggestedDeviceName(), stepUpToken?: string) {
  if (!(await isPlatformAuthenticatorAvailable())) {
    throw new SecurityServiceError('platform_authenticator_unavailable', "Device authentication isn't available on this browser or device.");
  }
  try {
    const start = await invoke<{ options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('webauthn/registration-options', { stepUpToken }, userId);
    const response = await startRegistration({ optionsJSON: start.options });
    await invoke('webauthn/registration-verify', { response, deviceName, stepUpToken }, userId);
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
    const response = await startAuthentication({ optionsJSON: start.options });
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

export async function createPin(userId: string, pin: string, stepUpToken?: string) {
  const result = await invoke<{ grant: UnlockGrant }>('pin/create', { pin, stepUpToken }, userId);
  saveUnlockGrant(userId, result.grant, '5m');
}

export async function verifyPin(userId: string, pin: string, duration: AutoLockDuration) {
  if (!navigator.onLine) throw new SecurityServiceError('offline', "You're offline. Connect to the internet to verify your App PIN securely.");
  const result = await invoke<{ grant: UnlockGrant }>('pin/verify', { pin }, userId);
  saveUnlockGrant(userId, result.grant, duration);
  return result.grant;
}

export async function changePin(userId: string, pin: string) {
  await invoke('pin/change', { pin }, userId);
}

export async function recoverPin(userId: string, pin: string, duration: AutoLockDuration, stepUpToken?: string) {
  const result = await invoke<{ grant: UnlockGrant }>('pin/recover', { pin, stepUpToken }, userId);
  saveUnlockGrant(userId, result.grant, duration);
  return result.grant;
}

export async function enableAppLock(userId: string, autoLockDuration: AutoLockDuration, stepUpToken?: string) {
  const result = await invoke<{ grant?: UnlockGrant }>('lock/enable', { autoLockDuration, stepUpToken }, userId);
  if (result.grant) saveUnlockGrant(userId, result.grant, autoLockDuration);
}

export async function disableAppLock(userId: string) {
  await invoke('lock/disable', {}, userId);
  clearUnlockGrant(userId);
}

export async function setAutoLock(userId: string, autoLockDuration: AutoLockDuration) {
  await invoke('lock/auto-lock', { autoLockDuration }, userId);
  const token = getUnlockGrant(userId);
  if (token) {
    clearUnlockGrant(userId);
    sessionStorage.setItem(`${GRANT_KEY_PREFIX}${userId}`, token);
  }
}

export async function verifyAccountPassword(
  userId: string,
  password: string,
  purpose: 'security_setup' | 'pin_recovery',
) {
  const result = await invoke<{ proof: string; expiresIn: number }>('reauth/password', { password, purpose }, userId);
  return result.proof;
}

export async function readPrivateData<T>(userId: string) {
  const result = await invoke<{ data: T | null; updatedAt: string | null }>('data/read', {}, userId);
  return result.data;
}

export async function writePrivateData(userId: string, data: Record<string, unknown>) {
  await invoke('data/write', { data }, userId);
}

export interface SecureFriendImportResponse<TRow = Record<string, unknown>> {
  successes: Array<{ clientId: string; row: TRow }>;
  failures: Array<{ clientId: string; name: string; reason: string }>;
}

export async function importConfirmedFriends<TRow = Record<string, unknown>>(
  userId: string,
  friends: Array<Record<string, unknown>>,
) {
  return invoke<SecureFriendImportResponse<TRow>>('friends/import', { friends }, userId);
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
