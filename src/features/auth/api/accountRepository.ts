import { clearPendingGalleryImportContext } from '@/src/features/camera/api/galleryPhotoRepository';
import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { clearMissionRevealHistory } from '@/src/features/missions/api/revealRepository';
import { clearLocalNotificationData } from '@/src/features/notifications/api/localNotificationRepository';
import { clearStoredRoomPushToken } from '@/src/features/notifications/api/roomPushNotificationRepository';
import { getPhotoQueue, removeUserPhotoQueue } from '@/src/features/sync/queue/photoQueue';
import { getSupabaseClient } from '@/src/lib/supabase/client';

type DeletedAccountResponse = {
  deleted: true;
};

export async function deleteCurrentAccount(userId: string): Promise<void> {
  if (!userId) throw new Error('account_delete_failed');
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('delete-my-account', { method: 'POST' });
  if (error || !isDeletedAccountResponse(data)) throw new Error('account_delete_failed');

  await clearLocalAccountData(userId);
  await supabase.auth.signOut({ scope: 'local' });
}

async function clearLocalAccountData(userId: string): Promise<void> {
  await Promise.allSettled([
    clearLocalAccountPhotoData(userId),
    clearPendingGalleryImportContext(),
    clearStoredRoomPushToken(),
    clearLocalNotificationData(),
    clearMissionRevealHistory(),
  ]);
}

async function clearLocalAccountPhotoData(userId: string): Promise<void> {
  const queuedPhotos = await getPhotoQueue();
  const localUris: string[] = [];
  for (const photo of queuedPhotos) {
    if (photo.userId === userId) localUris.push(photo.localUri);
  }
  await Promise.allSettled(localUris.map(removeLocalPhotoFile));
  await removeUserPhotoQueue(userId);
}

function isDeletedAccountResponse(value: unknown): value is DeletedAccountResponse {
  return typeof value === 'object'
    && value !== null
    && 'deleted' in value
    && value.deleted === true;
}
