type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let promptEvent: InstallPrompt | null = null;
const listeners = new Set<() => void>();

export function startInstallCapture() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent = event as InstallPrompt;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    localStorage.setItem('tab_installed', '1');
    listeners.forEach((listener) => listener());
  });
}

export function getInstallPrompt() { return promptEvent; }
export function subscribeInstallPrompt(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('tab_installed') === '1'; }
