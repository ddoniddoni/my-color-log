import { useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const STALE_TIME_MS = 60_000;

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: STALE_TIME_MS, retry: 1 } } }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
