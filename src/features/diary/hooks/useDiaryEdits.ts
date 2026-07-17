import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateDiaryEntryNote, updateDiaryPhotoCaption } from '@/src/features/diary/api/diaryRepository';
import { type DiaryEntry } from '@/src/features/diary/model/diaryMonth';
import { normalizeDiaryNote, normalizeDiaryPhotoCaption } from '@/src/features/diary/model/diaryEdits';
import { updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
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

export function useDiaryEdits({ monthKey, userId }: UseDiaryEditsInput) {
  const queryClient = useQueryClient();

  const updateSharedPhotoCaches = async (dateKey: string): Promise<void> => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyEntry(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomTodayBoard(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomHistory(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomHistoryBoard(userId, dateKey) }),
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

  return {
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
