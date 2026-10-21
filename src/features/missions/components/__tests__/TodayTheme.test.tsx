import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { AppHeader } from '@/src/components/layout/AppHeader';
import { Button } from '@/src/components/ui/Button';
import { ThemeProvider, useAppTheme } from '@/src/design/ThemeProvider';
import { colors, darkColors } from '@/src/design/tokens';
import { ThemeSettingsModal } from '@/src/features/profile/components/ThemeSettingsModal';
import type { TodayPhoto } from '@/src/features/entries/model/todayPhotos';
import type { DailyMission } from '../../model/dailyMission';
import { TodayJournal } from '../TodayJournal';

jest.mock('@/src/design/themePreference', () => ({ getThemePreference: jest.fn().mockResolvedValue('light'), saveThemePreference: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const value = { language: 'ko', t: (text: string) => text, format: (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key]) };
  return { useAppLanguage: () => value, useOptionalAppLanguage: () => value };
});

const mission: DailyMission = {
  id: 'mission', challengeDate: '2026-10-22', missionType: 'color', titleKo: '체리 레드', promptKo: '빨강을 찾아보세요.',
  publishedAt: '2026-10-21T15:00:00Z', source: 'scheduled',
  color: { id: 'red', slug: 'red', nameKo: '체리 레드', nameEn: 'Cherry Red', accent: '#D94A4A', onAccent: '#FFFFFF', accentTint: '#F9E6E6', accentShade: '#8D2727' },
};
const noop = () => undefined;

function Settings() {
  const theme = useAppTheme();
  return <ThemeSettingsModal isSaving={false} onClose={noop} onSelect={(value) => { void theme.setPreference(value); }} preference={theme.preference} visible />;
}

describe('today with the real theme provider and settings controls', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  it.each([0, 1, 9])('updates a %i-photo offline journal while preserving the mission and photo sources', async (count) => {
    const photos: TodayPhoto[] = Array.from({ length: count }, (_, i) => ({
      id: `photo-${i}`, uri: `file:///photo-${i}.jpg`, localUri: `file:///photo-${i}.jpg`, storagePath: null,
      position: i + 1, capturedAt: '2026-10-22T03:00:00Z', caption: null, status: 'pending',
    }));
    await act(async () => {
      screen = create(<ThemeProvider>
        <TodayJournal mission={mission} photos={photos} millisecondsUntilMidnight={120000} networkStatus="offline" isSyncing={false} pendingPhotoCount={count} hasSyncFailure={false} onAddPhotoPress={noop} onPhotoLongPress={noop} onPhotoPress={noop} onRetrySync={noop} onSettingsPress={noop} timeZone="Asia/Seoul" />
        <Settings />
      </ThemeProvider>);
    });
    const journal = () => screen.root.findByType(TodayJournal);
    const background = () => StyleSheet.flatten(journal().findAllByType(View)[0].props.style).backgroundColor;
    const sources = () => journal().findAllByType(Image).map((image) => image.props.source);
    const originalSources = sources();
    const colorSwatches = () => journal().findAllByType(View).filter((view) => StyleSheet.flatten(view.props.style)?.backgroundColor === mission.color.accent).length;
    const originalSwatches = colorSwatches();
    expect(background()).toBe(colors.canvas);

    await act(async () => screen.root.findByProps({ accessibilityLabel: '어둡게 테마' }).props.onPress());
    expect(background()).toBe(darkColors.canvas);
    expect(StyleSheet.flatten(journal().findByType(AppHeader).findAllByType(View)[0].props.style).backgroundColor).toBe(darkColors.canvas);
    expect(screen.root.findByProps({ accessibilityLabel: '어둡게 테마' }).props.accessibilityState.checked).toBe(true);
    expect(journal().props.mission).toBe(mission);
    expect(journal().props.photos).toBe(photos);
    expect(sources()).toEqual(originalSources);
    expect(colorSwatches()).toBe(originalSwatches);
    expect(journal().findByType(Button).props.disabled).toBe(count >= 9);

    await act(async () => screen.root.findByProps({ accessibilityLabel: '밝게 테마' }).props.onPress());
    expect(background()).toBe(colors.canvas);
    expect(sources()).toEqual(originalSources);
  });
});
