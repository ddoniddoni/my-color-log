import { type DailyAccent } from '@/src/features/missions/model/dailyMission';

export type DiaryColor = DailyAccent & {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
};

export type DiaryPhoto = {
  id: string;
  storagePath: string;
  position: number;
  caption: string | null;
  capturedAt: string;
  width: number;
  height: number;
  byteSize: number;
  signedUrl: string | null;
};

export type DiaryEntry = {
  id: string;
  missionId: string;
  dateKey: string;
  note: string | null;
  color: DiaryColor;
  photos: DiaryPhoto[];
};

export function getDiaryEntryMemo(entry: DiaryEntry): string {
  return entry.note ?? entry.photos.find((photo) => photo.caption)?.caption ?? `${entry.color.nameKo}을 발견한 오늘의 장면이에요.`;
}

export function parseDiaryMonthRows(value: unknown, signedUrlByPath: Map<string, string>): DiaryEntry[] {
  if (!Array.isArray(value)) throw new Error('invalid_diary_month_response');

  const entriesById = new Map<string, DiaryEntry>();
  for (const item of value) {
    const row = parseEntryRow(item);
    const existing = entriesById.get(row.id);
    const entry = existing ?? {
      id: row.id,
      missionId: row.missionId,
      dateKey: row.dateKey,
      note: row.note,
      color: row.color,
      photos: [],
    };
    if (!existing) entriesById.set(entry.id, entry);
    if (row.photo) entry.photos.push({ ...row.photo, signedUrl: signedUrlByPath.get(row.photo.storagePath) ?? null });
  }

  return [...entriesById.values()];
}

type ParsedEntryRow = {
  id: string;
  missionId: string;
  dateKey: string;
  note: string | null;
  color: DiaryColor;
  photo: Omit<DiaryPhoto, 'signedUrl'> | null;
};

function parseEntryRow(value: unknown): ParsedEntryRow {
  if (!isRecord(value)) throw new Error('invalid_diary_month_response');
  return {
    id: readString(value, 'entry_id'),
    missionId: readString(value, 'mission_id'),
    dateKey: readString(value, 'date_key'),
    note: readNullableString(value, 'note'),
    color: {
      id: readString(value, 'color_id'),
      slug: readString(value, 'color_slug'),
      nameKo: readString(value, 'color_name_ko'),
      nameEn: readString(value, 'color_name_en'),
      accent: readString(value, 'color_hex'),
      accentTint: readString(value, 'color_tint_hex'),
      accentShade: readString(value, 'color_shade_hex'),
      onAccent: readString(value, 'color_on_color_hex'),
    },
    photo: parsePhoto(value),
  };
}

function parsePhoto(value: Record<string, unknown>): Omit<DiaryPhoto, 'signedUrl'> | null {
  if (value.photo_id === null) return null;
  if (!isPhotoPosition(value.photo_position) || !isPositiveNumber(value.width) || !isPositiveNumber(value.height) || !isPositiveNumber(value.byte_size)) {
    throw new Error('invalid_diary_month_response');
  }

  return {
    id: readString(value, 'photo_id'),
    storagePath: readString(value, 'storage_path'),
    position: value.photo_position,
    caption: readNullableString(value, 'photo_caption'),
    capturedAt: readString(value, 'captured_at'),
    width: value.width,
    height: value.height,
    byteSize: value.byte_size,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (!isString(field)) throw new Error('invalid_diary_month_response');
  return field;
}

function readNullableString(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  if (field === null) return null;
  if (!isString(field)) throw new Error('invalid_diary_month_response');
  return field;
}

function isPhotoPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
