import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, type ImageManipulatorContext, SaveFormat } from 'expo-image-manipulator';

import { type SquareCrop } from '@/src/features/camera/model/squareCrop';
import { getCenteredSquareCrop, getSquareResize } from '@/src/features/camera/model/squareCrop';
import { addPendingPhoto, updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_COMPRESSION = 0.82;

export type SavePhotoForReviewInput = {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  userId: string;
  missionId: string;
  dateKey: string;
  position: number;
};

export async function saveCapturedPhotoForReview(input: SavePhotoForReviewInput): Promise<PendingPhoto> {
  const photoId = randomUUID();
  const entryId = randomUUID();
  const context = ImageManipulator.manipulate(input.sourceUri);
  const crop = getCenteredSquareCrop(input.sourceWidth, input.sourceHeight);
  context.crop(crop);
  const resize = getSquareResize(crop.width, MAX_IMAGE_DIMENSION);
  if (resize) context.resize(resize);

  const rendered = await context.renderAsync();
  const processed = await rendered.saveAsync({ base64: false, compress: JPEG_COMPRESSION, format: SaveFormat.JPEG });
  const processedFile = new File(processed.uri);
  if (!processedFile.exists) throw new Error('processed_photo_missing');

  const photoDirectory = new Directory(Paths.document, 'photo-queue', input.userId, input.dateKey);
  photoDirectory.create({ idempotent: true, intermediates: true });
  const destination = new File(photoDirectory, `${photoId}.jpg`);
  destination.write(await processedFile.bytes());
  const byteSize = destination.size;
  if (!destination.exists || byteSize <= 0) throw new Error('local_photo_preservation_failed');

  const pendingPhoto: PendingPhoto = {
    id: photoId,
    userId: input.userId,
    entryId,
    dateKey: input.dateKey,
    missionId: input.missionId,
    localUri: destination.uri,
    storagePath: `${input.userId}/${input.dateKey}/${photoId}.jpg`,
    position: input.position,
    caption: null,
    capturedAt: new Date().toISOString(),
    width: processed.width,
    height: processed.height,
    byteSize,
    status: 'local_saved',
    retryCount: 0,
    lastErrorCode: null,
  };

  await addPendingPhoto(pendingPhoto);
  return pendingPhoto;
}

export async function confirmCapturedPhoto(photo: PendingPhoto, caption: string): Promise<PendingPhoto> {
  const confirmedPhoto: PendingPhoto = {
    ...photo,
    caption: normalizeCaption(caption),
    status: 'pending',
  };
  await updatePendingPhoto(photo.id, { caption: confirmedPhoto.caption, status: confirmedPhoto.status });
  return confirmedPhoto;
}

export async function rotateCapturedPhoto(photo: PendingPhoto): Promise<PendingPhoto> {
  return editCapturedPhoto(photo, (context) => context.rotate(90));
}

export async function cropCapturedPhoto(photo: PendingPhoto, crop: SquareCrop): Promise<PendingPhoto> {
  if (!isValidCrop(crop, photo.width, photo.height)) throw new Error('invalid_photo_crop');

  return editCapturedPhoto(photo, (context) => context.crop(crop));
}

export async function discardCapturedPhoto(photo: PendingPhoto): Promise<void> {
  await updatePendingPhoto(photo.id, { status: 'cancelled' });
  await removeLocalPhotoFile(photo.localUri);
}

export async function removeLocalPhotoFile(localUri: string): Promise<void> {
  try {
    const file = new File(localUri);
    if (file.exists) file.delete();
  } catch {
    // A remote deletion still completes even if this stale local cache cannot be cleaned now.
  }
}

async function editCapturedPhoto(
  photo: PendingPhoto,
  applyEdit: (context: ImageManipulatorContext) => ImageManipulatorContext,
): Promise<PendingPhoto> {
  if (photo.status !== 'local_saved') throw new Error('photo_edit_not_available');

  const sourceFile = new File(photo.localUri);
  if (!sourceFile.exists) throw new Error('photo_edit_source_missing');

  const context = ImageManipulator.manipulate(photo.localUri);
  applyEdit(context);
  const rendered = await context.renderAsync();
  const processed = await rendered.saveAsync({ base64: false, compress: JPEG_COMPRESSION, format: SaveFormat.JPEG });
  const processedFile = new File(processed.uri);
  if (!processedFile.exists || processedFile.size <= 0) throw new Error('photo_edit_render_failed');

  const editedFile = new File(sourceFile.parentDirectory, `${photo.id}-${Date.now()}.jpg`);
  try {
    editedFile.write(await processedFile.bytes());
    if (!editedFile.exists || editedFile.size <= 0) throw new Error('photo_edit_preservation_failed');

    const editedPhoto: PendingPhoto = {
      ...photo,
      byteSize: editedFile.size,
      height: processed.height,
      localUri: editedFile.uri,
      width: processed.width,
    };
    await updatePendingPhoto(photo.id, {
      byteSize: editedPhoto.byteSize,
      height: editedPhoto.height,
      localUri: editedPhoto.localUri,
      width: editedPhoto.width,
    });
    await removeLocalPhotoFile(photo.localUri);
    return editedPhoto;
  } catch (error) {
    await removeLocalPhotoFile(editedFile.uri);
    throw error;
  } finally {
    await removeLocalPhotoFile(processedFile.uri);
  }
}

function isValidCrop(crop: SquareCrop, sourceWidth: number, sourceHeight: number): boolean {
  return Number.isInteger(crop.originX)
    && Number.isInteger(crop.originY)
    && Number.isInteger(crop.width)
    && Number.isInteger(crop.height)
    && crop.width > 0
    && crop.height > 0
    && crop.width === crop.height
    && crop.originX >= 0
    && crop.originY >= 0
    && crop.originX + crop.width <= sourceWidth
    && crop.originY + crop.height <= sourceHeight;
}

function normalizeCaption(caption: string): string | null {
  const normalized = caption.trim();
  return normalized.length > 0 ? normalized.slice(0, 80) : null;
}
