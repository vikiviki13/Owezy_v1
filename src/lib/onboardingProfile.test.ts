import { describe, expect, it } from 'vitest';
import { onboardingDestination } from './onboardingProfile';

describe('onboarding routing', () => {
  it('sends new users to onboarding', () => {
    expect(onboardingDestination(false)).toBe('/onboarding');
  });

  it('sends completed users home', () => {
    expect(onboardingDestination(true)).toBe('/home');
  });
});
