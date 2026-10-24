import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRoomPhotoAccess } from '../useRoomPhotoAccess';
import { withRoomPhotoNonce } from '@/src/features/rooms/model/roomPhotoUrl';

let mockToken: string | undefined = 'first-token';
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `nonce-${++mockNonce}` }));
jest.mock('@/src/features/auth/hooks/useSessionBootstrap', () => ({ useSessionBootstrap: () => ({ status: 'ready', session: mockToken ? { access_token: mockToken } : null }) }));
jest.mock('@/src/lib/env/publicEnv', () => ({ getPublicEnv: () => ({ supabaseUrl: 'https://project.example', supabasePublishableKey: 'public' }) }));
jest.mock('@/src/lib/supabase/entryPhotoUrls', () => ({ ENTRY_PHOTO_BUCKET: 'cl-entry-photos' }));
it('refreshes origin access on reopen without repeated downloads for board polling, and follows auth refresh', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let access: ReturnType<typeof useRoomPhotoAccess> | undefined;
  const Probe = () => { access = useRoomPhotoAccess(); return null; };
  let screen: ReactTestRenderer;
  await act(async () => { screen = create(<Probe />); });
  const firstNonce = access!.cacheNonce;
  expect(access!.headers?.Authorization).toBe('Bearer first-token');
  expect(withRoomPhotoNonce('https://project.example/image', firstNonce)).toContain('?cacheNonce=');
  await act(async () => { screen.update(<Probe />); });
  expect(access!.cacheNonce).toBe(firstNonce);
  mockToken = 'refreshed-token';
  await act(async () => { screen.update(<Probe />); });
  expect(access!.headers?.Authorization).toBe('Bearer refreshed-token');
  await act(async () => { screen.unmount(); });
  await act(async () => { screen = create(<Probe />); });
  expect(access!.cacheNonce).not.toBe(firstNonce);
  mockToken = undefined;
  await act(async () => { screen.update(<Probe />); });
  expect(access!.headers).toBeUndefined();
  await act(async () => { screen.unmount(); });
});
