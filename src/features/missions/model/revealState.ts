const REVEAL_STORAGE_PREFIX = '@mycolorlog/mission-reveal/v2/';

export function getMissionRevealStorageKey(userId: string, dateKey: string): string {
  return `${REVEAL_STORAGE_PREFIX}${userId}/${dateKey}`;
}
