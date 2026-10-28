// Scene composition. Everything is placed in a logical 1600 x 900 world that is
// scaled uniformly to the screen, so artwork is never stretched.
//
// Units:
//   x, y   logical pixels (0..1600, 0..900)
//   scale  logical pixels per ORIGINAL artwork pixel (so 1 = original size)
//   anchor point on the ORIGINAL artwork canvas ([sx, sy]) or a 0..1 ratio
//          of the trimmed sprite ({ x, y })
// Coordinates like the tree's heart are read straight off the original PNGs.

export const LOGICAL_WIDTH = 1600;
export const LOGICAL_HEIGHT = 900;

/** Background layers are 1672 x 941 canvases; this fits them to 1600 x 900. */
const LAYER = LOGICAL_WIDTH / 1672;

export interface Placement {
  asset: string;
  x: number;
  y: number;
  scale?: number;
  /** Alternative to scale: the visible height in logical pixels. */
  height?: number;
  anchor?: [number, number] | { x: number; y: number };
  /** Use only this region [x, y, w, h] of the original canvas. */
  frame?: [number, number, number, number];
  flipX?: boolean;
  tint?: number;
  alpha?: number;
  label?: string;
}

// Slightly dimmed and cooled so the tree and familiars stay the focus.
const BACKDROP_TINT = 0xb9bdd6;
const MIDGROUND_TINT = 0xc9cde0;

export const BACKGROUND: Placement[] = [
  { label: 'sky', asset: 'env.sky', x: 0, y: 0, scale: LAYER, anchor: { x: 0, y: 0 }, tint: BACKDROP_TINT },
  { label: 'mountains', asset: 'env.mountains', x: 0, y: -175, scale: LAYER, anchor: { x: 0, y: 0 }, tint: BACKDROP_TINT },
  { label: 'ruins', asset: 'env.ruins', x: 40, y: -330, scale: LAYER, anchor: { x: 0, y: 0 }, tint: BACKDROP_TINT },
  { label: 'far forest', asset: 'env.distantForest', x: 0, y: -40, scale: LAYER, anchor: { x: 0, y: 0 }, tint: BACKDROP_TINT },
];

// The side-groves image holds two separate tree groups with empty space between
// them, so it is split down that empty middle and each half placed on its own.
export const MIDGROUND: Placement[] = [
  { label: 'left grove', asset: 'env.sideGroves', frame: [0, 0, 836, 941], x: -60, y: -30, scale: LAYER, anchor: { x: 0, y: 0 }, tint: MIDGROUND_TINT },
  { label: 'right grove', asset: 'env.sideGroves', frame: [836, 0, 836, 941], x: 836 * LAYER + 210, y: -30, scale: LAYER, anchor: { x: 0, y: 0 }, tint: MIDGROUND_TINT },
];

/** The Heartwood is anchored on its glowing heart. */
export const HEART_SOURCE: [number, number] = [680, 672];
export const HEARTWOOD: Placement = { label: 'heartwood', asset: 'env.heartwood', x: 560, y: 410, scale: 0.9, anchor: HEART_SOURCE };

/** Clickable Heartwood area (logical px): heart, trunk and lower canopy. */
export const TREE_HIT = { x: 400, y: 210, width: 330, height: 440 };

/** How much the world is enlarged beyond cover-fit so parallax never shows an edge. */
export const PARALLAX_OVERSCAN = 0.036;

/**
 * Max parallax shift per layer in logical px (pointer at the screen edge).
 * Nearer layers move more, which is what creates the sense of depth. The tree,
 * ground, familiars (with their shadows) and the effects overlay share ONE value
 * so they move together as a single plane: roots never slide against the ground.
 * Everything is clamped to the overscan margin, so no edge is ever exposed.
 * Set every value to 0 to disable mouse parallax entirely.
 */
export const PARALLAX_SHIFT: Record<string, { x: number; y: number }> = {
  sky: { x: 4, y: 2 },
  mountains: { x: 6, y: 3 },
  ruins: { x: 8, y: 4 },
  farForest: { x: 10, y: 5 },
  haze: { x: 11, y: 5.5 },
  midground: { x: 14, y: 7 },
  heartwood: { x: 18, y: 9 },
  terrain: { x: 18, y: 9 },
  familiars: { x: 18, y: 9 },
  overlay: { x: 18, y: 9 },
  foreground: { x: 28, y: 14 },
};

/** Parallax smoothing time constant (seconds): a soft, floaty follow without lag. */
export const PARALLAX_SMOOTHING = 0.22;

/**
 * Terrain. Anchored on the low point of the clearing's back edge.
 * To swap in a different floor: change `asset`, then adjust anchor/x/y/scale.
 */
export const TERRAIN: Placement & { placeholder: boolean } = {
  label: 'clearing',
  asset: 'env.clearing',
  placeholder: false,
  anchor: [1000, 408],
  x: 700,
  y: 640,
  scale: 1.4,
};

export const STREAM: Placement = { label: 'stream', asset: 'env.stream', x: 1010, y: 850, height: 115, anchor: { x: 0.5, y: 0.5 } };

/** Familiars stand on their feet: anchor at the bottom centre of the trimmed sprite. */
export const FEET = { x: 0.5, y: 0.98 };

// ------------------------------------------------------------------ familiar placement
//
// Familiars are placed automatically inside ZONES. Every candidate position is
// checked against the creature's real bounding box (its sprite size, anchor and
// idle-motion reach) so it never sits under the UI, off screen, on the
// Heartwood's heart, or tangled with another familiar. All boxes are in logical px.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything a familiar box must stay inside (left of the sidebar, inside the screen). */
export const SAFE_AREA: Box = { x: 24, y: 16, w: 1112, h: 870 };

/** Screen areas covered by the HUD; familiars may overlap them by at most `maxOverlap`. */
export const UI_KEEP_OUT: Box[] = [
  { x: 250, y: 778, w: 672, h: 140 }, // bottom navigation
  { x: 540, y: 0, w: 530, h: 140 }, // title and Aether counter
  { x: 0, y: 0, w: 345, h: 112 }, // grove level card
];

/** The glowing heart stays visible. */
export const FOCAL_KEEP_OUT: Box = { x: 495, y: 335, w: 130, h: 160 };

export const PLACEMENT_RULES = {
  /** Largest allowed overlap with another familiar or a keep-out, as a fraction of the smaller box. */
  maxOverlap: 0.06,
  /** Extra breathing room around every familiar box. */
  padding: 10,
  /** Grid step when searching a zone for a position. */
  sampleStep: 16,
  /** Familiars closer than this (centre to centre) are nudged apart by the score. */
  comfortDistance: 230,
};

export interface PlacementZone {
  id: string;
  habitat: 'ground' | 'perch' | 'air';
  /** Where the familiar's anchor may go (feet for ground/perch, centre for air). */
  anchors: Box;
  /** Preferred anchor inside the zone. */
  ideal: { x: number; y: number };
  /** Lower = filled first. */
  priority: number;
  /** Size tweak for depth (1 = registry height; keep within 0.9-1). */
  scale?: number;
}

/**
 * Ground familiars must stand on the flat clearing floor:
 *   footprint    - fraction of the body width treated as where the feet are
 *   rimMargin    - feet must be at least this far (logical px) below the clearing's back rim
 *   maxRimSlope  - how steeply the rim may rise across the footprint (higher = a mound)
 *   flatDepth    - feet further than this in front of the rim are on flat floor (slope ignored)
 *   belowRimDip  - feet must be at least this far below the rim's lowest (centre) point
 */
export const GROUND_RULES = { footprint: 0.55, rimMargin: 55, maxRimSlope: 0.28, flatDepth: 140, belowRimDip: 22 };

export const PLACEMENT_ZONES: PlacementZone[] = [
  // ground: on the clearing, in front of the forest edge
  { id: 'ground-left', habitat: 'ground', anchors: { x: 120, y: 730, w: 210, h: 70 }, ideal: { x: 215, y: 790 }, priority: 0 },
  { id: 'ground-center', habitat: 'ground', anchors: { x: 650, y: 680, w: 250, h: 100 }, ideal: { x: 725, y: 765 }, priority: 0 },
  { id: 'ground-front-roots', habitat: 'ground', anchors: { x: 430, y: 735, w: 180, h: 45 }, ideal: { x: 520, y: 765 }, priority: 1 },
  { id: 'ground-right', habitat: 'ground', anchors: { x: 900, y: 650, w: 170, h: 140 }, ideal: { x: 1000, y: 765 }, priority: 0 },
  { id: 'ground-roots', habitat: 'ground', anchors: { x: 300, y: 700, w: 150, h: 70 }, ideal: { x: 380, y: 745 }, priority: 1 },
  { id: 'ground-back-right', habitat: 'ground', anchors: { x: 820, y: 662, w: 200, h: 56 }, ideal: { x: 930, y: 680 }, priority: 1, scale: 0.94 },
  // (was on the raised mossy rim at the top-left; now on open floor, below the ground line)
  { id: 'ground-back-left', habitat: 'ground', anchors: { x: 60, y: 668, w: 230, h: 64 }, ideal: { x: 150, y: 690 }, priority: 2, scale: 0.94 },
  // perch: canopy branches
  { id: 'perch-left-branch', habitat: 'perch', anchors: { x: 260, y: 310, w: 80, h: 40 }, ideal: { x: 300, y: 330 }, priority: 0 },
  { id: 'perch-right-branch', habitat: 'perch', anchors: { x: 760, y: 200, w: 110, h: 50 }, ideal: { x: 800, y: 215 }, priority: 1, scale: 0.95 },
  // air: open spaces beside the canopy
  { id: 'air-left', habitat: 'air', anchors: { x: 110, y: 400, w: 200, h: 170 }, ideal: { x: 175, y: 470 }, priority: 0 },
  { id: 'air-right', habitat: 'air', anchors: { x: 850, y: 230, w: 220, h: 200 }, ideal: { x: 940, y: 320 }, priority: 0 },
  { id: 'air-high', habitat: 'air', anchors: { x: 640, y: 180, w: 200, h: 90 }, ideal: { x: 720, y: 220 }, priority: 1, scale: 0.92 },
  { id: 'air-low-right', habitat: 'air', anchors: { x: 880, y: 430, w: 180, h: 110 }, ideal: { x: 960, y: 480 }, priority: 2, scale: 0.92 },
];

/**
 * The original composition: when one of the four starters is active it returns
 * here (if the spot is clear), so the familiar first scene never changes.
 */
export const STARTER_HOMES: Record<string, { zone: string; x: number; y: number }> = {
  opaline_wyrmling: { zone: 'perch-left-branch', x: 300, y: 330 },
  moonmoth_cat: { zone: 'ground-left', x: 215, y: 790 },
  lunabloom_fawn: { zone: 'ground-center', x: 725, y: 765 },
  fernwhorl: { zone: 'ground-right', x: 1008, y: 770 },
};

/** Gentle per-appearance colour adjustments (multiply tint). */
export const APPEARANCE_TINT: Record<string, number> = {
  // the white fawn's lavender highlights outshone the others; soften slightly
  'lunabloom_fawn|base': 0xe0dcea,
};

/** Lanterns hang from their top (the chain ring). */
const HANG = { x: 0.5, y: 0 };

/** Converts a point on the ORIGINAL Heartwood artwork to world coordinates. */
export function treeToWorld(sx: number, sy: number): [number, number] {
  const k = HEARTWOOD.scale ?? 1;
  return [HEARTWOOD.x + (sx - HEART_SOURCE[0]) * k, HEARTWOOD.y + (sy - HEART_SOURCE[1]) * k];
}

/**
 * Crystal lanterns hang from real branch undersides, measured on the Heartwood
 * artwork (`hook` = bark edge, original pixels, with open space below). They
 * move with the tree because they are positioned from the tree's transform.
 * `height` = lantern size in world px (the chain is the top of the sprite).
 */
export const LANTERN_HOOKS: { label: string; hook: [number, number]; height: number }[] = [
  { label: 'lantern upper left', hook: [340, 468], height: 128 },
  { label: 'lantern beside trunk', hook: [500, 572], height: 104 },
  { label: 'lantern right branch', hook: [880, 606], height: 118 },
];
/** The chain starts this many source px inside the bark, so it looks attached. */
const LANTERN_BARK_OVERLAP = 4;

export const PROPS: Placement[] = [
  ...LANTERN_HOOKS.map((h) => {
    const [x, y] = treeToWorld(h.hook[0], h.hook[1] - LANTERN_BARK_OVERLAP);
    return { label: h.label, asset: 'decor.lantern', x, y, height: h.height, anchor: HANG };
  }),
  // both mushroom clusters sit on open, visible ground (not under the nav bar or sidebar),
  // because Glimmercap Mushrooms makes them glow and release spores
  { label: 'mushrooms', asset: 'decor.mushrooms', x: 1040, y: 792, height: 70, anchor: FEET, flipX: true },
  { label: 'mushrooms small', asset: 'decor.mushrooms', x: 538, y: 716, height: 50, anchor: FEET, flipX: true },
  // Prismatic Crystals: both clusters on the right side of the grove, clear of the moonflowers
  { label: 'crystals', asset: 'decor.crystals', x: 1098, y: 702, height: 62, anchor: FEET },
  { label: 'crystals low left', asset: 'decor.crystals', x: 366, y: 778, height: 50, anchor: FEET },
];

/**
 * Moonlit Blossoms in the world: moonflower clusters (the Moonlit Blossoms art)
 * scattered naturally around the clearing, appearing as the upgrade levels up
 * (`level` = upgrade level that reveals it). Spread out on purpose, at varied
 * sizes and depths: never in a row.
 */
export const BLOSSOM_SPOTS: { x: number; y: number; height: number; level: number; flipX?: boolean }[] = [
  { x: 296, y: 664, height: 60, level: 1 }, // left of the roots
  { x: 818, y: 650, height: 52, level: 3, flipX: true }, // right of the roots
  { x: 1088, y: 708, height: 48, level: 5 }, // by the right crystals
  { x: 598, y: 630, height: 34, level: 5, flipX: true }, // tucked against the trunk
  { x: 142, y: 672, height: 44, level: 10, flipX: true }, // far left, near the mound
  { x: 936, y: 748, height: 40, level: 25 }, // front right
];

/**
 * Moonveil Elderwood in the world: points along the Heartwood's existing teal
 * veins (heart -> trunk -> roots) that glow brighter as the upgrade levels up.
 */
export const CONDUIT_VEINS: [number, number][] = [
  [505, 465], [508, 500], [502, 535], [495, 568],
  [612, 470], [616, 505], [620, 540],
  [566, 495], [568, 530], [566, 565],
  [472, 610], [658, 610],
];

export const FOREGROUND: Placement[] = [
  { label: 'bush left', asset: 'decor.flowerBush', x: 60, y: 930, height: 240, anchor: FEET },
  { label: 'bush right', asset: 'decor.flowerBush', x: 1540, y: 935, height: 220, anchor: FEET, flipX: true },
  { label: 'bush mid', asset: 'decor.flowerBush', x: 600, y: 940, height: 110, anchor: FEET },
];
