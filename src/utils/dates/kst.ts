import {
  DEFAULT_TIME_ZONE,
  getDateKeyInTimeZone,
  getMillisecondsUntilNextMidnight,
  getMonthKeyInTimeZone,
  isFutureDateInTimeZone,
} from '@/src/utils/dates/timezone';

export function getKstDateKey(date: Date = new Date()): string {
  return getDateKeyInTimeZone(date, DEFAULT_TIME_ZONE);
}

export function getKstMonthKey(date: Date = new Date()): string {
  return getMonthKeyInTimeZone(date, DEFAULT_TIME_ZONE);
}

export function getMillisecondsUntilNextKstMidnight(now: Date = new Date()): number {
  return getMillisecondsUntilNextMidnight(DEFAULT_TIME_ZONE, now);
}

export function isFutureKstDate(dateKey: string, now: Date = new Date()): boolean {
  return isFutureDateInTimeZone(dateKey, DEFAULT_TIME_ZONE, now);
}
