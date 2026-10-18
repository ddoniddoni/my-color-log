import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getNotificationSettings, saveNotificationSettings } from '@/src/features/notifications/api/localNotificationRepository';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/src/features/notifications/model/notificationSettings';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useNotificationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.notificationSettings, queryFn: getNotificationSettings, networkMode: 'always' });
  const mutation = useMutation({
    mutationFn: saveNotificationSettings,
    networkMode: 'always',
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationSettings }),
  });
  return { isLoading: query.isPending, isSaving: mutation.isPending, save: mutation.mutateAsync, settings: query.data ?? DEFAULT_NOTIFICATION_SETTINGS };
}
