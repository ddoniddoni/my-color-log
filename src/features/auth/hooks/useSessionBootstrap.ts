import { useEffect, useState } from 'react';
import { type Session } from '@supabase/supabase-js';

import { getStoredSession } from '@/src/features/auth/api/authRepository';
import { supabase } from '@/src/lib/supabase/client';

type SessionState = { status: 'loading' } | { status: 'ready'; session: Session | null } | { status: 'error' };
type SessionBootstrap = SessionState & { retry: () => void };

export function useSessionBootstrap(): SessionBootstrap {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadSession = async (): Promise<void> => {
      try {
        const session = await getStoredSession();
        if (isMounted) setState({ status: 'ready', session });
      } catch {
        if (isMounted) setState({ status: 'error' });
      }
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setState({ status: 'ready', session });
    });

    void loadSession();
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [attempt]);

  const retry = (): void => setAttempt((current) => current + 1);
  if (state.status === 'ready') return { status: 'ready', session: state.session, retry };
  return { status: state.status, retry };
}
