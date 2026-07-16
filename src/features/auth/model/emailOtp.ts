export type EmailValidation = { isValid: true; value: string } | { isValid: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(input: string): EmailValidation {
  const value = input.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(value)) return { isValid: false, message: '이메일 주소를 확인해 주세요.' };
  return { isValid: true, value };
}

export function validateEmailOtp(input: string): boolean {
  return /^\d{6}$/.test(input.trim());
}
