import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhotoViewingPreferences = Record<string, string>;
const key = (userId: string) => `@mycolorlog/photo-viewing/v1/${userId}`;

// One day's metadata per account; never persist image URLs or pixels here.
export async function readPhotoViewingPreferences(userId: string, dateKey: string): Promise<PhotoViewingPreferences> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('dateKey' in value) || value.dateKey !== dateKey || !('photos' in value)
    || !Array.isArray(value.photos)) return {};
  return Object.fromEntries(value.photos.slice(0, 9).filter((item): item is [string, string] =>
    Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string'
    && /^#[0-9a-f]{6}$/i.test(item[1])));
}

export async function writePhotoViewingPreferences(userId: string, dateKey: string, photos: PhotoViewingPreferences): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify({ dateKey, photos: Object.entries(photos).slice(-9) }));
}
