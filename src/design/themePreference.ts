import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'dark' | 'light' | 'system';

const THEME_PREFERENCE_STORAGE_KEY = '@mycolorlog/theme-preference/v1';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export async function getThemePreference(): Promise<ThemePreference> {
  return parseThemePreference(await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY));
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
}
