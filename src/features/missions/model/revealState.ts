const REVEAL_STORAGE_PREFIX = '@mycolorlog/mission-reveal/v1/';

export function getMissionRevealStorageKey(dateKey: string): string {
  return `${REVEAL_STORAGE_PREFIX}${dateKey}`;
}
