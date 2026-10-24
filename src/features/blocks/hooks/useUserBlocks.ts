import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getBlockedUsers, setUserBlock } from '@/src/features/blocks/api/userBlockRepository';
import { refreshBlockAccess } from '@/src/features/blocks/model/refreshBlockAccess';
import { getUserBlockErrorMessage, type UserBlockTarget } from '@/src/features/blocks/model/userBlock';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useBlockedUsers(userId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.blockedUsers(userId ?? 'signed-out'),
    queryFn: ({ signal }) => getBlockedUsers(signal),
    enabled: enabled && userId !== null,
    staleTime: 0,
    refetchInterval: enabled ? 15_000 : false,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (enabled && userId) void refetch();
  }, [enabled, refetch, userId]));
  return query;
}

export function useUserBlockAction(userId: string | null, onSaved?: () => void) {
  const client = useQueryClient();
  const submitting = useRef(false);
  const [target, setTarget] = useState<UserBlockTarget | null>(null);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = (): void => { if (!submitting.current) { setTarget(null); setError(null); } };
  const open = (value: UserBlockTarget): void => { if (!submitting.current) { setError(null); setTarget(value); } };
  const submit = async (): Promise<void> => {
    if (submitting.current || !target || !userId) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await setUserBlock(target.id, target.shouldBlock);
      await refreshBlockAccess(client, userId);
      setTarget(null);
      onSaved?.();
    } catch (error) {
      setError(getUserBlockErrorMessage(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return { target, open, close, submit, isPending, error };
}
export type UserBlockController = ReturnType<typeof useUserBlockAction>;
