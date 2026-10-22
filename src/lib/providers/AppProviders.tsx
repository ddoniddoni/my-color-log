import { useEffect, useRef, type PropsWithChildren } from 'react';
import { onlineManager } from '@tanstack/react-query';

import { OfflineBanner } from '@/src/components/feedback/OfflineBanner';
import { useAuthAutoRefresh } from '@/src/features/auth/hooks/useAuthAutoRefresh';
import { SessionBootstrapProvider, useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { configureLocalNotificationPresentation } from '@/src/features/notifications/api/localNotificationRepository';
import { useRoomPhotoPushRegistration } from '@/src/features/notifications/hooks/useRoomPhotoPushRegistration';
import { useDailyReminders } from '@/src/features/notifications/hooks/useDailyReminders';
import { useProfileTimeZoneSync } from '@/src/features/profile/hooks/useProfileTimeZoneSync';
import { PhotoSyncProvider } from '@/src/features/sync/hooks/usePhotoSync';
import { useNetworkStatus } from '@/src/features/sync/hooks/useNetworkStatus';
import { ThemeProvider } from '@/src/design/ThemeProvider';
import { LanguageProvider } from '@/src/lib/localization/LanguageProvider';
import { logError } from '@/src/lib/logging/logger';

import { OfflineQueryProvider, useOfflineCacheReady } from '@/src/lib/query/OfflineQueryProvider';
import { clearOfflineCache } from '@/src/lib/query/offlineCache';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <SessionBootstrapProvider>
          <AppProviderContent>{children}</AppProviderContent>
        </SessionBootstrapProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

function AppProviderContent({ children }: PropsWithChildren) {
  useAuthAutoRefresh();
  const sessionState = useSessionBootstrap();
  const networkStatus = useNetworkStatus();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    void configureLocalNotificationPresentation().catch(() => logError('notification_presentation_failed', { operation: 'configure' }));
  }, []);

  useEffect(() => {
    if (networkStatus !== 'unknown') onlineManager.setOnline(networkStatus === 'online');
  }, [networkStatus]);

  useEffect(() => {
    if (sessionState.status !== 'ready') return;
    if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== userId) {
      if (previousUserIdRef.current) void clearOfflineCache(previousUserIdRef.current).catch(() => undefined);
    }
    previousUserIdRef.current = userId;
  }, [sessionState.status, userId]);

  return (
    <OfflineQueryProvider userId={userId}>
      <AppRuntime networkStatus={networkStatus} userId={userId} sessionReady={sessionState.status === 'ready'}>
        {children}
      </AppRuntime>
    </OfflineQueryProvider>
  );
}

function AppRuntime({ children, networkStatus, userId, sessionReady }: PropsWithChildren<{ networkStatus: 'offline' | 'online' | 'unknown'; userId: string | null; sessionReady: boolean }>) {
  const cacheReady = useOfflineCacheReady();
  useDailyReminders(userId, sessionReady && cacheReady);
  useRoomPhotoPushRegistration(userId, networkStatus);
  useProfileTimeZoneSync(userId);

  return (
    <PhotoSyncProvider userId={cacheReady ? userId : null}>
      {children}
      <OfflineBanner visible={networkStatus === 'offline'} />
    </PhotoSyncProvider>
  );
}
