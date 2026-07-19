import { validateEmail, validatePassword, validatePasswordConfirmation } from '@/src/features/auth/model/emailPassword';

describe('email and password validation', () => {
  it('normalizes a valid email address', () => {
    expect(validateEmail('  COLOR@Example.com ')).toEqual({ isValid: true, value: 'color@example.com' });
  });

  it('rejects an incomplete email address', () => {
    expect(validateEmail('not-an-email')).toEqual({ isValid: false, message: '이메일 주소를 확인해 주세요.' });
  });

  it('requires passwords to be at least eight characters long', () => {
    expect(validatePassword('1234567')).toEqual({ isValid: false, message: '비밀번호는 8자 이상이어야 해요.' });
    expect(validatePassword('12345678')).toEqual({ isValid: true, value: '12345678' });
  });

  it('requires password confirmation to match', () => {
    expect(validatePasswordConfirmation('password', 'different')).toEqual({ isValid: false, message: '비밀번호가 서로 달라요.' });
    expect(validatePasswordConfirmation('password', 'password')).toEqual({ isValid: true, value: 'password' });
  });
});
