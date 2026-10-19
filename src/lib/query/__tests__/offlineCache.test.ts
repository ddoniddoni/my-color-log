import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';

import { clearOfflineCache, flushOfflineCache, persistOfflineCache, restoreOfflineCache } from '@/src/lib/query/offlineCache';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { parseDailyMission } from '@/src/features/missions/model/dailyMission';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
  },
}));

const user = 'owner';
const date = '2026-10-17';
const profile = { id: user, nickname: 'Tester', timezone: 'Asia/Seoul', isOnboarded: true };
const mission = parseDailyMission({
  id: 'mission', challenge_date: date, mission_type: 'color', title_ko: '파랑', prompt_ko: '파랑 찾기',
  published_at: '2026-10-16T15:00:00Z', source: 'scheduled', color_id: 'blue', color_slug: 'blue',
  color_name_ko: '파랑', color_name_en: 'Blue', color_hex: '#123456', color_tint_hex: '#AABBCC', color_shade_hex: '#112233', color_on_color_hex: '#FFFFFF',
});
const photo = { id: 'photo', entryId: 'entry', storagePath: 'owner/photo.jpg', position: 1, caption: null,
  capturedAt: '2026-10-17T01:00:00Z', width: 100, height: 100, byteSize: 100, signedUrl: 'https://private.example/photo?token=secret' };
const entry = { id: 'entry', userId: user, missionId: mission.id, dateKey: date, note: null, photos: [photo] };

describe('offline read cache', () => {
  afterEach(async () => {
    onlineManager.setOnline(true);
    await clearOfflineCache(user);
    mockStorage.clear();
  });

  it('restores profile, server mission and own entry offline without persisting signed URLs or room data', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const stop = persistOfflineCache(client, user);
    client.setQueryData(queryKeys.profile(user), profile);
    client.setQueryData(queryKeys.dailyMission(date), mission);
    client.setQueryData(queryKeys.dailyEntry(user, date), entry);
    client.setQueryData(queryKeys.roomTodayBoard(user, 'room', date), { secret: 'friend-photo' });
    client.setQueryData(queryKeys.dailyEntry('other', date), { ...entry, userId: 'other' });
    await flushOfflineCache();
    stop();
    client.clear();
    const stored = [...mockStorage.values()].join('');
    expect(stored).not.toContain('token=secret');
    expect(stored).not.toContain('friend-photo');
    expect(stored).not.toContain('other');

    onlineManager.setOnline(false);
    const restarted = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    await restoreOfflineCache(restarted, user);
    expect(restarted.getQueryData(queryKeys.profile(user))).toEqual(profile);
    expect(restarted.getQueryData(queryKeys.dailyMission(date))).toEqual(mission);
    expect(restarted.getQueryData(queryKeys.dailyEntry(user, date))).toEqual({ ...entry, photos: [{ ...photo, signedUrl: null }] });
    expect(restarted.getQueryData(queryKeys.dailyMission('2026-10-18'))).toBeUndefined();
    const remote = jest.fn(async () => profile);
    const observer = new QueryObserver(restarted, { queryKey: queryKeys.profile(user), queryFn: remote });
    const unsubscribe = observer.subscribe(() => undefined);
    expect(observer.getCurrentResult().data).toEqual(profile);
    expect(remote).not.toHaveBeenCalled();
    unsubscribe();
    restarted.clear();
  });

  it('keeps an explicitly empty entry snapshot and never shares it between accounts', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const stop = persistOfflineCache(client, user);
    client.setQueryData(queryKeys.dailyEntry(user, date), null);
    await flushOfflineCache();
    stop();
    const restarted = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    await restoreOfflineCache(restarted, user);
    expect(restarted.getQueryData(queryKeys.dailyEntry(user, date))).toBeNull();
    const other = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    await restoreOfflineCache(other, 'other');
    expect(other.getQueryCache().getAll()).toHaveLength(0);
    client.clear(); restarted.clear(); other.clear();
  });

  it('serializes logout cleanup after pending writes and ignores later results', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    persistOfflineCache(client, user);
    client.setQueryData(queryKeys.profile(user), profile);
    await clearOfflineCache(user);
    client.setQueryData(queryKeys.profile(user), { ...profile, nickname: 'Changed' });
    await flushOfflineCache();
    expect(mockStorage.size).toBe(0);
    client.clear();
  });

  it('ignores corrupt or mismatched cached records', async () => {
    mockStorage.set('@mycolorlog/offline-reads/v1/owner', JSON.stringify([
      { key: queryKeys.profile(user), data: { ...profile, id: 'other' }, updatedAt: 1 },
      { key: queryKeys.dailyMission('2026-10-18'), data: mission, updatedAt: 1 },
      { key: queryKeys.dailyEntry(user, date), data: { ...entry, photos: [{}] }, updatedAt: 1 },
    ]));
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    await restoreOfflineCache(client, user);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    client.clear();
  });
});
