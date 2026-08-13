import { describe, expect, it } from 'vitest';
import type { SecurityStatus } from '../types/security';
import { disabledSecurityStatus, resolveFailedSecurityBootstrap } from './securityBootstrap';

function enabledStatus(): SecurityStatus {
  return { ...disabledSecurityStatus(), appLockEnabled: true, pinEnabled: true };
}

describe('security startup fallback', () => {
  it('does not lock a new installation when the security function was never deployed', () => {
    expect(resolveFailedSecurityBootstrap('security_service_not_deployed', null)).toEqual({
      status: disabledSecurityStatus(),
      isLocked: false,
    });
  });

  it('keeps a previously enabled App Lock fail-closed when the function is missing', () => {
    const result = resolveFailedSecurityBootstrap('security_service_not_deployed', enabledStatus());
    expect(result.isLocked).toBe(true);
    expect(result.status?.appLockEnabled).toBe(true);
    expect(result.status?.grantValid).toBe(false);
  });

  it('fails closed for an unverified network error', () => {
    expect(resolveFailedSecurityBootstrap('network_failure', null)).toEqual({ status: null, isLocked: true });
  });
});
