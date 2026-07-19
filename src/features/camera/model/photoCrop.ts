import { type SquareCrop } from '@/src/features/camera/model/squareCrop';

export const MIN_PHOTO_CROP_ZOOM = 1;
export const MAX_PHOTO_CROP_ZOOM = 2.5;
export const PHOTO_CROP_ZOOM_STEP = 0.25;

export type PhotoCropAdjustment = {
  focusX: number;
  focusY: number;
  zoom: number;
};

export type PhotoCropMoveDirection = 'down' | 'left' | 'right' | 'up';

export function createPhotoCropAdjustment(): PhotoCropAdjustment {
  return { focusX: 0.5, focusY: 0.5, zoom: MIN_PHOTO_CROP_ZOOM };
}

export function normalizePhotoCropAdjustment(
  adjustment: PhotoCropAdjustment,
  sourceWidth: number,
  sourceHeight: number,
): PhotoCropAdjustment {
  assertDimensions(sourceWidth, sourceHeight);

  const zoom = clamp(adjustment.zoom, MIN_PHOTO_CROP_ZOOM, MAX_PHOTO_CROP_ZOOM);
  const cropSide = Math.max(1, Math.floor(Math.min(sourceWidth, sourceHeight) / zoom));
  const minFocusX = cropSide / (2 * sourceWidth);
  const minFocusY = cropSide / (2 * sourceHeight);

  return {
    focusX: clamp(adjustment.focusX, minFocusX, 1 - minFocusX),
    focusY: clamp(adjustment.focusY, minFocusY, 1 - minFocusY),
    zoom,
  };
}

export function getSquareCropForAdjustment(
  adjustment: PhotoCropAdjustment,
  sourceWidth: number,
  sourceHeight: number,
): SquareCrop {
  const normalized = normalizePhotoCropAdjustment(adjustment, sourceWidth, sourceHeight);
  const side = Math.max(1, Math.floor(Math.min(sourceWidth, sourceHeight) / normalized.zoom));

  return {
    originX: clamp(Math.round(sourceWidth * normalized.focusX - side / 2), 0, sourceWidth - side),
    originY: clamp(Math.round(sourceHeight * normalized.focusY - side / 2), 0, sourceHeight - side),
    width: side,
    height: side,
  };
}

export function movePhotoCropFocus(
  adjustment: PhotoCropAdjustment,
  direction: PhotoCropMoveDirection,
  sourceWidth: number,
  sourceHeight: number,
): PhotoCropAdjustment {
  const normalized = normalizePhotoCropAdjustment(adjustment, sourceWidth, sourceHeight);
  const step = 0.16 / normalized.zoom;
  const next = {
    ...normalized,
    focusX: normalized.focusX + (direction === 'left' ? -step : direction === 'right' ? step : 0),
    focusY: normalized.focusY + (direction === 'up' ? -step : direction === 'down' ? step : 0),
  };

  return normalizePhotoCropAdjustment(next, sourceWidth, sourceHeight);
}

function assertDimensions(sourceWidth: number, sourceHeight: number): void {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0 || !Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    throw new Error('invalid_photo_crop_dimensions');
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
