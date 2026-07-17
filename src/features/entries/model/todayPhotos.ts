import { type DailyEntry } from '@/src/features/entries/model/dailyEntry';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

export type TodayPhoto = {
  id: string;
  uri: string;
  localUri: string | null;
  storagePath: string | null;
  position: number;
  capturedAt: string;
  caption: string | null;
  status: 'synced' | 'syncing' | 'failed';
};

export function mergeTodayPhotos(entry: DailyEntry | null | undefined, queuedPhotos: PendingPhoto[]): TodayPhoto[] {
  const byId = new Map<string, TodayPhoto>();
  const cancelledPhotoIds = new Set<string>();
  for (const photo of queuedPhotos) {
    if (photo.status === 'cancelled') cancelledPhotoIds.add(photo.id);
  }
  for (const photo of entry?.photos ?? []) {
    if (cancelledPhotoIds.has(photo.id)) continue;
    if (!photo.signedUrl) continue;
    byId.set(photo.id, {
      id: photo.id,
      uri: photo.signedUrl,
      localUri: null,
      storagePath: photo.storagePath,
      position: photo.position,
      capturedAt: photo.capturedAt,
      caption: photo.caption,
      status: 'synced',
    });
  }
  for (const photo of queuedPhotos) {
    if (photo.status === 'cancelled') continue;
    byId.set(photo.id, {
      id: photo.id,
      uri: photo.localUri,
      localUri: photo.localUri,
      storagePath: photo.storagePath,
      position: photo.position,
      capturedAt: photo.capturedAt,
      caption: photo.caption,
      status: photo.status === 'failed' ? 'failed' : photo.status === 'synced' ? 'synced' : 'syncing',
    });
  }
  return [...byId.values()].sort((left, right) => left.position - right.position);
}

export function getNextPhotoPosition(photos: TodayPhoto[]): number | null {
  const occupied = new Set(photos.map((photo) => photo.position));
  for (let position = 1; position <= 9; position += 1) {
    if (!occupied.has(position)) return position;
  }
  return null;
}

export function getTodayPhotoSlots(photos: TodayPhoto[]): (TodayPhoto | null)[] {
  const photoByPosition = new Map(photos.map((photo) => [photo.position, photo]));
  return Array.from({ length: 9 }, (_, index) => photoByPosition.get(index + 1) ?? null);
}
