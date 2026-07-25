import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getLanguagePreference, saveLanguagePreference, type AppLanguage } from '@/src/lib/localization/languagePreference';
import { translateTemplate, translateText, type TranslationValues } from '@/src/lib/localization/translations';

type AppLanguageContextValue = {
  isLoading: boolean;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (text: string) => string;
  format: (text: string, values: TranslationValues) => string;
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setStoredLanguage] = useState<AppLanguage>('ko');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void getLanguagePreference()
      .then((savedLanguage) => {
        if (isMounted) setStoredLanguage(savedLanguage);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage): Promise<void> => {
    setStoredLanguage(nextLanguage);
    await saveLanguagePreference(nextLanguage);
  }, []);

  const value = useMemo<AppLanguageContextValue>(() => ({
    isLoading,
    language,
    setLanguage,
    format: (text, values) => translateTemplate(language, text, values),
    t: (text) => translateText(language, text),
  }), [isLoading, language, setLanguage]);

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage(): AppLanguageContextValue {
  const context = useContext(AppLanguageContext);
  if (!context) throw new Error('app_language_provider_missing');
  return context;
}

export function useOptionalAppLanguage(): AppLanguageContextValue {
  const context = useContext(AppLanguageContext);
  return context ?? {
    isLoading: false,
    language: 'ko',
    setLanguage: async () => undefined,
    format: (text, values) => translateTemplate('ko', text, values),
    t: (text) => translateText('ko', text),
  };
}
