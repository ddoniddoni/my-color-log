import { createContext, createElement, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { type Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/src/lib/supabase/client';
import { readOfflineSession } from '@/src/lib/supabase/offlineSession';
import { useNetworkStatus } from '@/src/features/sync/hooks/useNetworkStatus';

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
  const networkStatus = useNetworkStatus();
  const networkRef = useRef(networkStatus);
  const signedOutRef = useRef(false);

  useEffect(() => { networkRef.current = networkStatus; }, [networkStatus]);

  useEffect(() => {
    if (networkStatus !== 'offline' || signedOutRef.current) return;
    let cancelled = false;
    void readOfflineSession().then((session) => {
      if (cancelled || signedOutRef.current || !session) return;
      setState((current) => current.status === 'ready' && current.session ? current : { status: 'ready', session });
    }).catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [networkStatus, attempt]);

  useEffect(() => {
    if (networkStatus !== 'online') return;
    let cancelled = false;
    void getSupabaseClient().auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      setState(error ? { status: 'error' } : { status: 'ready', session: data.session });
    }).catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [networkStatus, attempt]);

  useEffect(() => {
    let isCancelled = false;
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isCancelled) {
        if (event === 'SIGNED_OUT') signedOutRef.current = true;
        else if (session) signedOutRef.current = false;
        setState((current) => event === 'INITIAL_SESSION' && !session && networkRef.current === 'offline'
          && current.status === 'ready' && current.session ? current : { status: 'ready', session });
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
