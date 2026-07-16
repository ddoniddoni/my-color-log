export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  dailyMission: (dateKey: string) => ['dailyMission', dateKey] as const,
  missionReveal: (dateKey: string) => ['missionReveal', dateKey] as const,
};
