import { getCalendarCells, getSelectedDiaryDateKey, moveMonth, moveYear } from '@/src/features/diary/model/calendar';

describe('diary calendar model', () => {
  it('pads a month into complete Sunday-first calendar rows', () => {
    const cells = getCalendarCells(2026, 7);

    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 3).every((cell) => cell.day === null)).toBe(true);
    expect(cells[3]?.day).toBe(1);
    expect(cells[33]?.day).toBe(31);
    expect(cells[34]?.day).toBeNull();
  });

  it('moves across the December and January year boundary', () => {
    expect(moveMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(moveMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('moves the year selector without exceeding supported calendar years', () => {
    expect(moveYear(2026, -1)).toBe(2025);
    expect(moveYear(1, -1)).toBe(1);
    expect(moveYear(9_999, 1)).toBe(9_999);
  });

  it('keeps today selected in the current month even when the latest entry is older', () => {
    const entries = [{ dateKey: '2026-07-18' }];

    expect(getSelectedDiaryDateKey({ entries, isCurrentMonth: true, selectedDateKey: null, todayKey: '2026-07-20' })).toBe('2026-07-20');
    expect(getSelectedDiaryDateKey({ entries, isCurrentMonth: false, selectedDateKey: null, todayKey: '2026-07-20' })).toBe('2026-07-18');
    expect(getSelectedDiaryDateKey({ entries, isCurrentMonth: true, selectedDateKey: '2026-07-17', todayKey: '2026-07-20' })).toBe('2026-07-17');
  });
});
