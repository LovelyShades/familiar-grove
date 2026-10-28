// Validates the original artwork and writes optimized, non-destructive copies.
//
//   npm run assets
//
// Originals in MORE_IMAGES/ are only ever read. Processed copies go to
// public/assets/grove/ as lossless WebP (alpha preserved, no colour loss) and
// a typed manifest is written to src/generated/assetManifest.json.

import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MANIFEST_FILE, OUTPUT_DIR, REFERENCE_ONLY, SOURCE_DIR, SOURCES } from './asset-sources.mjs';

const TRIM_PADDING = 2; // keep a hair of transparent space so edge pixels never touch the texture border
// Alpha at or below this is invisible noise (some originals contain stray 1-8 alpha specks out to the edges).
const VISIBLE_ALPHA = 8;
const problems = [];
const notes = [];

/** Bounding box of every visible pixel. Soft glows are well above the noise threshold, so they are kept. */
function alphaBounds(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > VISIBLE_ALPHA) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** All files under a folder, as paths relative to it (forward slashes). */
async function listFiles(dir, prefix = '') {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...(await listFiles(path.join(dir, d.name), rel)));
    else out.push(rel);
  }
  return out;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function processEntry(entry, previous) {
  const srcPath = path.join(SOURCE_DIR, entry.src);
  const buffer = await readFile(srcPath);
  const hash = createHash('sha1').update(buffer).digest('hex');
  const fileName = `${entry.id}.webp`;
  // unchanged original + same settings: reuse the existing processed copy
  const old = previous[entry.id];
  const needsProfile = entry.role === 'terrain' && !old?.topProfile;
  const sameRegion = JSON.stringify(old?.region ?? null) === JSON.stringify(entry.region ?? null);
  if (old && !needsProfile && sameRegion && old.sourceHash === hash && old.maxSize === (entry.maxSize ?? null) && (await exists(path.join(OUTPUT_DIR, fileName)))) {
    return { hash, record: { ...old, source: entry.src }, cached: true };
  }
  const meta = await sharp(buffer).metadata();
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let crop = { left: 0, top: 0, width: info.width, height: info.height };
  if (entry.region) {
    // a fixed piece of the original (e.g. an icon cut from larger artwork)
    const [left, top, width, height] = entry.region;
    crop = { left, top, width, height };
  } else if (entry.process === 'sprite') {
    const b = alphaBounds(data, info.width, info.height);
    if (!b) throw new Error(`${entry.src} is fully transparent`);
    const left = Math.max(0, b.left - TRIM_PADDING);
    const top = Math.max(0, b.top - TRIM_PADDING);
    crop = {
      left,
      top,
      width: Math.min(info.width, b.left + b.width + TRIM_PADDING) - left,
      height: Math.min(info.height, b.top + b.height + TRIM_PADDING) - top,
    };
    const corner = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1]
      .map((i) => data[i * 4 + 3]);
    if (corner.some((a) => a > VISIBLE_ALPHA)) problems.push(`${entry.src}: corner pixels are not transparent (possible baked background)`);
    if (b.left === 0 || b.top === 0 || b.left + b.width === info.width || b.top + b.height === info.height) {
      notes.push(`${entry.src}: artwork touches the canvas edge (check for clipping)`);
    }
  }

  // Terrain: record the top edge of the walkable surface (first visible pixel per
  // column, in ORIGINAL coordinates) so familiars can be kept on solid ground.
  let topProfile;
  if (entry.role === 'terrain') {
    const step = 4;
    const ys = [];
    for (let x = 0; x < info.width; x += step) {
      let top = -1;
      for (let y = 0; y < info.height; y++) {
        if (data[(y * info.width + x) * 4 + 3] > VISIBLE_ALPHA) {
          top = y;
          break;
        }
      }
      ys.push(top);
    }
    topProfile = { step, ys };
  }

  const fit = entry.maxSize ? Math.min(1, entry.maxSize / Math.max(crop.width, crop.height)) : 1;
  const outW = Math.round(crop.width * fit);
  const outH = Math.round(crop.height * fit);

  let pipeline = sharp(buffer).ensureAlpha().extract(crop);
  // lanczos3 keeps edges crisp when shrinking; nothing is ever enlarged
  if (fit < 1) pipeline = pipeline.resize(outW, outH, { kernel: 'lanczos3' });
  await pipeline.webp({ lossless: true, effort: 5 }).toFile(path.join(OUTPUT_DIR, fileName));

  return {
    hash,
    record: {
      id: entry.id,
      url: `assets/grove/${fileName}`,
      role: entry.role,
      ...(entry.species ? { species: entry.species, variant: entry.variant } : {}),
      source: entry.src,
      sourceHash: hash,
      maxSize: entry.maxSize ?? null,
      ...(entry.region ? { region: entry.region } : {}),
      sourceSize: { width: info.width, height: info.height },
      hasAlpha: meta.hasAlpha === true,
      // where the processed image sits inside the original canvas
      crop,
      size: { width: outW, height: outH },
      scale: fit,
      ...(topProfile ? { topProfile } : {}),
    },
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(path.dirname(MANIFEST_FILE), { recursive: true });

  const onDisk = new Set(await listFiles(SOURCE_DIR));
  let previous = {};
  try {
    previous = JSON.parse(await readFile(MANIFEST_FILE, 'utf8')).assets ?? {};
  } catch { /* first run */ }
  for (const entry of SOURCES) {
    if (!onDisk.has(entry.src)) problems.push(`MISSING: ${entry.src} (needed for ${entry.id})`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }

  const results = [];
  for (const entry of SOURCES) {
    const r = await processEntry(entry, previous);
    results.push(r);
    console.log(`  ${r.cached ? '=' : '✓'} ${entry.id.padEnd(36)} ${r.record.size.width}×${r.record.size.height}${r.cached ? ' (unchanged)' : ''}`);
  }

  // duplicates (identical bytes) among everything in the folder
  const byHash = new Map();
  for (const f of onDisk) {
    if (!f.toLowerCase().endsWith('.png')) continue;
    const h = createHash('sha1').update(await readFile(path.join(SOURCE_DIR, f))).digest('hex');
    byHash.set(h, [...(byHash.get(h) || []), f]);
  }
  for (const files of byHash.values()) if (files.length > 1) notes.push(`Identical files: ${files.join(' == ')}`);

  // every base familiar must have a rare partner drawn on the same canvas
  const familiars = results.map((r) => r.record).filter((r) => r.role === 'familiar');
  for (const species of new Set(familiars.map((f) => f.species))) {
    const base = familiars.find((f) => f.species === species && f.variant === 'base');
    const rare = familiars.find((f) => f.species === species && f.variant === 'rare');
    if (!base) problems.push(`${species}: missing base variant`);
    else if (!rare) notes.push(`${species}: rare mutation artwork not supplied yet`);
    else if (Math.abs(base.sourceSize.width - rare.sourceSize.width) > 2 || Math.abs(base.sourceSize.height - rare.sourceSize.height) > 2) {
      notes.push(`${species}: base and rare canvases differ in size`);
    }
  }

  const used = new Set([...SOURCES.map((s) => s.src), ...REFERENCE_ONLY]);
  for (const f of onDisk) if (f.toLowerCase().endsWith('.png') && !used.has(f)) notes.push(`Not used by the game yet: ${f}`);

  const manifest = {
    generated: new Date().toISOString(),
    assets: Object.fromEntries(results.map((r) => [r.record.id, r.record])),
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nWrote ${results.length} assets to ${OUTPUT_DIR} and ${MANIFEST_FILE}`);
  if (notes.length) console.log(`\nNotes:\n  - ${notes.join('\n  - ')}`);
  if (problems.length) {
    console.error(`\nProblems:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
