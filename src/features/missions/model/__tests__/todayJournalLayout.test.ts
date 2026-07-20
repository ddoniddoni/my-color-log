import { getTodayJournalLayout } from '@/src/features/missions/model/todayJournalLayout';

describe('today journal layout', () => {
  it('keeps the full 3×3 board within a compact screen height', () => {
    expect(getTodayJournalLayout({ contentHeight: 420, contentWidth: 320 })).toEqual({
      horizontalPadding: 16,
      isCompact: true,
      mosaicSize: 196,
    });
  });

  it('uses available width without making the standard screen scroll', () => {
    expect(getTodayJournalLayout({ contentHeight: 700, contentWidth: 390 })).toEqual({
      horizontalPadding: 20,
      isCompact: false,
      mosaicSize: 350,
    });
  });

  it('never returns a negative board size', () => {
    expect(getTodayJournalLayout({ contentHeight: 100, contentWidth: 320 }).mosaicSize).toBe(0);
  });
});
