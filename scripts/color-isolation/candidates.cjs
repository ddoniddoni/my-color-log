const { readFileSync } = require('node:fs');
const production = require('./production.cjs');

// Frozen cb63022 baseline. Never replace this with the candidate being evaluated.
const baseline = readFileSync(require.resolve('./baseline.sksl'), 'utf8');
const baselineMask = 'float colorMask = hueMatch * colorPresence * shadowPresence * targetPresence;';
const result = 'return half4(mix(grayscale, vividColor, colorMask) * pixel.a, pixel.a);';

const helpers = `
  float hueAngle(float3 c) {
    float hi = max(c.r, max(c.g, c.b));
    float lo = min(c.r, min(c.g, c.b));
    float d = max(hi - lo, 0.00001);
    float h = hi == c.r ? (c.g - c.b) / d : (hi == c.g ? 2.0 + (c.b - c.r) / d : 4.0 + (c.r - c.g) / d);
    return mod(h * 60.0 + 360.0, 360.0);
  }
  float angularDistance(float a, float b) {
    float d = abs(a - b);
    return min(d, 360.0 - d);
  }
  float3 lab(float3 srgb) {
    // Evaluation surfaces are explicitly sRGB. Production must use toLinearSrgb
    // when its working color space can differ; do not paste this into the app.
    float3 c = mix(srgb / 12.92, pow((srgb + 0.055) / 1.055, float3(2.4)), step(float3(0.04045), srgb));
    float l = pow(dot(c, float3(0.4122214708, 0.5363325363, 0.0514459929)), 1.0 / 3.0);
    float m = pow(dot(c, float3(0.2119034982, 0.6806995451, 0.1073969566)), 1.0 / 3.0);
    float s = pow(dot(c, float3(0.0883024619, 0.2817188376, 0.6299787005)), 1.0 / 3.0);
    return float3(0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
      1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
      0.0259040371*l + 0.7827717662*m - 0.8086757660*s);
  }
`;

// Fixed exploratory parameters before inspecting the validation scene scores.
// A dark red/magenta target gets a soft lightness ceiling, not a hard HEX identity.
const hsvMask = `
  float targetH = hueAngle(targetColor);
  float deltaH = angularDistance(hueAngle(rgb), targetH);
  float darkBerry = targetBrightest < 0.65 && (targetH > 315.0 || targetH < 15.0) ? 1.0 : 0.0;
  float valueCeiling = 1.0 - darkBerry * smoothstep(targetBrightest + 0.12, targetBrightest + 0.30, brightest);
  float colorMask = (1.0 - smoothstep(18.0, 32.0, deltaH))
    * smoothstep(0.10, 0.24, saturation) * smoothstep(0.025, 0.09, brightest)
    * targetPresence * valueCeiling;
`;
const oklchMask = `
  float3 p = lab(rgb);
  float3 t = lab(targetColor);
  float pc = length(p.yz);
  float tc = length(t.yz);
  // Chord distance on the hue circle avoids an atan per pixel.
  float hueChord = length(p.yz / max(pc, 0.00001) - t.yz / max(tc, 0.00001));
  float targetH = hueAngle(targetColor);
  float darkBerry = targetBrightest < 0.65 && (targetH > 315.0 || targetH < 15.0) ? 1.0 : 0.0;
  float lightnessCeiling = 1.0 - darkBerry * smoothstep(t.x + 0.12, t.x + 0.26, p.x);
  float colorMask = (1.0 - smoothstep(0.31, 0.58, hueChord))
    * smoothstep(0.025, 0.06, pc) * smoothstep(0.10, 0.22, p.x)
    * smoothstep(0.025, 0.06, tc) * lightnessCeiling;
`;

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('evaluation_shader_contract_changed');
  return source.replace(before, after);
}

function shaderFor(candidate, maskOnly = false) {
  if (candidate === 'current') return maskOnly ? production.COLOR_ISOLATION_MASK_SHADER : production.COLOR_ISOLATION_SHADER;
  let source = baseline;
  if (candidate !== 'baseline') {
    if (!['hsv', 'oklch'].includes(candidate)) throw new Error('unknown_candidate');
    source = replaceOnce(source, 'half4 main(float2 xy)', `${helpers}\n  half4 main(float2 xy)`);
    source = replaceOnce(source, baselineMask, candidate === 'hsv' ? hsvMask : oklchMask);
  }
  return maskOnly ? replaceOnce(source, result, 'return half4(float3(colorMask), 1.0);') : source;
}

function uniformsFor(hex, candidate) {
  if (candidate === 'current') {
    const uniforms = production.getColorIsolationUniforms(hex);
    if (!uniforms) throw new Error('invalid_target');
    return uniforms;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('invalid_target');
  return {
    targetColor: [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255),
    threshold: 0.32, softness: 0.14, saturationBoost: 1.35, backgroundBrightness: 0.82,
  };
}

module.exports = { shaderFor, uniformsFor };
