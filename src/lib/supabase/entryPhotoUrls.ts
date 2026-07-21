import { getSupabaseClient } from '@/src/lib/supabase/client';

const ENTRY_PHOTO_BUCKET = 'entry-photos';
const ENTRY_PHOTO_URL_TTL_SECONDS = 60 * 60;

export async function getEntryPhotoSignedUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const { data, error } = await getSupabaseClient().storage
    .from(ENTRY_PHOTO_BUCKET)
    .createSignedUrls(paths, ENTRY_PHOTO_URL_TTL_SECONDS);
  if (error) throw new Error('photo_urls_create_failed');

  return new Map(data.flatMap((item) => (
    item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []
  )));
}

export { ENTRY_PHOTO_BUCKET };
