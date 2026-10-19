import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getDailyColorClock } from '@/src/features/missions/model/dailyColorClock';
import { normalizeTimeZone } from '@/src/utils/dates/timezone';

// The date and countdown advance together. No ticking while the app is asleep.
export function useDailyColorClock(timeZone: string) {
  const zone = normalizeTimeZone(timeZone);
  const [clock, setClock] = useState(() => getDailyColorClock(zone, new Date()));
  useEffect(() => subscribeToClock(() => {
    setClock((previous) => getDailyColorClock(zone, new Date(), previous));
  }), [zone]);
  const current = clock.timeZone === zone ? clock : getDailyColorClock(zone, new Date(), clock);
  return { dateKey: current.dateKey, isNewDay: current.isNewDay, millisecondsUntilMidnight: Math.max(0, current.midnightAt - current.now) };
}

// One subscription owns the aligned timer and its cleanup, including callbacks
// already queued when the screen unmounts or the timezone changes.
function subscribeToClock(onTick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const refresh = () => {
    clearTimeout(timer);
    if (disposed) return;
    onTick();
    timer = setTimeout(refresh, 1_000 - (Date.now() % 1_000));
  };
  if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') refresh();
  const subscription = AppState.addEventListener('change', (state) => {
    clearTimeout(timer);
    if (state === 'active') refresh();
  });
  return () => { disposed = true; clearTimeout(timer); subscription.remove(); };
}
