import { APP_VERSION } from './appRelease';
import { checkRemoteUpdate } from '../services/appUpdateService';

export async function checkForAppUpdate(): Promise<'up-to-date' | 'update-found' | 'unsupported'> {
  // 1. Check if the server has a newer version deployed in /version.json or GitHub
  try {
    const remote = await checkRemoteUpdate(APP_VERSION, true);
    if (remote?.hasUpdate) {
      return 'update-found';
    }
  } catch {
    // Continue to check service worker
  }

  // 2. Check service worker registration
  if (!('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return 'up-to-date';
    }

    if (registration.waiting || registration.installing) {
      return 'update-found';
    }

    await registration.update();

    if (registration.waiting || registration.installing) {
      return 'update-found';
    }

    return 'up-to-date';
  } catch {
    return 'unsupported';
  }
}