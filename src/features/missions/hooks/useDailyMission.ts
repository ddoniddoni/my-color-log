import { useQuery } from '@tanstack/react-query';

import { getDailyMission } from '@/src/features/missions/api/missionRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { useOfflineCacheReady } from '@/src/lib/query/OfflineQueryProvider';

export function useDailyMission(dateKey: string) {
  const cacheReady = useOfflineCacheReady();
  return useQuery({ enabled: cacheReady, queryKey: queryKeys.dailyMission(dateKey), queryFn: () => getDailyMission(dateKey) });
}
