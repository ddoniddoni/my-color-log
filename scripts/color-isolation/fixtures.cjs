const palette = require('./palette.json');

function swatchImage(colors) {
  return { width: colors.length, height: 1,
    rgba: Uint8Array.from(colors.flatMap((rgb) => [...rgb.map((c) => Math.round(c)), 255])) };
}
function rgb(hex) { return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)); }

function syntheticCases() {
  return Object.entries(palette).map(([color, hex]) => {
    const original = rgb(hex);
    const samples = [
      { name: 'reference', pixel: original, label: 1 },
      { name: 'shadow-55%', pixel: original.map((c) => c * 0.55), label: 1 },
      { name: 'shadow-35%', pixel: original.map((c) => c * 0.35), label: 1 },
      { name: 'warm-cast', pixel: original.map((c, i) => Math.min(255, c * [1.08, 1, 0.85][i])), label: 1 },
      // A light tint of wine can reasonably be pink: leave that semantic boundary unscored.
      { name: 'tint-35%', pixel: original.map((c) => c * 0.65 + 255 * 0.35), label: color === 'deep-wine' ? -1 : 1 },
      ...Object.entries(palette).filter(([name]) => name !== color).map(([name, value]) => ({ name, pixel: rgb(value), label: 0 })),
      ...[[255,255,255], [128,128,128], [0,0,0], [6,2,4], [190,186,184], [235,224,213]].map((pixel, index) => ({ name: `neutral-${index}`, pixel, label: 0 })),
    ];
    return { id: `swatches-${color}`, scene: `swatches-${color}`, split: 'development', color, kind: 'synthetic',
      image: swatchImage(samples.map((sample) => sample.pixel)),
      labels: Int8Array.from(samples.map((sample) => sample.label)), samples };
  });
}

module.exports = { syntheticCases, swatchImage };
