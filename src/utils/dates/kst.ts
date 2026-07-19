const KST_TIME_ZONE = 'Asia/Seoul';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZone: KST_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

type KstDateParts = { year: number; month: number; day: number };

export function getKstDateKey(date: Date = new Date()): string {
  const { year, month, day } = getKstDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getKstMonthKey(date: Date = new Date()): string {
  const { year, month } = getKstDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getMillisecondsUntilNextKstMidnight(now: Date = new Date()): number {
  const { year, month, day } = getKstDateParts(now);
  const nextKstMidnight = Date.UTC(year, month - 1, day + 1) - KST_OFFSET_MS;
  return Math.max(0, nextKstMidnight - now.getTime());
}

export function isFutureKstDate(dateKey: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  return dateKey > getKstDateKey(now);
}

function getKstDateParts(date: Date): KstDateParts {
  const parts = KST_PARTS_FORMATTER.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.get('year')), month: Number(values.get('month')), day: Number(values.get('day')) };
}
