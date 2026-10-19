import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { hasRevealedMission, markMissionRevealed } from '@/src/features/missions/api/revealRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useMissionReveal(userId: string | null, dateKey: string) {
  const queryClient = useQueryClient();
  const [presentedKey, setPresentedKey] = useState<string | null>(null);
  const currentKey = `${userId}:${dateKey}`;
  const revealQuery = useQuery({
    queryKey: queryKeys.missionReveal(userId ?? 'signed-out', dateKey),
    enabled: userId !== null,
    networkMode: 'always',
    queryFn: () => hasRevealedMission(userId ?? '', dateKey),
  });
  const revealMutation = useMutation({
    networkMode: 'always',
    mutationFn: (target: { userId: string; dateKey: string }) => markMissionRevealed(target.userId, target.dateKey),
    onSuccess: (_, target) => queryClient.setQueryData(queryKeys.missionReveal(target.userId, target.dateKey), true),
  });
  return {
    isPresenting: !revealQuery.data || presentedKey === currentKey,
    isLoading: revealQuery.isPending,
    isError: revealQuery.isError,
    retry: revealQuery.refetch,
    begin: () => setPresentedKey(currentKey),
    dismiss: () => setPresentedKey(null),
    reveal: () => userId ? revealMutation.mutateAsync({ userId, dateKey }) : Promise.reject(new Error('reveal_session_required')),
  };
}
