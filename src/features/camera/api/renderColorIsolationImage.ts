import { FilterMode, MipmapMode, Skia, TileMode, type SkImage, type SkPaint, type SkRuntimeEffect, type SkShader, type SkSurface } from '@shopify/react-native-skia';

import { COLOR_ISOLATION_SHADER, type ColorIsolationUniforms } from '../model/colorIsolation';

// Preview and persistence both filter at source resolution, then scale the
// result for display. Sampling after thumbnail scaling changes mask decisions.
// The caller owns the returned snapshot; the source image remains caller-owned.
export function renderColorIsolationImage(source: SkImage, uniforms: ColorIsolationUniforms): SkImage {
  let effect: SkRuntimeEffect | null = null;
  let imageShader: SkShader | null = null;
  let shader: SkShader | null = null;
  let paint: SkPaint | null = null;
  let surface: SkSurface | null = null;
  try {
    effect = Skia.RuntimeEffect.Make(COLOR_ISOLATION_SHADER);
    if (!effect) throw new Error('photo_color_isolation_render_unavailable');
    const values = new Map(Object.entries(uniforms).map(([name, value]) => [name, typeof value === 'number' ? [value] : [...value]]));
    const ordered = Array.from({ length: effect.getUniformCount() }, (_, index) => {
      const value = values.get(effect!.getUniformName(index));
      if (!value) throw new Error('photo_color_isolation_uniform_missing');
      return value;
    }).flat();
    imageShader = source.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None);
    shader = effect.makeShaderWithChildren(ordered, [imageShader]);
    surface = Skia.Surface.MakeOffscreen(source.width(), source.height());
    if (!surface) throw new Error('photo_color_isolation_surface_unavailable');
    paint = Skia.Paint();
    paint.setShader(shader);
    surface.getCanvas().drawPaint(paint);
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    paint?.dispose();
    surface?.dispose();
    shader?.dispose();
    imageShader?.dispose();
    effect?.dispose();
  }
}
