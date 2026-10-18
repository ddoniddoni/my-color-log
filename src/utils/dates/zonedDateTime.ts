import { normalizeTimeZone } from './timezone';

const formatters = new Map<string, Intl.DateTimeFormat>();
const DAY_MS = 86_400_000;

// Calendar arithmetic on a date key, independent of the device zone.
export function addDateKeyDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Repeated DST times use the first occurrence; missing times move forward by
// the gap. Entire skipped days are omitted to avoid duplicate reminders.
export function getZonedDateTime(dateKey: string, hour: number, minute: number, timeZone: string): Date | null {
  const zone = normalizeTimeZone(timeZone);
  const [year, month, day] = dateKey.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set([-2, -1, 0, 1, 2].map((days) => {
    const timestamp = wall + days * DAY_MS;
    return wallTimestamp(timestamp, zone) - timestamp;
  }));
  const candidates = [...offsets].map((offset) => wall - offset).sort((a, b) => a - b);
  const exact = candidates.find((candidate) => wallTimestamp(candidate, zone) === wall);
  if (exact !== undefined) return new Date(exact);
  const next = candidates.find((candidate) => {
    const local = wallTimestamp(candidate, zone);
    return local > wall && Math.floor(local / DAY_MS) === Math.floor(wall / DAY_MS);
  });
  return next === undefined ? null : new Date(next);
}

function wallTimestamp(timestamp: number, zone: string): number {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(zone, formatter);
  }
  const parts = new Map(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.get('year')), Number(parts.get('month')) - 1, Number(parts.get('day')), Number(parts.get('hour')), Number(parts.get('minute')));
}
