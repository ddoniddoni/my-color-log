import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { syncPendingPhoto } from '@/src/features/entries/api/entryRepository';
import { isPendingUpload, type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

type UsePhotoSyncInput = {
  userId: string | null;
  dateKey: string;
  photos: PendingPhoto[];
};

export function usePhotoSync({ userId, dateKey, photos }: UsePhotoSyncInput) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (photo: PendingPhoto) => {
      await updatePendingPhoto(photo.id, { status: 'uploading', lastErrorCode: null });
      try {
        const result = await syncPendingPhoto(photo);
        await updatePendingPhoto(photo.id, { entryId: result.entryId, status: 'synced', lastErrorCode: null });
      } catch (error) {
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
  const { isPending, mutate } = mutation;

  useEffect(() => {
    if (!userId || isPending) return;
    const nextPhoto = photos.find(isPendingUpload);
    if (nextPhoto) mutate(nextPhoto);
  }, [isPending, mutate, photos, userId]);

  const retryFailed = async (): Promise<void> => {
    const failedPhotos = photos.filter((photo) => photo.status === 'failed');
    await Promise.all(failedPhotos.map((photo) => updatePendingPhoto(photo.id, { status: 'pending', lastErrorCode: null })));
    if (userId) await queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) });
  };

  return { isSyncing: isPending, retryFailed };
}
