// Automatic familiar placement. Pure logic (no Pixi), so it is unit-tested.
//
// Each familiar gets an anchor position inside a zone that suits its habitat.
// Candidates are checked against the creature's real bounding box (sprite size,
// anchor and how far its idle motion reaches): the box must stay inside the safe
// area, keep clear of the HUD and the Heartwood's heart, and not tangle with
// other familiars. Placement is deterministic for a given list.

import manifestJson from '../generated/assetManifest.json';
import { HEARTWOOD, FEET, FOCAL_KEEP_OUT, GROUND_RULES, PLACEMENT_RULES, PLACEMENT_ZONES, SAFE_AREA, STARTER_HOMES, TERRAIN, UI_KEEP_OUT } from './layout';
import type { Box, PlacementZone } from './layout';
import { SPECIES_BY_ID, appearanceOf, type IdleStyle } from '../game/registry';
import type { DisplayedFamiliar } from '../game/state';

const sizes = (manifestJson as { assets: Record<string, { size: { width: number; height: number } }> }).assets;

// ------------------------------------------------------------------ solid ground
// The clearing's back rim, measured from the terrain artwork by the asset
// pipeline (first visible pixel per column, original coordinates).
const terrain = (manifestJson as unknown as {
  assets: Record<string, { topProfile?: { step: number; ys: number[] } }>;
}).assets[TERRAIN.asset];
const terrainAnchor = TERRAIN.anchor as [number, number];
const terrainScale = TERRAIN.scale ?? 1;

/** Logical y of the clearing's back rim at logical x (Infinity where there is no ground). */
export function rimY(x: number): number {
  const profile = terrain?.topProfile;
  if (!profile) return -Infinity; // no profile: don't block placement
  const sx = terrainAnchor[0] + (x - TERRAIN.x) / terrainScale;
  const i = Math.round(sx / profile.step);
  const top = profile.ys[i];
  if (top === undefined || top < 0) return Infinity;
  return TERRAIN.y + (top - terrainAnchor[1]) * terrainScale;
}

/**
 * The ground line: the LOWEST point of the clearing's back rim across the
 * playable width (its centre dip, measured from the artwork) plus a margin.
 * Ground familiars' feet are never placed above it, so they can never appear
 * to float over the back edge or stand on the raised mossy rim.
 */
export const GROUND_LINE_Y = (() => {
  let lowest = -Infinity;
  for (let x = SAFE_AREA.x; x <= SAFE_AREA.x + SAFE_AREA.w; x += 4) {
    const r = rimY(x);
    if (Number.isFinite(r)) lowest = Math.max(lowest, r);
  }
  return Number.isFinite(lowest) ? lowest + GROUND_RULES.belowRimDip : -Infinity;
})();

/**
 * True when a ground familiar's feet (the middle of its body width at y) rest on
 * the flat clearing floor: comfortably below the back rim everywhere under the
 * footprint, and not where the rim curves steeply (the raised mossy mounds).
 */
export function onSolidGround(centerX: number, y: number, bodyWidth: number): boolean {
  if (y < GROUND_LINE_Y) return false;
  const half = (bodyWidth * GROUND_RULES.footprint) / 2;
  const samples = 7;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < samples; i++) {
    const x = centerX - half + (2 * half * i) / (samples - 1);
    const rim = rimY(x);
    if (!Number.isFinite(rim) && rim > 0) return false; // off the clearing
    if (y < rim + GROUND_RULES.rimMargin) return false; // too close to (or over) the rim
    lo = Math.min(lo, rim);
    hi = Math.max(hi, rim);
  }
  // Near the rim, a steep rim under the footprint means the floor is curving up
  // into a mound. Well in front of the rim the floor is flat, so it doesn't matter.
  if (y - hi > GROUND_RULES.flatDepth) return true;
  return hi - lo <= Math.max(12, 2 * half * GROUND_RULES.maxRimSlope);
}

export const familiarKey = (f: DisplayedFamiliar): string => `${f.species}|${f.variant}`;

export interface Placement {
  familiar: DisplayedFamiliar;
  key: string;
  zoneId: string;
  x: number;
  y: number;
  scale: number;
  face: 'left' | 'right';
  box: Box;
}

/** How far each idle style moves the sprite: [x, y] in px, plus a height-relative sway. */
function motionReach(style: IdleStyle, height: number): [number, number] {
  switch (style) {
    case 'swim':
      return [24, 12];
    case 'flutter':
      return [15, 11];
    case 'hover':
      return [4, 9];
    case 'perch':
      return [4 + height * 0.02, 3];
    case 'sway':
      return [height * 0.022, 2];
    case 'creep':
      return [4, 2];
    default:
      return [3, 3];
  }
}

/** Visible size of a familiar at a given depth scale. */
export function familiarSize(f: DisplayedFamiliar, scale = 1): { w: number; h: number } {
  const def = SPECIES_BY_ID[f.species];
  const size = sizes[appearanceOf(f.species, f.variant).asset]?.size ?? { width: 1, height: 1 };
  const h = def.display.height * scale;
  return { w: (h * size.width) / size.height, h };
}

/** Bounding box (including idle-motion reach) of a familiar anchored at (x, y). */
export function familiarBox(f: DisplayedFamiliar, x: number, y: number, scale: number, face: 'left' | 'right'): Box {
  const def = SPECIES_BY_ID[f.species];
  const { w, h } = familiarSize(f, scale);
  const anchor = def.display.anchor ?? FEET;
  const flip = def.display.facing !== 'front' && def.display.facing !== face;
  const ax = flip ? 1 - anchor.x : anchor.x;
  const [rx, ry] = motionReach(def.animation.idle, h);
  return { x: x - ax * w - rx, y: y - anchor.y * h - ry, w: w + 2 * rx, h: h + 2 * ry };
}

export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const inflate = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });

export function insideSafeArea(b: Box): boolean {
  return b.x >= SAFE_AREA.x && b.y >= SAFE_AREA.y && b.x + b.w <= SAFE_AREA.x + SAFE_AREA.w && b.y + b.h <= SAFE_AREA.y + SAFE_AREA.h;
}

/** Reasons a box is not acceptable next to the already placed ones (empty = fine). */
export function problemsFor(box: Box, others: Box[], maxOverlap = PLACEMENT_RULES.maxOverlap): string[] {
  const out: string[] = [];
  const area = box.w * box.h;
  if (!insideSafeArea(box)) out.push('outside safe area');
  for (const k of UI_KEEP_OUT) if (overlapArea(box, k) > area * maxOverlap) out.push('under the HUD');
  if (overlapArea(box, FOCAL_KEEP_OUT) > Math.min(area, FOCAL_KEEP_OUT.w * FOCAL_KEEP_OUT.h) * maxOverlap) out.push('covers the heart');
  for (const o of others) {
    const smaller = Math.min(area, o.w * o.h);
    if (overlapArea(inflate(box, PLACEMENT_RULES.padding / 2), inflate(o, PLACEMENT_RULES.padding / 2)) > smaller * maxOverlap) {
      out.push('overlaps another familiar');
      break;
    }
  }
  return out;
}

const habitatsFor = (f: DisplayedFamiliar): PlacementZone['habitat'][] => {
  const h = SPECIES_BY_ID[f.species]?.display.habitat ?? 'ground';
  return h === 'ground' ? ['ground'] : h === 'perch' ? ['perch', 'air'] : ['air', 'perch'];
};

/** Creatures look toward the tree. */
const faceFor = (x: number): 'left' | 'right' => (x < HEARTWOOD.x ? 'right' : 'left');

function centre(b: Box): { x: number; y: number } {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function tryAt(f: DisplayedFamiliar, zone: PlacementZone, x: number, y: number, placed: Placement[], maxOverlap: number): Placement | null {
  const scale = zone.scale ?? 1;
  const face = faceFor(x);
  const box = familiarBox(f, x, y, scale, face);
  if (problemsFor(box, placed.map((p) => p.box), maxOverlap).length) return null;
  if (zone.habitat === 'ground' && !onSolidGround(box.x + box.w / 2, y, familiarSize(f, scale).w)) return null;
  return { familiar: f, key: familiarKey(f), zoneId: zone.id, x, y, scale, face, box };
}

/** Valid positions for a familiar, best first, at most one per zone. */
function candidates(f: DisplayedFamiliar, placed: Placement[], maxOverlap: number): Placement[] {
  const best = new Map<string, { c: Placement; score: number }>();
  const step = PLACEMENT_RULES.sampleStep;
  habitatsFor(f).forEach((habitat, habitatRank) => {
    for (const zone of PLACEMENT_ZONES) {
      if (zone.habitat !== habitat) continue;
      if (placed.some((p) => p.zoneId === zone.id)) continue; // one familiar per zone keeps the scene airy
      const a = zone.anchors;
      for (let y = a.y; y <= a.y + a.h; y += step) {
        for (let x = a.x; x <= a.x + a.w; x += step) {
          const c = tryAt(f, zone, x, y, placed, maxOverlap);
          if (!c) continue;
          const me = centre(c.box);
          let crowd = 0;
          for (const p of placed) {
            const o = centre(p.box);
            crowd += Math.max(0, PLACEMENT_RULES.comfortDistance - Math.hypot(me.x - o.x, me.y - o.y));
          }
          const score = habitatRank * 5000 + zone.priority * 1000 + Math.hypot(x - zone.ideal.x, y - zone.ideal.y) + crowd * 2;
          const prev = best.get(zone.id);
          if (!prev || score < prev.score) best.set(zone.id, { c, score });
        }
      }
    }
  });
  return [...best.values()].sort((a, b) => a.score - b.score).map((v) => v.c);
}

/** Depth-first search over the best few spots per familiar; first full fit wins. */
function search(pending: DisplayedFamiliar[], placed: Placement[], maxOverlap: number, budget: { n: number }): Placement[] | null {
  if (!pending.length) return placed;
  if (budget.n-- <= 0) return null;
  const [f, ...rest] = pending;
  for (const c of candidates(f, placed, maxOverlap).slice(0, 6)) {
    const found = search(rest, [...placed, c], maxOverlap, budget);
    if (found) return found;
  }
  return null;
}

/**
 * Places the active familiars. `previous` keeps familiars where they already
 * are (so adding one never makes the others jump) as long as that spot is
 * still valid. Familiars that cannot fit anywhere are left out.
 */
export function placeFamiliars(list: DisplayedFamiliar[], previous: Map<string, Placement> = new Map()): Placement[] {
  // most stable first: keep current spots and starter homes; relax only if that can't fit everyone cleanly
  const attempts: [Map<string, Placement>, boolean][] = [
    [previous, true],
    [new Map(), true],
    [new Map(), false],
  ];
  let fallback: Placement[] = [];
  for (const [prev, homes] of attempts) {
    const r = solve(list, prev, homes);
    if (r.clean && r.placed.length === list.length) return r.placed;
    if (r.placed.length > fallback.length) fallback = r.placed;
  }
  return fallback;
}

function solve(list: DisplayedFamiliar[], previous: Map<string, Placement>, useHomes: boolean): { placed: Placement[]; clean: boolean } {
  const placed: Placement[] = [];
  const pending = [...list];
  const take = (p: Placement | null) => {
    if (!p) return false;
    placed.push(p);
    pending.splice(pending.indexOf(p.familiar), 1);
    return true;
  };
  const zoneById = (id: string) => PLACEMENT_ZONES.find((z) => z.id === id);

  // 1. keep previous positions that are still valid
  for (const f of [...pending]) {
    const prev = previous.get(familiarKey(f));
    const zone = prev && zoneById(prev.zoneId);
    if (prev && zone && !placed.some((p) => p.zoneId === zone.id)) take(tryAt(f, zone, prev.x, prev.y, placed, PLACEMENT_RULES.maxOverlap));
  }
  // 2. starters go home (the original composition)
  for (const f of useHomes ? [...pending] : []) {
    const home = STARTER_HOMES[f.species];
    const zone = home && zoneById(home.zone);
    if (home && zone && !placed.some((p) => p.zoneId === zone.id)) take(tryAt(f, zone, home.x, home.y, placed, PLACEMENT_RULES.maxOverlap));
  }
  // 3. everyone else, biggest first: search for an arrangement where all fit cleanly
  const bySize = [...pending].sort((a, b) => {
    const sa = familiarSize(a);
    const sb = familiarSize(b);
    return sb.w * sb.h - sa.w * sa.h || list.indexOf(a) - list.indexOf(b);
  });
  let isClean = true;
  const clean = search(bySize, placed, PLACEMENT_RULES.maxOverlap, { n: 400 });
  if (clean) {
    placed.splice(0, placed.length, ...clean);
  } else {
    isClean = false;
    // last resort: best greedy spots, tolerating a little more overlap rather than hiding anyone
    for (const f of bySize) {
      const c = candidates(f, placed, PLACEMENT_RULES.maxOverlap)[0] ?? candidates(f, placed, PLACEMENT_RULES.maxOverlap * 2)[0];
      if (c) placed.push(c);
    }
  }
  // keep the caller's order (useful for stable diffs)
  return { placed: list.map((f) => placed.find((p) => p.familiar === f)).filter((p): p is Placement => !!p), clean: isClean };
}
