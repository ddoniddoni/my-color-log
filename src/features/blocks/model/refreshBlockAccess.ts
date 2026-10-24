import { type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/src/lib/query/queryKeys';

// Discard potentially private snapshots, including inactive rooms and historical dates.
// Abort-aware query functions prevent a pre-block response from repopulating the cache.
// Personal diary, local upload queues and room membership are deliberately outside this scope.
export async function refreshBlockAccess(client: QueryClient, userId: string): Promise<void> {
  const keys = [queryKeys.allRoomTodayBoards(userId), queryKeys.roomHistoryBoards(userId),
    queryKeys.roomHistories(userId), queryKeys.allRoomPhotoReactions(userId), queryKeys.blockedUsers(userId)];
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })));
  for (const queryKey of keys) void client.resetQueries({ queryKey });
}
