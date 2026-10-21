const CanvasKitInit = require('canvaskit-wasm');
const { shaderFor, uniformsFor } = require('./candidates.cjs');

async function createRenderer() {
  const skia = await CanvasKitInit({ locateFile: () => require.resolve('canvaskit-wasm/bin/canvaskit.wasm') });
  const effects = new Map();
  function pixels(surface, width, height) {
    const result = surface.getCanvas().readPixels(0, 0, {
      width, height, alphaType: skia.AlphaType.Unpremul,
      colorType: skia.ColorType.RGBA_8888, colorSpace: skia.ColorSpace.SRGB,
    });
    if (!(result instanceof Uint8Array)) throw new Error('evaluation_pixels_unavailable');
    return result;
  }
  function makeImage(width, height, rgba) {
    const image = skia.MakeImage({ width, height, alphaType: skia.AlphaType.Unpremul,
      colorType: skia.ColorType.RGBA_8888, colorSpace: skia.ColorSpace.SRGB }, rgba, width * 4);
    if (!image) throw new Error('evaluation_image_unavailable');
    return image;
  }
  function png(surface) {
    const snapshot = surface.makeImageSnapshot();
    try {
      const bytes = snapshot.encodeToBytes();
      if (!bytes) throw new Error('evaluation_encode_failed');
      return bytes;
    } finally { snapshot.delete(); }
  }
  return {
    normalize(encoded, maxSide = 640) {
      const image = skia.MakeImageFromEncoded(encoded);
      if (!image) throw new Error('evaluation_decode_failed');
      const scale = Math.min(1, maxSide / Math.max(image.width(), image.height()));
      const width = Math.round(image.width() * scale);
      const height = Math.round(image.height() * scale);
      const surface = skia.MakeSurface(width, height);
      const paint = new skia.Paint();
      try {
        if (!surface) throw new Error('evaluation_surface_unavailable');
        surface.getCanvas().drawImageRectOptions(image, skia.XYWHRect(0, 0, image.width(), image.height()),
          skia.XYWHRect(0, 0, width, height), skia.FilterMode.Linear, skia.MipmapMode.None, paint);
        return { width, height, rgba: pixels(surface, width, height), png: png(surface) };
      } finally { paint.delete(); surface?.dispose(); image.delete(); }
    },
    render({ width, height, rgba }, target, candidate, maskOnly = false) {
      const key = `${candidate}:${maskOnly}`;
      if (!effects.has(key)) {
        let diagnostic = '';
        const effect = skia.RuntimeEffect.Make(shaderFor(candidate, maskOnly), (error) => { diagnostic = error; });
        if (!effect) throw new Error(`evaluation_compile_failed: ${diagnostic}`);
        effects.set(key, effect);
      }
      const effect = effects.get(key);
      const uniforms = uniformsFor(target, candidate);
      const ordered = Array.from({ length: effect.getUniformCount() }, (_, index) => {
        const value = uniforms[effect.getUniformName(index)];
        if (value === undefined) throw new Error('evaluation_uniform_missing');
        return typeof value === 'number' ? [value] : value;
      }).flat();
      const image = makeImage(width, height, rgba);
      let source;
      let shader;
      let paint;
      let surface;
      try {
        source = image.makeShaderOptions(skia.TileMode.Clamp, skia.TileMode.Clamp, skia.FilterMode.Nearest, skia.MipmapMode.None);
        shader = effect.makeShaderWithChildren(ordered, [source]);
        paint = new skia.Paint();
        surface = skia.MakeSurface(width, height);
        if (!surface) throw new Error('evaluation_surface_unavailable');
        paint.setShader(shader);
        surface.getCanvas().drawPaint(paint);
        return { rgba: pixels(surface, width, height), png: png(surface) };
      } finally { surface?.dispose(); paint?.delete(); shader?.delete(); source?.delete(); image.delete(); }
    },
    dispose() { for (const effect of effects.values()) effect.delete(); effects.clear(); },
  };
}

module.exports = { createRenderer };
