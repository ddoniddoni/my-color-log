import { getAuthErrorMessage, mapSignInErrorCode, mapSignUpErrorCode } from '@/src/features/auth/model/authErrors';

describe('Supabase 인증 오류 변환', () => {
  it('유효하지 않은 이메일 오류를 사용자 메시지로 바꾼다', () => {
    expect(mapSignUpErrorCode('email_address_invalid')).toBe('invalid_email_address');
    expect(getAuthErrorMessage('invalid_email_address', true)).toContain('수신 가능한 이메일');
  });

  it('이메일 전송 제한과 확인 필요 오류를 구분한다', () => {
    expect(mapSignUpErrorCode('over_email_send_rate_limit')).toBe('email_send_rate_limited');
    expect(mapSignInErrorCode('email_not_confirmed')).toBe('email_not_confirmed');
  });
});
