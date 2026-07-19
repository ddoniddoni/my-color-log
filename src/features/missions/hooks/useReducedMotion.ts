import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [isReducedMotionEnabled, setIsReducedMotionEnabled] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReducedMotionEnabled);
    return () => subscription.remove();
  }, []);

  return isReducedMotionEnabled;
}
