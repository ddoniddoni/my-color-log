import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getRoom } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useRoom(userId: string | null, roomId: string | null) {
  const query = useQuery({
    enabled: userId !== null && roomId !== null,
    queryFn: () => getRoom(roomId ?? ''),
    queryKey: roomId ? queryKeys.room(userId ?? 'signed-out', roomId) : ['room', userId ?? 'signed-out', 'unselected'],
    staleTime: 30_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId && roomId) void refetch();
  }, [refetch, roomId, userId]));

  return query;
}
