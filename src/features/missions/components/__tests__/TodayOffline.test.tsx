import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import TodayScreen from '@/app/(tabs)/index';
import { OfflineQueryProvider } from '@/src/lib/query/OfflineQueryProvider';
import { clearOfflineCache, flushOfflineCache, persistOfflineCache } from '@/src/lib/query/offlineCache';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { parseDailyMission } from '../../model/dailyMission';
import { MISSION_REVEAL_SLOT_COUNT } from '../../model/missionRevealWheel';
import { MissionReveal } from '../MissionReveal';
import { TodayJournal } from '../TodayJournal';
import { AppText } from '@/src/components/ui/AppText';
import { getDailyMission } from '../../api/missionRepository';
import { hasRevealedMission } from '../../api/revealRepository';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
  removeItem: async (key: string) => { mockStorage.delete(key); },
} }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/src/features/auth/hooks/useSessionBootstrap', () => ({ useSessionBootstrap: () => ({ status: 'ready', session: { user: { id: 'owner' } }, retry: jest.fn() }) }));
jest.mock('@/src/lib/localization/deviceTimeZone', () => ({ useDeviceTimeZone: () => 'Asia/Seoul' }));
jest.mock('../../hooks/useDailyColorClock', () => ({ useDailyColorClock: () => ({ dateKey: '2026-10-19', isNewDay: false, millisecondsUntilMidnight: 1000 }) }));
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/src/features/sync/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => 'offline' }));
jest.mock('@/src/features/sync/hooks/usePhotoSync', () => ({ usePhotoSync: () => ({ isSyncing: false }) }));
jest.mock('@/src/features/entries/hooks/useTodayPhotoActions', () => ({ useTodayPhotoActions: () => ({}) }));
jest.mock('@/src/features/camera/hooks/usePhotoSourceSelection', () => ({ usePhotoSourceSelection: () => ({}) }));
jest.mock('@/src/features/camera/components/PhotoDraftRecovery', () => ({ PhotoDraftRecovery: () => null }));
jest.mock('@/src/features/camera/components/PhotoSourceModal', () => ({ PhotoSourceModal: () => null }));
jest.mock('@/src/features/entries/components/TodayPhotoManagerModal', () => ({ TodayPhotoManagerModal: () => null }));
jest.mock('@/src/components/feedback/LoadingSkeleton', () => ({ LoadingSkeleton: 'LoadingSkeleton' }));
jest.mock('@/src/components/layout/Screen', () => ({ Screen: 'Screen' }));
jest.mock('@/src/components/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/src/components/ui/Button', () => ({ Button: 'Button' }));
jest.mock('../TodayJournal', () => ({ TodayJournal: 'TodayJournal' }));
jest.mock('../MissionReveal', () => ({ MissionReveal: 'MissionReveal' }));
jest.mock('../../api/missionRepository', () => ({ getDailyMission: jest.fn(), getMissionRevealPalette: jest.fn() }));
jest.mock('../../api/revealRepository', () => ({ hasRevealedMission: jest.fn(), markMissionRevealed: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/features/entries/api/entryRepository', () => ({ getDailyEntry: jest.fn() }));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({ getDayPhotoQueue: jest.fn().mockResolvedValue([]) }));

const day = '2026-10-19';
const mission = parseDailyMission({ id: 'mission', challenge_date: day, mission_type: 'color', title_ko: '파랑', prompt_ko: '파랑 찾기',
  published_at: '2026-10-18T15:00:00Z', source: 'scheduled', color_id: 'blue', color_slug: 'blue', color_name_ko: '파랑',
  color_name_en: 'Blue', color_hex: '#123456', color_tint_hex: '#AABBCC', color_shade_hex: '#112233', color_on_color_hex: '#FFFFFF' });
const flush = () => act(async () => { await jest.advanceTimersByTimeAsync(10); });

describe('today after offline restart', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.useFakeTimers();
    jest.clearAllMocks(); onlineManager.setOnline(false);
    jest.mocked(hasRevealedMission).mockResolvedValue(true);
  });
  afterEach(async () => {
    await act(async () => screen?.unmount());
    await clearOfflineCache('owner'); mockStorage.clear(); onlineManager.setOnline(true);
    jest.clearAllTimers(); jest.useRealTimers();
  });
  async function seed() {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const stop = persistOfflineCache(client, 'owner');
    client.setQueryData(queryKeys.dailyMission(day), mission);
    client.setQueryData(queryKeys.missionRevealPalette(day), Array.from({ length: MISSION_REVEAL_SLOT_COUNT }, (_, index) => ({
      id: index === 0 ? 'blue' : `color-${index}`, slug: `color-${index}`, nameKo: '파랑', nameEn: 'Blue', accent: '#123456', onAccent: '#FFFFFF',
    })));
    client.setQueryData(queryKeys.dailyEntry('owner', day), null);
    await flushOfflineCache(); stop(); client.clear();
  }
  async function mount() {
    await act(async () => { screen = create(<OfflineQueryProvider userId="owner"><TodayScreen /></OfflineQueryProvider>); });
    await flush(); await flush();
  }

  it('restores the server mission and shows the journal without a network request', async () => {
    await seed(); await mount();
    expect(screen.root.findByType(TodayJournal).props.mission).toEqual(mission);
    expect(getDailyMission).not.toHaveBeenCalled();
  });

  it('keeps the cached color reveal on screen until Continue is pressed offline', async () => {
    await seed(); jest.mocked(hasRevealedMission).mockResolvedValue(false); await mount();
    const reveal = screen.root.findByType(MissionReveal);
    await act(async () => { reveal.props.onStart(); await reveal.props.onRevealed(); });
    await flush();
    expect(screen.root.findByType(MissionReveal).props.mission).toEqual(mission);
    await act(async () => reveal.props.onContinue());
    expect(screen.root.findByType(TodayJournal).props.mission).toEqual(mission);
  });

  it('shows a connection message for an uncached day without creating a fallback color', async () => {
    await mount();
    expect(screen.root.findAllByType(AppText).some((node) => node.props.children === '오늘의 색을 불러올 수 없어요')).toBe(true);
    expect(screen.root.findAllByType(TodayJournal)).toHaveLength(0);
    expect(getDailyMission).not.toHaveBeenCalled();
  });
});
