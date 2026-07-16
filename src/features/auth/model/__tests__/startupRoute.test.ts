import { getAuthenticatedDestination, getStartupDestination } from '@/src/features/auth/model/startupRoute';

describe('getStartupDestination', () => {
  const completedProfile = { id: 'user-id', nickname: '오늘빛', timezone: 'Asia/Seoul', isOnboarded: true };

  it('sends a user without a session to onboarding', () => {
    expect(getStartupDestination(false, null)).toBe('/(onboarding)');
  });

  it('sends a signed-in user without an onboarded profile to nickname setup', () => {
    expect(getStartupDestination(true, null)).toBe('/(onboarding)/nickname');
  });

  it('sends an onboarded user to the tabs', () => {
    expect(getStartupDestination(true, completedProfile)).toBe('/(tabs)');
  });

  it('uses an explicit destination after authentication', () => {
    expect(getAuthenticatedDestination(null)).toBe('/(onboarding)/nickname');
    expect(getAuthenticatedDestination(completedProfile)).toBe('/(tabs)');
  });
});
