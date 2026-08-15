import { describe, expect, it } from 'vitest';
import { compareVersions, isRequiredUpdate } from './appRelease';

describe('compareVersions', () => {
  it('orders semver versions correctly', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
  });
});

describe('isRequiredUpdate', () => {
  it('is false when no required version is configured', () => {
    expect(isRequiredUpdate('1.0.0')).toBe(false);
  });
});