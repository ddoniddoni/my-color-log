import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { useDailyEntry } from '@/src/features/entries/hooks/useDailyEntry';
import { useTimeZoneDateKey } from '@/src/features/missions/hooks/useTimeZoneDateKey';
import { syncDailyReminderContext } from '@/src/features/notifications/api/localNotificationRepository';
import { hasRecordedToday } from '@/src/features/notifications/model/dailyReminder';
import { useNotificationSettings } from '@/src/features/notifications/hooks/useNotificationSettings';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { getDayPhotoQueue } from '@/src/features/sync/queue/photoQueue';
import { useDeviceTimeZone } from '@/src/lib/localization/deviceTimeZone';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';
import { logError } from '@/src/lib/logging/logger';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function useDailyReminders(userId: string | null, sessionReady: boolean): void {
  const { language, isLoading: languageLoading } = useAppLanguage();
  const profile = useProfile(userId ?? undefined);
  const deviceTimeZone = useDeviceTimeZone();
  const timeZone = profile.data?.timezone ?? deviceTimeZone;
  const dateKey = useTimeZoneDateKey(timeZone);
  const { settings } = useNotificationSettings();
  const observingUser = settings.evening.enabled ? userId : null;
  const entry = useDailyEntry(observingUser, dateKey);
  const queue = useQuery({
    queryKey: queryKeys.pendingPhotos(observingUser ?? 'signed-out', dateKey),
    enabled: observingUser !== null,
    networkMode: 'always',
    queryFn: () => getDayPhotoQueue(observingUser ?? '', dateKey),
  });
  // A cached empty result is not authoritative during an offline/failed refresh.
  // Pending and recently synced local photos can still suppress today's alert.
  const verifiedEntry = entry.fetchStatus === 'idle' && !entry.isError ? entry.data : undefined;
  const recorded = userId ? hasRecordedToday(userId, dateKey, verifiedEntry, queue.data) : null;
  const [foregroundCycle, setForegroundCycle] = useState(0);
  const refetchEntry = entry.refetch;
  const refetchQueue = queue.refetch;

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setForegroundCycle((cycle) => cycle + 1);
      if (observingUser) {
        void refetchEntry();
        void refetchQueue();
      }
    });
    return () => listener.remove();
  }, [observingUser, refetchEntry, refetchQueue]);

  useEffect(() => {
    if (!sessionReady || languageLoading) return;
    void syncDailyReminderContext(userId ? { userId, timeZone, dateKey, language, hasRecordedToday: recorded } : null)
      .catch(() => logError('daily_reminders_sync_failed', { operation: 'reconcile' }));
  }, [dateKey, foregroundCycle, language, languageLoading, recorded, sessionReady, settings, timeZone, userId]);
}
