import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { colors, darkColors, type ThemeColors } from '@/src/design/tokens';
import {
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/src/design/themePreference';

export type ResolvedTheme = 'dark' | 'light';

type AppTheme = {
  colors: ThemeColors;
  isLoading: boolean;
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const AppThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void getThemePreference()
      .then((savedPreference) => {
        if (isMounted) setStoredPreference(savedPreference);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system'
    ? systemColorScheme === 'dark' ? 'dark' : 'light'
    : preference;

  const setPreference = useCallback(async (nextPreference: ThemePreference): Promise<void> => {
    setStoredPreference(nextPreference);
    await saveThemePreference(nextPreference);
  }, []);

  const value = useMemo<AppTheme>(() => ({
    colors: resolvedTheme === 'dark' ? darkColors : colors,
    isLoading,
    preference,
    resolvedTheme,
    setPreference,
  }), [isLoading, preference, resolvedTheme, setPreference]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) throw new Error('app_theme_provider_missing');
  return theme;
}

export function getThemePreferenceLabel(preference: ThemePreference): string {
  if (preference === 'dark') return '어둡게';
  if (preference === 'light') return '밝게';
  return '시스템 설정';
}
