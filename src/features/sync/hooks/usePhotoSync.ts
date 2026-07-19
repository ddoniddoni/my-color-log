import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { removeEntryPhotoObject, syncPendingPhoto } from '@/src/features/entries/api/entryRepository';
import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { isPendingUpload, type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { getQueuedPhoto, markPendingPhotoSynced, removePendingPhoto, updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { useNetworkStatus } from '@/src/features/sync/hooks/useNetworkStatus';
import { queryKeys } from '@/src/lib/query/queryKeys';

type UsePhotoSyncInput = {
  userId: string | null;
  dateKey: string;
  photos: PendingPhoto[];
};

export function usePhotoSync({ userId, dateKey, photos }: UsePhotoSyncInput) {
  const queryClient = useQueryClient();
  const networkStatus = useNetworkStatus();
  const attemptedCancelledCleanupIds = useRef(new Set<string>());
  const lastNetworkStatus = useRef(networkStatus);
  const recoveredFailureIdsByCycle = useRef(new Map<number, Set<string>>());
  const [reconnectCycle, setReconnectCycle] = useState(0);
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
    if (!userId || isPending || networkStatus === 'offline') return;
    const nextPhoto = photos.find(isPendingUpload);
    if (nextPhoto) mutate(nextPhoto);
  }, [isPending, mutate, networkStatus, photos, userId]);

  useEffect(() => {
    if (!userId || isPending || isCancelledCleanupPending || networkStatus === 'offline') return;
    const cancelledPhoto = photos.find((photo) => (
      photo.status === 'cancelled' && !attemptedCancelledCleanupIds.current.has(photo.id)
    ));
    if (!cancelledPhoto) return;
    attemptedCancelledCleanupIds.current.add(cancelledPhoto.id);
    cleanCancelledPhoto(cancelledPhoto);
  }, [cleanCancelledPhoto, isCancelledCleanupPending, isPending, networkStatus, photos, userId]);

  useEffect(() => {
    if (networkStatus !== 'online') {
      lastNetworkStatus.current = networkStatus;
      return;
    }
    if (lastNetworkStatus.current === 'online') return;

    lastNetworkStatus.current = 'online';
    setReconnectCycle((current) => current + 1);
  }, [networkStatus]);

  useEffect(() => {
    if (!userId || networkStatus !== 'online' || reconnectCycle === 0) return;

    const recoveredFailureIds = recoveredFailureIdsByCycle.current.get(reconnectCycle) ?? new Set<string>();
    const failedPhotoIds: string[] = [];
    for (const photo of photos) {
      if (photo.status !== 'failed' || recoveredFailureIds.has(photo.id)) continue;
      failedPhotoIds.push(photo.id);
    }
    if (failedPhotoIds.length === 0) return;

    failedPhotoIds.forEach((photoId) => recoveredFailureIds.add(photoId));
    recoveredFailureIdsByCycle.current.set(reconnectCycle, recoveredFailureIds);
    void Promise.all(failedPhotoIds.map((photoId) => updatePendingPhoto(photoId, { status: 'pending', lastErrorCode: null })))
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) });
      });
  }, [dateKey, networkStatus, photos, queryClient, reconnectCycle, userId]);

  const retryFailed = async (): Promise<void> => {
    const failedPhotos = photos.filter((photo) => photo.status === 'failed');
    await Promise.all(failedPhotos.map((photo) => updatePendingPhoto(photo.id, { status: 'pending', lastErrorCode: null })));
    if (userId) await queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) });
  };

  return { isSyncing: isPending || isCancelledCleanupPending, retryFailed };
}
