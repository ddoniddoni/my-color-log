import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getRoomDayBoard } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useRoomDayBoard(userId: string | null, roomId: string | null, dateKey: string | null) {
  const query = useQuery({
    enabled: userId !== null && roomId !== null && dateKey !== null,
    queryFn: () => getRoomDayBoard(roomId ?? '', dateKey ?? ''),
    queryKey: roomId && dateKey ? queryKeys.roomHistoryBoard(userId ?? 'signed-out', roomId, dateKey) : ['roomHistoryBoard', userId ?? 'signed-out', roomId ?? 'unselected', dateKey ?? 'unselected'],
    staleTime: 20_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId && roomId && dateKey) void refetch();
  }, [dateKey, refetch, roomId, userId]));

  return query;
}
