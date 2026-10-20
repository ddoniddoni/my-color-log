import { getKstDateKey } from '@/src/utils/dates/kst';
import { getMillisecondsUntilNextMidnight, getMonthKeyInTimeZone, isFutureDateInTimeZone } from '@/src/utils/dates/timezone';

describe('KST date utilities', () => {
  it('uses KST instead of the UTC date around midnight', () => {
    expect(getKstDateKey(new Date('2026-12-31T14:59:59.000Z'))).toBe('2026-12-31');
    expect(getKstDateKey(new Date('2026-12-31T15:00:00.000Z'))).toBe('2027-01-01');
  });

  it('handles a leap-year February date and month key', () => {
    const instant = new Date('2028-02-29T03:00:00.000Z');
    expect(getKstDateKey(instant)).toBe('2028-02-29');
    expect(getMonthKeyInTimeZone(instant, 'Asia/Seoul')).toBe('2028-02');
  });

  it('counts down to KST midnight without using the device timezone', () => {
    expect(getMillisecondsUntilNextMidnight('Asia/Seoul', new Date('2026-07-16T14:59:59.000Z'))).toBe(1000);
    expect(getMillisecondsUntilNextMidnight('Asia/Seoul', new Date('2026-07-16T15:00:01.000Z'))).toBe(86_399_000);
  });

  it('compares future dates against a KST date key', () => {
    const now = new Date('2026-07-16T16:00:00.000Z');
    expect(isFutureDateInTimeZone('2026-07-18', 'Asia/Seoul', now)).toBe(true);
    expect(isFutureDateInTimeZone('2026-07-17', 'Asia/Seoul', now)).toBe(false);
    expect(isFutureDateInTimeZone('not-a-date', 'Asia/Seoul', now)).toBe(false);
  });
});
