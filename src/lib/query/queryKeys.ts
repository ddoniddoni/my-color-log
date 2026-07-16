export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  dailyMission: (dateKey: string) => ['dailyMission', dateKey] as const,
  dailyEntry: (userId: string, dateKey: string) => ['dailyEntry', userId, dateKey] as const,
  pendingPhotos: (userId: string, dateKey: string) => ['pendingPhotos', userId, dateKey] as const,
  queuedPhoto: (photoId: string) => ['queuedPhoto', photoId] as const,
  missionReveal: (dateKey: string) => ['missionReveal', dateKey] as const,
};
