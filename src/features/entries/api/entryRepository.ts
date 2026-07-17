import { File } from 'expo-file-system';

import { type DailyEntry, parseDailyEntry, parseEntryPhoto } from '@/src/features/entries/model/dailyEntry';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { getQueuedPhoto } from '@/src/features/sync/queue/photoQueue';
import { shareEntryToActiveRoom } from '@/src/features/rooms/api/roomRepository';
import { supabase } from '@/src/lib/supabase/client';
import { ENTRY_PHOTO_BUCKET, getEntryPhotoSignedUrls } from '@/src/lib/supabase/entryPhotoUrls';

export async function getDailyEntry(userId: string, dateKey: string): Promise<DailyEntry | null> {
  const { data: entry, error: entryError } = await supabase
    .from('daily_entries')
    .select('id, user_id, mission_id, date_key, note')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .maybeSingle();

  if (entryError) throw new Error('daily_entry_fetch_failed');
  if (!entry) return null;

  const { data: photoRows, error: photoError } = await supabase
    .from('entry_photos')
    .select('id, entry_id, storage_path, position, caption, captured_at, width, height, byte_size')
    .eq('entry_id', entry.id)
    .order('position');

  if (photoError) throw new Error('entry_photos_fetch_failed');
  const paths = (photoRows ?? []).map((photo) => photo.storage_path);
  const signedUrlByPath = await getEntryPhotoSignedUrls(paths);
  const photos = (photoRows ?? []).map((photo) => parseEntryPhoto(photo, signedUrlByPath.get(photo.storage_path) ?? null));
  return parseDailyEntry(entry, photos);
}

type SyncPendingPhotoResult = {
  entryId: string;
  wasCancelled: boolean;
};

export async function syncPendingPhoto(photo: PendingPhoto): Promise<SyncPendingPhotoResult> {
  const localFile = new File(photo.localUri);
  if (!localFile.exists) throw new Error('local_photo_missing');

  const { data: entryRows, error: entryError } = await supabase.rpc('get_or_create_daily_entry', {
    p_entry_id: photo.entryId,
    p_mission_id: photo.missionId,
    p_date_key: photo.dateKey,
  });
  if (entryError) throw new Error('daily_entry_create_failed');
  const entryId = readEntryId(entryRows);

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

  const { error: photoError } = await supabase.from('entry_photos').upsert({
    id: latestPhoto.id,
    entry_id: entryId,
    owner_id: latestPhoto.userId,
    date_key: latestPhoto.dateKey,
    storage_path: latestPhoto.storagePath,
    position: latestPhoto.position,
    caption: latestPhoto.caption,
    captured_at: latestPhoto.capturedAt,
    width: latestPhoto.width,
    height: latestPhoto.height,
    byte_size: latestPhoto.byteSize,
  }, { onConflict: 'id' });
  if (photoError) throw new Error('entry_photo_save_failed');

  const afterSavePhoto = await getQueuedPhoto(photo.id);
  if (!afterSavePhoto || afterSavePhoto.status === 'cancelled') {
    await cleanCancelledRemotePhoto(photo.id, latestPhoto.storagePath);
    return { entryId, wasCancelled: true };
  }

  await shareEntryToActiveRoom(entryId);
  return { entryId, wasCancelled: false };
}

export async function deleteMyEntryPhotoRecord(photoId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('delete_my_entry_photo', { p_photo_id: photoId });
  if (error) throw new Error('entry_photo_delete_failed');
  return readDeletedStoragePath(data);
}

export async function removeEntryPhotoObject(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(ENTRY_PHOTO_BUCKET).remove([storagePath]);
  if (error) throw new Error('entry_photo_storage_delete_failed');
}

export async function reorderMyEntryPhotos(updates: readonly { photoId: string; position: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase.rpc('reorder_my_entry_photos', {
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
