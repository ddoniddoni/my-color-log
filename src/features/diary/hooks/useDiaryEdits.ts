import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateDiaryEntryNote, updateDiaryPhotoCaption } from '@/src/features/diary/api/diaryRepository';
import { removeDiaryPhoto, type DiaryEntry, type DiaryPhoto } from '@/src/features/diary/model/diaryMonth';
import { normalizeDiaryNote, normalizeDiaryPhotoCaption } from '@/src/features/diary/model/diaryEdits';
import { deleteMyEntryPhotoRecord, removeEntryPhotoObject } from '@/src/features/entries/api/entryRepository';
import { type DailyEntry } from '@/src/features/entries/model/dailyEntry';
import { removeEntryPhoto } from '@/src/features/entries/model/removeEntryPhoto';
import { cancelPendingPhoto, getQueuedPhoto, restorePendingPhoto, updatePendingPhoto, PHOTO_SYNC_MUTATION_SCOPE } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

type UseDiaryEditsInput = {
  monthKey: string;
  userId: string | null;
};

type NoteUpdateInput = {
  dateKey: string;
  entryId: string;
  value: string;
};

type CaptionUpdateInput = {
  dateKey: string;
  entryId: string;
  photoId: string;
  value: string;
};

type DeletePhotoInput = {
  dateKey: string;
  entryId: string;
  photo: DiaryPhoto;
};

type DeletePhotoResult = {
  storageCleanupPending: boolean;
  willRetryStorageCleanup: boolean;
};

export function useDiaryEdits({ monthKey, userId }: UseDiaryEditsInput) {
  const queryClient = useQueryClient();

  const updateSharedPhotoCaches = async (dateKey: string): Promise<void> => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyEntry(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingPhotos(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.photoQueue(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomTodayBoards(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomHistories(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roomHistoryBoards(userId) }),
    ]);
  };

  const noteMutation = useMutation({
    mutationFn: async ({ entryId, value }: NoteUpdateInput): Promise<string | null> => {
      const note = normalizeDiaryNote(value);
      await updateDiaryEntryNote(entryId, note);
      return note;
    },
    onSuccess: async (note, { entryId, dateKey }) => {
      if (!userId) return;
      updateDiaryEntryInCache(queryClient, userId, monthKey, entryId, (entry) => ({ ...entry, note }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.dailyEntry(userId, dateKey) });
    },
  });

  const captionMutation = useMutation({
    mutationFn: async ({ photoId, value }: CaptionUpdateInput): Promise<string | null> => {
      const caption = normalizeDiaryPhotoCaption(value);
      await updateDiaryPhotoCaption(photoId, caption);
      try {
        await updatePendingPhoto(photoId, { caption });
      } catch {
        // The server record is authoritative. A stale local upload queue must not
        // turn a successful caption edit into a user-visible failure.
      }
      return caption;
    },
    onSuccess: async (caption, { dateKey, entryId, photoId }) => {
      if (!userId) return;
      updateDiaryEntryInCache(queryClient, userId, monthKey, entryId, (entry) => ({
        ...entry,
        photos: entry.photos.map((photo) => photo.id === photoId ? { ...photo, caption } : photo),
      }));
      await updateSharedPhotoCaches(dateKey);
    },
  });

  const deleteMutation = useMutation({
    scope: PHOTO_SYNC_MUTATION_SCOPE,
    mutationFn: async ({ photo, dateKey }: DeletePhotoInput): Promise<DeletePhotoResult> => {
      const queuedPhoto = await getQueuedPhoto(photo.id);
      if (queuedPhoto) await cancelPendingPhoto(photo.id);
      let deletedStoragePath: string | null;
      try {
        deletedStoragePath = await deleteMyEntryPhotoRecord(photo.id);
      } catch (error) {
        if (queuedPhoto) await restorePendingPhoto(queuedPhoto);
        throw error;
      }
      if (userId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.dailyEntry(userId, dateKey) });
        queryClient.setQueryData<DailyEntry | null>(queryKeys.dailyEntry(userId, dateKey), (current) => removeEntryPhoto(current, photo.id));
      }
      let storageCleanupPending = false;
      try {
        await removeEntryPhotoObject(deletedStoragePath ?? photo.storagePath);
      } catch {
        storageCleanupPending = true;
      }

      if (queuedPhoto) {
        await updatePendingPhoto(photo.id, { lastErrorCode: storageCleanupPending ? 'entry_photo_storage_delete_failed' : null, status: 'cancelled' });
      }

      return { storageCleanupPending, willRetryStorageCleanup: storageCleanupPending && queuedPhoto !== null };
    },
    onSuccess: async (_result, { dateKey, entryId, photo }) => {
      if (!userId) return;
      updateDiaryEntryInCache(queryClient, userId, monthKey, entryId, (entry) => removeDiaryPhoto(entry, photo.id));
      await updateSharedPhotoCaches(dateKey);
    },
  });

  return {
    deletePhoto: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    isSaving: noteMutation.isPending || captionMutation.isPending,
    updateCaption: captionMutation.mutateAsync,
    updateNote: noteMutation.mutateAsync,
  };
}

function updateDiaryEntryInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  monthKey: string,
  entryId: string,
  update: (entry: DiaryEntry) => DiaryEntry,
): void {
  queryClient.setQueryData<DiaryEntry[]>(queryKeys.diaryMonth(userId, monthKey), (current) => (
    (current ?? []).map((entry) => entry.id === entryId ? update(entry) : entry)
  ));
}
