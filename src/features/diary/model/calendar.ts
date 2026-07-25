const DAYS_PER_WEEK = 7;

export type MonthCursor = { month: number; year: number };
export type CalendarCell = { day: number | null; key: string };

type DatedDiaryEntry = { dateKey: string };

export function getCalendarCells(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const numberOfDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingCells = Array.from({ length: firstWeekday }, (_, index) => ({ day: null, key: `leading-${year}-${month}-${index}` }));
  const days = Array.from({ length: numberOfDays }, (_, index) => ({ day: index + 1, key: `day-${year}-${month}-${index + 1}` }));
  const trailingCellCount = (DAYS_PER_WEEK - ((leadingCells.length + days.length) % DAYS_PER_WEEK)) % DAYS_PER_WEEK;
  const trailingCells = Array.from({ length: trailingCellCount }, (_, index) => ({ day: null, key: `trailing-${year}-${month}-${index}` }));
  return [...leadingCells, ...days, ...trailingCells];
}

export function moveMonth(cursor: MonthCursor, offset: number): MonthCursor {
  const moved = new Date(Date.UTC(cursor.year, cursor.month - 1 + offset, 1));
  return { month: moved.getUTCMonth() + 1, year: moved.getUTCFullYear() };
}

export function moveYear(year: number, offset: number): number {
  return Math.min(9_999, Math.max(1, year + offset));
}

export function getSelectedDiaryDateKey({ entries, isCurrentMonth, selectedDateKey, todayKey }: {
  entries: readonly DatedDiaryEntry[];
  isCurrentMonth: boolean;
  selectedDateKey: string | null;
  todayKey: string;
}): string | null {
  if (selectedDateKey) return selectedDateKey;
  if (isCurrentMonth) return todayKey;
  return entries[0]?.dateKey ?? null;
}
