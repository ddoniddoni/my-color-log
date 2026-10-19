import { useQuery } from '@tanstack/react-query';

import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { getQueuedPhoto } from '@/src/features/sync/queue/photoQueue';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useQueuedPhoto(photoId: string) {
  const session = useSessionBootstrap();
  const userId = session.status === 'ready' ? session.session?.user.id : undefined;
  return useQuery({
    enabled: Boolean(userId),
    networkMode: 'always',
    queryKey: queryKeys.queuedPhoto(photoId),
    queryFn: async () => {
      const photo = await getQueuedPhoto(photoId);
      return photo?.userId === userId ? photo : null;
    },
  });
}
