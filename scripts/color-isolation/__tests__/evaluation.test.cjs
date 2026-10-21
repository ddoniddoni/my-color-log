const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { rectangleLabels, scoreMask, summarize, validateSceneSplits } = require('../metrics.cjs');
const { createRenderer } = require('../render.cjs');
const { swatchImage } = require('../fixtures.cjs');
const { shaderFor } = require('../candidates.cjs');
const manifest = require('../photos.json');

test('scores target errors without counting unlabelled pixels or background dominance', () => {
  const result = scoreMask([1, 0.6, 0.1, 1, 0], [1, 0, 1, -1, 0]);
  assert.equal(result.precision, 0.5);
  assert.equal(result.recall, 0.5);
  assert.equal(result.iou, 1/3);
  assert.equal(result.falsePositiveRate, 0.5);
  assert.equal(result.labelled, 4);
});
test('absent target cases report false positives and cannot inflate macro IoU', () => {
  const absent = scoreMask([0, 0], [0, 0]);
  assert.equal(absent.iou, null);
  assert.equal(absent.precision, null);
  assert.equal(absent.falsePositiveRate, 0);
  const missed = scoreMask([0], [1]);
  assert.equal(missed.precision, 0);
  assert.equal(summarize([absent, missed]).iou, 0);
  const falseAlarm = scoreMask([1], [0]);
  const hit = scoreMask([1], [1]);
  assert.equal(summarize([falseAlarm, hit]).precision, 1);
  assert.equal(summarize([falseAlarm, hit]).absentTargetFalsePositiveRate, 1);
});
test('fixed boundary is inclusive and malformed masks cannot create a passing report', () => {
  assert.equal(scoreMask([0.5], [1]).recall, 1);
  assert.throws(() => scoreMask([Number.NaN], [1]));
  assert.throws(() => scoreMask([1], [-1]));
  assert.throws(() => scoreMask([1], [2]));
  assert.throws(() => scoreMask([1], [1, 0]));
});
test('sparse annotations leave unknown pixels ignored and reject contradictory regions', () => {
  assert.deepEqual([...rectangleLabels(4, 1, [{ label: 1, bounds: [0, 0, 0.5, 1] }])], [1, 1, -1, -1]);
  assert.throws(() => rectangleLabels(4, 1, [{ label: 1, bounds: [0,0,1,1] }, { label: 0, bounds: [0,0,1,1] }]));
});
test('scene variants cannot leak into both development and validation', () => {
  validateSceneSplits(manifest.cases);
  assert.throws(() => validateSceneSplits([{ id:'a', scene:'same', split:'development' }, { id:'b', scene:'same', split:'validation' }]));
  for (const item of manifest.cases) {
    const photo = manifest.photos.find((p) => p.id === item.scene);
    assert.ok(photo);
    assert.equal(item.split, photo.split);
    assert.match(photo.sha256, /^[a-f0-9]{64}$/);
    const labels = rectangleLabels(photo.width, photo.height, item.regions);
    assert.ok(labels.some((label) => label !== -1));
  }
});
test('frozen baseline is the cb63022 shader and cannot silently become a future candidate', () => {
  const { createHash } = require('node:crypto');
  const frozen = readFileSync(require.resolve('../baseline.sksl'), 'utf8');
  assert.equal(shaderFor('baseline'), frozen);
  // Hash fixed at corpus creation, intentionally independent of later production edits.
  assert.equal(createHash('sha256').update(frozen).digest('hex'), '96d824abcfe4f2591c56b5c1498d41dc969e573c215eb397dc60fda912d5f52f');
});
test('all candidate shaders execute, preserve target color and reject neutral pixels', async () => {
  const renderer = await createRenderer();
  try {
    const image = swatchImage([[123,47,208], [128,128,128], [255,255,255], [0,0,0]]);
    for (const candidate of ['baseline', 'hsv', 'oklch']) {
      const result = renderer.render(image, '#7B2FD0', candidate, true);
      assert.ok(result.rgba[0] > 250, candidate);
      for (const i of [1,2,3]) assert.equal(result.rgba[i*4], 0, candidate);
    }
  } finally { renderer.dispose(); }
});
test('baseline reproduces pink/wine confusion rather than hiding it in the metric', async () => {
  const renderer = await createRenderer();
  try {
    const mask = renderer.render(swatchImage([[236,64,122], [139,30,75]]), '#8B1E4B', 'baseline', true);
    const result = scoreMask([mask.rgba[0]/255, mask.rgba[4]/255], [0,1]);
    assert.equal(result.fp, 1);
    assert.equal(result.tp, 1);
    assert.equal(result.precision, 0.5);
  } finally { renderer.dispose(); }
});
