import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { SessionBootstrapProvider, useSessionBootstrap } from '../useSessionBootstrap';

let mockNetwork: 'online' | 'offline' = 'online';
let mockAuthEvent: (event: AuthChangeEvent, session: Session | null) => void;
const mockGetSession = jest.fn();
const mockReadOffline = jest.fn();
jest.mock('@/src/features/sync/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => mockNetwork }));
jest.mock('@/src/lib/supabase/offlineSession', () => ({ readOfflineSession: () => mockReadOffline() }));
jest.mock('@/src/lib/supabase/client', () => ({ getSupabaseClient: () => ({ auth: {
  getSession: () => mockGetSession(),
  onAuthStateChange: (callback: typeof mockAuthEvent) => {
    mockAuthEvent = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  },
} }) }));

const session: Session = { access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600,
  user: { id: 'owner', aud: 'authenticated', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} } };
let result: ReturnType<typeof useSessionBootstrap>;
function Probe() {
  const value = useSessionBootstrap();
  useEffect(() => { result = value; }, [value]);
  return null;
}
const render = () => <SessionBootstrapProvider><Probe /></SessionBootstrapProvider>;

describe('session restoration and account transitions', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockNetwork = 'online';
    mockGetSession.mockReset().mockImplementation(() => new Promise(() => undefined));
    mockReadOffline.mockReset().mockResolvedValue(session);
  });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  it('restores offline identity while SDK session refresh is unavailable', async () => {
    mockNetwork = 'offline';
    await act(async () => { screen = create(render()); });
    expect(result).toMatchObject({ status: 'ready', session });
    await act(async () => mockAuthEvent('INITIAL_SESSION', null));
    expect(result).toMatchObject({ status: 'ready', session });
  });

  it('does not restore an old account after a confirmed sign-out', async () => {
    let resolveSession!: (value: unknown) => void;
    mockGetSession.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    await act(async () => { screen = create(render()); });
    await act(async () => mockAuthEvent('SIGNED_OUT', null));
    await act(async () => resolveSession({ data: { session }, error: null }));
    expect(result).toMatchObject({ status: 'ready', session: null });
  });

  it('can restore the local identity after an empty initial SDK event', async () => {
    mockNetwork = 'offline';
    let resolveRead!: (value: Session) => void;
    mockReadOffline.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    await act(async () => { screen = create(render()); });
    await act(async () => mockAuthEvent('INITIAL_SESSION', null));
    await act(async () => resolveRead(session));
    expect(result).toMatchObject({ status: 'ready', session });
  });

  it('does not replace a newly signed-in account with a late session read', async () => {
    let resolveSession!: (value: unknown) => void;
    mockGetSession.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    await act(async () => { screen = create(render()); });
    const next = { ...session, user: { ...session.user, id: 'next-owner' } };
    await act(async () => mockAuthEvent('SIGNED_IN', next));
    await act(async () => resolveSession({ data: { session }, error: null }));
    expect(result).toMatchObject({ status: 'ready', session: next });
  });

  it('does not erase a valid session when an older offline read fails', async () => {
    mockNetwork = 'offline';
    let rejectRead!: (reason: Error) => void;
    mockReadOffline.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
    await act(async () => { screen = create(render()); });
    await act(async () => mockAuthEvent('SIGNED_IN', session));
    await act(async () => rejectRead(new Error('storage_unavailable')));
    expect(result).toMatchObject({ status: 'ready', session });
  });
});
