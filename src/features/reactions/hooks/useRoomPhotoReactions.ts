import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { getRoomPhotoReactions, toggleRoomPhotoReaction } from '@/src/features/reactions/api/roomPhotoReactionRepository';
import { type RoomPhotoReactionEmoji } from '@/src/features/reactions/model/roomPhotoReaction';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { supabase } from '@/src/lib/supabase/client';

export function useRoomPhotoReactions({ photoId, roomId, userId }: { photoId: string | null; roomId: string | null; userId: string | null }) {
  const queryClient = useQueryClient();
  const queryKey = photoId && roomId
    ? queryKeys.roomPhotoReactions(userId ?? 'signed-out', roomId, photoId)
    : ['roomPhotoReactions', userId ?? 'signed-out', roomId ?? 'unselected', photoId ?? 'unselected'] as const;
  const query = useQuery({
    enabled: userId !== null && roomId !== null && photoId !== null,
    queryFn: () => getRoomPhotoReactions(roomId ?? '', photoId ?? ''),
    queryKey,
    staleTime: 15_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId && roomId && photoId) void refetch();
  }, [photoId, refetch, roomId, userId]));

  useEffect(() => {
    if (!userId || !roomId || !photoId) return undefined;

    const channel = supabase
      .channel(`room-photo-reactions:${roomId}:${photoId}`)
      .on('postgres_changes', {
        event: '*',
        filter: `photo_id=eq.${photoId}`,
        schema: 'public',
        table: 'room_photo_reactions',
      }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.roomPhotoReactions(userId, roomId, photoId) });
      })
      .subscribe();

    const unsubscribe = (): void => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
    return unsubscribe;
  }, [photoId, queryClient, roomId, userId]);

  const mutation = useMutation({
    mutationFn: (emoji: RoomPhotoReactionEmoji) => toggleRoomPhotoReaction(roomId ?? '', photoId ?? '', emoji),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return { ...query, isSaving: mutation.isPending, toggle: mutation.mutateAsync };
}
