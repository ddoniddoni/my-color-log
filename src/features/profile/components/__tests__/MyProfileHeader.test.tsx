import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AppHeader } from '@/src/components/layout/AppHeader';
import { MyProfileCanvas } from '../MyProfileCanvas';

jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const value = { language: 'ko', t: (text: string) => text };
  return { useAppLanguage: () => value, useOptionalAppLanguage: () => value };
});

it('removes nonfunctional header icons while keeping the theme settings entry usable', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const onThemePress = jest.fn();
  const noop = jest.fn();
  let screen!: ReactTestRenderer;
  try {
    await act(async () => {
      screen = create(<MyProfileCanvas deletingAccount={false} email="member@example.invalid" languagePreferenceLabel="한국어" nickname="색수집가" onDeleteAccountPress={noop} onLanguagePress={noop} onNotificationsPress={noop} onProfileEditPress={noop} onRoomsPress={noop} onSignOutPress={noop} onThemePress={onThemePress} rooms={[]} roomsStatus="ready" signingOut={false} themePreferenceLabel="시스템 설정" />);
    });
    const header = screen.root.findByType(AppHeader);
    expect(header.props.title).toBe('내 정보');
    expect(header.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
    expect(screen.root.findAll((node) => node.props.accessibilityLabel === '메뉴')).toHaveLength(0);
    const themeButton = screen.root.findByProps({ accessibilityLabel: '화면 테마' });
    await act(async () => themeButton.props.onPress());
    expect(onThemePress).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => screen?.unmount());
  }
});
