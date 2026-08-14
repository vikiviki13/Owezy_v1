import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cameraPermissionState,
  mapBrowserPermissionState,
  notificationPermissionState,
  photosAndFilesPermissionState,
  requestNotificationAccess,
} from './permissionService';

describe('permission service', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps browser permission states without inventing grants', () => {
    expect(mapBrowserPermissionState('granted')).toBe('allowed');
    expect(mapBrowserPermissionState('prompt')).toBe('not_requested');
    expect(mapBrowserPermissionState('denied')).toBe('blocked');
  });

  it('uses the browser notification result as the source of truth', () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(notificationPermissionState()).toBe('blocked');
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(notificationPermissionState()).toBe('not_requested');
    vi.stubGlobal('Notification', { permission: 'granted' });
    expect(notificationPermissionState()).toBe('allowed');
  });

  it('describes user-selected file access as availability, not a persistent grant', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('File', class File {});
    vi.stubGlobal('FileReader', class FileReader {});
    expect(photosAndFilesPermissionState()).toBe('available');
  });

  it('does not retry a notification prompt after the browser reports it blocked', async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });
    await expect(requestNotificationAccess()).rejects.toMatchObject({ code: 'blocked' });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('reads camera state through the Permissions API when supported', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'denied' }) },
    });
    expect(await cameraPermissionState()).toBe('blocked');
  });
});
