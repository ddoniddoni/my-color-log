import { createClient } from '@supabase/supabase-js';
import { createRecoveryConnection, requestPasswordReset } from '../passwordRecoveryRepository';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/src/lib/env/publicEnv', () => ({ getPublicEnv: () => ({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test-public-key', appScheme: 'mycolorlog' }) }));
// Fails immediately if recovery starts using the persisted application client.
jest.mock('@/src/lib/supabase/client', () => ({ getSupabaseClient: () => { throw new Error('main_session_must_not_be_used'); } }));

const response = { data: { session: { user: { id: 'recovery-user' } }, user: { id: 'recovery-user' } }, error: null };
function setup() {
  const auth = {
    resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    setSession: jest.fn().mockResolvedValue(response),
    verifyOtp: jest.fn().mockResolvedValue(response),
    updateUser: jest.fn().mockResolvedValue(response),
    dispose: jest.fn().mockResolvedValue(undefined),
  };
  jest.mocked(createClient).mockReturnValue({ auth } as unknown as ReturnType<typeof createClient>);
  return auth;
}

describe('password recovery repository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends to a normalized email with the exact native callback, then releases resources', async () => {
    const auth = setup();
    await requestPasswordReset('  COLOR@Example.com ');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('color@example.com', { redirectTo: 'mycolorlog://auth/reset-password' });
    expect(auth.dispose).toHaveBeenCalledTimes(1);
  });

  it('uses a distinct memory-only client for each recovery instead of the main session', () => {
    setup();
    createRecoveryConnection();
    createRecoveryConnection();
    const calls = jest.mocked(createClient).mock.calls;
    const first = calls[0][2]?.auth;
    const second = calls[1][2]?.auth;
    expect(first).toEqual(expect.objectContaining({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' }));
    expect(first?.storage).toBeUndefined();
    expect(first?.storageKey).not.toBe(second?.storageKey);
  });

  it('rejects invalid emails before making a request and cleans up failed requests', async () => {
    const auth = setup();
    await expect(requestPasswordReset('invalid')).rejects.toThrow('invalid_email');
    expect(createClient).not.toHaveBeenCalled();
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: 'over_email_send_rate_limit' } });
    await expect(requestPasswordReset('color@example.com')).rejects.toEqual({ code: 'over_email_send_rate_limit' });
    expect(auth.dispose).toHaveBeenCalledTimes(1);
  });

  it('verifies both supported link formats with Supabase before updating the password', async () => {
    const auth = setup();
    const connection = createRecoveryConnection();
    await connection.authenticate({ kind: 'tokens', accessToken: 'test-access', refreshToken: 'test-refresh' });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
    await connection.authenticate({ kind: 'token-hash', tokenHash: 'test-hash' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-hash', type: 'recovery' });
    await connection.updatePassword('new-test-password');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-test-password' });
    connection.dispose();
    expect(auth.dispose).toHaveBeenCalled();
  });

  it('does not accept a missing session or report an empty update response as success', async () => {
    const auth = setup();
    const connection = createRecoveryConnection();
    auth.setSession.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    await expect(connection.authenticate({ kind: 'tokens', accessToken: 'test-access', refreshToken: 'test-refresh' })).rejects.toMatchObject({ code: 'session_not_found' });
    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(connection.updatePassword('new-test-password')).rejects.toMatchObject({ code: 'session_not_found' });
  });
});
