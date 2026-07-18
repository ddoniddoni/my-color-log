import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

export async function saveDiaryCollageToLibrary(uri: string): Promise<void> {
  // Android Expo Go cannot request broad photo-library access. Saving a newly
  // rendered collage only needs write access, so do not request photo reading.
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (permission.status !== 'granted') throw new Error('diary_collage_save_permission_denied');

  await MediaLibrary.createAssetAsync(toLocalFileUri(uri));
}

export async function shareDiaryCollage(uri: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('diary_collage_sharing_unavailable');

  await Sharing.shareAsync(toLocalFileUri(uri), {
    dialogTitle: '나의 Color Log 공유하기',
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
  });
}

function toLocalFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}
