export async function checkForAppUpdate(): Promise<'up-to-date' | 'update-found' | 'unsupported'> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return 'unsupported';
  await registration.update();
  return registration.waiting ? 'update-found' : 'up-to-date';
}