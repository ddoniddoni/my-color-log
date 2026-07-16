const DAYS_PER_WEEK = 7;

export type MonthCursor = { month: number; year: number };
export type CalendarCell = { day: number | null; key: string };

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
