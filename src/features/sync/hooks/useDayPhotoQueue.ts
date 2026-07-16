import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getDayPhotoQueue } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useDayPhotoQueue(userId: string | null, dateKey: string) {
  const query = useQuery({
    enabled: userId !== null,
    queryKey: queryKeys.pendingPhotos(userId ?? 'signed-out', dateKey),
    queryFn: () => {
      if (!userId) throw new Error('photo_queue_session_required');
      return getDayPhotoQueue(userId, dateKey);
    },
  });

  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (userId) void refetch();
  }, [refetch, userId]));

  return query;
}
