import { type Profile } from '@/src/features/profile/model/profile';

export type StartupDestination = '/(tabs)' | '/(onboarding)' | '/(onboarding)/nickname';

export function getStartupDestination(hasSession: boolean, profile: Profile | null): StartupDestination {
  if (!hasSession) return '/(onboarding)';
  if (!profile?.isOnboarded) return '/(onboarding)/nickname';
  return '/(tabs)';
}
