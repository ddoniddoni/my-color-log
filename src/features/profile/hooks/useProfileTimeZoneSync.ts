import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { updateProfileTimeZone } from '@/src/features/profile/api/profileRepository';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { useDeviceTimeZone } from '@/src/lib/localization/deviceTimeZone';

export function useProfileTimeZoneSync(userId: string | null): string {
  const queryClient = useQueryClient();
  const profileQuery = useProfile(userId ?? undefined);
  const deviceTimeZone = useDeviceTimeZone();
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('profile_timezone_session_required');
      return updateProfileTimeZone(userId, deviceTimeZone);
    },
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile(profile.id), profile),
  });
  const updateTimeZone = updateMutation.mutate;

  useEffect(() => {
    const profile = profileQuery.data;
    if (!userId || !profile?.isOnboarded || profile.timezone === deviceTimeZone || updateMutation.isPending) return;
    updateTimeZone();
  }, [deviceTimeZone, profileQuery.data, updateMutation.isPending, updateTimeZone, userId]);

  return deviceTimeZone;
}
