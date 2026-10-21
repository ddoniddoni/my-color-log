import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { colors, darkColors, type ThemeColors } from '@/src/design/tokens';
import type { AppLanguage } from '@/src/lib/localization/languagePreference';
import { logError } from '@/src/lib/logging/logger';
import {
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/src/design/themePreference';

type ResolvedTheme = 'dark' | 'light';

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
  const selectionVersion = useRef(0);
  const persistedPreference = useRef<ThemePreference>('system');
  const pendingWrite = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Finish hydration before persisting a new choice so failure can restore
    // the actual saved value. A late read must never replace a newer selection.
    pendingWrite.current = getThemePreference()
      .then((savedPreference) => {
        if (!isMounted) return;
        persistedPreference.current = savedPreference;
        if (selectionVersion.current === 0) setStoredPreference(savedPreference);
      })
      .catch(() => logError('theme_preference_read_failed', { operation: 'read' }))
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
    const version = ++selectionVersion.current;
    setStoredPreference(nextPreference);
    const write = (pendingWrite.current ?? Promise.resolve()).then(async () => {
      await saveThemePreference(nextPreference);
      persistedPreference.current = nextPreference;
    }).catch((error: unknown) => {
      if (version === selectionVersion.current) setStoredPreference(persistedPreference.current);
      throw error;
    });
    // Keep writes ordered without letting one failure prevent the next retry.
    pendingWrite.current = write.catch(() => undefined);
    await write;
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

export function getThemePreferenceLabel(preference: ThemePreference, language: AppLanguage = 'ko'): string {
  if (language === 'en') {
    if (preference === 'dark') return 'Dark';
    if (preference === 'light') return 'Light';
    return 'Use device setting';
  }
  if (preference === 'dark') return '어둡게';
  if (preference === 'light') return '밝게';
  return '시스템 설정';
}
