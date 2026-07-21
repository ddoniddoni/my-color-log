export const DEFAULT_TIME_ZONE = 'Asia/Seoul';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_PARTS_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const TIME_ZONE_VALIDITY = new Map<string, boolean>();

type DateParts = {
  day: number;
  month: number;
  year: number;
};

export function normalizeTimeZone(value: string | null | undefined, fallback: string = DEFAULT_TIME_ZONE): string {
  const candidate = value?.trim();
  return candidate && isValidTimeZone(candidate) ? candidate : fallback;
}

export function isValidTimeZone(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length === 0) return false;
  const cached = TIME_ZONE_VALIDITY.get(candidate);
  if (cached !== undefined) return cached;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    TIME_ZONE_VALIDITY.set(candidate, true);
    return true;
  } catch {
    TIME_ZONE_VALIDITY.set(candidate, false);
    return false;
  }
}

export function getDateKeyInTimeZone(date: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
  const { day, month, year } = getDateParts(date, normalizeTimeZone(timeZone));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getMonthKeyInTimeZone(date: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
  const { month, year } = getDateParts(date, normalizeTimeZone(timeZone));
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getMillisecondsUntilNextMidnight(timeZone: string, now: Date = new Date()): number {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const currentDateKey = getDateKeyInTimeZone(now, normalizedTimeZone);
  const nowMs = now.getTime();
  let low = nowMs + 1;
  let high = nowMs + 48 * 60 * 60 * 1_000;

  if (getDateKeyInTimeZone(new Date(high), normalizedTimeZone) <= currentDateKey) {
    throw new Error('next_midnight_not_found');
  }

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (getDateKeyInTimeZone(new Date(middle), normalizedTimeZone) > currentDateKey) high = middle;
    else low = middle + 1;
  }

  return Math.max(0, low - nowMs);
}

export function isFutureDateInTimeZone(dateKey: string, timeZone: string, now: Date = new Date()): boolean {
  if (!DATE_KEY_PATTERN.test(dateKey)) return false;
  return dateKey > getDateKeyInTimeZone(now, timeZone);
}

export function getTimeZoneDisplayName(timeZone: string): string {
  return normalizeTimeZone(timeZone).replaceAll('_', ' ');
}

function getDateParts(date: Date, timeZone: string): DateParts {
  const formatter = getDatePartsFormatter(timeZone);
  const values = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const year = Number(values.get('year'));
  const month = Number(values.get('month'));
  const day = Number(values.get('day'));
  if (![year, month, day].every(Number.isFinite)) throw new Error('invalid_time_zone_date');
  return { day, month, year };
}

function getDatePartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = DATE_PARTS_FORMATTERS.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  });
  DATE_PARTS_FORMATTERS.set(timeZone, formatter);
  return formatter;
}
