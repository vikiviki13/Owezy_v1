import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
const provider = readFileSync(resolve(root, 'src/components/AppUpdateProvider.tsx'), 'utf8');
const prompt = readFileSync(resolve(root, 'src/components/AppUpdatePrompt.tsx'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
const versionMetadata = JSON.parse(readFileSync(resolve(root, 'public/version.json'), 'utf8')) as { version: string; required_update: boolean };

describe('PWA update contract', () => {
  it('uses prompt registration and exposes matching release metadata', () => {
    expect(viteConfig).toContain("registerType: 'prompt'");
    expect(viteConfig).toContain('__APP_VERSION__');
    expect(packageJson.version).toBe(versionMetadata.version);
  });

  it('checks on startup, visibility changes, and a reasonable interval', () => {
    expect(provider).toContain("useRegisterSW");
    expect(provider).toContain("document.addEventListener('visibilitychange'");
    expect(provider).toContain('45 * 60_000');
    expect(provider).toContain('nextRegistration.waiting');
  });

  it('offers explicit update, later, offline, failure, and critical states', () => {
    expect(prompt).toContain('New update available');
    expect(prompt).toContain('Update Now');
    expect(prompt).toContain('Later');
    expect(prompt).toContain("Couldn't update the app");
    expect(prompt).toContain('Connect to the internet');
    expect(prompt).toContain('Update required');
    expect(prompt).toContain('applyUpdate');
  });

  it('never clears persistent user data while updating', () => {
    expect(provider).not.toContain('localStorage.clear');
    expect(provider).not.toContain('indexedDB.deleteDatabase');
    expect(prompt).not.toContain('uninstall');
  });
});
