import { useQuery } from '@tanstack/react-query';

import { getMissionRevealPalette } from '@/src/features/missions/api/missionRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useMissionRevealPalette(dateKey: string, enabled: boolean) {
  return useQuery({ enabled, queryKey: queryKeys.missionRevealPalette(dateKey), queryFn: () => getMissionRevealPalette(dateKey) });
}
