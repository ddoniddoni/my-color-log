import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { addPendingPhoto, updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_COMPRESSION = 0.82;

type CapturePhotoForReviewInput = {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  userId: string;
  missionId: string;
  dateKey: string;
  position: number;
};

export async function saveCapturedPhotoForReview(input: CapturePhotoForReviewInput): Promise<PendingPhoto> {
  const photoId = randomUUID();
  const entryId = randomUUID();
  const context = ImageManipulator.manipulate(input.sourceUri);
  const resize = getResize(input.sourceWidth, input.sourceHeight);
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

function getResize(width: number, height: number): { width?: number; height?: number } | null {
  if (Math.max(width, height) <= MAX_IMAGE_DIMENSION) return null;
  return width >= height ? { width: MAX_IMAGE_DIMENSION } : { height: MAX_IMAGE_DIMENSION };
}

function normalizeCaption(caption: string): string | null {
  const normalized = caption.trim();
  return normalized.length > 0 ? normalized.slice(0, 80) : null;
}
