import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getActiveRoomHistory } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useActiveRoomHistory(userId: string | null) {
  const query = useQuery({
    enabled: userId !== null,
    queryFn: getActiveRoomHistory,
    queryKey: queryKeys.activeRoomHistory(userId ?? 'signed-out'),
    staleTime: 30_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId) void refetch();
  }, [refetch, userId]));

  return query;
}
