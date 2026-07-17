export const DAILY_NOTE_MAX_LENGTH = 200;
export const PHOTO_CAPTION_MAX_LENGTH = 80;

export function normalizeDiaryNote(value: string): string | null {
  return normalizeOptionalText(value, DAILY_NOTE_MAX_LENGTH);
}

export function normalizeDiaryPhotoCaption(value: string): string | null {
  return normalizeOptionalText(value, PHOTO_CAPTION_MAX_LENGTH);
}

function normalizeOptionalText(value: string, maximumLength: number): string | null {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  return normalized.slice(0, maximumLength);
}
