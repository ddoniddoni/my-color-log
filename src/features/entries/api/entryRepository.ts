import { File } from 'expo-file-system';

import { type DailyEntry, parseDailyEntry, parseEntryPhoto } from '@/src/features/entries/model/dailyEntry';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { supabase } from '@/src/lib/supabase/client';

const ENTRY_PHOTO_BUCKET = 'entry-photos';

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
  const signedUrlByPath = await getSignedUrls(paths);
  const photos = (photoRows ?? []).map((photo) => parseEntryPhoto(photo, signedUrlByPath.get(photo.storage_path) ?? null));
  return parseDailyEntry(entry, photos);
}

export async function syncPendingPhoto(photo: PendingPhoto): Promise<{ entryId: string }> {
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

  const { error: photoError } = await supabase.from('entry_photos').upsert({
    id: photo.id,
    entry_id: entryId,
    owner_id: photo.userId,
    date_key: photo.dateKey,
    storage_path: photo.storagePath,
    position: photo.position,
    caption: photo.caption,
    captured_at: photo.capturedAt,
    width: photo.width,
    height: photo.height,
    byte_size: photo.byteSize,
  }, { onConflict: 'id' });
  if (photoError) throw new Error('entry_photo_save_failed');
  return { entryId };
}

async function getSignedUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(ENTRY_PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw new Error('photo_urls_create_failed');
  return new Map(data.flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
}

function readEntryId(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) throw new Error('daily_entry_create_failed');
  const first: unknown = value[0];
  if (typeof first !== 'object' || first === null || !('id' in first) || typeof first.id !== 'string') {
    throw new Error('daily_entry_create_failed');
  }
  return first.id;
}
