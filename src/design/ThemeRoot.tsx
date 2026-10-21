import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

import { useAppTheme } from './ThemeProvider';
import { logError } from '@/src/lib/logging/logger';

export function ThemeRoot({ children }: PropsWithChildren) {
  const { colors, isLoading, resolvedTheme } = useAppTheme();
  const splashHidden = useRef(false);
  const navigationTheme = useMemo(() => {
    const base = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.ink,
        background: colors.canvas,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, resolvedTheme]);

  useEffect(() => {
    if (isLoading) return;
    void SystemUI.setBackgroundColorAsync(colors.canvas)
      .catch(() => logError('theme_background_failed', { operation: 'apply' }));
  }, [colors.canvas, isLoading]);

  // Keep the native splash until the saved theme is known. Later changes only
  // update context/styles, preserving navigation, mission reveal and photo state.
  if (isLoading) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View style={[styles.root, { backgroundColor: colors.canvas }]} onLayout={() => {
        if (splashHidden.current) return;
        splashHidden.current = true;
        void SplashScreen.hideAsync()
          .catch(() => logError('theme_splash_hide_failed', { operation: 'hide' }));
      }}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </View>
    </NavigationThemeProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
