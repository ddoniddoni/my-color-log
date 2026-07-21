import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { removeEntryPhotoObject, syncPendingPhoto } from '@/src/features/entries/api/entryRepository';
import {
  getNextCancelledPhoto,
  getNextPendingUpload,
  getRecoverableFailedPhotos,
  type PendingPhoto,
} from '@/src/features/sync/model/pendingPhoto';
import { useNetworkStatus } from '@/src/features/sync/hooks/useNetworkStatus';
import { useUserPhotoQueue } from '@/src/features/sync/hooks/useUserPhotoQueue';
import {
  getQueuedPhoto,
  markPendingPhotoSynced,
  removePendingPhoto,
  updatePendingPhoto,
} from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

type PhotoSyncOperation = {
  kind: 'cleanup' | 'upload';
  photo: PendingPhoto;
};

type PhotoSyncContextValue = {
  activeDateKey: string | null;
  retryFailed: (dateKey: string) => Promise<void>;
};

const PhotoSyncContext = createContext<PhotoSyncContextValue | null>(null);

export function PhotoSyncProvider({ children, userId }: PropsWithChildren<{ userId: string | null }>) {
  const queryClient = useQueryClient();
  const networkStatus = useNetworkStatus();
  const queueQuery = useUserPhotoQueue(userId);
  const photos = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const attemptedCancelledCleanupIds = useRef(new Set<string>());
  const attemptedFailureRecoveryIds = useRef(new Set<string>());
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);
  const previousNetworkStatus = useRef(networkStatus);
  const [recoveryCycle, setRecoveryCycle] = useState(0);

  const invalidatePhotoViews = useCallback(async (photoUserId: string, dateKeys: readonly string[]): Promise<void> => {
    const uniqueDateKeys = [...new Set(dateKeys)];
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.photoQueue(photoUserId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomHistories(photoUserId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomHistoryBoards(photoUserId) }),
      ...uniqueDateKeys.flatMap((dateKey) => [
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(photoUserId, dateKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyEntry(photoUserId, dateKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.diaryMonth(photoUserId, dateKey.slice(0, 7)) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roomTodayBoards(photoUserId, dateKey) }),
      ]),
    ]);
  }, [queryClient]);

  const operationMutation = useMutation({
    mutationFn: async (operation: PhotoSyncOperation): Promise<void> => {
      const { photo } = operation;
      if (operation.kind === 'cleanup') {
        if (photo.lastErrorCode === 'entry_photo_storage_delete_failed') {
          await removeEntryPhotoObject(photo.storagePath);
        }
        await removePendingPhoto(photo.id);
        await removeLocalPhotoFile(photo.localUri);
        return;
      }

      const latestPhoto = await getQueuedPhoto(photo.id);
      if (!latestPhoto || latestPhoto.status === 'cancelled' || latestPhoto.status === 'local_saved' || latestPhoto.status === 'synced') {
        return;
      }

      await updatePendingPhoto(photo.id, { status: 'uploading', lastErrorCode: null });
      try {
        const result = await syncPendingPhoto(latestPhoto);
        if (!result.wasCancelled) await markPendingPhotoSynced(photo.id, result.entryId);
      } catch (error) {
        const failedPhoto = await getQueuedPhoto(photo.id);
        if (!failedPhoto || failedPhoto.status === 'cancelled') return;

        const errorCode = error instanceof Error ? error.message : 'photo_sync_failed';
        await updatePendingPhoto(photo.id, {
          status: 'failed',
          retryCount: failedPhoto.retryCount + 1,
          lastErrorCode: errorCode,
        });
        throw error;
      }
    },
    onError: (_error, operation) => {
      if (operation.kind === 'upload') attemptedFailureRecoveryIds.current.add(operation.photo.id);
    },
    onSettled: async (_data, _error, operation) => {
      await invalidatePhotoViews(operation.photo.userId, [operation.photo.dateKey]);
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(2 ** attempt * 1_000, 30_000),
  });

  const { isPending: isOperationPending, mutate: runOperation } = operationMutation;

  useEffect(() => {
    if (!userId || isOperationPending || networkStatus === 'offline') return;

    const cancelledPhoto = getNextCancelledPhoto(photos, attemptedCancelledCleanupIds.current);
    if (cancelledPhoto) {
      attemptedCancelledCleanupIds.current.add(cancelledPhoto.id);
      runOperation({ kind: 'cleanup', photo: cancelledPhoto });
      return;
    }

    const pendingPhoto = getNextPendingUpload(photos);
    if (pendingPhoto) runOperation({ kind: 'upload', photo: pendingPhoto });
  }, [isOperationPending, networkStatus, photos, runOperation, userId]);

  useEffect(() => {
    if (!userId || networkStatus === 'offline') return;

    const failedPhotos = getRecoverableFailedPhotos(photos, attemptedFailureRecoveryIds.current);
    if (failedPhotos.length === 0) return;

    failedPhotos.forEach((photo) => attemptedFailureRecoveryIds.current.add(photo.id));
    void Promise.all(failedPhotos.map((photo) => updatePendingPhoto(photo.id, {
      status: 'pending',
      lastErrorCode: null,
    }))).then(() => invalidatePhotoViews(userId, failedPhotos.map((photo) => photo.dateKey)));
  }, [invalidatePhotoViews, networkStatus, photos, recoveryCycle, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const didReturnToForeground = previousAppState.current !== 'active' && nextAppState === 'active';
      previousAppState.current = nextAppState;
      if (!didReturnToForeground) return;

      attemptedCancelledCleanupIds.current.clear();
      attemptedFailureRecoveryIds.current.clear();
      setRecoveryCycle((current) => current + 1);
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.photoQueue(userId) });
    });

    return () => subscription.remove();
  }, [queryClient, userId]);

  useEffect(() => {
    const didReconnect = networkStatus === 'online' && previousNetworkStatus.current !== 'online';
    previousNetworkStatus.current = networkStatus;
    if (!didReconnect) return;

    attemptedCancelledCleanupIds.current.clear();
    attemptedFailureRecoveryIds.current.clear();
    setRecoveryCycle((current) => current + 1);
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.photoQueue(userId) });
  }, [networkStatus, queryClient, userId]);

  useEffect(() => {
    attemptedCancelledCleanupIds.current.clear();
    attemptedFailureRecoveryIds.current.clear();
  }, [userId]);

  const retryFailed = useCallback(async (dateKey: string): Promise<void> => {
    if (!userId) return;
    const failedPhotos = photos.filter((photo) => photo.dateKey === dateKey && photo.status === 'failed');
    if (failedPhotos.length === 0) return;

    await Promise.all(failedPhotos.map((photo) => updatePendingPhoto(photo.id, {
      status: 'pending',
      lastErrorCode: null,
    })));
    await invalidatePhotoViews(userId, [dateKey]);
  }, [invalidatePhotoViews, photos, userId]);

  const contextValue = useMemo<PhotoSyncContextValue>(() => ({
    activeDateKey: isOperationPending ? operationMutation.variables?.photo.dateKey ?? null : null,
    retryFailed,
  }), [isOperationPending, operationMutation.variables?.photo.dateKey, retryFailed]);

  return <PhotoSyncContext.Provider value={contextValue}>{children}</PhotoSyncContext.Provider>;
}

export function usePhotoSync(dateKey: string) {
  const context = useContext(PhotoSyncContext);
  if (!context) throw new Error('photo_sync_provider_missing');

  return {
    isSyncing: context.activeDateKey === dateKey,
    retryFailed: () => context.retryFailed(dateKey),
  };
}
