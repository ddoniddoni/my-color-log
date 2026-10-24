import { randomUUID } from 'expo-crypto';
import { useMemo, useState } from 'react';

import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { getPublicEnv } from '@/src/lib/env/publicEnv';

export function useRoomPhotoAccess() {
  // A new mounted photo surface must recheck origin permissions. Keep the nonce
  // stable while mounted so the 15s board polling does not redownload all photos.
  const [cacheNonce] = useState(() => randomUUID());
  const session = useSessionBootstrap();
  const token = session.status === 'ready' ? session.session?.access_token : undefined;
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}`, apikey: getPublicEnv().supabasePublishableKey, 'Cache-Control': 'no-store' } : undefined, [token]);
  return { headers, cacheNonce };
}
