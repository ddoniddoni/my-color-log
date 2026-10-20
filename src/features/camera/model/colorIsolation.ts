export type NormalizedRgb = readonly [number, number, number];

export const COLOR_ISOLATION_DEFAULTS = {
  backgroundBrightness: 0.82,
  saturationBoost: 1.35,
  // Match hue independently of brightness and saturation, with a soft edge.
  softness: 0.14,
  threshold: 0.32,
} as const;

export type ColorIsolationUniforms = {
  backgroundBrightness: number;
  saturationBoost: number;
  softness: number;
  targetColor: NormalizedRgb;
  threshold: number;
};

export const COLOR_ISOLATION_SHADER = `
  uniform shader image;
  layout(color) uniform float3 targetColor;
  uniform float threshold;
  uniform float softness;
  uniform float saturationBoost;
  uniform float backgroundBrightness;

  half4 main(float2 xy) {
    half4 pixel = image.eval(xy);
    // Skia shaders use premultiplied alpha. Classify the straight color.
    float3 rgb = clamp(pixel.rgb / max(pixel.a, 0.001), 0.0, 1.0);
    float brightest = max(rgb.r, max(rgb.g, rgb.b));
    float darkest = min(rgb.r, min(rgb.g, rgb.b));
    float chroma = brightest - darkest;
    float saturation = chroma / max(brightest, 0.001);

    float3 pixelHue = (rgb - darkest) / max(chroma, 0.001);
    float targetBrightest = max(targetColor.r, max(targetColor.g, targetColor.b));
    float targetDarkest = min(targetColor.r, min(targetColor.g, targetColor.b));
    float targetChroma = targetBrightest - targetDarkest;
    float3 targetHue = (targetColor - targetDarkest) / max(targetChroma, 0.001);
    float difference = length(pixelHue - targetHue);

    float hueMatch = 1.0 - smoothstep(threshold - softness, threshold + softness, difference);
    // Suppress tinted whites and shadow noise instead of amplifying them.
    float colorPresence = smoothstep(0.05, 0.18, saturation);
    float shadowPresence = smoothstep(0.04, 0.12, brightest);
    float targetPresence = smoothstep(0.05, 0.18, targetChroma / max(targetBrightest, 0.001));
    float colorMask = hueMatch * colorPresence * shadowPresence * targetPresence;

    // Increase saturation while preserving the photographed hue and highlights.
    float vividSaturation = min(saturation * saturationBoost, 1.0);
    float3 vividColor = brightest * mix(float3(1.0), pixelHue, vividSaturation);
    float luminance = dot(rgb, float3(0.2126, 0.7152, 0.0722));
    float3 grayscale = float3(luminance * backgroundBrightness);
    return half4(mix(grayscale, vividColor, colorMask) * pixel.a, pixel.a);
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

  return { ...COLOR_ISOLATION_DEFAULTS, targetColor };
}
