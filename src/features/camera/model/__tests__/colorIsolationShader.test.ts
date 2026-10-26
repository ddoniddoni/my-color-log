/** @jest-environment node */
/// <reference types="node" />

import { createRequire } from 'node:module';
import { TextDecoder } from 'node:util';
import CanvasKitInit, { type CanvasKit, type RuntimeEffect, type ColorSpace } from 'canvaskit-wasm';

import { COLOR_ISOLATION_SHADER, getColorIsolationUniforms } from '@/src/features/camera/model/colorIsolation';

type Pixel = readonly [number, number, number, number];

let skia: CanvasKit;
let effect: RuntimeEffect;
const textDecoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');

beforeAll(async () => {
  // Expo's UTF-8-only decoder cannot load CanvasKit's UTF-16 WASM bindings.
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder });
  // Execute the production SkSL, rather than a JavaScript copy of the filter.
  skia = await CanvasKitInit({
    locateFile: () => createRequire(__filename).resolve('canvaskit-wasm/bin/canvaskit.wasm'),
  });
  const compiled = skia.RuntimeEffect.Make(COLOR_ISOLATION_SHADER);
  if (!compiled) throw new Error('color_isolation_shader_compile_failed');
  effect = compiled;
});

afterAll(() => {
  effect?.delete();
  if (textDecoderDescriptor) Object.defineProperty(globalThis, 'TextDecoder', textDecoderDescriptor);
});

function render(pixel: Pixel, targetHex = '#E53935', sourceSpace?: ColorSpace): number[] {
  const uniforms = getColorIsolationUniforms(targetHex);
  if (!uniforms) throw new Error('invalid_test_color');
  const values = new Map<string, readonly number[]>(
    Object.entries(uniforms).map(([key, value]) => [key, typeof value === 'number' ? [value] : value]),
  );
  const orderedUniforms = Array.from({ length: effect.getUniformCount() }, (_, index) => {
    const name = effect.getUniformName(index);
    const value = values.get(name);
    if (!value) throw new Error(`missing_uniform_${name}`);
    return [...value];
  }).flat();
  const surface = skia.MakeSurface(1, 1);
  if (!surface) throw new Error('test_surface_unavailable');
  const source = skia.Shader.MakeColor(skia.Color4f(pixel[0] / 255, pixel[1] / 255, pixel[2] / 255, pixel[3]), sourceSpace ?? skia.ColorSpace.SRGB);
  const shader = effect.makeShaderWithChildren(orderedUniforms, [source]);
  const paint = new skia.Paint();
  try {
    paint.setShader(shader);
    surface.getCanvas().drawPaint(paint);
    const result = surface.getCanvas().readPixels(0, 0, {
      width: 1,
      height: 1,
      alphaType: skia.AlphaType.Unpremul,
      colorType: skia.ColorType.RGBA_8888,
      colorSpace: skia.ColorSpace.SRGB,
    });
    if (!result) throw new Error('test_pixels_unavailable');
    return Array.from(result);
  } finally {
    paint.delete();
    shader.delete();
    source.delete();
    surface.dispose();
  }
}

function saturation(rgb: readonly number[]): number {
  const channels = rgb.slice(0, 3);
  return (Math.max(...channels) - Math.min(...channels)) / Math.max(1, ...channels);
}

function renderPatch(center: Pixel, surrounding: Pixel, target = '#E53935'): number[] {
  const uniforms = getColorIsolationUniforms(target)!;
  const values = new Map(Object.entries(uniforms).map(([name, value]) => [name, typeof value === 'number' ? [value] : [...value]]));
  const ordered = Array.from({ length: effect.getUniformCount() }, (_, index) => values.get(effect.getUniformName(index))!).flat();
  const rgba = new Uint8Array(5 * 5 * 4);
  for (let i = 0; i < 25; i += 1) {
    const pixel = i === 12 ? center : surrounding;
    rgba.set([pixel[0], pixel[1], pixel[2], Math.round(pixel[3] * 255)], i * 4);
  }
  const image = skia.MakeImage({ width: 5, height: 5, alphaType: skia.AlphaType.Unpremul,
    colorType: skia.ColorType.RGBA_8888, colorSpace: skia.ColorSpace.SRGB }, rgba, 20)!;
  const source = image.makeShaderOptions(skia.TileMode.Clamp, skia.TileMode.Clamp, skia.FilterMode.Nearest, skia.MipmapMode.None);
  const shader = effect.makeShaderWithChildren(ordered, [source]);
  const surface = skia.MakeSurface(5, 5)!;
  const paint = new skia.Paint();
  try {
    paint.setShader(shader);
    surface.getCanvas().drawPaint(paint);
    const output = surface.getCanvas().readPixels(2, 2, { width: 1, height: 1, alphaType: skia.AlphaType.Unpremul,
      colorType: skia.ColorType.RGBA_8888, colorSpace: skia.ColorSpace.SRGB });
    return Array.from(output!);
  } finally { paint.delete(); surface.dispose(); shader.delete(); source.delete(); image.delete(); }
}

describe('spatial color confidence', () => {
  it('suppresses isolated weak color noise more than a continuous pale target surface', () => {
    const weakRed: Pixel = [180, 165, 164, 1];
    const coherent = renderPatch(weakRed, weakRed);
    const noise = renderPatch(weakRed, [170, 170, 170, 1]);
    expect(saturation(noise)).toBeLessThan(saturation(coherent) * 0.6);
  });

  it('supports a weak reflection surrounded by the same color without flattening its brightness', () => {
    const reflection: Pixel = [190, 175, 173, 1];
    const isolated = render(reflection);
    const supported = renderPatch(reflection, [190, 150, 145, 1]);
    expect(saturation(supported)).toBeGreaterThan(saturation(isolated) * 1.3);
    expect(Math.max(...supported.slice(0, 3))).toBeGreaterThanOrEqual(Math.max(...isolated.slice(0, 3)));
  });

  it.each<Pixel>([[170, 170, 170, 1], [210, 50, 95, 1], [4, 1, 1, 1], [40, 190, 80, 1]])(
    'does not spread red into excluded colors, neutral highlights or deep noise (%i,%i,%i)', (r, g, b, a) => {
      expect(saturation(renderPatch([r, g, b, a], [210, 50, 55, 1]))).toBeLessThan(0.03);
    },
  );

  it('preserves a tiny saturated target even when its neighbors are unrelated', () => {
    expect(renderPatch([210, 50, 55, 1], [40, 190, 80, 1])).toEqual(render([210, 50, 55, 1]));
  });

  it('does not let transparent neighbors weaken an opaque edge', () => {
    const edge: Pixel = [180, 165, 164, 1];
    expect(renderPatch(edge, [0, 0, 0, 0])).toEqual(render(edge));
  });

  it('does not create brightness blotches when weak chroma confidence changes', () => {
    const source: Pixel = [190, 175, 173, 1];
    const expected = (source[0] * 0.2126 + source[1] * 0.7152 + source[2] * 0.0722) * 0.82;
    for (const surrounding of [[170, 170, 170, 1], source, [190, 150, 145, 1]] as const) {
      const result = renderPatch(source, surrounding);
      const brightness = result[0] * 0.2126 + result[1] * 0.7152 + result[2] * 0.0722;
      expect(Math.abs(brightness - expected)).toBeLessThan(1);
    }
  });
});

describe('color isolation rendered pixels', () => {
  it.each<Pixel>([
    [200, 160, 158, 1],
    [190, 100, 96, 1],
    [82, 20, 22, 1],
  ])('keeps and strengthens a red shade (%i, %i, %i)', (r, g, b, a) => {
    const source: Pixel = [r, g, b, a];
    expect(saturation(render(source))).toBeGreaterThan(saturation(source) + 0.04);
  });

  it('recognizes the same blue family at different saturations and brightnesses', () => {
    for (const pixel of [[160, 190, 220, 1], [20, 60, 100, 1]] as const) {
      const result = render(pixel, '#1976D2');
      expect(result[2]).toBeGreaterThan(result[1]);
      expect(result[1]).toBeGreaterThan(result[0]);
      expect(saturation(result)).toBeGreaterThan(saturation(pixel));
    }
  });

  it.each<Pixel>([[40, 190, 80, 1], [40, 100, 220, 1]])('makes other colors quieter grayscale (%i, %i, %i)', (r, g, b, a) => {
    const result = render([r, g, b, a]);
    const originalLuminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    expect(Math.max(...result.slice(0, 3)) - Math.min(...result.slice(0, 3))).toBeLessThanOrEqual(1);
    expect(result[0]).toBeLessThan(originalLuminance * 0.9);
    expect(result[0]).toBeGreaterThan(originalLuminance * 0.7);
  });

  it('keeps neutral highlights and deep shadow noise achromatic', () => {
    for (const pixel of [[255, 255, 255, 1], [180, 178, 178, 1], [4, 1, 1, 1], [0, 0, 0, 1]] as const) {
      expect(saturation(render(pixel))).toBeLessThan(0.02);
    }
    expect(render([0, 0, 0, 1])).toEqual([0, 0, 0, 255]);
  });

  it('preserves grayscale tonal detail instead of flattening the background', () => {
    const tones = [32, 96, 160, 224].map((level) => render([level, level, level, 1])[0]);
    for (let index = 1; index < tones.length; index += 1) {
      expect(tones[index] - tones[index - 1]).toBeGreaterThan(40);
    }
  });

  it('keeps red on both sides of the hue wrap-around', () => {
    expect(saturation(render([210, 50, 55, 1], '#FF0000'))).toBeGreaterThan(0.8);
    expect(saturation(render([210, 55, 50, 1], '#FF0000'))).toBeGreaterThan(0.8);
  });

  // Representative cool pink / raspberry swatches, not pixels extracted from
  // the user's already-filtered screenshot. Include highlights and shadows.
  it.each<Pixel>([
    [210, 50, 95, 1],
    [170, 75, 105, 1],
    [115, 45, 65, 1],
    [230, 140, 165, 1],
    [220, 40, 76, 1],
  ])('does not emphasize a cool pink as tomato red (%i, %i, %i)', (r, g, b, a) => {
    for (const target of ['#E53935', '#FF0000']) {
      expect(saturation(render([r, g, b, a], target))).toBeLessThan(0.03);
    }
    // Tightening red must not remove these shades from an actual pink mission.
    expect(saturation(render([r, g, b, a], '#EC407A'))).toBeGreaterThan(0.3);
  });

  it('softly separates red from raspberry while keeping the hue wrap-around', () => {
    const core = saturation(render([240, 0, 8, 1], '#FF0000'));
    const edge = saturation(render([240, 0, 32, 1], '#FF0000'));
    const outside = saturation(render([240, 0, 52, 1], '#FF0000'));
    expect(core).toBeGreaterThan(0.9);
    expect(edge).toBeGreaterThan(0.15);
    expect(edge).toBeLessThan(0.8);
    expect(outside).toBeLessThan(0.03);
  });

  it('retains saturated dark reds without reopening the boundary for muted pink shadows or wine', () => {
    // Dark red flag samples from the existing NASA astronaut evaluation scene.
    for (const pixel of [[92, 8, 27, 1], [89, 8, 25, 1], [109, 11, 28, 1], [115, 12, 30, 1]] as const) {
      expect(saturation(render(pixel))).toBeGreaterThan(0.8);
    }
    for (const pixel of [[115, 45, 65, 1], [65, 4, 20, 1], [139, 30, 75, 1]] as const) {
      expect(saturation(render(pixel))).toBeLessThan(0.03);
    }
  });

  it('fades nearby hues smoothly without retaining distant orange', () => {
    const core = saturation(render([240, 40, 0, 1], '#FF0000'));
    const edge = saturation(render([240, 80, 0, 1], '#FF0000'));
    const outside = saturation(render([240, 120, 0, 1], '#FF0000'));
    expect(core).toBeGreaterThan(0.9);
    expect(edge).toBeGreaterThan(0.15);
    expect(edge).toBeLessThan(0.8);
    expect(outside).toBeLessThan(0.02);
  });

  it('preserves transparency without a dark fringe or colored transparent pixels', () => {
    const opaque = render([190, 100, 96, 1]);
    const translucent = render([190, 100, 96, 0.5]);
    expect(translucent[3]).toBe(128);
    opaque.slice(0, 3).forEach((value, index) => {
      expect(Math.abs(translucent[index] - value)).toBeLessThanOrEqual(2);
    });
    expect(render([190, 100, 96, 0])).toEqual([0, 0, 0, 0]);
  });

  it('does not arbitrarily select a hue for an achromatic target', () => {
    expect(saturation(render([210, 50, 50, 1], '#888888'))).toBeLessThan(0.02);
  });

  it('keeps a red-shifted wine leaf while suppressing a bright pink for a wine mission', () => {
    expect(saturation(render([92, 44, 49, 1], '#8B1E4B'))).toBeGreaterThan(0.5);
    expect(saturation(render([236, 64, 122, 1], '#8B1E4B'))).toBeLessThan(0.03);
    expect(saturation(render([139, 30, 75, 1], '#8B1E4B'))).toBeGreaterThan(0.9);
  });

  it('retains pale blue sky without amplifying almost-white blue noise', () => {
    const sky: Pixel = [215, 228, 240, 1];
    expect(saturation(render(sky, '#29B6F6'))).toBeGreaterThan(saturation(sky));
    expect(saturation(render([238, 241, 245, 1], '#29B6F6'))).toBeLessThan(0.02);
  });

  it('finds wood and coffee browns without emphasizing bright orange, beige or white', () => {
    for (const pixel of [[141, 110, 99, 1], [110, 65, 38, 1], [85, 56, 35, 1], [160, 125, 85, 1]] as const) {
      expect(saturation(render(pixel, '#8D6E63'))).toBeGreaterThan(0.2);
    }
    for (const pixel of [[245, 124, 0, 1], [253, 216, 53, 1], [215, 196, 163, 1], [238, 237, 234, 1], [210, 50, 95, 1]] as const) {
      expect(saturation(render(pixel, '#8D6E63'))).toBeLessThan(0.03);
    }
  });

  it('finds beige paper and fabric without emphasizing gray, white, brown or vivid yellow', () => {
    for (const pixel of [[215, 196, 163, 1], [230, 210, 175, 1], [190, 170, 140, 1]] as const) {
      expect(saturation(render(pixel, '#D7C4A3'))).toBeGreaterThan(0.15);
    }
    for (const pixel of [[180, 180, 180, 1], [245, 243, 239, 1], [141, 110, 99, 1], [110, 65, 38, 1], [253, 216, 53, 1], [245, 124, 0, 1]] as const) {
      expect(saturation(render(pixel, '#D7C4A3'))).toBeLessThan(0.03);
    }
  });

  it('finds olive foliage without classifying yellow or brown as leaf green', () => {
    expect(saturation(render([90, 100, 50, 1], '#43A047'))).toBeGreaterThan(0.5);
    expect(saturation(render([253, 216, 53, 1], '#43A047'))).toBeLessThan(0.03);
    expect(saturation(render([110, 65, 38, 1], '#43A047'))).toBeLessThan(0.03);
  });

  it('classifies equivalent sRGB and Display P3 input colors consistently', () => {
    // D65 linear sRGB -> Display P3 matrix, then encode with the shared transfer
    // curve. These are equivalent in-gamut colors, not equal RGB triplets.
    const toLinear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const encode = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
    for (const [source, target] of [
      [[92, 44, 49, 1], '#8B1E4B'],
      [[215, 228, 240, 1], '#29B6F6'],
      [[123, 47, 208, 1], '#7B2FD0'],
      [[210, 50, 95, 1], '#E53935'],
      [[220, 40, 76, 1], '#E53935'],
      [[210, 50, 55, 1], '#E53935'],
      [[110, 65, 38, 1], '#8D6E63'],
      [[215, 196, 163, 1], '#D7C4A3'],
    ] as const) {
      const [r, g, b] = source.slice(0, 3).map((v) => toLinear(v / 255));
      const p3: Pixel = [encode(0.82259287*r + 0.17753395*g), encode(0.03319951*r + 0.9667835*g), encode(0.01708535*r + 0.07239572*g + 0.91030148*b), 1];
      const srgbResult = render(source, target);
      const p3Result = render(p3, target, skia.ColorSpace.DISPLAY_P3);
      srgbResult.forEach((value, i) => expect(Math.abs(value - p3Result[i])).toBeLessThanOrEqual(2));
    }
  });

  it('keeps older lime/coral missions and narrow wine ranges renderable', () => {
    for (const pixel of [[164, 204, 56, 1], [255, 127, 80, 1], [130, 20, 29, 1]] as const) {
      const hex = `#${pixel.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      const result = render(pixel, hex);
      expect(saturation(result)).toBeGreaterThan(saturation(pixel));
    }
  });

});
