import { getCameraSquareCrop, resolveCameraFrame, type CameraFrame } from '../cameraFraming';

const portrait: CameraFrame = {
  preview: { width: 400, height: 800 },
  guide: { x: 24, y: 187, width: 352, height: 352 },
};

describe('measured camera frame', () => {
  it('translates nested guide coordinates and excludes the border', () => {
    expect(resolveCameraFrame(
      { x: 10, y: 20, width: 400, height: 800 },
      { x: 10, y: 118, width: 400, height: 530 },
      { x: 24, y: 89, width: 352, height: 352 }, 2,
    )).toEqual({ preview: portrait.preview, guide: { x: 26, y: 189, width: 348, height: 348 } });
  });

  it('waits for native layout rather than guessing a screen size', () => {
    expect(resolveCameraFrame(null, null, null, 2)).toBeNull();
    expect(resolveCameraFrame({ x: 0, y: 0, width: 0, height: 0 }, portrait.guide, portrait.guide, 2)).toBeNull();
    expect(resolveCameraFrame({ x: 0, y: 0, ...portrait.preview }, { x: 0, y: 0, width: 400, height: 0 }, portrait.guide, 2)).toBeNull();
  });

  it('uses the guide position on a file already cropped to the iOS preview aspect', () => {
    expect(getCameraSquareCrop(4000, 8000, portrait))
      .toEqual({ originX: 240, originY: 1870, width: 3520, height: 3520 });
  });

  it('accounts for the hidden sides of a full Android portrait sensor image', () => {
    expect(getCameraSquareCrop(3000, 4000, portrait))
      .toEqual({ originX: 620, originY: 935, width: 1760, height: 1760 });
  });

  it('accounts for the hidden top and bottom of a landscape preview', () => {
    expect(getCameraSquareCrop(4000, 3000, {
      preview: { width: 800, height: 400 }, guide: { x: 224, y: 24, width: 352, height: 352 },
    })).toEqual({ originX: 1120, originY: 620, width: 1760, height: 1760 });
  });

  it('uses the measured tablet guide instead of assuming 88% of the screen', () => {
    expect(getCameraSquareCrop(3000, 4000, {
      preview: { width: 800, height: 1000 }, guide: { x: 190, y: 253, width: 420, height: 420 },
    })).toEqual({ originX: 713, originY: 1074, width: 1575, height: 1575 });
  });

  it('keeps fractional layouts aligned within one source pixel after rounding', () => {
    const frame: CameraFrame = { preview: { width: 393, height: 852 }, guide: { x: 25.58, y: 218.08, width: 341.84, height: 341.84 } };
    const crop = getCameraSquareCrop(3024, 4032, frame);
    const scale = 852 / 4032;
    const projectedLeft = crop.originX * scale - (3024 * scale - 393) / 2;
    const projectedTop = crop.originY * scale;
    expect(Math.abs(projectedLeft - frame.guide.x)).toBeLessThanOrEqual(scale);
    expect(Math.abs(projectedTop - frame.guide.y)).toBeLessThanOrEqual(scale);
    expect(Math.abs(projectedLeft + crop.width * scale - (frame.guide.x + frame.guide.width))).toBeLessThanOrEqual(scale);
    expect(Math.abs(projectedTop + crop.height * scale - (frame.guide.y + frame.guide.height))).toBeLessThanOrEqual(scale);
    expect(crop.width).toBe(crop.height);
  });

  it('keeps a full square frame intact and an edge-aligned crop within the file', () => {
    expect(getCameraSquareCrop(1600, 1600, {
      preview: { width: 400, height: 400 }, guide: { x: 0, y: 0, width: 400, height: 400 },
    })).toEqual({ originX: 0, originY: 0, width: 1600, height: 1600 });
    expect(getCameraSquareCrop(3000, 4000, {
      preview: { width: 300, height: 400 }, guide: { x: 0, y: 100, width: 300, height: 300 },
    })).toEqual({ originX: 0, originY: 1000, width: 3000, height: 3000 });
  });

  it.each([
    { ...portrait, preview: { width: 0, height: 800 } },
    { ...portrait, guide: { ...portrait.guide, x: -1 } },
    { ...portrait, guide: { ...portrait.guide, y: 600 } },
    { ...portrait, guide: { ...portrait.guide, width: 400 } },
    { ...portrait, guide: { ...portrait.guide, height: 200 } },
    { ...portrait, guide: { ...portrait.guide, y: NaN } },
  ])('rejects unavailable or out-of-preview geometry %#', (frame) => {
    expect(() => getCameraSquareCrop(3000, 4000, frame)).toThrow('invalid_camera_frame');
  });

  it.each([[0, 4000], [3000, Infinity], [0.5, 4000]])('rejects invalid source dimensions %s × %s', (width, height) => {
    expect(() => getCameraSquareCrop(width, height, portrait)).toThrow('invalid_camera_image_dimensions');
  });
});
