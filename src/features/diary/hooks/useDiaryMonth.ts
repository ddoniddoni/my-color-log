import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { getDiaryMonth } from '@/src/features/diary/api/diaryRepository';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useDiaryMonth(userId: string | null, monthKey: string) {
  const query = useQuery({
    enabled: userId !== null,
    queryKey: queryKeys.diaryMonth(userId ?? 'signed-out', monthKey),
    queryFn: () => {
      if (!userId) throw new Error('diary_session_required');
      return getDiaryMonth(monthKey);
    },
  });

  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (userId) void refetch();
  }, [refetch, userId]));

  return query;
}
