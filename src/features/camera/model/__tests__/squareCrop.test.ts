import { getCenteredSquareCrop, getSquareResize } from '@/src/features/camera/model/squareCrop';

describe('camera square crop', () => {
  it('crops a landscape image around its center', () => {
    expect(getCenteredSquareCrop(4000, 3000)).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
  });

  it('crops a portrait image around its center', () => {
    expect(getCenteredSquareCrop(3000, 4000)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
  });

  it('keeps small square captures intact and resizes large ones squarely', () => {
    expect(getCenteredSquareCrop(1600, 1600)).toEqual({ originX: 0, originY: 0, width: 1600, height: 1600 });
    expect(getSquareResize(1600, 1600)).toBeNull();
    expect(getSquareResize(2400, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('rejects missing camera dimensions', () => {
    expect(() => getCenteredSquareCrop(0, 3000)).toThrow('invalid_camera_image_dimensions');
    expect(() => getSquareResize(1600, 0)).toThrow('invalid_square_resize_dimensions');
  });
});
