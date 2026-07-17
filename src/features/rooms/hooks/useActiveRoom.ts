import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getActiveRoom } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useActiveRoom(userId: string | null) {
  const query = useQuery({
    enabled: userId !== null,
    queryFn: getActiveRoom,
    queryKey: userId ? queryKeys.activeRoom(userId) : ['activeRoom', 'unauthenticated'],
    staleTime: 30_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId) void refetch();
  }, [refetch, userId]));

  return query;
}
