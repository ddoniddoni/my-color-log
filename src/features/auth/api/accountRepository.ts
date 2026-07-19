import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { getPhotoQueue, removeUserPhotoQueue } from '@/src/features/sync/queue/photoQueue';
import { supabase } from '@/src/lib/supabase/client';

type DeletedAccountResponse = {
  deleted: true;
};

export async function deleteCurrentAccount(userId: string): Promise<void> {
  if (!userId) throw new Error('account_delete_failed');

  const { data, error } = await supabase.functions.invoke('delete-my-account', { method: 'POST' });
  if (error || !isDeletedAccountResponse(data)) throw new Error('account_delete_failed');

  await clearLocalAccountPhotoData(userId);
  await supabase.auth.signOut({ scope: 'local' });
}

async function clearLocalAccountPhotoData(userId: string): Promise<void> {
  try {
    const queuedPhotos = await getPhotoQueue();
    const localUris: string[] = [];
    for (const photo of queuedPhotos) {
      if (photo.userId === userId) localUris.push(photo.localUri);
    }
    await Promise.all(localUris.map(removeLocalPhotoFile));
    await removeUserPhotoQueue(userId);
  } catch {
    // The remote account has already been deleted. A stale local cache is safe to clear on the next launch.
  }
}

function isDeletedAccountResponse(value: unknown): value is DeletedAccountResponse {
  return typeof value === 'object'
    && value !== null
    && 'deleted' in value
    && value.deleted === true;
}
