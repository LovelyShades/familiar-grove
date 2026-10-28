// The familiar roster. Everything about a species lives here: add a new entry
// (and its images in scripts/asset-sources.mjs) and the rest of the game picks it up.
//
// Two separate kinds of rarity:
//   speciesRarity  - how hard the species is to summon at all
//   mutation chance - once summoned, the chance it appears in its rare form;
//                     it grows with that species' Familiar Bond (see MUTATION in config.ts)

import manifestJson from '../generated/assetManifest.json';

const manifestAssets = (manifestJson as { assets: Record<string, unknown> }).assets;

export type SpeciesRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Variant = 'base' | 'mutation';

/** Summon weight of each species in a tier (higher = more likely), plus display colour. */
export const SPECIES_RARITY: Record<SpeciesRarity, { label: string; weight: number; color: string }> = {
  common: { label: 'Common', weight: 50, color: '#c9d3e6' },
  uncommon: { label: 'Uncommon', weight: 28, color: '#7fe0b8' },
  rare: { label: 'Rare', weight: 12, color: '#7cc4ff' },
  epic: { label: 'Epic', weight: 5, color: '#c39bff' },
  legendary: { label: 'Legendary', weight: 1.5, color: '#f0d8ff' },
};

/**
 * Idle motion personalities, used by the scene:
 *   breathe - gentle rise and fall      sway  - slow side-to-side lean
 *   perch   - settled with small shifts hover - floats up and down
 *   swim    - slow, graceful gliding    flutter - quick playful hovering
 *   creep   - very slow, barely moving
 */
export type IdleStyle = 'breathe' | 'sway' | 'perch' | 'hover' | 'swim' | 'flutter' | 'creep';

export interface AppearanceDef {
  name: string;
  /** Manifest asset id. */
  asset: string;
  /** Point on the ORIGINAL artwork to centre portraits on (usually the face). */
  face: [number, number];
}

export interface SpeciesDef {
  id: string;
  name: string;
  lore: string;
  speciesRarity: SpeciesRarity;
  base: AppearanceDef;
  /** The rare form. Its odds come from MUTATION / MOONS_FAVOR in config.ts. */
  mutation: AppearanceDef;
  unlock: { groveLevel: number };
  /** Starting companions are already in the grove on a new save. */
  starter?: boolean;
  display: {
    /** Height in logical scene pixels when standing in the grove. */
    height: number;
    /** Which way the artwork faces. 'front' is never mirrored. */
    facing: 'left' | 'right' | 'front';
    /** Where the species can be placed in the scene. */
    habitat: 'ground' | 'perch' | 'air';
    /** Anchor on the trimmed sprite (feet for ground creatures). */
    anchor?: { x: number; y: number };
  };
  animation: {
    idle: IdleStyle;
    /** 1 = normal tempo; lower is calmer. */
    tempo?: number;
  };
}

export const SPECIES: SpeciesDef[] = [
  {
    id: 'moonmoth_cat',
    name: 'Moonmoth Cat',
    lore: 'A star-speckled cat with moth wings that naps in moonbeams.',
    speciesRarity: 'common',
    base: { name: 'Moonmoth Cat', asset: 'familiar.moonmoth_cat.base', face: [1120, 360] },
    mutation: { name: 'Eclipse Moonmoth', asset: 'familiar.moonmoth_cat.rare', face: [1120, 360] },
    unlock: { groveLevel: 1 },
    starter: true,
    display: { height: 190, facing: 'right', habitat: 'ground' },
    animation: { idle: 'breathe', tempo: 0.8 },
  },
  {
    id: 'opaline_wyrmling',
    name: 'Opaline Wyrmling',
    lore: 'A young dragon whose scales shimmer like the inside of a shell.',
    speciesRarity: 'rare',
    base: { name: 'Opaline Wyrmling', asset: 'familiar.opaline_wyrmling.base', face: [1010, 330] },
    mutation: { name: 'Astral Opaline', asset: 'familiar.opaline_wyrmling.rare', face: [1010, 330] },
    unlock: { groveLevel: 1 },
    display: { height: 220, facing: 'right', habitat: 'perch' },
    animation: { idle: 'perch', tempo: 1.3 },
  },
  {
    id: 'lunabloom_fawn',
    name: 'Lunabloom Fawn',
    lore: 'Flowers open wherever this moonlit fawn steps.',
    speciesRarity: 'uncommon',
    base: { name: 'Lunabloom Fawn', asset: 'familiar.lunabloom_fawn.base', face: [1080, 400] },
    mutation: { name: 'Bloodmoon Lunabloom', asset: 'familiar.lunabloom_fawn.rare', face: [1080, 400] },
    unlock: { groveLevel: 1 },
    display: { height: 290, facing: 'right', habitat: 'ground' },
    animation: { idle: 'sway', tempo: 0.7 },
  },
  {
    id: 'fernwhorl',
    name: 'Fernwhorl Guardian',
    lore: 'A mossy guardian that curls its fern tail around sleeping crystals.',
    speciesRarity: 'common',
    base: { name: 'Fernwhorl Guardian', asset: 'familiar.fernwhorl.base', face: [1150, 330] },
    mutation: { name: 'Mycelium Fernwhorl', asset: 'familiar.fernwhorl.rare', face: [1150, 330] },
    unlock: { groveLevel: 1 },
    display: { height: 180, facing: 'right', habitat: 'ground' },
    animation: { idle: 'breathe', tempo: 0.6 },
  },
  {
    id: 'veilfin_drifter',
    name: 'Veilfin Drifter',
    lore: 'Glides through the twilight air on wings full of constellations.',
    speciesRarity: 'epic',
    base: { name: 'Veilfin Drifter', asset: 'familiar.veilfin_drifter.base', face: [800, 520] },
    mutation: { name: 'Nebula Veilfin', asset: 'familiar.veilfin_drifter.rare', face: [750, 540] },
    unlock: { groveLevel: 8 },
    display: { height: 210, facing: 'front', habitat: 'air', anchor: { x: 0.5, y: 0.5 } },
    animation: { idle: 'swim', tempo: 0.6 },
  },
  {
    id: 'lanternshell_nimbi',
    name: 'Lanternshell Nimbi',
    lore: 'A slow snail carrying a tiny glowing garden inside its glass shell.',
    speciesRarity: 'common',
    base: { name: 'Lanternshell Nimbi', asset: 'familiar.lanternshell_nimbi.base', face: [320, 610] },
    mutation: { name: 'Frostglass Nimbi', asset: 'familiar.lanternshell_nimbi.rare', face: [320, 610] },
    unlock: { groveLevel: 2 },
    display: { height: 130, facing: 'left', habitat: 'ground' },
    animation: { idle: 'creep', tempo: 0.4 },
  },
  {
    id: 'arcveil_pangolith',
    name: 'Arcveil Pangolith',
    lore: 'Its rune-carved scales glow softly when danger is near.',
    speciesRarity: 'uncommon',
    base: { name: 'Arcveil Pangolith', asset: 'familiar.arcveil_pangolith.base', face: [1290, 640] },
    mutation: { name: 'Aurora Pangolith', asset: 'familiar.arcveil_pangolith.rare', face: [1290, 640] },
    unlock: { groveLevel: 4 },
    display: { height: 150, facing: 'right', habitat: 'ground' },
    animation: { idle: 'breathe', tempo: 0.9 },
  },
  {
    id: 'echoglass_pipbat',
    name: 'Echoglass Pipbat',
    lore: 'A tiny bat with stained-glass wings that chime when it flaps.',
    speciesRarity: 'uncommon',
    base: { name: 'Echoglass Pipbat', asset: 'familiar.echoglass_pipbat.base', face: [670, 600] },
    mutation: { name: 'Dreamglass Pipbat', asset: 'familiar.echoglass_pipbat.rare', face: [670, 600] },
    unlock: { groveLevel: 5 },
    display: { height: 130, facing: 'front', habitat: 'air', anchor: { x: 0.5, y: 0.5 } },
    animation: { idle: 'flutter', tempo: 1.4 },
  },
  {
    id: 'runebloom_axolume',
    name: 'Runebloom Axolume',
    lore: 'A moonlit axolotl whose gills glow with growing runes.',
    speciesRarity: 'rare',
    base: { name: 'Runebloom Axolume', asset: 'familiar.runebloom_axolume.base', face: [850, 455] },
    mutation: { name: 'Pearldusk Axolume', asset: 'familiar.runebloom_axolume.rare', face: [850, 455] },
    unlock: { groveLevel: 6 },
    display: { height: 140, facing: 'front', habitat: 'ground' },
    animation: { idle: 'sway', tempo: 0.8 },
  },
  {
    id: 'starhollow_tapir',
    name: 'Starhollow Tapir',
    lore: 'A forest spirit with a crescent tail that carries the night sky.',
    speciesRarity: 'legendary',
    base: { name: 'Starhollow Tapir', asset: 'familiar.starhollow_tapir.base', face: [300, 470] },
    mutation: { name: 'Astral Hollow Tapir', asset: 'familiar.starhollow_tapir.rare', face: [300, 470] },
    unlock: { groveLevel: 10 },
    display: { height: 190, facing: 'left', habitat: 'ground' },
    animation: { idle: 'breathe', tempo: 0.7 },
  },
];

export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

/** Every collectible appearance: each species' base form and its mutation. */
export const APPEARANCES = SPECIES.flatMap((s) => [
  { species: s.id, variant: 'base' as Variant, ...s.base },
  { species: s.id, variant: 'mutation' as Variant, ...s.mutation },
]);

export const TOTAL_SPECIES = SPECIES.length;
export const TOTAL_APPEARANCES = APPEARANCES.length;

export function appearanceOf(speciesId: string, variant: Variant): AppearanceDef {
  const s = SPECIES_BY_ID[speciesId];
  return variant === 'mutation' ? s.mutation : s.base;
}

/** True when the image for this appearance has been processed into the game. */
export function hasArtwork(speciesId: string, variant: Variant): boolean {
  return appearanceOf(speciesId, variant).asset in manifestAssets;
}
