import { AppState, Platform } from 'react-native';

export async function playRevealHaptic(): Promise<void> {
  if (Platform.OS === 'web' || AppState.currentState !== 'active') return;
  try {
    const haptics = await import('expo-haptics');
    if (AppState.currentState !== 'active') return;
    if (Platform.OS === 'android') await haptics.performAndroidHapticsAsync(haptics.AndroidHaptics.Confirm);
    else await haptics.impactAsync(haptics.ImpactFeedbackStyle.Soft);
  } catch {
    // Haptics may be disabled or absent in an older development build.
    // The visual reveal and its saved state remain available.
  }
}
