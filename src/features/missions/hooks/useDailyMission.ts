import { useQuery } from '@tanstack/react-query';

import { getDailyMission } from '@/src/features/missions/api/missionRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useDailyMission(dateKey: string) {
  return useQuery({ queryKey: queryKeys.dailyMission(dateKey), queryFn: () => getDailyMission(dateKey) });
}
