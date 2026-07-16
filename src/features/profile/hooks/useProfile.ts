import { useQuery } from '@tanstack/react-query';

import { getProfile } from '@/src/features/profile/api/profileRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useProfile(userId: string | undefined) {
  return useQuery({ queryKey: queryKeys.profile(userId ?? 'missing'), queryFn: () => getProfile(userId ?? ''), enabled: Boolean(userId) });
}
