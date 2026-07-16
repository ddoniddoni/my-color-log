import { getKstDateKey, getKstMonthKey, getMillisecondsUntilNextKstMidnight, isFutureKstDate } from '@/src/utils/dates/kst';

describe('KST date utilities', () => {
  it('uses KST instead of the UTC date around midnight', () => {
    expect(getKstDateKey(new Date('2026-12-31T14:59:59.000Z'))).toBe('2026-12-31');
    expect(getKstDateKey(new Date('2026-12-31T15:00:00.000Z'))).toBe('2027-01-01');
  });

  it('handles a leap-year February date and month key', () => {
    const instant = new Date('2028-02-29T03:00:00.000Z');
    expect(getKstDateKey(instant)).toBe('2028-02-29');
    expect(getKstMonthKey(instant)).toBe('2028-02');
  });

  it('counts down to KST midnight without using the device timezone', () => {
    expect(getMillisecondsUntilNextKstMidnight(new Date('2026-07-16T14:59:59.000Z'))).toBe(1000);
    expect(getMillisecondsUntilNextKstMidnight(new Date('2026-07-16T15:00:01.000Z'))).toBe(86_399_000);
  });

  it('compares future dates against a KST date key', () => {
    const now = new Date('2026-07-16T16:00:00.000Z');
    expect(isFutureKstDate('2026-07-18', now)).toBe(true);
    expect(isFutureKstDate('2026-07-17', now)).toBe(false);
    expect(isFutureKstDate('not-a-date', now)).toBe(false);
  });
});
