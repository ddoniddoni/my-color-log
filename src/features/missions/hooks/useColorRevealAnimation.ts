import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { playRevealHaptic } from '@/src/features/missions/api/revealHaptics';
import { getRevealTargetRotation, REVEAL_MOTION } from '@/src/features/missions/model/missionRevealWheel';

type RevealPhase = 'idle' | 'turning' | 'saving' | 'ready' | 'error';
type RevealOptions = { targetIndex: number; reduceMotion: boolean; onStart: () => void; onRevealed: () => Promise<void> };

export function useColorRevealAnimation({ targetIndex, reduceMotion, onStart, onRevealed }: RevealOptions) {
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const rotation = useSharedValue(18);
  const progress = useSharedValue(0);
  const mounted = useRef(true);
  const started = useRef(false);
  const completed = useRef(false);
  const saving = useRef(false);
  const callbacks = useRef({ onStart, onRevealed });
  useEffect(() => { callbacks.current = { onStart, onRevealed }; }, [onStart, onRevealed]);

  const persist = useCallback(async () => {
    if (!mounted.current || saving.current) return;
    saving.current = true;
    setPhase('saving');
    try {
      await callbacks.current.onRevealed();
      if (mounted.current) setPhase('ready');
    } catch {
      if (mounted.current) setPhase('error');
    } finally { saving.current = false; }
  }, []);

  const complete = useCallback((animate = true) => {
    if (!mounted.current || completed.current) return;
    completed.current = true;
    // Preserve the short opacity fade; all spatial transforms are disabled by
    // the reduced-motion view. Rotation still honors the system preference.
    progress.set(animate ? withTiming(1, { duration: reduceMotion ? REVEAL_MOTION.reduced : REVEAL_MOTION.settle, reduceMotion: ReduceMotion.Never }) : 1);
    if (animate && !reduceMotion) void playRevealHaptic();
    void persist();
  }, [persist, progress, reduceMotion]);

  const begin = () => {
    if (started.current || targetIndex < 0) return;
    started.current = true;
    callbacks.current.onStart();
    setPhase('turning');
    if (reduceMotion) { complete(); return; }
    rotation.set(withTiming(getRevealTargetRotation(targetIndex), {
      duration: REVEAL_MOTION.turn,
      easing: Easing.bezier(0.16, 0.1, 0.18, 1),
    }, (finished) => { if (finished) scheduleOnRN(complete); }));
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelAnimation(rotation); cancelAnimation(progress); };
  }, [progress, rotation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && started.current && !completed.current) {
        cancelAnimation(rotation);
        complete(false);
      }
    });
    if (reduceMotion && started.current && !completed.current) {
      cancelAnimation(rotation);
      complete();
    }
    return () => subscription.remove();
  }, [complete, reduceMotion, rotation]);

  return { phase, rotation, progress, begin, retry: persist, hasResult: phase === 'saving' || phase === 'ready' || phase === 'error' };
}
