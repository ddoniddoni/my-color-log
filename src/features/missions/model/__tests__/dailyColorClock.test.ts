import { getDailyColorClock } from '../dailyColorClock';

describe('daily color boundary', () => {
  it('advances the date and countdown together at the personal midnight', () => {
    const before = getDailyColorClock('Asia/Seoul', new Date('2026-10-18T14:59:59Z'));
    expect(before.midnightAt - before.now).toBe(1_000);
    const after = getDailyColorClock('Asia/Seoul', new Date('2026-10-18T15:00:00Z'), before);
    expect(after.dateKey).toBe('2026-10-19');
    expect(after.midnightAt - after.now).toBe(86_400_000);
    expect(after.isNewDay).toBe(true);
  });
  it('identifies a new day after several days in the background', () => {
    const before = getDailyColorClock('America/New_York', new Date('2026-10-18T22:00:00Z'));
    const after = getDailyColorClock('America/New_York', new Date('2026-10-21T05:00:00Z'), before);
    expect(after).toMatchObject({ dateKey: '2026-10-21', isNewDay: true });
  });
  it('uses the actual midnight on short and long DST days', () => {
    const spring = getDailyColorClock('America/New_York', new Date('2026-03-08T05:00:00Z'));
    const fall = getDailyColorClock('America/New_York', new Date('2026-11-01T04:00:00Z'));
    expect(spring.midnightAt - spring.now).toBe(23 * 3_600_000);
    expect(fall.midnightAt - fall.now).toBe(25 * 3_600_000);
  });
  it('does not announce a new day on first launch and recalculates after a timezone change', () => {
    const now = new Date('2026-10-18T18:00:00Z');
    const before = getDailyColorClock('Asia/Seoul', now);
    expect(before.isNewDay).toBe(false);
    const after = getDailyColorClock('America/Los_Angeles', now, before);
    expect(after.dateKey).toBe('2026-10-18');
    expect(after.midnightAt).not.toBe(before.midnightAt);
  });
});
