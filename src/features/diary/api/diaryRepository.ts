import { parseDiaryMonthRows, type DiaryEntry } from '@/src/features/diary/model/diaryMonth';
import { getSupabaseClient } from '@/src/lib/supabase/client';
import { getEntryPhotoSignedUrls } from '@/src/lib/supabase/entryPhotoUrls';

export async function getDiaryMonth(monthKey: string): Promise<DiaryEntry[]> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error('invalid_diary_month');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_diary_month', { p_month_start: `${monthKey}-01` });
  if (error || !Array.isArray(data)) throw new Error('diary_month_fetch_failed');

  const signedUrlByPath = await getEntryPhotoSignedUrls(getStoragePaths(data));
  return parseDiaryMonthRows(data, signedUrlByPath);
}

export async function updateDiaryEntryNote(entryId: string, note: string | null): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_entries')
    .update({ note })
    .eq('id', entryId)
    .select('id')
    .maybeSingle();

  if (error || !isUpdatedRow(data)) throw new Error('diary_note_update_failed');
}

export async function updateDiaryPhotoCaption(photoId: string, caption: string | null): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('entry_photos')
    .update({ caption })
    .eq('id', photoId)
    .select('id')
    .maybeSingle();

  if (error || !isUpdatedRow(data)) throw new Error('diary_photo_caption_update_failed');
}

function getStoragePaths(rows: unknown[]): string[] {
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null || !('storage_path' in row) || typeof row.storage_path !== 'string') return [];
    return [row.storage_path];
  });
}

function isUpdatedRow(value: unknown): value is { id: string } {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'string'
    && value.id.length > 0;
}
