export type UploadStatus = 'local_saved' | 'pending' | 'uploading' | 'synced' | 'failed' | 'cancelled';

export type PendingPhoto = {
  id: string;
  userId: string;
  entryId: string;
  dateKey: string;
  missionId: string;
  localUri: string;
  storagePath: string;
  position: number;
  caption: string | null;
  capturedAt: string;
  width: number;
  height: number;
  byteSize: number;
  status: UploadStatus;
  retryCount: number;
  lastErrorCode: string | null;
};

export function parsePendingPhoto(value: unknown): PendingPhoto | null {
  if (!isRecord(value)) return null;
  if (!isUploadStatus(value.status)) return null;
  if (!isString(value.id) || !isString(value.userId) || !isString(value.entryId)) return null;
  if (!isString(value.dateKey) || !isString(value.missionId) || !isString(value.localUri)) return null;
  if (!isString(value.storagePath) || !isString(value.capturedAt)) return null;
  if (!isPhotoPosition(value.position) || !isPositiveNumber(value.width) || !isPositiveNumber(value.height)) return null;
  if (!isPositiveNumber(value.byteSize) || !isNonNegativeInteger(value.retryCount)) return null;
  if (value.caption !== null && !isString(value.caption)) return null;
  if (value.lastErrorCode !== null && !isString(value.lastErrorCode)) return null;

  return {
    id: value.id,
    userId: value.userId,
    entryId: value.entryId,
    dateKey: value.dateKey,
    missionId: value.missionId,
    localUri: value.localUri,
    storagePath: value.storagePath,
    position: value.position,
    caption: value.caption,
    capturedAt: value.capturedAt,
    width: value.width,
    height: value.height,
    byteSize: value.byteSize,
    status: value.status,
    retryCount: value.retryCount,
    lastErrorCode: value.lastErrorCode,
  };
}

export function isPendingUpload(photo: PendingPhoto): boolean {
  return photo.status === 'pending' || photo.status === 'uploading';
}

export function comparePhotosForSync(left: PendingPhoto, right: PendingPhoto): number {
  const capturedAtComparison = left.capturedAt.localeCompare(right.capturedAt);
  if (capturedAtComparison !== 0) return capturedAtComparison;

  const dateComparison = left.dateKey.localeCompare(right.dateKey);
  if (dateComparison !== 0) return dateComparison;

  const positionComparison = left.position - right.position;
  return positionComparison !== 0 ? positionComparison : left.id.localeCompare(right.id);
}

export function getNextPendingUpload(photos: readonly PendingPhoto[]): PendingPhoto | null {
  return photos.filter(isPendingUpload).sort(comparePhotosForSync)[0] ?? null;
}

export function getNextCancelledPhoto(
  photos: readonly PendingPhoto[],
  attemptedPhotoIds: ReadonlySet<string>,
): PendingPhoto | null {
  return photos
    .filter((photo) => photo.status === 'cancelled' && !attemptedPhotoIds.has(photo.id))
    .sort(comparePhotosForSync)[0] ?? null;
}

export function getRecoverableFailedPhotos(
  photos: readonly PendingPhoto[],
  attemptedPhotoIds: ReadonlySet<string>,
): PendingPhoto[] {
  return photos
    .filter((photo) => photo.status === 'failed' && !attemptedPhotoIds.has(photo.id))
    .sort(comparePhotosForSync);
}

function isUploadStatus(value: unknown): value is UploadStatus {
  return value === 'local_saved' || value === 'pending' || value === 'uploading' || value === 'synced' || value === 'failed' || value === 'cancelled';
}

function isPhotoPosition(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 && value <= 9;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
