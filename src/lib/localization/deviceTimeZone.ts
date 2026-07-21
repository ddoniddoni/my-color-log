import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_TIME_ZONE, normalizeTimeZone } from '@/src/utils/dates/timezone';

export function getDeviceTimeZone(): string {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone, DEFAULT_TIME_ZONE);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function useDeviceTimeZone(): string {
  const [timeZone, setTimeZone] = useState(getDeviceTimeZone);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      const nextTimeZone = getDeviceTimeZone();
      setTimeZone((currentTimeZone) => (currentTimeZone === nextTimeZone ? currentTimeZone : nextTimeZone));
    });

    return () => subscription.remove();
  }, []);

  return timeZone;
}
