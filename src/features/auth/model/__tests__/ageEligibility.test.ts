import {
  getAgeEligibilityErrorMessage,
  MINIMUM_SIGN_UP_AGE,
  validateMinimumSignUpAge,
} from '@/src/features/auth/model/ageEligibility';

const NOW = new Date('2026-07-28T00:00:00.000Z');

describe('minimum sign-up age', () => {
  it('allows a person on their fourteenth birthday in KST', () => {
    expect(validateMinimumSignUpAge({ day: '28', month: '07', year: '2012' }, NOW)).toEqual({ isEligible: true });
  });

  it('blocks a person before their fourteenth birthday in KST', () => {
    expect(validateMinimumSignUpAge({ day: '29', month: '07', year: '2012' }, NOW)).toEqual({
      code: 'minimum_age_not_met',
      isEligible: false,
    });
  });

  it('requires a complete, real birth date', () => {
    expect(validateMinimumSignUpAge({ day: '', month: '07', year: '2010' }, NOW)).toEqual({
      code: 'birth_date_required',
      isEligible: false,
    });
    expect(validateMinimumSignUpAge({ day: '30', month: '02', year: '2010' }, NOW)).toEqual({
      code: 'birth_date_invalid',
      isEligible: false,
    });
    expect(validateMinimumSignUpAge({ day: '01', month: '01', year: '2030' }, NOW)).toEqual({
      code: 'birth_date_invalid',
      isEligible: false,
    });
  });

  it('uses the documented minimum age in its user-facing error', () => {
    expect(MINIMUM_SIGN_UP_AGE).toBe(14);
    expect(getAgeEligibilityErrorMessage({ code: 'minimum_age_not_met', isEligible: false }))
      .toBe('Color Log는 만 14세 이상부터 가입할 수 있어요.');
  });
});
