import { redirectSystemPath } from '@/app/+native-intent';
import { passwordRecoveryFlow } from '../passwordRecoveryIntent';

jest.mock('@/src/features/auth/api/passwordRecoveryRepository', () => ({
  createRecoveryConnection: () => ({ authenticate: jest.fn().mockResolvedValue(undefined), updatePassword: jest.fn(), dispose: jest.fn() }),
}));

describe('native password recovery entry point', () => {
  afterEach(() => passwordRecoveryFlow.clear(passwordRecoveryFlow.getSnapshot().id));

  it.each([true, false])('sanitizes token-bearing URLs on native entry (cold start: %s)', (initial) => {
    const destination = redirectSystemPath({ path: 'mycolorlog://auth/reset-password#access_token=test-secret&refresh_token=refresh-secret&type=recovery', initial });
    expect(destination).toMatch(/^\/auth\/reset-password\?recoveryId=\d+$/);
    expect(destination).not.toContain('secret');
    expect(JSON.stringify(passwordRecoveryFlow.getSnapshot())).not.toContain('secret');
  });

  it('keeps invitations unchanged and routes expired links to safe feedback', () => {
    const invite = 'mycolorlog://invite?code=test-invite';
    expect(redirectSystemPath({ path: invite, initial: true })).toBe(invite);
    const destination = redirectSystemPath({ path: 'mycolorlog://auth/reset-password#error_code=otp_expired&error_description=private-detail', initial: false });
    expect(destination).not.toContain('private-detail');
    expect(passwordRecoveryFlow.getSnapshot().error).toBe('expired');
  });
});
