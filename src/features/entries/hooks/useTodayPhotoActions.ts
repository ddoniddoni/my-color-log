import { useMutation, useQueryClient } from '@tanstack/react-query';

import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { deleteMyEntryPhotoRecord, removeEntryPhotoObject, reorderMyEntryPhotos } from '@/src/features/entries/api/entryRepository';
import { getPhotoMoveUpdates, type PhotoMoveDirection, type PhotoPositionUpdate } from '@/src/features/entries/model/photoManagement';
import { type DailyEntry } from '@/src/features/entries/model/dailyEntry';
import { type TodayPhoto } from '@/src/features/entries/model/todayPhotos';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { cancelPendingPhoto, removePendingPhoto, restorePendingPhoto, updatePendingPhoto, updatePendingPhotoPositions } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

type UseTodayPhotoActionsInput = {
  dateKey: string;
  entry: DailyEntry | null | undefined;
  queuedPhotos: PendingPhoto[];
  userId: string | null;
};

type DeletePhotoResult = {
  storageCleanupPending: boolean;
};

export function useTodayPhotoActions({ dateKey, entry, queuedPhotos, userId }: UseTodayPhotoActionsInput) {
  const queryClient = useQueryClient();

  const invalidatePhotoViews = async (): Promise<void> => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyEntry(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomTodayBoards(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomHistories(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomHistoryBoards(userId) }),
    ]);
  };

  const deleteMutation = useMutation({
    mutationFn: async (photo: TodayPhoto): Promise<DeletePhotoResult> => {
      const queuedPhoto = queuedPhotos.find((item) => item.id === photo.id) ?? null;
      if (queuedPhoto && userId) {
        await cancelPendingPhoto(photo.id);
        queryClient.setQueryData<PendingPhoto[]>(queryKeys.pendingPhotos(userId, dateKey), (current) => (
          (current ?? []).map((item) => item.id === photo.id ? { ...item, status: 'cancelled', lastErrorCode: null } : item)
        ));
      }

      let deletedStoragePath: string | null;
      try {
        deletedStoragePath = await deleteMyEntryPhotoRecord(photo.id);
      } catch (error) {
        if (queuedPhoto && userId) {
          await restorePendingPhoto(queuedPhoto);
          queryClient.setQueryData<PendingPhoto[]>(queryKeys.pendingPhotos(userId, dateKey), (current) => (
            (current ?? []).map((item) => item.id === photo.id ? queuedPhoto : item)
          ));
        }
        throw error;
      }

      const storagePath = deletedStoragePath ?? photo.storagePath ?? queuedPhoto?.storagePath ?? null;
      let storageCleanupPending = false;
      if (storagePath) {
        try {
          await removeEntryPhotoObject(storagePath);
        } catch {
          storageCleanupPending = true;
        }
      }

      if (queuedPhoto) {
        if (storageCleanupPending) {
          await updatePendingPhoto(photo.id, { lastErrorCode: 'entry_photo_storage_delete_failed', status: 'cancelled' });
        } else {
          await removePendingPhoto(photo.id);
        }
        await removeLocalPhotoFile(queuedPhoto.localUri);
      }

      await invalidatePhotoViews();
      return { storageCleanupPending };
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ direction, photoId, photos }: { direction: PhotoMoveDirection; photoId: string; photos: TodayPhoto[] }): Promise<void> => {
      const updates = getPhotoMoveUpdates(photos, photoId, direction);
      if (!updates) return;

      const newPositionByPhotoId = new Map(updates.map((update) => [update.photoId, update.position]));
      const remoteUpdates = (entry?.photos ?? []).map((photo) => ({
        photoId: photo.id,
        position: newPositionByPhotoId.get(photo.id) ?? photo.position,
      }));

      if (remoteUpdates.length > 0) await reorderMyEntryPhotos(remoteUpdates);
      await updatePendingPhotoPositions(updates);
      updatePhotoPositionsInCache(updates);
      await invalidatePhotoViews();
    },
  });

  const updatePhotoPositionsInCache = (updates: PhotoPositionUpdate[]): void => {
    if (!userId) return;
    const newPositionByPhotoId = new Map(updates.map((update) => [update.photoId, update.position]));
    queryClient.setQueryData<DailyEntry | null>(queryKeys.dailyEntry(userId, dateKey), (current) => (
      current
        ? {
            ...current,
            photos: current.photos.map((photo) => ({
              ...photo,
              position: newPositionByPhotoId.get(photo.id) ?? photo.position,
            })),
          }
        : current
    ));
    queryClient.setQueryData<PendingPhoto[]>(queryKeys.pendingPhotos(userId, dateKey), (current) => (
      (current ?? []).map((photo) => ({
        ...photo,
        position: newPositionByPhotoId.get(photo.id) ?? photo.position,
      }))
    ));
  };

  return {
    deletePhoto: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    isMoving: moveMutation.isPending,
    movePhoto: moveMutation.mutateAsync,
  };
}
