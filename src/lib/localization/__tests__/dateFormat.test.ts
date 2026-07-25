import { formatDateKey, formatMonthLabel } from '@/src/lib/localization/dateFormat';

describe('localized date formatting', () => {
  it('formats the same date key for Korean and English readers', () => {
    expect(formatDateKey('2026-07-18', 'ko')).toBe('2026년 7월 18일');
    expect(formatDateKey('2026-07-18', 'en')).toBe('Jul 18, 2026');
    expect(formatDateKey('2026-07-18', 'ko', 'shortWithWeekday')).toBe('7월 18일 (토)');
    expect(formatDateKey('2026-07-18', 'en', 'shortWithWeekday')).toBe('Sat, Jul 18');
  });

  it('keeps malformed date keys visible instead of guessing', () => {
    expect(formatDateKey('2026-02-30', 'en')).toBe('2026-02-30');
    expect(formatMonthLabel(2026, 7, 'ko')).toBe('2026년 7월');
    expect(formatMonthLabel(2026, 7, 'en')).toBe('Jul 2026');
  });
});
