export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  dailyMission: (dateKey: string) => ['dailyMission', dateKey] as const,
  dailyEntry: (userId: string, dateKey: string) => ['dailyEntry', userId, dateKey] as const,
  activeRoom: (userId: string) => ['activeRoom', userId] as const,
  activeRoomTodayBoard: (userId: string, dateKey: string) => ['activeRoomTodayBoard', userId, dateKey] as const,
  activeRoomHistory: (userId: string) => ['activeRoomHistory', userId] as const,
  activeRoomHistoryBoard: (userId: string, dateKey: string) => ['activeRoomHistoryBoard', userId, dateKey] as const,
  diaryMonth: (userId: string, monthKey: string) => ['diaryMonth', userId, monthKey] as const,
  pendingPhotos: (userId: string, dateKey: string) => ['pendingPhotos', userId, dateKey] as const,
  queuedPhoto: (photoId: string) => ['queuedPhoto', photoId] as const,
  missionReveal: (dateKey: string) => ['missionReveal', dateKey] as const,
  missionRevealPalette: (dateKey: string) => ['missionRevealPalette', dateKey] as const,
};
