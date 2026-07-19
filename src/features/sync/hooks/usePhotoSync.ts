import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { removeEntryPhotoObject, syncPendingPhoto } from '@/src/features/entries/api/entryRepository';
import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { isPendingUpload, type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { getQueuedPhoto, markPendingPhotoSynced, removePendingPhoto, updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

type UsePhotoSyncInput = {
  userId: string | null;
  dateKey: string;
  photos: PendingPhoto[];
};

export function usePhotoSync({ userId, dateKey, photos }: UsePhotoSyncInput) {
  const queryClient = useQueryClient();
  const attemptedCancelledCleanupIds = useRef(new Set<string>());
  const mutation = useMutation({
    mutationFn: async (photo: PendingPhoto) => {
      await updatePendingPhoto(photo.id, { status: 'uploading', lastErrorCode: null });
      try {
        const result = await syncPendingPhoto(photo);
        if (!result.wasCancelled) await markPendingPhotoSynced(photo.id, result.entryId);
      } catch (error) {
        const latestPhoto = await getQueuedPhoto(photo.id);
        if (latestPhoto?.status === 'cancelled') return;
        const errorCode = error instanceof Error ? error.message : 'photo_sync_failed';
        await updatePendingPhoto(photo.id, { status: 'failed', retryCount: photo.retryCount + 1, lastErrorCode: errorCode });
        throw error;
      }
    },
    onSettled: async () => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyEntry(userId, dateKey) }),
      ]);
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(2 ** attempt * 1_000, 30_000),
  });
  const cancelledCleanupMutation = useMutation({
    mutationFn: async (photo: PendingPhoto): Promise<void> => {
      if (photo.lastErrorCode === 'entry_photo_storage_delete_failed') {
        await removeEntryPhotoObject(photo.storagePath);
      }
      await removePendingPhoto(photo.id);
      await removeLocalPhotoFile(photo.localUri);
    },
    onSettled: async () => {
      if (!userId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) });
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(2 ** attempt * 1_000, 30_000),
  });
  const { isPending, mutate } = mutation;
  const { isPending: isCancelledCleanupPending, mutate: cleanCancelledPhoto } = cancelledCleanupMutation;

  useEffect(() => {
    if (!userId || isPending) return;
    const nextPhoto = photos.find(isPendingUpload);
    if (nextPhoto) mutate(nextPhoto);
  }, [isPending, mutate, photos, userId]);

  useEffect(() => {
    if (!userId || isPending || isCancelledCleanupPending) return;
    const cancelledPhoto = photos.find((photo) => (
      photo.status === 'cancelled' && !attemptedCancelledCleanupIds.current.has(photo.id)
    ));
    if (!cancelledPhoto) return;
    attemptedCancelledCleanupIds.current.add(cancelledPhoto.id);
    cleanCancelledPhoto(cancelledPhoto);
  }, [cleanCancelledPhoto, isCancelledCleanupPending, isPending, photos, userId]);

  const retryFailed = async (): Promise<void> => {
    const failedPhotos = photos.filter((photo) => photo.status === 'failed');
    await Promise.all(failedPhotos.map((photo) => updatePendingPhoto(photo.id, { status: 'pending', lastErrorCode: null })));
    if (userId) await queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) });
  };

  return { isSyncing: isPending || isCancelledCleanupPending, retryFailed };
}
