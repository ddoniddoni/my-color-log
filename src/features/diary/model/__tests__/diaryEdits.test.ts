import { normalizeDiaryNote, normalizeDiaryPhotoCaption } from '@/src/features/diary/model/diaryEdits';

describe('diary edit normalization', () => {
  it('stores blank notes and captions as null', () => {
    expect(normalizeDiaryNote('  \n ')).toBeNull();
    expect(normalizeDiaryPhotoCaption('  ')).toBeNull();
  });

  it('trims and limits notes to their database-safe lengths', () => {
    expect(normalizeDiaryNote('  오늘의 메모  ')).toBe('오늘의 메모');
    expect(normalizeDiaryNote('a'.repeat(205))).toHaveLength(200);
    expect(normalizeDiaryPhotoCaption('b'.repeat(85))).toHaveLength(80);
  });
});
