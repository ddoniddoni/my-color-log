import type { AppLanguage } from '@/src/lib/localization/languagePreference';

type ParsedDateKey = {
  day: number;
  month: number;
  year: number;
};

type DateKeyFormat = 'full' | 'monthDay' | 'numeric' | 'shortWithWeekday';

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function formatDateKey(dateKey: string, language: AppLanguage, format: DateKeyFormat = 'full'): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;

  if (format === 'numeric') {
    return `${date.year}.${String(date.month).padStart(2, '0')}.${String(date.day).padStart(2, '0')}`;
  }

  if (format === 'monthDay') {
    return language === 'ko' ? `${date.month}월 ${date.day}일` : `${EN_MONTHS[date.month - 1]} ${date.day}`;
  }

  if (format === 'shortWithWeekday') {
    const weekday = getWeekday(date);
    return language === 'ko'
      ? `${date.month}월 ${date.day}일 (${KO_WEEKDAYS[weekday]})`
      : `${EN_WEEKDAYS[weekday]}, ${EN_MONTHS[date.month - 1]} ${date.day}`;
  }

  return language === 'ko'
    ? `${date.year}년 ${date.month}월 ${date.day}일`
    : `${EN_MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

export function formatMonthLabel(year: number, month: number, language: AppLanguage): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return '';
  return language === 'ko' ? `${year}년 ${month}월` : `${EN_MONTHS[month - 1]} ${year}`;
}

function parseDateKey(dateKey: string): ParsedDateKey | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return { day, month, year };
}

function getWeekday(date: ParsedDateKey): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}
