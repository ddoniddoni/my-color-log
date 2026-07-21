import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { OfflineBanner } from '@/src/components/feedback/OfflineBanner';
import { useAuthAutoRefresh } from '@/src/features/auth/hooks/useAuthAutoRefresh';
import { SessionBootstrapProvider, useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { configureLocalNotificationPresentation } from '@/src/features/notifications/api/localNotificationRepository';
import { useRoomPhotoPushRegistration } from '@/src/features/notifications/hooks/useRoomPhotoPushRegistration';
import { useProfileTimeZoneSync } from '@/src/features/profile/hooks/useProfileTimeZoneSync';
import { PhotoSyncProvider } from '@/src/features/sync/hooks/usePhotoSync';
import { useNetworkStatus } from '@/src/features/sync/hooks/useNetworkStatus';

const STALE_TIME_MS = 60_000;

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SessionBootstrapProvider>
      <AppProviderContent>{children}</AppProviderContent>
    </SessionBootstrapProvider>
  );
}

function AppProviderContent({ children }: PropsWithChildren) {
  useAuthAutoRefresh();
  const sessionState = useSessionBootstrap();
  const networkStatus = useNetworkStatus();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: STALE_TIME_MS, retry: 1 } } }));
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    void configureLocalNotificationPresentation();
  }, []);

  useEffect(() => {
    if (networkStatus !== 'unknown') onlineManager.setOnline(networkStatus === 'online');
  }, [networkStatus]);

  useEffect(() => {
    if (sessionState.status !== 'ready') return;
    if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== userId) {
      queryClient.clear();
    }
    previousUserIdRef.current = userId;
  }, [queryClient, sessionState.status, userId]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppRuntime networkStatus={networkStatus} userId={userId}>
        {children}
      </AppRuntime>
    </QueryClientProvider>
  );
}

function AppRuntime({ children, networkStatus, userId }: PropsWithChildren<{ networkStatus: 'offline' | 'online' | 'unknown'; userId: string | null }>) {
  useRoomPhotoPushRegistration(userId);
  useProfileTimeZoneSync(userId);

  return (
    <PhotoSyncProvider userId={userId}>
      {children}
      <OfflineBanner visible={networkStatus === 'offline'} />
    </PhotoSyncProvider>
  );
}
