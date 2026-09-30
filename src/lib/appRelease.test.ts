import { describe, expect, it } from 'vitest';
import { compareVersions, getReleaseNotesForVersion, isRequiredUpdate, latestReleaseNotes } from './appRelease';

describe('compareVersions', () => {
  it('orders semver versions correctly', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
  });

  it('handles "v" prefix gracefully', () => {
    expect(compareVersions('v1.2.0', '1.1.0')).toBe(1);
    expect(compareVersions('1.1.0', 'v1.2.0')).toBe(-1);
    expect(compareVersions('v1.1.0', '1.1.0')).toBe(0);
  });
});

describe('isRequiredUpdate', () => {
  it('is false when no required version is configured', () => {
    expect(isRequiredUpdate('1.0.0')).toBe(false);
  });
});

describe('getReleaseNotesForVersion and latestReleaseNotes', () => {
  it('finds authentic notes for configured versions', () => {
    const notes110 = getReleaseNotesForVersion('1.1.0');
    expect(notes110).toBeDefined();
    expect(notes110?.notes.length).toBeGreaterThan(0);
    expect(notes110?.notes[0]).toContain('Contact Import');

    const notes100 = getReleaseNotesForVersion('1.0.0');
    expect(notes100).toBeDefined();
    expect(notes100?.notes.length).toBeGreaterThan(0);
  });

  it('returns undefined for nonexistent versions', () => {
    expect(getReleaseNotesForVersion('99.99.99')).toBeUndefined();
  });

  it('returns valid notes for latest release', () => {
    const latest = latestReleaseNotes();
    expect(latest).toBeDefined();
    expect(latest?.notes.length).toBeGreaterThan(0);
  });
});