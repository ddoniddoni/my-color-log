import {
  getDateKeyInTimeZone,
  getMillisecondsUntilNextMidnight,
  getMonthKeyInTimeZone,
  isFutureDateInTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
} from '@/src/utils/dates/timezone';

describe('IANA timezone date utilities', () => {
  it('creates different local date keys for the same UTC instant', () => {
    const instant = new Date('2026-07-22T02:30:00.000Z');
    expect(getDateKeyInTimeZone(instant, 'Asia/Seoul')).toBe('2026-07-22');
    expect(getDateKeyInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-07-21');
    expect(getMonthKeyInTimeZone(instant, 'Pacific/Auckland')).toBe('2026-07');
  });

  it('finds the next midnight across a 23-hour daylight-saving day', () => {
    const beforeSpringForward = new Date('2026-03-08T05:00:00.000Z');
    expect(getMillisecondsUntilNextMidnight('America/New_York', beforeSpringForward)).toBe(23 * 60 * 60 * 1_000);
  });

  it('finds the next midnight across a 25-hour daylight-saving day', () => {
    const beforeFallBack = new Date('2026-11-01T04:00:00.000Z');
    expect(getMillisecondsUntilNextMidnight('America/New_York', beforeFallBack)).toBe(25 * 60 * 60 * 1_000);
  });

  it('compares future dates using the selected timezone', () => {
    const instant = new Date('2026-07-22T02:30:00.000Z');
    expect(isFutureDateInTimeZone('2026-07-22', 'America/Los_Angeles', instant)).toBe(true);
    expect(isFutureDateInTimeZone('2026-07-22', 'Asia/Seoul', instant)).toBe(false);
  });

  it('validates IANA names and safely falls back', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('Not/A_Zone')).toBe(false);
    expect(normalizeTimeZone('Not/A_Zone')).toBe('Asia/Seoul');
  });
});
