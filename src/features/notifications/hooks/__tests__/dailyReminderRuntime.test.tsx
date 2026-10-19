import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { syncDailyReminderContext } from '../../api/localNotificationRepository';
import { useDailyReminders } from '../useDailyReminders';
import { queryKeys } from '@/src/lib/query/queryKeys';
import type { PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { getDailyEntry } from '@/src/features/entries/api/entryRepository';

let mockLanguage = 'ko';
const day = '2026-10-19';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined),
} }));
jest.mock('@/src/lib/localization/LanguageProvider', () => ({ useAppLanguage: () => ({ language: mockLanguage, isLoading: false }) }));
jest.mock('@/src/lib/localization/deviceTimeZone', () => ({ useDeviceTimeZone: () => 'Asia/Seoul' }));
jest.mock('@/src/features/missions/hooks/useTimeZoneDateKey', () => ({ useTimeZoneDateKey: () => '2026-10-19' }));
jest.mock('@/src/features/profile/hooks/useProfile', () => ({ useProfile: () => ({ data: { timezone: 'Asia/Seoul' } }) }));
jest.mock('@/src/features/entries/api/entryRepository', () => ({ getDailyEntry: jest.fn().mockResolvedValue(null) }));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({ getDayPhotoQueue: jest.fn().mockResolvedValue([]) }));
jest.mock('../../api/localNotificationRepository', () => ({
  getNotificationSettings: jest.fn().mockResolvedValue({ morning: { enabled: true, hour: 9, minute: 0 }, evening: { enabled: true, hour: 20, minute: 0 }, roomPhotoPushEnabled: false }),
  saveNotificationSettings: jest.fn(),
  syncDailyReminderContext: jest.fn().mockResolvedValue(undefined),
}));

function Harness({ userId, ready }: { userId: string | null; ready: boolean }) { useDailyReminders(userId, ready); return null; }
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

describe('daily reminder runtime', () => {
  let screen: ReactTestRenderer;
  let client: QueryClient;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockLanguage = 'ko';
    jest.mocked(getDailyEntry).mockResolvedValue(null);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  });
  afterEach(async () => { await act(async () => { screen?.unmount(); }); client.clear(); });
  const render = (userId: string | null, ready = true) => <QueryClientProvider client={client}><Harness userId={userId} ready={ready} /></QueryClientProvider>;

  it('observes local save/delete and language changes outside the today screen', async () => {
    await act(async () => { screen = create(render('owner')); });
    await flush(); await flush();
    expect(syncDailyReminderContext).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'owner', hasRecordedToday: false, language: 'ko' }));
    const queued: PendingPhoto = { id: 'photo', userId: 'owner', entryId: 'entry', missionId: 'mission', dateKey: day, localUri: 'file:///test.jpg', storagePath: 'owner/photo.jpg', position: 1, caption: null, capturedAt: '2026-10-19T01:00:00Z', width: 100, height: 100, byteSize: 1000, retryCount: 0, lastErrorCode: null, status: 'pending' };
    await act(async () => { client.setQueryData(queryKeys.pendingPhotos('owner', day), [queued]); });
    await flush();
    expect(syncDailyReminderContext).toHaveBeenLastCalledWith(expect.objectContaining({ hasRecordedToday: true }));
    await act(async () => { client.setQueryData(queryKeys.pendingPhotos('owner', day), [{ ...queued, status: 'cancelled' }]); });
    await flush();
    expect(syncDailyReminderContext).toHaveBeenLastCalledWith(expect.objectContaining({ hasRecordedToday: false }));
    mockLanguage = 'en';
    await act(async () => { screen.update(render('owner')); });
    expect(syncDailyReminderContext).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'en' }));
  });
  it('does not cancel schedules during session restoration, but clears them on confirmed sign-out', async () => {
    await act(async () => { screen = create(render(null, false)); });
    await flush();
    expect(syncDailyReminderContext).not.toHaveBeenCalled();
    await act(async () => { screen.update(render(null, true)); });
    expect(syncDailyReminderContext).toHaveBeenLastCalledWith(null);
  });
  it('does not treat a cached empty entry as current after a failed server refresh', async () => {
    client.setQueryData(queryKeys.dailyEntry('owner', day), null);
    jest.mocked(getDailyEntry).mockRejectedValue(new Error('offline'));
    await act(async () => { screen = create(render('owner')); });
    await flush(); await flush();
    expect(syncDailyReminderContext).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'owner', hasRecordedToday: null }));
  });
});
