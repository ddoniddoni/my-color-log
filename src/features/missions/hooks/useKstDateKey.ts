import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getKstDateKey, getMillisecondsUntilNextKstMidnight } from '@/src/utils/dates/kst';

export function useKstDateKey(): string {
  const [dateKey, setDateKey] = useState(() => getKstDateKey());

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (): void => setDateKey(getKstDateKey());
    const scheduleMidnightRefresh = (): void => {
      if (midnightTimer) clearTimeout(midnightTimer);
      midnightTimer = setTimeout(() => {
        refresh();
        scheduleMidnightRefresh();
      }, getMillisecondsUntilNextKstMidnight() + 50);
    };
    scheduleMidnightRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        scheduleMidnightRefresh();
      }
    });
    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      subscription.remove();
    };
  }, []);

  return dateKey;
}
