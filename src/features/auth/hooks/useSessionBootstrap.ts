import { createContext, createElement, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { type Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/src/lib/supabase/client';

type SessionState = { status: 'loading' } | { status: 'ready'; session: Session | null } | { status: 'error' };
type SessionBootstrap = SessionState & { retry: () => void };

const SessionBootstrapContext = createContext<SessionBootstrap | null>(null);

export function SessionBootstrapProvider({ children }: PropsWithChildren) {
  const sessionBootstrap = useSessionBootstrapState();

  return createElement(SessionBootstrapContext.Provider, { value: sessionBootstrap }, children);
}

export function useSessionBootstrap(): SessionBootstrap {
  const sessionBootstrap = useContext(SessionBootstrapContext);
  if (!sessionBootstrap) throw new Error('session_bootstrap_provider_missing');
  return sessionBootstrap;
}

function useSessionBootstrapState(): SessionBootstrap {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isCancelled) {
        setState({ status: 'ready', session });
      }
    });

    return () => {
      isCancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [attempt]);

  const retry = (): void => setAttempt((current) => current + 1);
  if (state.status === 'ready') return { status: 'ready', session: state.session, retry };
  return { status: state.status, retry };
}
