import { validateEmail, validateEmailOtp } from '@/src/features/auth/model/emailOtp';

describe('email OTP validation', () => {
  it('normalizes a valid email address', () => {
    expect(validateEmail('  COLOR@Example.com ')).toEqual({ isValid: true, value: 'color@example.com' });
  });

  it('rejects an incomplete email address', () => {
    expect(validateEmail('not-an-email')).toEqual({ isValid: false, message: '이메일 주소를 확인해 주세요.' });
  });

  it('accepts only a six digit OTP', () => {
    expect(validateEmailOtp('123456')).toBe(true);
    expect(validateEmailOtp('12345a')).toBe(false);
    expect(validateEmailOtp('12345')).toBe(false);
  });
});
