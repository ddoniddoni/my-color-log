import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { persistOfflineCache, restoreOfflineCache } from '@/src/lib/query/offlineCache';

const OfflineCacheReadyContext = createContext(true);
export function useOfflineCacheReady(): boolean { return useContext(OfflineCacheReadyContext); }

// Each account has a separate client, while the navigator stays mounted during
// hydration. Login callbacks can still navigate as soon as authentication ends.
export function OfflineQueryProvider({ children, userId }: PropsWithChildren<{ userId: string | null }>) {
  const { client } = useMemo(() => ({ userId, client: new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }) }), [userId]);
  const [restoredClient, setRestoredClient] = useState<QueryClient | null>(null);
  const ready = userId === null || restoredClient === client;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void restoreOfflineCache(client, userId).then(() => {
      if (cancelled) return;
      stop = persistOfflineCache(client, userId);
      setRestoredClient(client);
    });
    return () => { cancelled = true; stop?.(); void client.cancelQueries(); };
  }, [client, userId]);
  // Query observers retain their original client, so remount them on account
  // changes. Children render immediately; hydration never hides the navigator.
  return <QueryClientProvider key={userId ?? 'signed-out'} client={client}><OfflineCacheReadyContext.Provider value={ready}>{children}</OfflineCacheReadyContext.Provider></QueryClientProvider>;
}
