import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getActiveRoomTodayBoard } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useActiveRoomTodayBoard(userId: string | null, dateKey: string) {
  const query = useQuery({
    enabled: userId !== null,
    queryFn: getActiveRoomTodayBoard,
    queryKey: queryKeys.activeRoomTodayBoard(userId ?? 'signed-out', dateKey),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId) void refetch();
  }, [refetch, userId]));

  return query;
}
