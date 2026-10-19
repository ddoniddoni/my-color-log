import { File } from 'expo-file-system';

import { type DailyEntry, type EntryPhoto, parseDailyEntry, parseEntryPhoto } from '@/src/features/entries/model/dailyEntry';
import { notifyRoomPhotoUploaded } from '@/src/features/notifications/api/roomPushNotificationRepository';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { getQueuedPhoto, updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { shareEntryToActiveRoom } from '@/src/features/rooms/api/roomRepository';
import { getSupabaseClient } from '@/src/lib/supabase/client';
import { ENTRY_PHOTO_BUCKET, getEntryPhotoSignedUrls } from '@/src/lib/supabase/entryPhotoUrls';

export async function getDailyEntry(userId: string, dateKey: string): Promise<DailyEntry | null> {
  const supabase = getSupabaseClient();
  const { data: entry, error: entryError } = await supabase
    .from('cl_daily_entries')
    .select('id, user_id, mission_id, date_key, note')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .maybeSingle();

  if (entryError) throw new Error('daily_entry_fetch_failed');
  if (!entry) return null;

  const { data: photoRows, error: photoError } = await supabase
    .from('cl_entry_photos')
    .select('id, entry_id, storage_path, position, caption, captured_at, width, height, byte_size')
    .eq('entry_id', entry.id)
    .order('position');

  if (photoError) throw new Error('entry_photos_fetch_failed');
  const paths = (photoRows ?? []).map((photo) => photo.storage_path);
  const signedUrlByPath = await getEntryPhotoSignedUrls(paths);
  const photos = (photoRows ?? []).map((photo) => parseEntryPhoto(photo, signedUrlByPath.get(photo.storage_path) ?? null));
  return parseDailyEntry(entry, photos);
}

type SyncPendingPhotoResult =
  | { entryId: string; wasCancelled: true }
  | { entryId: string; wasCancelled: false; photo: EntryPhoto; photos: EntryPhoto[] };

export async function syncPendingPhoto(photo: PendingPhoto): Promise<SyncPendingPhotoResult> {
  const supabase = getSupabaseClient();
  const localFile = new File(photo.localUri);

  const { data: entryRows, error: entryError } = await supabase.rpc('cl_get_or_create_daily_entry', {
    p_entry_id: photo.entryId,
    p_mission_id: photo.missionId,
    p_date_key: photo.dateKey,
  });
  if (entryError) throw new Error('daily_entry_create_failed');
  const entryId = readEntryId(entryRows);

  const remotePhotos = await getRemotePhotoMetadata(entryId);
  const existingPhoto = remotePhotos.find((item) => item.id === photo.id);
  if (existingPhoto) {
    const queued = await getQueuedPhoto(photo.id);
    if (!queued || queued.status === 'cancelled') {
      await cleanCancelledRemotePhoto(photo.id, photo.storagePath);
      return { entryId, wasCancelled: true };
    }
    // A prior upload may have committed before the app was terminated. Never
    // upsert stale captions/positions over edits made since that commit.
    await updatePendingPhoto(photo.id, { position: existingPhoto.position, caption: existingPhoto.caption, entryId });
    await shareEntryToActiveRoom(entryId);
    return { entryId, wasCancelled: false, photo: existingPhoto, photos: remotePhotos };
  }

  if (!localFile.exists) throw new Error('local_photo_missing');
  const bytes = await localFile.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from(ENTRY_PHOTO_BUCKET).upload(photo.storagePath, bytes, {
    cacheControl: '31536000',
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (uploadError) throw new Error('photo_upload_failed');

  const latestPhoto = await getQueuedPhoto(photo.id);
  if (!latestPhoto || latestPhoto.status === 'cancelled') {
    await cleanCancelledRemotePhoto(photo.id, photo.storagePath);
    return { entryId, wasCancelled: true };
  }

  const saved = await insertPendingPhoto(entryId, latestPhoto);
  if (!saved) {
    await cleanCancelledRemotePhoto(photo.id, latestPhoto.storagePath);
    return { entryId, wasCancelled: true };
  }
  const afterSavePhoto = await getQueuedPhoto(saved.photo.id);
  if (!afterSavePhoto || afterSavePhoto.status === 'cancelled') {
    await cleanCancelledRemotePhoto(photo.id, latestPhoto.storagePath);
    return { entryId, wasCancelled: true };
  }

  const wasSharedToRoom = await shareEntryToActiveRoom(entryId);
  if (wasSharedToRoom) {
    void notifyRoomPhotoUploaded(latestPhoto.id).catch(() => {
      // A push failure must never turn a safely synced photo back into a failed upload.
    });
  }
  return { entryId, wasCancelled: false, photo: saved.photo, photos: saved.photos };
}

async function getRemotePhotoMetadata(entryId: string): Promise<EntryPhoto[]> {
  const { data, error } = await getSupabaseClient().from('cl_entry_photos')
    .select('id, entry_id, storage_path, position, caption, captured_at, width, height, byte_size')
    .eq('entry_id', entryId).order('position');
  if (error) throw new Error('entry_photos_fetch_failed');
  return (data ?? []).map((row) => parseEntryPhoto(row, null));
}

async function insertPendingPhoto(entryId: string, photo: PendingPhoto): Promise<{ photo: EntryPhoto; photos: EntryPhoto[] } | undefined> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remote = await getRemotePhotoMetadata(entryId);
    const existing = remote.find((item) => item.id === photo.id);
    if (existing) {
      await updatePendingPhoto(photo.id, { position: existing.position, caption: existing.caption, entryId });
      return { photo: existing, photos: remote };
    }
    const occupied = new Set(remote.map((item) => item.position));
    const position = !occupied.has(photo.position) ? photo.position
      : Array.from({ length: 9 }, (_, index) => index + 1).find((slot) => !occupied.has(slot));
    if (!position) throw new Error('entry_photo_limit_reached');
    const latest = await getQueuedPhoto(photo.id);
    if (!latest || latest.status === 'cancelled') return;
    const { error } = await getSupabaseClient().from('cl_entry_photos').insert({
      id: latest.id, entry_id: entryId, owner_id: latest.userId,
      date_key: latest.dateKey, storage_path: latest.storagePath, position,
      caption: latest.caption, captured_at: latest.capturedAt,
      width: latest.width, height: latest.height, byte_size: latest.byteSize,
    });
    if (!error) {
      await updatePendingPhoto(photo.id, { position, entryId });
      const savedPhoto: EntryPhoto = { id: latest.id, entryId, storagePath: latest.storagePath, position, caption: latest.caption,
        capturedAt: latest.capturedAt, width: latest.width, height: latest.height, byteSize: latest.byteSize, signedUrl: null };
      return { photo: savedPhoto, photos: [...remote, savedPhoto].sort((a, b) => a.position - b.position) };
    }
    // A second device can claim the slot between SELECT and INSERT. The unique
    // constraint remains authoritative; reload and converge without overwriting.
    if (error.code !== '23505') throw new Error('entry_photo_save_failed');
  }
  throw new Error('entry_photo_position_conflict');
}

export async function deleteMyEntryPhotoRecord(photoId: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().rpc('cl_delete_my_entry_photo', { p_photo_id: photoId });
  if (error) throw new Error('entry_photo_delete_failed');
  return readDeletedStoragePath(data);
}

export async function removeEntryPhotoObject(storagePath: string): Promise<void> {
  const { error } = await getSupabaseClient().storage.from(ENTRY_PHOTO_BUCKET).remove([storagePath]);
  if (error) throw new Error('entry_photo_storage_delete_failed');
}

export async function reorderMyEntryPhotos(updates: readonly { photoId: string; position: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await getSupabaseClient().rpc('cl_reorder_my_entry_photos', {
    p_photo_ids: updates.map((update) => update.photoId),
    p_positions: updates.map((update) => update.position),
  });
  if (error) throw new Error('entry_photo_reorder_failed');
}

async function cleanCancelledRemotePhoto(photoId: string, fallbackStoragePath: string): Promise<void> {
  try {
    const storagePath = await deleteMyEntryPhotoRecord(photoId);
    await removeEntryPhotoObject(storagePath ?? fallbackStoragePath);
  } catch {
    // The cancelled queue record remains a tombstone, so a later explicit deletion
    // cannot accidentally revive this photo in the UI.
  }
}

function readEntryId(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) throw new Error('daily_entry_create_failed');
  const first: unknown = value[0];
  if (typeof first !== 'object' || first === null || !('id' in first) || typeof first.id !== 'string') {
    throw new Error('daily_entry_create_failed');
  }
  return first.id;
}

function readDeletedStoragePath(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first: unknown = value[0];
  if (typeof first !== 'object' || first === null || !('storage_path' in first) || typeof first.storage_path !== 'string') {
    throw new Error('entry_photo_delete_failed');
  }
  return first.storage_path;
}
