import { type Profile } from '@/src/features/profile/model/profile';

export type StartupDestination = '/(tabs)' | '/(onboarding)' | '/(onboarding)/nickname';
export type AuthenticatedDestination = Exclude<StartupDestination, '/(onboarding)'>;

export function getStartupDestination(hasSession: boolean, profile: Profile | null): StartupDestination {
  if (!hasSession) return '/(onboarding)';
  return getAuthenticatedDestination(profile);
}

export function getAuthenticatedDestination(profile: Profile | null): AuthenticatedDestination {
  if (!profile?.isOnboarded) return '/(onboarding)/nickname';
  return '/(tabs)';
}
