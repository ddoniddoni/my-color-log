import { parseOfflineSession } from '@/src/lib/supabase/offlineSession';

jest.mock('@/src/lib/supabase/storage', () => ({ secureStorage: { getItem: jest.fn() } }));

describe('offline session parsing', () => {
  it('retains an expired local identity without inventing or refreshing credentials', () => {
    const session = { access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600,
      expires_at: 1, user: { id: 'owner', aud: 'authenticated', created_at: '2026-01-01', app_metadata: {}, user_metadata: {} } };
    expect(parseOfflineSession(JSON.stringify(session))).toEqual(session);
  });

  it('does not manufacture a session from a missing or corrupt credential store', () => {
    expect(parseOfflineSession(null)).toBeNull();
    expect(parseOfflineSession('{')).toBeNull();
    expect(parseOfflineSession(JSON.stringify({ user: { id: 'owner' } }))).toBeNull();
  });
});
