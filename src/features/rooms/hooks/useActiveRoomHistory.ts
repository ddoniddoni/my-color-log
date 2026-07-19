import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getRoomHistory } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useRoomHistory(userId: string | null, roomId: string | null) {
  const query = useQuery({
    enabled: userId !== null && roomId !== null,
    queryFn: () => getRoomHistory(roomId ?? ''),
    queryKey: roomId ? queryKeys.roomHistory(userId ?? 'signed-out', roomId) : ['roomHistory', userId ?? 'signed-out', 'unselected'],
    staleTime: 30_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId && roomId) void refetch();
  }, [refetch, roomId, userId]));

  return query;
}
