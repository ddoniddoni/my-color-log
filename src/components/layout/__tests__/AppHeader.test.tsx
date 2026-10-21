import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '../AppHeader';
import { Screen } from '../Screen';
import { AppText } from '@/src/components/ui/AppText';
import { colors, darkColors, type ThemeColors } from '@/src/design/tokens';

let mockColors: ThemeColors = colors;
let mockLanguage: 'ko' | 'en' = 'ko';
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: mockColors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const { translateText } = jest.requireActual<typeof import('@/src/lib/localization/translations')>('@/src/lib/localization/translations');
  return { useOptionalAppLanguage: () => ({ t: (text: string) => translateText(mockLanguage, text) }) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));

describe('shared screen header', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockColors = colors;
    mockLanguage = 'ko';
  });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  it('has no decorative menu or empty button when no action is provided', async () => {
    await act(async () => { screen = create(<AppHeader title="내 정보" />); });
    expect(screen.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
    expect(screen.root.findByType(AppText).props.accessibilityRole).toBe('header');
    expect(screen.root.findByType(AppText).props.numberOfLines).toBeUndefined();
    expect(screen.root.findByType(AppText).props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('exposes working, localized back and settings buttons', async () => {
    mockLanguage = 'en';
    const back = jest.fn();
    const settings = jest.fn();
    await act(async () => {
      screen = create(<AppHeader title="친구방" leadingAction={{ icon: 'back', accessibilityLabel: '뒤로가기', onPress: back }} trailingAction={{ icon: 'settings', accessibilityLabel: '설정 열기', onPress: settings }} />);
    });
    const buttons = screen.root.findAll((node) => node.props.accessibilityRole === 'button', { deep: false });
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Go back', 'Open settings']);
    await act(async () => { buttons[0].props.onPress(); buttons[1].props.onPress(); });
    expect(back).toHaveBeenCalledTimes(1);
    expect(settings).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(screen.toJSON())).toContain('Rooms');
  });

  it('updates header surface and title together when the theme changes', async () => {
    await act(async () => { screen = create(<AppHeader title="오늘" />); });
    const surfaceColor = () => StyleSheet.flatten(screen.root.findAllByType(View)[0].props.style).backgroundColor;
    expect(surfaceColor()).toBe(colors.canvas);
    mockColors = darkColors;
    await act(async () => screen.update(<AppHeader title="오늘" />));
    expect(surfaceColor()).toBe(darkColors.canvas);
    expect(StyleSheet.flatten(screen.root.findByType(AppText).props.style).color).toBe(darkColors.ink);
  });

  it('applies the top safe area once when loading or error content has a header', async () => {
    await act(async () => { screen = create(<Screen header={<AppHeader title="오늘" />}><AppText>불러오는 중</AppText></Screen>); });
    const header = screen.root.findByType(AppHeader);
    expect(StyleSheet.flatten(header.findAllByType(View)[0].props.style).paddingTop).toBe(59);
    expect(StyleSheet.flatten(screen.root.findByType(ScrollView).props.contentContainerStyle).paddingTop).toBe(20);
    await act(async () => screen.update(<Screen><AppText>다른 화면</AppText></Screen>));
    expect(StyleSheet.flatten(screen.root.findByType(ScrollView).props.contentContainerStyle).paddingTop).toBe(59);
  });
});
