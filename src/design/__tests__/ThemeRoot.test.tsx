import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

import { ThemeProvider, useAppTheme } from '../ThemeProvider';
import { ThemeRoot } from '../ThemeRoot';
import { getThemePreference, type ThemePreference } from '../themePreference';
import { colors, darkColors } from '../tokens';

jest.mock('expo-router', () => ({
  ThemeProvider: 'NavigationThemeProvider',
  DarkTheme: { dark: true, colors: {} }, DefaultTheme: { dark: false, colors: {} },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../themePreference', () => ({ getThemePreference: jest.fn(), saveThemePreference: jest.fn().mockResolvedValue(undefined) }));

describe('native theme surfaces and initial hydration', () => {
  let screen: ReactTestRenderer;
  let theme: ReturnType<typeof useAppTheme>;
  const mounted = jest.fn();
  function Controller() { theme = useAppTheme(); return null; }
  function Content() {
    const [value] = useState(() => { mounted(); return 'existing-screen'; });
    return <Text>{value}</Text>;
  }
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
  });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  it('waits for the saved theme, then updates all surfaces without remounting content', async () => {
    let resolve!: (value: ThemePreference) => void;
    jest.mocked(getThemePreference).mockReturnValue(new Promise((yes) => { resolve = yes; }));
    await act(async () => { screen = create(<ThemeProvider><Controller /><ThemeRoot><Content /></ThemeRoot></ThemeProvider>); });
    expect(mounted).not.toHaveBeenCalled();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    expect(SystemUI.setBackgroundColorAsync).not.toHaveBeenCalled();

    await act(async () => resolve('dark'));
    expect(mounted).toHaveBeenCalledTimes(1);
    const surface = () => screen.root.findByType(View);
    expect(StyleSheet.flatten(surface().props.style).backgroundColor).toBe(darkColors.canvas);
    expect(screen.root.findByType(NavigationThemeProvider).props.value.colors.background).toBe(darkColors.canvas);
    expect(screen.root.findByType(StatusBar).props.style).toBe('light');
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(darkColors.canvas);
    await act(async () => surface().props.onLayout());
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);

    await act(async () => theme.setPreference('light'));
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(screen.root.findByType(Text).props.children).toBe('existing-screen');
    expect(screen.root.findByType(NavigationThemeProvider).props.value.colors.background).toBe(colors.canvas);
    expect(screen.root.findByType(StatusBar).props.style).toBe('dark');
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(colors.canvas);
    await act(async () => surface().props.onLayout());
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
