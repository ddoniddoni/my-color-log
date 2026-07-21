import { useEffect, useState } from 'react';

import { getMillisecondsUntilNextMidnight, normalizeTimeZone } from '@/src/utils/dates/timezone';

export function useTimeZoneCountdown(timeZone: string): number {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const [milliseconds, setMilliseconds] = useState(() => getMillisecondsUntilNextMidnight(normalizedTimeZone));

  useEffect(() => {
    const refresh = (): void => setMilliseconds(getMillisecondsUntilNextMidnight(normalizedTimeZone));
    refresh();
    const interval = setInterval(refresh, 1_000);
    return () => clearInterval(interval);
  }, [normalizedTimeZone]);

  return milliseconds;
}
