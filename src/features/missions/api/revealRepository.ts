import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMissionRevealStorageKey } from '@/src/features/missions/model/revealState';

export async function hasRevealedMission(dateKey: string): Promise<boolean> {
  return (await AsyncStorage.getItem(getMissionRevealStorageKey(dateKey))) === 'revealed';
}

export async function markMissionRevealed(dateKey: string): Promise<void> {
  await AsyncStorage.setItem(getMissionRevealStorageKey(dateKey), 'revealed');
}
