export type AppAuthErrorCode =
  | 'email_already_registered'
  | 'email_confirmation_required'
  | 'email_not_confirmed'
  | 'email_send_rate_limited'
  | 'invalid_email_address'
  | 'password_sign_in_failed'
  | 'password_sign_up_failed'
  | 'profile_fetch_failed';

export function mapSignUpErrorCode(code: string | undefined): AppAuthErrorCode {
  if (code === 'email_address_invalid') return 'invalid_email_address';
  if (code === 'over_email_send_rate_limit') return 'email_send_rate_limited';
  if (code === 'user_already_exists') return 'email_already_registered';
  return 'password_sign_up_failed';
}

export function mapSignInErrorCode(code: string | undefined): AppAuthErrorCode {
  if (code === 'email_not_confirmed') return 'email_not_confirmed';
  return 'password_sign_in_failed';
}

export function getAuthErrorMessage(code: AppAuthErrorCode, isSignUp: boolean): string {
  switch (code) {
    case 'invalid_email_address':
      return '실제로 수신 가능한 이메일 주소를 입력해 주세요.';
    case 'email_send_rate_limited':
      return '이메일 전송 제한에 걸렸어요. 이메일 확인 설정을 끈 뒤 다시 시도해 주세요.';
    case 'email_already_registered':
      return '이미 가입된 이메일이에요. 로그인해 주세요.';
    case 'email_confirmation_required':
      return '가입 후 바로 시작하려면 Supabase에서 Confirm email을 꺼 주세요.';
    case 'email_not_confirmed':
      return '이메일 확인이 아직 완료되지 않았어요.';
    case 'profile_fetch_failed':
      return '로그인됐지만 프로필을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.';
    default:
      return isSignUp ? '회원가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.' : '이메일 또는 비밀번호가 맞지 않아요.';
  }
}
