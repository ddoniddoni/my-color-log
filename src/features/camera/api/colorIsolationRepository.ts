import { File } from 'expo-file-system';

import { getColorIsolationUniforms } from '@/src/features/camera/model/colorIsolation';
import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const COLOR_ISOLATION_JPEG_QUALITY = 85;

export async function applyColorIsolationToPhoto(photo: PendingPhoto, colorHex: string): Promise<PendingPhoto> {
  if (photo.status !== 'local_saved') throw new Error('photo_color_isolation_not_available');
  if (photo.colorIsolationApplied) return photo;

  const uniforms = getColorIsolationUniforms(colorHex);
  if (!uniforms) throw new Error('photo_color_isolation_invalid_color');

  const sourceFile = new File(photo.localUri);
  if (!sourceFile.exists) throw new Error('photo_color_isolation_source_missing');

  const [{ ImageFormat, Skia }, { renderColorIsolationImage }] = await Promise.all([
    import('@shopify/react-native-skia'), import('./renderColorIsolationImage'),
  ]);
  let sourceData: Awaited<ReturnType<typeof Skia.Data.fromURI>> | null = null;
  let sourceImage: ReturnType<typeof Skia.Image.MakeImageFromEncoded> = null;
  let destination: File | null = null;
  let filteredImage: ReturnType<typeof Skia.Image.MakeImageFromEncoded> = null;

  try {
    sourceData = await Skia.Data.fromURI(photo.localUri);
    sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);
    if (!sourceImage) throw new Error('photo_color_isolation_render_unavailable');
    filteredImage = renderColorIsolationImage(sourceImage, uniforms);
    destination = new File(sourceFile.parentDirectory, `${photo.id}-color-${Date.now()}.jpg`);
    const bytes = filteredImage.encodeToBytes(ImageFormat.JPEG, COLOR_ISOLATION_JPEG_QUALITY);
    if (bytes.byteLength === 0) throw new Error('photo_color_isolation_encode_failed');

    destination.write(bytes);
    if (!destination.exists || destination.size <= 0) throw new Error('photo_color_isolation_preservation_failed');

    const filteredPhoto: PendingPhoto = {
      ...photo,
      byteSize: destination.size,
      colorIsolationApplied: true,
      height: sourceImage.height(),
      localUri: destination.uri,
      width: sourceImage.width(),
    };
    await updatePendingPhoto(photo.id, {
      byteSize: filteredPhoto.byteSize,
      colorIsolationApplied: true,
      height: filteredPhoto.height,
      localUri: filteredPhoto.localUri,
      width: filteredPhoto.width,
    });
    await removeLocalPhotoFile(photo.localUri);
    return filteredPhoto;
  } catch (error) {
    if (destination) await removeLocalPhotoFile(destination.uri);
    throw error;
  } finally {
    filteredImage?.dispose();
    sourceImage?.dispose();
    sourceData?.dispose();
  }
}
