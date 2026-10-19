import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMissionRevealStorageKey } from '@/src/features/missions/model/revealState';

const MISSION_REVEAL_STORAGE_PREFIX = '@mycolorlog/mission-reveal/';

export async function hasRevealedMission(userId: string, dateKey: string): Promise<boolean> {
  return (await AsyncStorage.getItem(getMissionRevealStorageKey(userId, dateKey))) === 'revealed';
}

export async function markMissionRevealed(userId: string, dateKey: string): Promise<void> {
  await AsyncStorage.setItem(getMissionRevealStorageKey(userId, dateKey), 'revealed');
}

export async function clearMissionRevealHistory(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const revealKeys = keys.filter((key) => key.startsWith(MISSION_REVEAL_STORAGE_PREFIX));
  if (revealKeys.length > 0) await AsyncStorage.multiRemove(revealKeys);
}
