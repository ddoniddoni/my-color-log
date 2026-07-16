import { useEffect, useState } from 'react';

import { getMillisecondsUntilNextKstMidnight } from '@/src/utils/dates/kst';

export function useKstCountdown(): number {
  const [milliseconds, setMilliseconds] = useState(() => getMillisecondsUntilNextKstMidnight());

  useEffect(() => {
    const interval = setInterval(() => setMilliseconds(getMillisecondsUntilNextKstMidnight()), 1_000);
    return () => clearInterval(interval);
  }, []);

  return milliseconds;
}
