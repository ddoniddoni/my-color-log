import { getKstDateKey } from '@/src/utils/dates/kst';

export const MINIMUM_SIGN_UP_AGE = 14;

export type BirthDateInput = {
  day: string;
  month: string;
  year: string;
};

export type AgeEligibility =
  | { isEligible: true }
  | { code: 'birth_date_invalid' | 'birth_date_required' | 'minimum_age_not_met'; isEligible: false };

export function validateMinimumSignUpAge(input: BirthDateInput, now: Date = new Date()): AgeEligibility {
  const year = parseDatePart(input.year, 4);
  const month = parseDatePart(input.month, 2);
  const day = parseDatePart(input.day, 2);

  if (year === null || month === null || day === null) {
    if (input.year.trim().length === 0 || input.month.trim().length === 0 || input.day.trim().length === 0) {
      return { code: 'birth_date_required', isEligible: false };
    }
    return { code: 'birth_date_invalid', isEligible: false };
  }

  const birthDateKey = toDateKey(year, month, day);
  if (birthDateKey === null || birthDateKey > getKstDateKey(now)) {
    return { code: 'birth_date_invalid', isEligible: false };
  }

  const [currentYear, currentMonth, currentDay] = getKstDateKey(now).split('-').map(Number);
  if (currentYear === undefined || currentMonth === undefined || currentDay === undefined) {
    throw new Error('invalid_kst_date_key');
  }

  const age = currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
  return age >= MINIMUM_SIGN_UP_AGE
    ? { isEligible: true }
    : { code: 'minimum_age_not_met', isEligible: false };
}

export function getAgeEligibilityErrorMessage(eligibility: Exclude<AgeEligibility, { isEligible: true }>): string {
  switch (eligibility.code) {
    case 'birth_date_required':
      return '생년월일을 입력해 주세요.';
    case 'birth_date_invalid':
      return '생년월일을 다시 확인해 주세요.';
    case 'minimum_age_not_met':
      return 'Color Log는 만 14세 이상부터 가입할 수 있어요.';
  }
}

function parseDatePart(value: string, length: 2 | 4): number | null {
  const trimmed = value.trim();
  if (!new RegExp(`^\\d{${length}}$`).test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function toDateKey(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
