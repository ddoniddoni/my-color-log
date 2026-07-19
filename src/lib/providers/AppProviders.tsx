import { useEffect, useState, type PropsWithChildren } from 'react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { OfflineBanner } from '@/src/components/feedback/OfflineBanner';
import { useAuthAutoRefresh } from '@/src/features/auth/hooks/useAuthAutoRefresh';
import { useNetworkStatus } from '@/src/features/sync/hooks/useNetworkStatus';

const STALE_TIME_MS = 60_000;

export function AppProviders({ children }: PropsWithChildren) {
  useAuthAutoRefresh();
  const networkStatus = useNetworkStatus();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: STALE_TIME_MS, retry: 1 } } }));

  useEffect(() => {
    if (networkStatus !== 'unknown') onlineManager.setOnline(networkStatus === 'online');
  }, [networkStatus]);

  return <QueryClientProvider client={queryClient}>{children}<OfflineBanner visible={networkStatus === 'offline'} /></QueryClientProvider>;
}
