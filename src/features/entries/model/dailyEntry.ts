export type EntryPhoto = {
  id: string;
  entryId: string;
  storagePath: string;
  position: number;
  caption: string | null;
  capturedAt: string;
  width: number;
  height: number;
  byteSize: number;
  signedUrl: string | null;
};

export type DailyEntry = {
  id: string;
  userId: string;
  missionId: string;
  dateKey: string;
  note: string | null;
  photos: EntryPhoto[];
};

export function parseDailyEntry(value: unknown, photos: EntryPhoto[]): DailyEntry {
  if (!isRecord(value)) throw new Error('invalid_daily_entry_response');
  if (!isString(value.id) || !isString(value.user_id) || !isString(value.mission_id) || !isString(value.date_key)) {
    throw new Error('invalid_daily_entry_response');
  }
  if (value.note !== null && typeof value.note !== 'string') throw new Error('invalid_daily_entry_response');
  return { id: value.id, userId: value.user_id, missionId: value.mission_id, dateKey: value.date_key, note: value.note, photos };
}

export function parseEntryPhoto(value: unknown, signedUrl: string | null): EntryPhoto {
  if (!isRecord(value)) throw new Error('invalid_entry_photo_response');
  if (!isString(value.id) || !isString(value.entry_id) || !isString(value.storage_path)) throw new Error('invalid_entry_photo_response');
  if (!isPositiveInteger(value.position) || !isString(value.captured_at)) throw new Error('invalid_entry_photo_response');
  if (!isPositiveNumber(value.width) || !isPositiveNumber(value.height) || !isPositiveNumber(value.byte_size)) throw new Error('invalid_entry_photo_response');
  if (value.caption !== null && typeof value.caption !== 'string') throw new Error('invalid_entry_photo_response');
  return {
    id: value.id,
    entryId: value.entry_id,
    storagePath: value.storage_path,
    position: value.position,
    caption: value.caption,
    capturedAt: value.captured_at,
    width: value.width,
    height: value.height,
    byteSize: value.byte_size,
    signedUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
