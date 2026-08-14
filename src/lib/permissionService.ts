import { contactAvailability } from './contactService';
import { isPlatformAuthenticatorAvailable } from './securityService';

export type AppPermissionKey = 'contacts' | 'camera' | 'photos' | 'notifications' | 'device-security';

export type AppPermissionState =
  | 'allowed'
  | 'not_requested'
  | 'blocked'
  | 'unsupported'
  | 'available_on_demand'
  | 'available'
  | 'limited'
  | 'not_available'
  | 'enabled';

export interface AppPermissionSnapshot {
  key: AppPermissionKey;
  state: AppPermissionState;
}

export class PermissionRequestError extends Error {
  code: 'blocked' | 'unsupported' | 'not_available' | 'cancelled' | 'request_failed';

  constructor(code: PermissionRequestError['code'], message: string) {
    super(message);
    this.name = 'PermissionRequestError';
    this.code = code;
  }
}

export function mapBrowserPermissionState(state: PermissionState): AppPermissionState {
  if (state === 'granted') return 'allowed';
  if (state === 'denied') return 'blocked';
  return 'not_requested';
}

export function notificationPermissionState(): AppPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'allowed';
  if (Notification.permission === 'denied') return 'blocked';
  return 'not_requested';
}

export function photosAndFilesPermissionState(): AppPermissionState {
  if (typeof window === 'undefined' || typeof File === 'undefined' || typeof FileReader === 'undefined') return 'not_available';
  return 'available';
}

async function queryBrowserPermission(name: string): Promise<AppPermissionState | undefined> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined;
  try {
    const result = await navigator.permissions.query({ name } as PermissionDescriptor);
    return mapBrowserPermissionState(result.state);
  } catch {
    return undefined;
  }
}

export async function cameraPermissionState(): Promise<AppPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unsupported';
  return (await queryBrowserPermission('camera')) || 'not_requested';
}

export async function deviceSecurityPermissionState(enabled: boolean): Promise<AppPermissionState> {
  if (enabled) return 'enabled';
  return await isPlatformAuthenticatorAvailable() ? 'available' : 'unsupported';
}

export async function getAppPermissionSnapshots(deviceSecurityEnabled: boolean): Promise<AppPermissionSnapshot[]> {
  const [camera, deviceSecurity] = await Promise.all([
    cameraPermissionState(),
    deviceSecurityPermissionState(deviceSecurityEnabled),
  ]);
  return [
    { key: 'contacts', state: contactAvailability() },
    { key: 'camera', state: camera },
    { key: 'photos', state: photosAndFilesPermissionState() },
    { key: 'notifications', state: notificationPermissionState() },
    { key: 'device-security', state: deviceSecurity },
  ];
}

export async function requestCameraAccess(facingMode: 'user' | 'environment' = 'environment'): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new PermissionRequestError('unsupported', 'Camera access is not supported in this browser.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
  } catch (caught) {
    if (caught instanceof DOMException && (caught.name === 'NotAllowedError' || caught.name === 'SecurityError')) {
      throw new PermissionRequestError('blocked', 'Camera access is blocked.');
    }
    if (caught instanceof DOMException && (caught.name === 'NotFoundError' || caught.name === 'OverconstrainedError')) {
      throw new PermissionRequestError('not_available', 'No available camera was found on this device.');
    }
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw new PermissionRequestError('cancelled', 'Camera access was cancelled.');
    }
    throw new PermissionRequestError('request_failed', 'Camera access could not be requested.');
  }
}

export async function requestNotificationAccess(): Promise<AppPermissionState> {
  const current = notificationPermissionState();
  if (current === 'unsupported') throw new PermissionRequestError('unsupported', 'Notifications are not supported in this browser.');
  if (current === 'blocked') throw new PermissionRequestError('blocked', 'Notifications are blocked.');
  if (current === 'allowed') return current;
  const result = await Notification.requestPermission();
  return result === 'granted' ? 'allowed' : result === 'denied' ? 'blocked' : 'not_requested';
}
