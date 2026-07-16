export type EmailValidation = { isValid: true; value: string } | { isValid: false; message: string };
export type PasswordValidation = { isValid: true; value: string } | { isValid: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(input: string): EmailValidation {
  const value = input.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(value)) return { isValid: false, message: '이메일 주소를 확인해 주세요.' };
  return { isValid: true, value };
}

export function validatePassword(input: string): PasswordValidation {
  if (input.length < MIN_PASSWORD_LENGTH) return { isValid: false, message: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.` };
  return { isValid: true, value: input };
}

export function validatePasswordConfirmation(password: string, confirmation: string): PasswordValidation {
  if (password !== confirmation) return { isValid: false, message: '비밀번호가 서로 달라요.' };
  return { isValid: true, value: confirmation };
}
