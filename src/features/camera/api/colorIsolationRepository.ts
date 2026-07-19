import { File } from 'expo-file-system';

import { COLOR_ISOLATION_SHADER, getColorIsolationUniforms } from '@/src/features/camera/model/colorIsolation';
import { removeLocalPhotoFile } from '@/src/features/camera/api/localPhotoRepository';
import { updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const COLOR_ISOLATION_JPEG_QUALITY = 85;

export async function applyColorIsolationToPhoto(photo: PendingPhoto, colorHex: string): Promise<PendingPhoto> {
  if (photo.status !== 'local_saved') throw new Error('photo_color_isolation_not_available');

  const uniforms = getColorIsolationUniforms(colorHex);
  if (!uniforms) throw new Error('photo_color_isolation_invalid_color');

  const sourceFile = new File(photo.localUri);
  if (!sourceFile.exists) throw new Error('photo_color_isolation_source_missing');

  const { ImageFormat, Skia } = await import('@shopify/react-native-skia');
  const sourceData = await Skia.Data.fromURI(photo.localUri);
  const sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);
  const runtimeEffect = Skia.RuntimeEffect.Make(COLOR_ISOLATION_SHADER);
  if (!sourceImage || !runtimeEffect) {
    sourceData.dispose();
    sourceImage?.dispose();
    runtimeEffect?.dispose();
    throw new Error('photo_color_isolation_render_unavailable');
  }

  const destination = new File(sourceFile.parentDirectory, `${photo.id}-color-${Date.now()}.jpg`);
  let surface: ReturnType<typeof Skia.Surface.MakeOffscreen> = null;
  let filteredImage: ReturnType<typeof Skia.Image.MakeImageFromEncoded> = null;
  let builder: ReturnType<typeof Skia.RuntimeShaderBuilder> | null = null;
  let imageFilter: ReturnType<typeof Skia.ImageFilter.MakeRuntimeShader> | null = null;
  let paint: ReturnType<typeof Skia.Paint> | null = null;

  try {
    surface = Skia.Surface.MakeOffscreen(sourceImage.width(), sourceImage.height());
    if (!surface) throw new Error('photo_color_isolation_surface_unavailable');

    builder = Skia.RuntimeShaderBuilder(runtimeEffect);
    builder.setUniform('targetColor', uniforms.targetColor);
    builder.setUniform('threshold', [uniforms.threshold]);
    builder.setUniform('softness', [uniforms.softness]);
    imageFilter = Skia.ImageFilter.MakeRuntimeShader(builder, null, null);
    paint = Skia.Paint();
    paint.setImageFilter(imageFilter);

    surface.getCanvas().drawImage(sourceImage, 0, 0, paint);
    surface.flush();
    filteredImage = surface.makeImageSnapshot();
    const bytes = filteredImage.encodeToBytes(ImageFormat.JPEG, COLOR_ISOLATION_JPEG_QUALITY);
    if (bytes.byteLength === 0) throw new Error('photo_color_isolation_encode_failed');

    destination.write(bytes);
    if (!destination.exists || destination.size <= 0) throw new Error('photo_color_isolation_preservation_failed');

    const filteredPhoto: PendingPhoto = {
      ...photo,
      byteSize: destination.size,
      height: sourceImage.height(),
      localUri: destination.uri,
      width: sourceImage.width(),
    };
    await updatePendingPhoto(photo.id, {
      byteSize: filteredPhoto.byteSize,
      height: filteredPhoto.height,
      localUri: filteredPhoto.localUri,
      width: filteredPhoto.width,
    });
    await removeLocalPhotoFile(photo.localUri);
    return filteredPhoto;
  } catch (error) {
    await removeLocalPhotoFile(destination.uri);
    throw error;
  } finally {
    paint?.dispose();
    imageFilter?.dispose();
    builder?.dispose();
    filteredImage?.dispose();
    surface?.dispose();
    runtimeEffect.dispose();
    sourceImage.dispose();
    sourceData.dispose();
  }
}
