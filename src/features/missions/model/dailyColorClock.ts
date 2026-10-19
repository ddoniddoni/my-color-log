import { getDateKeyInTimeZone, getMillisecondsUntilNextMidnight, normalizeTimeZone } from '@/src/utils/dates/timezone';

export type DailyColorClock = {
  dateKey: string;
  timeZone: string;
  now: number;
  midnightAt: number;
  isNewDay: boolean;
};

export function getDailyColorClock(timeZone: string, now: Date, previous?: DailyColorClock): DailyColorClock {
  const zone = normalizeTimeZone(timeZone);
  const dateKey = getDateKeyInTimeZone(now, zone);
  const sameDay = previous?.dateKey === dateKey && previous.timeZone === zone;
  return {
    dateKey,
    timeZone: zone,
    now: now.getTime(),
    midnightAt: sameDay ? previous.midnightAt : now.getTime() + getMillisecondsUntilNextMidnight(zone, now),
    isNewDay: sameDay ? previous.isNewDay : previous !== undefined && previous.dateKey !== dateKey,
  };
}
