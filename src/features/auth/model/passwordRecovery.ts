export type RecoveryCredentials =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'token-hash'; tokenHash: string };
export type RecoveryLink = RecoveryCredentials | { kind: 'invalid'; reason: 'expired' | 'invalid' };
export type RecoveryError = 'expired' | 'invalid' | 'network' | 'rate-limit' | 'weak-password' | 'same-password';

export function getPasswordRecoveryRedirectUrl(scheme: string): string {
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme) || /^https?$/i.test(scheme)) throw new Error('invalid_app_scheme');
  return `${scheme}://auth/reset-password`;
}

// Parse only our recovery route, and never return server error descriptions.
export function parsePasswordRecoveryLink(path: string, scheme: string): RecoveryLink | null {
  try {
    const url = new URL(path, `${scheme}://app`);
    const route = `/${url.hostname === 'app' ? '' : url.hostname}${url.pathname}`.replace(/\/+/g, '/').replace(/\/$/, '');
    if (route !== '/auth/reset-password') return null;
    if (url.protocol !== `${scheme}:` || url.username || url.password || url.port || path.length > 16_384) return { kind: 'invalid', reason: 'invalid' };
    const params = new URLSearchParams(url.search);
    const fragment = new URLSearchParams(url.hash.slice(1));
    fragment.forEach((value, key) => params.append(key, value));
    if (params.has('error') || params.has('error_code')) {
      return { kind: 'invalid', reason: params.get('error_code') === 'otp_expired' ? 'expired' : 'invalid' };
    }
    if (['type', 'access_token', 'refresh_token', 'token_hash'].some((key) => params.getAll(key).length > 1)
      || params.get('type') !== 'recovery') return { kind: 'invalid', reason: 'invalid' };
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenHash = params.get('token_hash');
    if (accessToken && refreshToken && !tokenHash) return { kind: 'tokens', accessToken, refreshToken };
    if (tokenHash && !accessToken && !refreshToken) return { kind: 'token-hash', tokenHash };
    return { kind: 'invalid', reason: 'invalid' };
  } catch {
    return path.includes('/auth/reset-password') || path.includes('://auth/reset-password') ? { kind: 'invalid', reason: 'invalid' } : null;
  }
}

export function getRecoveryError(error: unknown): RecoveryError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (['otp_expired', 'session_expired', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'user_not_found'].includes(String(code))) return 'expired';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'rate-limit';
  if (code === 'weak_password') return 'weak-password';
  if (code === 'same_password') return 'same-password';
  return 'network';
}

export function getRecoveryErrorMessage(error: RecoveryError): string {
  switch (error) {
    case 'expired': return '링크가 만료됐거나 이미 사용됐어요. 재설정 메일을 다시 요청해 주세요.';
    case 'invalid': return '재설정 링크를 확인할 수 없어요. 메일의 링크를 다시 열거나 새 메일을 요청해 주세요.';
    case 'rate-limit': return '요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.';
    case 'weak-password': return '더 안전한 비밀번호를 입력해 주세요. 영문, 숫자, 기호를 함께 사용해 보세요.';
    case 'same-password': return '이전과 다른 새 비밀번호를 입력해 주세요.';
    case 'network': return '연결을 확인한 뒤 다시 시도해 주세요.';
  }
}
