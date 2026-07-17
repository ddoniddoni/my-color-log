import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateProfileNickname } from '@/src/features/profile/api/profileRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useUpdateProfileNickname(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nickname: string) => updateProfileNickname(userId, nickname),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.profile(userId), profile);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rooms(userId) }),
        queryClient.invalidateQueries({ queryKey: ['roomTodayBoard', userId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roomHistories(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roomHistoryBoards(userId) }),
      ]);
    },
  });
}
