import { redirectSystemPath } from '@/app/+native-intent';
import { passwordRecoveryFlow } from '../passwordRecoveryIntent';
import Constants from 'expo-constants';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { scheme: 'mycolorlog' } } }));

jest.mock('@/src/features/auth/api/passwordRecoveryRepository', () => ({
  createRecoveryConnection: () => ({ authenticate: jest.fn().mockResolvedValue(undefined), updatePassword: jest.fn(), dispose: jest.fn() }),
}));

describe('native password recovery entry point', () => {
  afterEach(() => {
    passwordRecoveryFlow.clear(passwordRecoveryFlow.getSnapshot().id);
    if (Constants.expoConfig) Constants.expoConfig.scheme = 'mycolorlog';
  });

  it.each(['mycolorlog-dev', 'mycolorlog-preview'])('opens recovery in the installed %s variant', (scheme) => {
    if (Constants.expoConfig) Constants.expoConfig.scheme = scheme;
    const destination = redirectSystemPath({ path: `${scheme}://auth/reset-password#access_token=test-secret&refresh_token=refresh-secret&type=recovery`, initial: true });
    expect(destination).toMatch(/^\/auth\/reset-password\?recoveryId=\d+$/);
    expect(destination).not.toContain('secret');
    const productionLink = 'mycolorlog://auth/reset-password#error_code=otp_expired';
    expect(redirectSystemPath({ path: productionLink, initial: false })).toMatch(/^\/auth\/reset-password\?recoveryId=\d+$/);
    expect(passwordRecoveryFlow.getSnapshot().error).toBe('invalid');
  });

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
