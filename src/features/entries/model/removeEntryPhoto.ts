import { type DailyEntry } from '@/src/features/entries/model/dailyEntry';

// Mirrors the server's confirmed delete/compaction without waiting for a
// refetch, which may fail if the connection drops immediately after deletion.
export function removeEntryPhoto(entry: DailyEntry | null | undefined, photoId: string): DailyEntry | null | undefined {
  const removed = entry?.photos.find((photo) => photo.id === photoId);
  if (!entry || !removed) return entry;
  return {
    ...entry,
    photos: entry.photos.filter((photo) => photo.id !== photoId).map((photo) => ({
      ...photo, position: photo.position > removed.position ? photo.position - 1 : photo.position,
    })),
  };
}
