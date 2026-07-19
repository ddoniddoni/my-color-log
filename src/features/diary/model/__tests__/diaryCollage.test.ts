import { getDiaryCollageFilename, getDiaryCollageRowCounts } from '@/src/features/diary/model/diaryCollage';

describe('diary collage layout', () => {
  it('always uses a three-by-three grid and leaves empty cells for photos not yet taken', () => {
    expect(getDiaryCollageRowCounts(1)).toEqual([3, 3, 3]);
    expect(getDiaryCollageRowCounts(3)).toEqual([3, 3, 3]);
    expect(getDiaryCollageRowCounts(5)).toEqual([3, 3, 3]);
    expect(getDiaryCollageRowCounts(9)).toEqual([3, 3, 3]);

    for (let count = 1; count <= 9; count += 1) {
      expect(getDiaryCollageRowCounts(count).reduce((total, rowCount) => total + rowCount, 0)).toBe(9);
    }
  });

  it('rejects photo counts outside a daily record range', () => {
    expect(() => getDiaryCollageRowCounts(0)).toThrow('invalid_diary_collage_photo_count');
    expect(() => getDiaryCollageRowCounts(10)).toThrow('invalid_diary_collage_photo_count');
  });

  it('creates a safe, identifiable file name', () => {
    expect(getDiaryCollageFilename('2026-07-18', 'Leaf Green')).toBe('color-log-2026-07-18-leaf-green');
    expect(getDiaryCollageFilename('2026-07-18', '  ')).toBe('color-log-2026-07-18-today-color');
    expect(() => getDiaryCollageFilename('07-18-2026', 'leaf-green')).toThrow('invalid_diary_collage_date');
  });
});
