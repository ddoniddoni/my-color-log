import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hasRevealedMission, markMissionRevealed } from '@/src/features/missions/api/revealRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useMissionReveal(dateKey: string) {
  const queryClient = useQueryClient();
  const revealQuery = useQuery({ queryKey: queryKeys.missionReveal(dateKey), queryFn: () => hasRevealedMission(dateKey) });
  const revealMutation = useMutation({
    mutationFn: () => markMissionRevealed(dateKey),
    onSuccess: () => queryClient.setQueryData(queryKeys.missionReveal(dateKey), true),
  });
  return { isRevealed: revealQuery.data ?? false, isLoading: revealQuery.isPending, isError: revealQuery.isError, reveal: revealMutation.mutateAsync };
}
