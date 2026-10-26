import { FilterMode, MipmapMode, Skia, TileMode, type SkImage, type SkPaint, type SkRuntimeEffect, type SkShader, type SkSurface } from '@shopify/react-native-skia';

import { COLOR_ISOLATION_SHADER, type ColorIsolationUniforms } from '../model/colorIsolation';

// Preview and persistence both filter at source resolution, then scale the
// result for display. Sampling after thumbnail scaling changes mask decisions.
// The caller owns the returned raster image; the source remains caller-owned.
// A GPU snapshot created on the JS thread must not cross into the Canvas render
// thread. Resolve it to CPU-backed pixels while its producing surface is alive.
export function renderColorIsolationImage(source: SkImage, uniforms: ColorIsolationUniforms, maxDimension?: number): SkImage {
  let effect: SkRuntimeEffect | null = null;
  let imageShader: SkShader | null = null;
  let shader: SkShader | null = null;
  let paint: SkPaint | null = null;
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
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
    snapshot = surface.makeImageSnapshot();
    const image = snapshot.makeNonTextureImage();
    if (!image) throw new Error('photo_color_isolation_readback_failed');
    if (maxDimension && Math.max(image.width(), image.height()) > maxDimension) {
      try { return resizeFilteredImage(image, maxDimension); }
      finally { image.dispose(); }
    }
    return image;
  } finally {
    snapshot?.dispose();
    paint?.dispose();
    surface?.dispose();
    shader?.dispose();
    imageShader?.dispose();
    effect?.dispose();
  }
}

// Downsample only AFTER classification so thumbnail and detail choose the same
// pixels. A CPU surface keeps the small result safe across render contexts.
function resizeFilteredImage(image: SkImage, maxDimension: number): SkImage {
  const scale = maxDimension / Math.max(image.width(), image.height());
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error('photo_color_thumbnail_unavailable');
  const paint = Skia.Paint();
  try {
    surface.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, width, height), paint);
    surface.flush();
    return surface.makeImageSnapshot();
  } finally { paint.dispose(); surface.dispose(); }
}
