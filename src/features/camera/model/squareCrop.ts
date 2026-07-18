export type SquareCrop = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function getCenteredSquareCrop(sourceWidth: number, sourceHeight: number): SquareCrop {
  if (!isPositiveDimension(sourceWidth) || !isPositiveDimension(sourceHeight)) throw new Error('invalid_camera_image_dimensions');

  const width = Math.floor(sourceWidth);
  const height = Math.floor(sourceHeight);
  const side = Math.min(width, height);

  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

export function getSquareResize(side: number, maxDimension: number): { width: number; height: number } | null {
  if (!isPositiveDimension(side) || !isPositiveDimension(maxDimension)) throw new Error('invalid_square_resize_dimensions');
  if (side <= maxDimension) return null;

  return { width: Math.floor(maxDimension), height: Math.floor(maxDimension) };
}

function isPositiveDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
