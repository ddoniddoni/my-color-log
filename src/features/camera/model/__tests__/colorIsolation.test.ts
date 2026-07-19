import { COLOR_ISOLATION_DEFAULTS, getColorIsolationUniforms, isColorHex, toNormalizedRgb } from '@/src/features/camera/model/colorIsolation';

describe('color isolation', () => {
  it('accepts six-digit mission colors', () => {
    expect(isColorHex('#F47F34')).toBe(true);
    expect(isColorHex('#f47f34')).toBe(true);
  });

  it('rejects incomplete or unsafe color route parameters', () => {
    expect(isColorHex('#FFF')).toBe(false);
    expect(isColorHex('F47F34')).toBe(false);
    expect(isColorHex(undefined)).toBe(false);
  });

  it('converts a color hex to shader-ready normalized RGB values', () => {
    expect(toNormalizedRgb('#FF8040')).toEqual([1, 128 / 255, 64 / 255]);
  });

  it('does not produce shader uniforms for invalid colors', () => {
    expect(toNormalizedRgb('#orange')).toBeNull();
    expect(getColorIsolationUniforms('#orange')).toBeNull();
    expect(COLOR_ISOLATION_DEFAULTS).toEqual({ softness: 0.12, threshold: 0.3 });
  });

  it('creates complete shader uniforms for a mission color', () => {
    expect(getColorIsolationUniforms('#FF8040')).toEqual({
      softness: 0.12,
      targetColor: [1, 128 / 255, 64 / 255],
      threshold: 0.3,
    });
  });
});
