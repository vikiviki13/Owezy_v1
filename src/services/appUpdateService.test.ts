import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkRemoteUpdate } from './appUpdateService';

describe('checkRemoteUpdate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects an update when remote version.json is newer', async () => {
    const mockManifest = {
      version: '1.2.0',
      buildDate: '2026-10-01',
      notes: ['Brand new feature 1', 'Brand new feature 2'],
      required: false,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    const result = await checkRemoteUpdate('1.1.0', true);
    expect(result).toBeDefined();
    expect(result?.hasUpdate).toBe(true);
    expect(result?.version).toBe('1.2.0');
    expect(result?.notes).toEqual(['Brand new feature 1', 'Brand new feature 2']);
  });

  it('signals no update when remote version is equal or older', async () => {
    const mockManifest = {
      version: '1.1.0',
      buildDate: '2026-09-30',
      notes: ['Some note'],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    const result = await checkRemoteUpdate('1.1.0', true);
    expect(result).toBeDefined();
    expect(result?.hasUpdate).toBe(false);
    expect(result?.version).toBe('1.1.0');
  });

  it('gracefully handles fetch errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    const result = await checkRemoteUpdate('1.1.0', true);
    expect(result).toBeDefined();
    expect(result?.hasUpdate).toBe(false);
  });
});
