import {
  DEFAULT_TIME_ZONE,
  getDateKeyInTimeZone,
} from '@/src/utils/dates/timezone';

export function getKstDateKey(date: Date = new Date()): string {
  return getDateKeyInTimeZone(date, DEFAULT_TIME_ZONE);
}
