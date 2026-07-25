import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'en' | 'ko';

const LANGUAGE_PREFERENCE_STORAGE_KEY = '@mycolorlog/language-preference/v1';

export function parseLanguagePreference(value: unknown): AppLanguage {
  return value === 'en' || value === 'ko' ? value : 'ko';
}

export async function getLanguagePreference(): Promise<AppLanguage> {
  return parseLanguagePreference(await AsyncStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY));
}

export async function saveLanguagePreference(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, language);
}
