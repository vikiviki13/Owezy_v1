import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const permissionPage = readFileSync(resolve(root, 'src/pages/settings/PermissionPages.tsx'), 'utf8');
const notificationPage = readFileSync(resolve(root, 'src/pages/settings/AccountSettingsPages.tsx'), 'utf8');
const profilePage = readFileSync(resolve(root, 'src/pages/settings/EditProfile.tsx'), 'utf8');

describe('permissions UX contract', () => {
  it('lists only device capabilities the app actually uses', () => {
    for (const key of ['contacts', 'camera', 'photos', 'notifications', 'device-security']) {
      expect(permissionPage).toContain(`key: '${key}'`);
    }
    expect(permissionPage).not.toContain("key: 'location'");
    expect(permissionPage).not.toContain('MapPin');
  });

  it('shows an explanation before notification and camera requests', () => {
    expect(notificationPage).toContain('PermissionExplanationDialog');
    expect(notificationPage).toContain('requestNotificationAccess');
    expect(profilePage).toContain('PermissionExplanationDialog');
    expect(profilePage).toContain('requestCameraAccess');
  });

  it('uses truthful non-persistent copy for browser file selection', () => {
    expect(permissionPage).toContain('This is not treated as permanent access');
    expect(permissionPage).toContain('Browser file pickers share only files you select');
  });
});
