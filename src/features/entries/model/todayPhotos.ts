import { type DailyEntry } from '@/src/features/entries/model/dailyEntry';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

export type TodayPhoto = {
  id: string;
  uri: string | null;
  localUri: string | null;
  storagePath: string | null;
  position: number;
  capturedAt: string;
  caption: string | null;
  status: 'pending' | 'synced' | 'syncing' | 'failed';
  colorIsolationApplied?: true;
};

export function mergeTodayPhotos(entry: DailyEntry | null | undefined, queuedPhotos: PendingPhoto[]): TodayPhoto[] {
  const byId = new Map<string, TodayPhoto>();
  const localById = new Map(queuedPhotos.map((photo) => [photo.id, photo]));
  const cancelledPhotoIds = new Set<string>();
  for (const photo of queuedPhotos) {
    if (photo.status === 'cancelled') cancelledPhotoIds.add(photo.id);
  }
  for (const photo of entry?.photos ?? []) {
    if (cancelledPhotoIds.has(photo.id)) continue;
    const localUri = localById.get(photo.id)?.localUri ?? null;
    byId.set(photo.id, {
      id: photo.id,
      uri: localUri ?? photo.signedUrl,
      localUri,
      storagePath: photo.storagePath,
      position: photo.position,
      capturedAt: photo.capturedAt,
      caption: photo.caption,
      status: 'synced',
      ...(localById.get(photo.id)?.colorIsolationApplied ? { colorIsolationApplied: true as const } : {}),
    });
  }
  for (const photo of queuedPhotos) {
    if (photo.status === 'cancelled' || photo.status === 'local_saved' || byId.has(photo.id)) continue;
    // A confirmed server snapshot owns membership, order and captions. Synced
    // local files are image caches, never evidence that a deleted row still exists.
    if (photo.status === 'synced' && entry !== undefined) continue;
    const occupied = new Set([...byId.values()].map((item) => item.position));
    let position = photo.position;
    if (occupied.has(position)) {
      position = 1;
      while (occupied.has(position)) position += 1;
    }
    byId.set(photo.id, {
      id: photo.id,
      uri: photo.localUri,
      localUri: photo.localUri,
      storagePath: photo.storagePath,
      position,
      capturedAt: photo.capturedAt,
      caption: photo.caption,
      ...(photo.colorIsolationApplied ? { colorIsolationApplied: true as const } : {}),
      status: photo.status === 'failed'
        ? 'failed'
        : photo.status === 'synced'
          ? 'synced'
          : photo.status === 'uploading'
            ? 'syncing'
            : 'pending',
    });
  }
  return [...byId.values()].sort((left, right) => left.position - right.position);
}

export function getNextPhotoPosition(photos: TodayPhoto[]): number | null {
  if (photos.length >= 9) return null;
  const occupied = new Set(photos.map((photo) => photo.position));
  for (let position = 1; position <= 9; position += 1) {
    if (!occupied.has(position)) return position;
  }
  return null;
}
