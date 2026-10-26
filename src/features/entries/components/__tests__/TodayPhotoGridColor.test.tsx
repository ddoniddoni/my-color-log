import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TodayJournal } from '@/src/features/missions/components/TodayJournal';
import { PhotoColorThumbnail } from '../PhotoColorThumbnail';
import { type TodayPhoto } from '../../model/todayPhotos';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';

jest.mock('expo-font', () => ({ useFonts: () => [false] }));
jest.mock('@/src/components/layout/AppHeader', () => ({ AppHeader: 'AppHeader' }));
jest.mock('@/src/components/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/src/components/ui/Button', () => ({ Button: 'Button' }));
jest.mock('@/src/features/missions/components/NextColorCountdown', () => ({ NextColorCountdown: 'Countdown' }));
jest.mock('../PhotoColorThumbnail', () => ({ PhotoColorThumbnail: 'PhotoColorThumbnail' }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => ({ useAppLanguage: () => ({ language: 'ko', t: (text: string) => text, format: (text: string) => text }) }));

const photo: TodayPhoto = { id: 'p1', uri: 'file:///photo.jpg', localUri: 'file:///photo.jpg', storagePath: null,
  capturedAt: '2026-10-26T01:00:00Z', position: 1, caption: null, status: 'pending' };
const mission: DailyMission = { id: 'mission', challengeDate: '2026-10-26', missionType: 'color', titleKo: '빨강', promptKo: '빨강을 찾아요',
  publishedAt: '', source: 'scheduled', color: { id: 'red', slug: 'red', nameKo: '빨강', nameEn: 'Red', accent: '#E53935', accentTint: '#FFFFFF', accentShade: '#000000', onAccent: '#FFFFFF' } };
const noop = () => undefined;
const view = (choices: Record<string, string>, openPhotoId?: string, photos = [photo]) => <TodayJournal
  mission={mission} millisecondsUntilMidnight={10000} photos={photos} isSyncing={false} networkStatus="online" pendingPhotoCount={1} hasSyncFailure={false}
  onAddPhotoPress={noop} onPhotoLongPress={noop} onPhotoPress={noop} onRetrySync={noop} onSettingsPress={noop} timeZone="Asia/Seoul"
  colorViewingPreferences={choices} openPhotoId={openPhotoId} />;
let screen: ReactTestRenderer;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => { screen = create(view({})); });
});
afterEach(async () => { await act(async () => screen.unmount()); });

it('shows the selected effect in the nine-cell grid after closing, and returns to the saved photo when disabled', async () => {
  expect(screen.root.findAllByType(PhotoColorThumbnail)).toHaveLength(0);
  await act(async () => screen.update(view({ p1: '#E53935' }, 'p1')));
  expect(screen.root.findAllByType(PhotoColorThumbnail)).toHaveLength(0);
  await act(async () => screen.update(view({ p1: '#E53935' })));
  expect(screen.root.findByType(PhotoColorThumbnail).props).toMatchObject({ uri: photo.uri, colorHex: '#E53935' });
  await act(async () => screen.update(view({})));
  expect(screen.root.findAllByType(PhotoColorThumbnail)).toHaveLength(0);
});

it('does not apply another photo/color choice or reprocess an already-filtered file', async () => {
  await act(async () => screen.update(view({ p2: '#E53935', p1: '#43A047' })));
  expect(screen.root.findAllByType(PhotoColorThumbnail)).toHaveLength(0);
  await act(async () => screen.update(view({ p1: '#E53935' }, undefined, [{ ...photo, colorIsolationApplied: true }])));
  expect(screen.root.findAllByType(PhotoColorThumbnail)).toHaveLength(0);
});
