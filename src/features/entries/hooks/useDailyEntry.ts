import { useQuery } from '@tanstack/react-query';

import { getDailyEntry } from '@/src/features/entries/api/entryRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { useOfflineCacheReady } from '@/src/lib/query/OfflineQueryProvider';

export function useDailyEntry(userId: string | null, dateKey: string) {
  const cacheReady = useOfflineCacheReady();
  return useQuery({
    enabled: userId !== null && cacheReady,
    queryKey: queryKeys.dailyEntry(userId ?? 'signed-out', dateKey),
    queryFn: () => {
      if (!userId) throw new Error('daily_entry_session_required');
      return getDailyEntry(userId, dateKey);
    },
  });
}
