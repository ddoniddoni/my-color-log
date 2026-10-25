export type NormalizedRgb = readonly [number, number, number];
type Range = readonly [number, number];

export const COLOR_ISOLATION_DEFAULTS = {
  backgroundBrightness: 0.82,
  saturationBoost: 1.35,
  softness: 0.14,
  threshold: 0.32,
} as const;

export type ColorIsolationUniforms = {
  backgroundBrightness: number;
  saturationBoost: number;
  softness: number;
  targetColor: NormalizedRgb;
  threshold: number;
  // Signed circular hue distance: negative inner/outer, positive inner/outer.
  hueRange: readonly [number, number, number, number];
  useHueRange: number;
  saturationRange: Range;
  saturationCeiling: Range;
  shadowRange: Range;
  valueCeiling: Range;
  separateRedFromPink: number;
};

// Classification is independent of compositing. The target HEX and classifier
// both use encoded sRGB, even when Skia's destination uses a different space.
const CLASSIFIER = `
  uniform shader image;
  uniform float3 targetColor;
  uniform float threshold;
  uniform float softness;
  uniform float saturationBoost;
  uniform float backgroundBrightness;
  uniform float4 hueRange;
  uniform float useHueRange;
  uniform float2 saturationRange;
  uniform float2 saturationCeiling;
  uniform float2 shadowRange;
  uniform float2 valueCeiling;
  uniform float separateRedFromPink;

  float3 encodeSrgb(float3 linear) {
    float3 c = clamp(linear, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, float3(1.0 / 2.4)) - 0.055, step(float3(0.0031308), c));
  }
  float3 decodeSrgb(float3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, float3(2.4)), step(float3(0.04045), c));
  }
  float hueAngle(float3 c) {
    float hi = max(c.r, max(c.g, c.b));
    float lo = min(c.r, min(c.g, c.b));
    float d = max(hi - lo, 0.00001);
    float h = hi == c.r ? (c.g - c.b) / d : (hi == c.g ? 2.0 + (c.b - c.r) / d : 4.0 + (c.r - c.g) / d);
    return mod(h * 60.0 + 360.0, 360.0);
  }
  float colorIsolationMask(float3 rgb) {
    float hi = max(rgb.r, max(rgb.g, rgb.b));
    float lo = min(rgb.r, min(rgb.g, rgb.b));
    float saturation = (hi - lo) / max(hi, 0.001);
    float targetHi = max(targetColor.r, max(targetColor.g, targetColor.b));
    float targetLo = min(targetColor.r, min(targetColor.g, targetColor.b));
    float3 pixelHue = (rgb - lo) / max(hi - lo, 0.001);
    float3 targetHue = (targetColor - targetLo) / max(targetHi - targetLo, 0.001);
    float hueMatch = 1.0 - smoothstep(threshold - softness, threshold + softness, length(pixelHue - targetHue));
    if (useHueRange > 0.5) {
      float delta = mod(hueAngle(rgb) - hueAngle(targetColor) + 540.0, 360.0) - 180.0;
      float2 bounds = delta < 0.0 ? hueRange.xy : hueRange.zw;
      hueMatch = 1.0 - smoothstep(bounds.x, bounds.y, abs(delta));
    }
    if (separateRedFromPink > 0.5) {
      // The symmetric distance above accepts raspberry hues as red. Keep the
      // existing match, but fade its cool side between 356 and 350 degrees.
      // Use an absolute family boundary so a slightly warmer target cannot
      // widen this back into pink. Reds on either side of zero still match.
      float hue = hueAngle(rgb);
      float signedHue = hue > 180.0 ? hue - 360.0 : hue;
      float redBoundary = smoothstep(-10.0, -4.0, signedHue);
      // A saturated dark red can shift toward blue in shadow. Give only those
      // pixels a small extension; muted pink shadows and wine stay excluded.
      // The normal shadow/noise floor still applies after this hue decision.
      float darkRed = (1.0 - smoothstep(0.50, 0.65, hi)) * smoothstep(0.82, 0.90, saturation);
      float darkRedBoundary = smoothstep(-16.0, -12.0, signedHue);
      hueMatch *= mix(redBoundary, darkRedBoundary, darkRed);
    }
    float colorPresence = smoothstep(saturationRange.x, saturationRange.y, saturation)
      * (1.0 - smoothstep(saturationCeiling.x, saturationCeiling.y, saturation));
    float shadowPresence = smoothstep(shadowRange.x, shadowRange.y, hi);
    float targetPresence = smoothstep(0.05, 0.18, (targetHi - targetLo) / max(targetHi, 0.001));
    float brightnessPresence = 1.0 - smoothstep(valueCeiling.x, valueCeiling.y, hi);
    return hueMatch * colorPresence * shadowPresence * targetPresence * brightnessPresence;
  }
`;

export const COLOR_ISOLATION_SHADER = `${CLASSIFIER}
  half4 main(float2 xy) {
    half4 pixel = image.eval(xy);
    // Unpremultiply before color conversion; premultiply only the final result.
    float3 rgb = encodeSrgb(toLinearSrgb(pixel.rgb / max(pixel.a, 0.001)));
    float brightest = max(rgb.r, max(rgb.g, rgb.b));
    float darkest = min(rgb.r, min(rgb.g, rgb.b));
    float chroma = brightest - darkest;
    float saturation = chroma / max(brightest, 0.001);
    float3 pixelHue = (rgb - darkest) / max(chroma, 0.001);
    float vividSaturation = min(saturation * saturationBoost, 1.0);
    float3 vividColor = brightest * mix(float3(1.0), pixelHue, vividSaturation);
    float3 grayscale = float3(dot(rgb, float3(0.2126, 0.7152, 0.0722)) * backgroundBrightness);
    float3 result = mix(grayscale, vividColor, colorIsolationMask(rgb));
    return half4(fromLinearSrgb(decodeSrgb(result)) * pixel.a, pixel.a);
  }
`;

// Evaluation renders the production classifier itself, not a copied algorithm.
export const COLOR_ISOLATION_MASK_SHADER = `${CLASSIFIER}
  half4 main(float2 xy) {
    half4 pixel = image.eval(xy);
    float3 rgb = encodeSrgb(toLinearSrgb(pixel.rgb / max(pixel.a, 0.001)));
    return half4(float3(colorIsolationMask(rgb) * pixel.a), 1.0);
  }
`;

export function isColorHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function toNormalizedRgb(colorHex: string): NormalizedRgb | null {
  if (!isColorHex(colorHex)) return null;
  return [
    Number.parseInt(colorHex.slice(1, 3), 16) / 255,
    Number.parseInt(colorHex.slice(3, 5), 16) / 255,
    Number.parseInt(colorHex.slice(5, 7), 16) / 255,
  ];
}

export function getColorIsolationUniforms(colorHex: string): ColorIsolationUniforms | null {
  const targetColor = toNormalizedRgb(colorHex);
  if (!targetColor) return null;
  const [r, g, b] = targetColor;
  const hi = Math.max(r, g, b);
  const chroma = hi - Math.min(r, g, b);
  const segment = chroma === 0 ? 0 : hi === r ? (g - b) / chroma : hi === g ? 2 + (b - r) / chroma : 4 + (r - g) / chroma;
  const hue = (segment * 60 + 360) % 360;
  const uniforms: ColorIsolationUniforms = {
    ...COLOR_ISOLATION_DEFAULTS, targetColor,
    hueRange: [10.8, 27.6, 10.8, 27.6], useHueRange: 0,
    saturationRange: [0.05, 0.18], shadowRange: [0.04, 0.12], valueCeiling: [1, 1.01],
    saturationCeiling: [1, 1.01],
    separateRedFromPink: 0,
  };

  if (hue >= 12 && hue <= 50 && hi < 0.70) {
    // Brown spans warm woods and coffee, but bright orange/yellow and beige
    // must not survive merely because they share a hue with those materials.
    uniforms.hueRange = [hue - 10, hue - 2, 40 - hue, 55 - hue].map((v) => Math.max(0, v)) as [number, number, number, number];
    uniforms.useHueRange = 1;
    uniforms.valueCeiling = [0.68, 0.82];
    uniforms.saturationBoost = 1.10;
  } else if (hue >= 25 && hue <= 55 && hi >= 0.70 && chroma / hi < 0.40) {
    // Beige is light, softly colored paper/fabric; it is neither neutral white
    // nor a fully saturated yellow/orange. Do not recolor it into orange.
    uniforms.hueRange = [hue - 25, hue - 15, 50 - hue, 60 - hue].map((v) => Math.max(0, v)) as [number, number, number, number];
    uniforms.useHueRange = 1;
    uniforms.saturationRange = [0.08, 0.18];
    uniforms.saturationCeiling = [0.38, 0.52];
    uniforms.shadowRange = [0.58, 0.70];
    uniforms.saturationBoost = 1.10;
  } else if (hue >= 315 && hue <= 355 && hi < 0.65) {
    // Dark berry colors need a brightness ceiling to separate wine from pink.
    // Stop the red-side extension before orange/brown coffee and wood hues.
    const redEdge = Math.min(28, 360 - hue);
    uniforms.hueRange = [10.8, 27.6, Math.min(20, redEdge * 0.75), redEdge];
    // Expanded wine hues must not amplify the red sensor noise in dark objects.
    uniforms.shadowRange = [0.08, 0.18];
    uniforms.useHueRange = 1;
    uniforms.valueCeiling = [hi + 0.10, hi + 0.25];
  } else if (hue <= 12 || hue >= 355) {
    // Tomato/pure red needs a tighter cool boundary than pink or wine. Keep
    // the original brightness/saturation tolerance for red shading/reflection.
    uniforms.separateRedFromPink = 1;
  } else if (hue >= 80 && hue < 150) {
    // Allow yellow-green foliage, but keep lemon yellow and brown outside.
    // Absolute lower bounds also protect older lime missions from over-widening.
    uniforms.hueRange = [Math.max(10.8, hue - 70), Math.max(27.6, hue - 52), 10.8, 27.6];
    uniforms.useHueRange = 1;
  } else if (hue >= 150 && hue < 250) {
    // Pale sky still has color; almost-white pixels remain below the floor.
    uniforms.saturationRange = [0.04, 0.12];
  }
  return uniforms;
}
