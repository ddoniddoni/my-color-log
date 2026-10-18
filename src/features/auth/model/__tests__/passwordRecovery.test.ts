import { getPasswordRecoveryRedirectUrl, getRecoveryError, getRecoveryErrorMessage, parsePasswordRecoveryLink } from '../passwordRecovery';

const route = 'mycolorlog://auth/reset-password';

describe('password recovery links', () => {
  it('accepts default Supabase implicit callbacks and custom token hash links', () => {
    expect(parsePasswordRecoveryLink(`${route}#access_token=access&refresh_token=refresh&type=recovery`, 'mycolorlog')).toEqual({ kind: 'tokens', accessToken: 'access', refreshToken: 'refresh' });
    expect(parsePasswordRecoveryLink(`${route}?token_hash=hash&type=recovery`, 'mycolorlog')).toEqual({ kind: 'token-hash', tokenHash: 'hash' });
    expect(parsePasswordRecoveryLink('/auth/reset-password?token_hash=hash&type=recovery', 'mycolorlog')).toEqual({ kind: 'token-hash', tokenHash: 'hash' });
  });

  it.each([
    route,
    `${route}#access_token=access&type=recovery`,
    `${route}#access_token=access&refresh_token=refresh&type=signup`,
    `${route}?token_hash=hash&type=recovery#type=recovery`,
    `${route}?access_token=access&refresh_token=refresh&token_hash=hash&type=recovery`,
    `${route}?token_hash=hash&type=recovery#token_hash=other`,
    'other://auth/reset-password?token_hash=hash&type=recovery',
    'mycolorlog://user:password@auth/reset-password?token_hash=hash&type=recovery',
    'mycolorlog://auth:42/reset-password?token_hash=hash&type=recovery',
    'mycolorlog://[invalid]/auth/reset-password?token_hash=hash&type=recovery',
    `${route}?token_hash=${'a'.repeat(16_384)}&type=recovery`,
  ])('rejects untrusted, incomplete, or ambiguous recovery URLs: %#', (url) => {
    expect(parsePasswordRecoveryLink(url, 'mycolorlog')).toEqual({ kind: 'invalid', reason: 'invalid' });
  });

  it('preserves unrelated invitation and app routes', () => {
    expect(parsePasswordRecoveryLink('mycolorlog://invite/abc', 'mycolorlog')).toBeNull();
    expect(parsePasswordRecoveryLink('/(tabs)/today', 'mycolorlog')).toBeNull();
  });

  it('classifies expired links without exposing raw server text', () => {
    const result = parsePasswordRecoveryLink(`${route}#error=access_denied&error_code=otp_expired&error_description=private-detail`, 'mycolorlog');
    expect(result).toEqual({ kind: 'invalid', reason: 'expired' });
    expect(JSON.stringify(result)).not.toContain('private-detail');
  });

  it('uses the registered custom scheme only', () => {
    expect(getPasswordRecoveryRedirectUrl('mycolorlog')).toBe(route);
    expect(() => getPasswordRecoveryRedirectUrl('https')).toThrow('invalid_app_scheme');
    expect(() => getPasswordRecoveryRedirectUrl('mycolorlog://wrong')).toThrow('invalid_app_scheme');
  });

  it.each([
    ['otp_expired', 'expired'], ['bad_jwt', 'expired'], ['session_not_found', 'expired'],
    ['over_email_send_rate_limit', 'rate-limit'], ['over_request_rate_limit', 'rate-limit'],
    ['weak_password', 'weak-password'], ['same_password', 'same-password'],
  ])('maps %s to safe actionable feedback', (code, expected) => {
    expect(getRecoveryError({ code, message: 'private-server-detail' })).toBe(expected);
    expect(getRecoveryErrorMessage(getRecoveryError({ code }))).not.toContain('private-server-detail');
  });
});
