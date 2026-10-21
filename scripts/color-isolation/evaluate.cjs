const { createHash } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { mkdir, readFile, writeFile, mkdtemp } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { parseArgs } = require('node:util');
const { createRenderer } = require('./render.cjs');
const { syntheticCases } = require('./fixtures.cjs');
const { MASK_THRESHOLD, rectangleLabels, scoreMask, summarize, validateSceneSplits } = require('./metrics.cjs');
const palette = require('./palette.json');
const manifest = require('./photos.json');
const candidates = ['baseline', 'hsv', 'oklch'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

async function photoBytes(photo, cache, download) {
  const path = join(cache, `${photo.id}.source`);
  let bytes;
  try { bytes = await readFile(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!download) throw new Error(`Missing ${photo.id}; run with --photos --download or supply --cache.`);
    const response = await fetch(photo.url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'ColorLog-Evaluation/1.0' } });
    if (!response.ok) throw new Error(`Photo download failed: ${photo.id} (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (sha256(bytes) !== photo.sha256) throw new Error(`Photo checksum changed: ${photo.id}`);
    await writeFile(path, bytes);
  }
  if (sha256(bytes) !== photo.sha256) throw new Error(`Photo checksum changed: ${photo.id}`);
  return bytes;
}

function annotationSvg(item, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${item.regions.map(({ label, bounds: [l,t,r,b] }) => `<rect x="${l*width}" y="${t*height}" width="${(r-l)*width}" height="${(b-t)*height}" fill="none" stroke="${label ? '#00ffff' : '#ff9900'}" stroke-width="2"/>`).join('')}</svg>`;
}

async function main() {
  const { values } = parseArgs({ options: { photos: { type: 'boolean' }, download: { type: 'boolean' },
    cache: { type: 'string' }, output: { type: 'string' } } });
  if (values.download && !values.photos) throw new Error('--download requires --photos');
  const output = values.output ? resolve(values.output) : await mkdtemp(join(tmpdir(), 'colorlog-evaluation-'));
  const cache = values.cache ? resolve(values.cache) : join(tmpdir(), 'mycolorlog-color-evaluation');
  await mkdir(output, { recursive: true });
  if (values.photos) await mkdir(cache, { recursive: true });
  validateSceneSplits(manifest.cases);
  const renderer = await createRenderer();
  const rows = [];
  const cards = [];
  try {
    const cases = syntheticCases();
    if (values.photos) {
      const images = new Map();
      for (const photo of manifest.photos) {
        const image = renderer.normalize(await photoBytes(photo, cache, values.download), manifest.maxSide);
        if (image.width !== photo.width || image.height !== photo.height) throw new Error(`Photo orientation/dimensions changed: ${photo.id}`);
        images.set(photo.id, image);
        // Re-encoded pixel image: no source EXIF/location metadata in reports.
        await writeFile(join(output, `${photo.id}.png`), image.png);
      }
      for (const item of manifest.cases) {
        const image = images.get(item.scene);
        if (!image) throw new Error('unknown_scene');
        cases.push({ ...item, image, labels: rectangleLabels(image.width, image.height, item.regions), kind: 'photo-roi' });
      }
    }
    for (const item of cases) {
      const resultCells = [];
      for (const candidate of candidates) {
        const mask = renderer.render(item.image, palette[item.color], candidate, true);
        const values = Float32Array.from({ length: item.image.width * item.image.height }, (_, index) => mask.rgba[index * 4] / 255);
        const scores = scoreMask(values, item.labels);
        rows.push({ id: item.id, scene: item.scene, split: item.split, color: item.color, kind: item.kind, candidate, ...scores,
          ...(item.samples ? { samples: item.samples.map((sample, i) => ({ ...sample, mask: values[i] })) } : {}) });
        if (item.kind === 'photo-roi') {
          const rendered = renderer.render(item.image, palette[item.color], candidate);
          await writeFile(join(output, `${item.id}-${candidate}.png`), rendered.png);
          await writeFile(join(output, `${item.id}-${candidate}-mask.png`), mask.png);
          resultCells.push(`<figure><figcaption>${candidate}: P ${scores.precision?.toFixed(3) ?? 'n/a'}, R ${scores.recall?.toFixed(3) ?? 'n/a'}, ROI IoU ${scores.iou?.toFixed(3) ?? 'n/a'}<br>FP rate ${scores.falsePositiveRate?.toFixed(3) ?? 'n/a'}</figcaption><img src="${item.id}-${candidate}.png"><details><summary>Mask</summary><img src="${item.id}-${candidate}-mask.png"></details></figure>`);
        }
      }
      if (item.kind === 'photo-roi') {
        const svg = annotationSvg(item, item.image.width, item.image.height);
        await writeFile(join(output, `${item.id}-regions.svg`), svg);
        cards.push(`<section><h2>${escape(item.id)} · ${item.split}</h2><p>${escape(item.note)}</p><div class="grid"><figure><figcaption>Source + sparse regions (cyan target / orange negative)</figcaption><div class="source"><img src="${item.scene}.png"><img class="regions" src="${item.id}-regions.svg"></div></figure>${resultCells.join('')}</div></section>`);
      }
    }
  } finally { renderer.dispose(); }
  const summaries = [];
  for (const kind of ['synthetic', 'photo-roi']) for (const split of ['development', 'validation']) for (const candidate of candidates) {
    const group = rows.filter((r) => r.kind === kind && r.split === split && r.candidate === candidate);
    if (group.length) summaries.push({ kind, split, candidate, cases: group.length, ...summarize(group) });
  }
  const report = {
    version: 1, annotationStatus: manifest.annotationStatus,
    maskThreshold: MASK_THRESHOLD, engine: `CanvasKit ${require('canvaskit-wasm/package.json').version} CPU sRGB 8-bit`,
    photoScenes: values.photos ? manifest.photos.length : 0,
    baselineSha256: sha256(await readFile(require.resolve('./baseline.sksl'))),
    candidateSha256: sha256(await readFile(require.resolve('./candidates.cjs'))),
    manifestSha256: sha256(await readFile(require.resolve('./photos.json'))),
    // Sparse, agent-reviewed ROIs cannot satisfy the plan's human full-mask release gate.
    releaseGate: { status: 'not-evaluated', reasons: ['40 independent scenes and human full masks pending', '10-color validation coverage pending', 'iOS/Android timing, memory and color-space QA deferred to F'] },
    summaries,
    byColor: candidates.flatMap((candidate) => Object.keys(palette).map((color) => {
      const group = rows.filter((r) => r.kind === 'photo-roi' && r.candidate === candidate && r.color === color && r.split === 'validation');
      return { candidate, color, cases: group.length, ...summarize(group) };
    })),
    rows,
  };
  await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const credits = manifest.photos.map((p) => `<li>${escape(p.id)}: ${escape(p.author)} · <a href="${escape(p.licenseUrl)}">${escape(p.license)}</a> · <a href="${escape(p.source)}">source</a>. Resized, sRGB decoded; candidate images filtered.</li>`).join('');
  await writeFile(join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Color isolation — exploratory comparison</title><style>body{font:15px system-ui;margin:24px;background:#eee;color:#222}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{min-height:60px;font-size:12px}.source{position:relative}.regions{position:absolute;inset:0}section{margin:40px 0}a{color:#084a96}</style><h1>Exploratory comparison — release gate NOT evaluated</h1><p>6 independent public photo scenes at most. Sparse regions annotated by the coding agent, not human full-image masks. No mobile performance claim. Undefined areas ignored; mask threshold fixed at 0.5.</p>${cards.join('')}<h2>Attribution</h2><ul>${credits}</ul>`);
  console.table(summaries);
  console.log(`Report: ${join(output, 'index.html')}\nRelease gate: not evaluated (see report.json).`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
