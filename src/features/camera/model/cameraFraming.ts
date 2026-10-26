import { type SquareCrop } from './squareCrop';

type Size = Readonly<{ width: number; height: number }>;
export type CameraLayout = Readonly<Size & { x: number; y: number }>;
export type CameraFrame = Readonly<{ preview: Size; guide: CameraLayout }>;

// CameraView and the guide area are siblings. The guide's onLayout coordinates
// belong to the area, so translate them into CameraView coordinates first.
export function resolveCameraFrame(
  preview: CameraLayout | null,
  guideArea: CameraLayout | null,
  guide: CameraLayout | null,
  borderWidth: number,
): CameraFrame | null {
  if (!isMeasuredLayout(preview) || !isMeasuredLayout(guideArea) || !isMeasuredLayout(guide)
    || !Number.isFinite(borderWidth) || borderWidth < 0) return null;
  const frame: CameraFrame = {
    preview: { width: preview.width, height: preview.height },
    guide: {
      x: guideArea.x + guide.x - preview.x + borderWidth,
      y: guideArea.y + guide.y - preview.y + borderWidth,
      width: guide.width - 2 * borderWidth,
      height: guide.height - 2 * borderWidth,
    },
  };
  return isValidFrame(frame) ? frame : null;
}

// Expo Camera uses centered aspect-fill when no ratio is supplied. iOS may
// already crop the returned file to the preview aspect; Android can return the
// full oriented sensor image. Use the actual returned dimensions in both cases.
// skipProcessing must remain false so these coordinates use the displayed axes.
export function getCameraSquareCrop(sourceWidth: number, sourceHeight: number, frame: CameraFrame): SquareCrop {
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('invalid_camera_image_dimensions');
  }
  if (!isValidFrame(frame)) throw new Error('invalid_camera_frame');

  const scale = Math.max(frame.preview.width / sourceWidth, frame.preview.height / sourceHeight);
  const hiddenX = (sourceWidth * scale - frame.preview.width) / 2;
  const hiddenY = (sourceHeight * scale - frame.preview.height) / 2;
  // Native layout can round each edge to a physical pixel. Keep a square within
  // both measured edges and round only once, in source-image pixels.
  const guideSide = Math.min(frame.guide.width, frame.guide.height);
  const side = Math.min(sourceWidth, sourceHeight, Math.max(1, Math.round(guideSide / scale)));
  const x = (frame.guide.x + (frame.guide.width - guideSide) / 2 + hiddenX) / scale;
  const y = (frame.guide.y + (frame.guide.height - guideSide) / 2 + hiddenY) / scale;
  return {
    originX: Math.max(0, Math.min(sourceWidth - side, Math.round(x))),
    originY: Math.max(0, Math.min(sourceHeight - side, Math.round(y))),
    width: side,
    height: side,
  };
}

function isValidFrame({ preview, guide }: CameraFrame): boolean {
  return [preview.width, preview.height, guide.width, guide.height].every((value) => Number.isFinite(value) && value > 0)
    && Number.isFinite(guide.x) && Number.isFinite(guide.y)
    && guide.x >= 0 && guide.y >= 0
    && guide.x + guide.width <= preview.width + 0.001
    && guide.y + guide.height <= preview.height + 0.001
    && Math.abs(guide.width - guide.height) <= 1;
}

function isMeasuredLayout(layout: CameraLayout | null): layout is CameraLayout {
  return layout !== null && [layout.x, layout.y, layout.width, layout.height].every(Number.isFinite)
    && layout.width > 0 && layout.height > 0;
}
