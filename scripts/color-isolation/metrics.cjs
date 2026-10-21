// Evaluation only. Labels: 1 target, 0 background, -1 unlabelled/ambiguous.
const MASK_THRESHOLD = 0.5;

function scoreMask(mask, labels) {
  if (mask.length !== labels.length || mask.length === 0) throw new Error('invalid_mask_dimensions');
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (let index = 0; index < labels.length; index += 1) {
    const value = mask[index];
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('invalid_mask_value');
    const label = labels[index];
    if (label === -1) continue;
    if (label !== 0 && label !== 1) throw new Error('invalid_mask_label');
    if (value >= MASK_THRESHOLD) {
      if (label === 1) tp += 1;
      else fp += 1;
    } else if (label === 1) fn += 1;
    else tn += 1;
  }
  const labelled = tp + fp + fn + tn;
  if (!labelled) throw new Error('empty_annotation');
  const hasTarget = tp + fn > 0;
  return {
    tp, fp, fn, tn, labelled,
    // Empty predictions are not perfect precision. Absent targets do not inflate macro IoU.
    precision: tp + fp > 0 ? tp / (tp + fp) : (hasTarget ? 0 : null),
    recall: hasTarget ? tp / (tp + fn) : null,
    iou: hasTarget ? tp / (tp + fp + fn) : null,
    falsePositiveRate: fp + tn > 0 ? fp / (fp + tn) : null,
  };
}

function mean(values) {
  const present = values.filter((value) => value !== null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

function summarize(rows) {
  const positiveScenes = rows.filter((row) => row.iou !== null);
  return {
    ...Object.fromEntries(['precision', 'recall', 'iou'].map((metric) => [metric, mean(positiveScenes.map((row) => row[metric]))])),
    falsePositiveRate: mean(rows.map((row) => row.falsePositiveRate)),
    absentTargetFalsePositiveRate: mean(rows.filter((row) => row.iou === null).map((row) => row.falsePositiveRate)),
  };
}

function rectangleLabels(width, height, regions) {
  const labels = new Int8Array(width * height).fill(-1);
  for (const { bounds, label } of regions) {
    const [left, top, right, bottom] = bounds;
    if (bounds.length !== 4 || !bounds.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
      || left >= right || top >= bottom || ![0, 1].includes(label)) throw new Error('invalid_annotation');
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if ((x + 0.5) / width >= left && (x + 0.5) / width < right && (y + 0.5) / height >= top && (y + 0.5) / height < bottom) {
          const index = y * width + x;
          if (labels[index] !== -1 && labels[index] !== label) throw new Error('conflicting_annotation');
          labels[index] = label;
        }
      }
    }
  }
  return labels;
}

function validateSceneSplits(cases) {
  const scenes = new Map();
  const ids = new Set();
  for (const item of cases) {
    if (!item.id || ids.has(item.id) || !item.scene || !['development', 'validation'].includes(item.split)) throw new Error('invalid_case');
    ids.add(item.id);
    if (scenes.has(item.scene) && scenes.get(item.scene) !== item.split) throw new Error('scene_split_leakage');
    scenes.set(item.scene, item.split);
  }
}

module.exports = { MASK_THRESHOLD, rectangleLabels, scoreMask, summarize, validateSceneSplits };
