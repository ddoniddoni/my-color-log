import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getRoomTodayBoard } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { supabase } from '@/src/lib/supabase/client';

export function useRoomTodayBoard(userId: string | null, dateKey: string, roomId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: userId !== null && roomId !== null,
    queryFn: () => getRoomTodayBoard(roomId ?? ''),
    queryKey: roomId ? queryKeys.roomTodayBoard(userId ?? 'signed-out', roomId, dateKey) : ['roomTodayBoard', userId ?? 'signed-out', dateKey, 'unselected'],
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (!userId || !roomId) return;

    void refetch();
    const channel = supabase
      .channel(`active-room-board:${roomId}:${dateKey}`)
      .on('postgres_changes', {
        event: '*',
        filter: `room_id=eq.${roomId}`,
        schema: 'public',
        table: 'entry_room_shares',
      }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.roomTodayBoard(userId, roomId, dateKey) });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dateKey, queryClient, refetch, roomId, userId]));

  return query;
}
