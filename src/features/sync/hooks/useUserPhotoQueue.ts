import { useQuery } from '@tanstack/react-query';

import { getUserPhotoQueue } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useUserPhotoQueue(userId: string | null) {
  return useQuery({
    enabled: userId !== null,
    queryKey: queryKeys.photoQueue(userId ?? 'signed-out'),
    queryFn: () => {
      if (!userId) throw new Error('photo_queue_session_required');
      return getUserPhotoQueue(userId);
    },
  });
}
