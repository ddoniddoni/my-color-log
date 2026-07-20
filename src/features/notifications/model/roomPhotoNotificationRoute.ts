export type RoomPhotoNotificationRoute = {
  dateKey: string;
  photoId: string;
  roomId: string;
};

export function parseRoomPhotoNotificationRoute(value: unknown): RoomPhotoNotificationRoute | null {
  if (!isRecord(value) || value.destination !== 'room') return null;
  if (!isUuid(value.roomId) || !isUuid(value.photoId) || !isDateKey(value.dateKey)) return null;
  return { dateKey: value.dateKey, photoId: value.photoId, roomId: value.roomId };
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
