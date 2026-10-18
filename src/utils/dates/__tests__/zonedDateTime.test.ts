import { addDateKeyDays, getZonedDateTime } from '../zonedDateTime';

describe('notification wall-clock dates', () => {
  it('does calendar arithmetic across leap days and year boundaries', () => {
    expect(addDateKeyDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDateKeyDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it.each([
    ['Asia/Seoul', '2026-10-19T11:00:00.000Z'],
    ['America/New_York', '2026-10-20T00:00:00.000Z'],
    ['Asia/Kathmandu', '2026-10-19T14:15:00.000Z'],
  ])('resolves 20:00 in %s independently of the device', (zone, expected) => {
    expect(getZonedDateTime('2026-10-19', 20, 0, zone)?.toISOString()).toBe(expected);
  });
  it('moves a nonexistent spring-forward time ahead by the gap', () => {
    expect(getZonedDateTime('2026-03-08', 2, 30, 'America/New_York')?.toISOString()).toBe('2026-03-08T07:30:00.000Z');
  });
  it('uses only the first occurrence of a repeated autumn time', () => {
    expect(getZonedDateTime('2026-11-01', 1, 30, 'America/New_York')?.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
  it('handles half-hour DST gaps and skips a removed calendar day', () => {
    expect(getZonedDateTime('2026-10-04', 2, 15, 'Australia/Lord_Howe')?.toISOString()).toBe('2026-10-03T15:45:00.000Z');
    expect(getZonedDateTime('2011-12-30', 20, 0, 'Pacific/Apia')).toBeNull();
  });
});
