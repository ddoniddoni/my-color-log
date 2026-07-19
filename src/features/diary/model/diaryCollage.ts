export const DIARY_COLLAGE_MAX_PHOTOS = 9;
export const DIARY_COLLAGE_GRID_SIZE = 3;

const COLLAGE_ROW_COUNTS = [DIARY_COLLAGE_GRID_SIZE, DIARY_COLLAGE_GRID_SIZE, DIARY_COLLAGE_GRID_SIZE] as const;

export function getDiaryCollageRowCounts(photoCount: number): readonly number[] {
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > DIARY_COLLAGE_MAX_PHOTOS) {
    throw new Error('invalid_diary_collage_photo_count');
  }

  return COLLAGE_ROW_COUNTS;
}

export function getDiaryCollageFilename(dateKey: string, colorSlug: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('invalid_diary_collage_date');

  const normalizedSlug = colorSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'today-color';

  return `color-log-${dateKey}-${normalizedSlug}`;
}
