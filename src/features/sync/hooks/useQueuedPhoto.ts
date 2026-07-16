import { useQuery } from '@tanstack/react-query';

import { getQueuedPhoto } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useQueuedPhoto(photoId: string) {
  return useQuery({
    queryKey: queryKeys.queuedPhoto(photoId),
    queryFn: () => getQueuedPhoto(photoId),
  });
}
