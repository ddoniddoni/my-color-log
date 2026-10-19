import { useQuery } from '@tanstack/react-query';

import { getMissionRevealPalette } from '@/src/features/missions/api/missionRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { useOfflineCacheReady } from '@/src/lib/query/OfflineQueryProvider';

export function useMissionRevealPalette(dateKey: string, enabled: boolean) {
  const cacheReady = useOfflineCacheReady();
  return useQuery({ enabled: enabled && cacheReady, queryKey: queryKeys.missionRevealPalette(dateKey), queryFn: () => getMissionRevealPalette(dateKey) });
}
