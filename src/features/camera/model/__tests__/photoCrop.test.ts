import {
  createPhotoCropAdjustment,
  getSquareCropForAdjustment,
  movePhotoCropFocus,
  normalizePhotoCropAdjustment,
} from '@/src/features/camera/model/photoCrop';

describe('photo crop adjustments', () => {
  it('starts with the entire square image in the crop', () => {
    expect(getSquareCropForAdjustment(createPhotoCropAdjustment(), 1600, 1600)).toEqual({
      originX: 0,
      originY: 0,
      width: 1600,
      height: 1600,
    });
  });

  it('creates a centered square crop at the chosen zoom level', () => {
    expect(getSquareCropForAdjustment({ focusX: 0.5, focusY: 0.5, zoom: 2 }, 1600, 1600)).toEqual({
      originX: 400,
      originY: 400,
      width: 800,
      height: 800,
    });
  });

  it('keeps crop movement within the source image', () => {
    const moved = movePhotoCropFocus({ focusX: 0.5, focusY: 0.5, zoom: 2 }, 'right', 1600, 1600);
    expect(moved.focusX).toBeGreaterThan(0.5);
    expect(movePhotoCropFocus({ focusX: 1, focusY: 1, zoom: 2 }, 'down', 1600, 1600)).toEqual({
      focusX: 0.75,
      focusY: 0.75,
      zoom: 2,
    });
  });

  it('normalizes zoom and focus for a non-square source', () => {
    expect(normalizePhotoCropAdjustment({ focusX: 2, focusY: -1, zoom: 9 }, 1000, 1600)).toEqual({
      focusX: 0.8,
      focusY: 0.125,
      zoom: 2.5,
    });
    expect(() => getSquareCropForAdjustment(createPhotoCropAdjustment(), 0, 100)).toThrow('invalid_photo_crop_dimensions');
  });
});
