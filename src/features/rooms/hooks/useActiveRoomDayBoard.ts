import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getActiveRoomDayBoard } from '@/src/features/rooms/api/roomRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useActiveRoomDayBoard(userId: string | null, dateKey: string | null) {
  const query = useQuery({
    enabled: userId !== null && dateKey !== null,
    queryFn: () => getActiveRoomDayBoard(dateKey ?? ''),
    queryKey: queryKeys.activeRoomHistoryBoard(userId ?? 'signed-out', dateKey ?? 'unselected'),
    staleTime: 20_000,
  });
  const { refetch } = query;

  useFocusEffect(useCallback(() => {
    if (userId && dateKey) void refetch();
  }, [dateKey, refetch, userId]));

  return query;
}
