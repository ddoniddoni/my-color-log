import { useQuery } from '@tanstack/react-query';

import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { getProfile } from '@/src/features/profile/api/profileRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useProfile(userId: string | undefined) {
  const sessionState = useSessionBootstrap();
  const session = sessionState.status === 'ready' ? sessionState.session : null;
  const accessToken = session && session.user.id === userId
    ? session.access_token
    : undefined;

  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'missing'),
    queryFn: () => getProfile(userId ?? '', accessToken),
    enabled: Boolean(userId),
  });
}
