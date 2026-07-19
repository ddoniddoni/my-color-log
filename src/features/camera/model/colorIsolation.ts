export type NormalizedRgb = readonly [number, number, number];

export const COLOR_ISOLATION_DEFAULTS = {
  // Keep nearby shades within the same everyday color family visible too.
  softness: 0.12,
  threshold: 0.3,
} as const;

export const COLOR_ISOLATION_SHADER = `
  uniform shader image;
  uniform float3 targetColor;
  uniform float threshold;
  uniform float softness;

  half4 main(float2 xy) {
    half4 pixel = image.eval(xy);
    float brightest = max(pixel.r, max(pixel.g, pixel.b));
    float darkest = min(pixel.r, min(pixel.g, pixel.b));
    float saturation = (brightest - darkest) / max(brightest, 0.001);

    float3 pixelChroma = pixel.rgb / max(brightest, 0.001);
    float targetBrightest = max(targetColor.r, max(targetColor.g, targetColor.b));
    float3 targetChroma = targetColor / max(targetBrightest, 0.001);
    float difference = length(pixelChroma - targetChroma);

    float hueMatch = 1.0 - smoothstep(threshold - softness, threshold + softness, difference);
    float colorPresence = smoothstep(0.05, 0.15, saturation);
    float keepOriginalColor = hueMatch * colorPresence;
    float luminance = dot(pixel.rgb, float3(0.2126, 0.7152, 0.0722));
    half3 grayscale = half3(luminance, luminance, luminance);
    return half4(mix(grayscale, pixel.rgb, keepOriginalColor), pixel.a);
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

export function getColorIsolationUniforms(colorHex: string): {
  softness: number;
  targetColor: NormalizedRgb;
  threshold: number;
} | null {
  const targetColor = toNormalizedRgb(colorHex);
  if (!targetColor) return null;

  return { ...COLOR_ISOLATION_DEFAULTS, targetColor };
}
