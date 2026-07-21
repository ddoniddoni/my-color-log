import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getDateKeyInTimeZone, normalizeTimeZone } from '@/src/utils/dates/timezone';

export function useTimeZoneDateKey(timeZone: string): string {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const [dateKey, setDateKey] = useState(() => getDateKeyInTimeZone(new Date(), normalizedTimeZone));

  useEffect(() => {
    const refresh = (): void => setDateKey(getDateKeyInTimeZone(new Date(), normalizedTimeZone));
    refresh();
    const interval = setInterval(refresh, 1_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [normalizedTimeZone]);

  return dateKey;
}
