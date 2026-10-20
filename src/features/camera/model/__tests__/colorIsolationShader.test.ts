/** @jest-environment node */
/// <reference types="node" />

import { createRequire } from 'node:module';
import { TextDecoder } from 'node:util';
import CanvasKitInit, { type CanvasKit, type RuntimeEffect } from 'canvaskit-wasm';

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

function render(pixel: Pixel, targetHex = '#E53935'): number[] {
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
  const source = skia.Shader.MakeColor(skia.Color(...pixel), skia.ColorSpace.SRGB);
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
});
