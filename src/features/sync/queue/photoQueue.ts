import AsyncStorage from '@react-native-async-storage/async-storage';

import { type PendingPhoto, parsePendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const PHOTO_QUEUE_STORAGE_KEY = '@mycolorlog/photo-upload-queue/v1';

let writeChain: Promise<void> = Promise.resolve();

export async function getPhotoQueue(): Promise<PendingPhoto[]> {
  const rawValue = await AsyncStorage.getItem(PHOTO_QUEUE_STORAGE_KEY);
  if (!rawValue) return [];

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parsePendingPhoto).filter((photo): photo is PendingPhoto => photo !== null);
  } catch {
    return [];
  }
}

export async function getDayPhotoQueue(userId: string, dateKey: string): Promise<PendingPhoto[]> {
  const queue = await getPhotoQueue();
  return queue
    .filter((photo) => photo.userId === userId && photo.dateKey === dateKey && photo.status !== 'local_saved')
    .sort((left, right) => left.position - right.position);
}

export async function getQueuedPhoto(photoId: string): Promise<PendingPhoto | null> {
  const queue = await getPhotoQueue();
  return queue.find((photo) => photo.id === photoId) ?? null;
}

export function addPendingPhoto(photo: PendingPhoto): Promise<void> {
  return mutateQueue((queue) => [...queue.filter((item) => item.id !== photo.id), photo]);
}

export function updatePendingPhoto(photoId: string, update: Partial<Pick<PendingPhoto, 'caption' | 'entryId' | 'position' | 'status' | 'retryCount' | 'lastErrorCode'>>): Promise<void> {
  return mutateQueue((queue) => queue.map((photo) => photo.id === photoId ? { ...photo, ...update } : photo));
}

export function markPendingPhotoSynced(photoId: string, entryId: string): Promise<void> {
  return mutateQueue((queue) => queue.map((photo) => (
    photo.id === photoId && photo.status !== 'cancelled'
      ? { ...photo, entryId, status: 'synced', lastErrorCode: null }
      : photo
  )));
}

export function cancelPendingPhoto(photoId: string): Promise<void> {
  return updatePendingPhoto(photoId, { status: 'cancelled', lastErrorCode: null });
}

export function restorePendingPhoto(photo: PendingPhoto): Promise<void> {
  return mutateQueue((queue) => queue.map((item) => item.id === photo.id ? photo : item));
}

export function removePendingPhoto(photoId: string): Promise<void> {
  return mutateQueue((queue) => queue.filter((photo) => photo.id !== photoId));
}

export function removeUserPhotoQueue(userId: string): Promise<void> {
  return mutateQueue((queue) => queue.filter((photo) => photo.userId !== userId));
}

export function updatePendingPhotoPositions(updates: readonly { photoId: string; position: number }[]): Promise<void> {
  const positionByPhotoId = new Map(updates.map((update) => [update.photoId, update.position]));
  return mutateQueue((queue) => queue.map((photo) => {
    const position = positionByPhotoId.get(photo.id);
    return position ? { ...photo, position } : photo;
  }));
}

function mutateQueue(update: (queue: PendingPhoto[]) => PendingPhoto[]): Promise<void> {
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const queue = await getPhotoQueue();
      await AsyncStorage.setItem(PHOTO_QUEUE_STORAGE_KEY, JSON.stringify(update(queue)));
    });
  return writeChain;
}
