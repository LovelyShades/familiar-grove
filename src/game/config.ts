// Balance numbers and upgrade definitions. Effects are calculated in economy.ts.
// Everything tunable lives here or in registry.ts — never in UI code.

export const SAVE_KEY = 'familiar-grove:save';
export const SAVE_VERSION = 3;
export const AUTOSAVE_MS = 5000;
export const TICK_MS = 100;
/** Most production granted for time spent away (closed tab or sleep). */
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
/** Gaps shorter than this are normal ticks, not "welcome back" moments. */
export const OFFLINE_NOTICE_SECONDS = 30;

/** Game clock: 1 real second = 1 in-game minute (at normal time speed). */
export const CLOCK_START_MINUTES = 20 * 60;

export const TIME_SPEEDS = [0.25, 0.5, 1, 2, 3, 5, 10];

// ------------------------------------------------------------------ upgrades

export type UpgradeId =
  | 'arcane_touch'
  | 'crystal_springs'
  | 'luminous_canopy'
  | 'whispering_roots'
  | 'moonlit_blossoms'
  | 'elderwood_conduit'
  | 'astral_resonance';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** 'click' upgrades sit with the spells; 'passive' ones are Grove Upgrades. */
  kind: 'click' | 'clickMultiplier' | 'passive';
  description: string;
  /** Manifest asset id for the icon. */
  icon: string;
  baseCost: number;
  /** Cost multiplier per level owned. */
  growth: number;
  /** Passive upgrades: Aether per second added by each level (before milestones). */
  rate?: number;
  maxLevel?: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'arcane_touch',
    name: 'Arcane Touch',
    kind: 'click',
    description: 'Draw a surge of Aether from the Heartwood Tree.',
    icon: 'ui.aether',
    baseCost: 15,
    growth: 1.45,
  },
  {
    id: 'crystal_springs',
    name: 'Prismatic Crystals',
    kind: 'clickMultiplier',
    description: 'Each level adds +50% click power.',
    icon: 'decor.crystals',
    baseCost: 400,
    growth: 3.2,
  },
  {
    id: 'luminous_canopy',
    name: 'Glimmercap Mushrooms',
    kind: 'passive',
    description: 'The glowing mushrooms gather Aether on their own.',
    icon: 'decor.mushrooms',
    baseCost: 12,
    growth: 1.15,
    rate: 1,
  },
  {
    id: 'whispering_roots',
    name: 'Whispering Roots',
    kind: 'passive',
    description: 'Deep roots draw Aether up from the old earth.',
    icon: 'ui.upgrade.whisperingRoots',
    baseCost: 140,
    growth: 1.15,
    rate: 7,
  },
  {
    id: 'moonlit_blossoms',
    name: 'Moonlit Blossoms',
    kind: 'passive',
    description: 'Flowers that open only for the moon, spilling light.',
    icon: 'ui.upgrade.moonlitBlossoms',
    baseCost: 1600,
    growth: 1.15,
    rate: 45,
  },
  {
    id: 'elderwood_conduit',
    name: 'Moonveil Elderwood',
    kind: 'passive',
    description: 'Moonlit ancient wood channels Aether from the whole forest.',
    icon: 'ui.nav.grove',
    baseCost: 19000,
    growth: 1.15,
    rate: 280,
  },
  {
    id: 'astral_resonance',
    name: 'Astral Spark',
    kind: 'passive',
    description: 'A spark of starlight hums with Aether.',
    icon: 'fx.aetherParticle',
    baseCost: 240000,
    growth: 1.15,
    rate: 1800,
  },
];

export const UPGRADES_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

/** Passive upgrades double their output every this many levels. */
export const PASSIVE_MILESTONE_EVERY = 25;
/** Arcane Touch doubles click power every this many levels. */
export const CLICK_MILESTONE_EVERY = 10;

/** Upgrades are hidden until lifetime Aether reaches this fraction of their first price. */
export const UPGRADE_REVEAL_FRACTION = 0.4;

// ------------------------------------------------------------------ grove levels

/** Lifetime Aether needed to reach grove level n. */
export function levelThreshold(n: number): number {
  return n <= 1 ? 0 : 50 * Math.pow(3.2, n - 2);
}

// ------------------------------------------------------------------ summoning (Familiar Calling)

export const SUMMON = {
  /** Price of the first summon. */
  baseCost: 100,
  /** Price multiplier per summon performed. */
  growth: 1.22,
  /** Max familiars shown in the grove at once. */
  maxActive: 4,
};

/**
 * Familiar Bond — the duplicate reward. Every duplicate summon adds bond to its
 * species; each bond point gives a small permanent boost to ALL Aether income.
 * Mutations are worth more bond.
 */
export const BOND = {
  perDuplicate: 1,
  perMutationDuplicate: 3,
  /** Production bonus per bond level (0.02 = +2%). */
  bonusPerPoint: 0.02,
  /** Minutes a familiar must stay active in the grove to gain one bond level (game open or offline, capped like income). */
  activeMinutesPerLevel: 20,
};

/**
 * Rare-mutation chance for a summon, AFTER the species has been chosen:
 *   chance = min(base + perBond × that species' bond level, max)
 * Bond 0 = 3%, 5 = 6.75%, 10 = 10.5%, 20+ = 18%.
 */
export const MUTATION = {
  base: 0.03,
  perBond: 0.0075,
  max: 0.18,
};

/**
 * Moon's Favor (pity): every summon of a species that does NOT mutate adds one
 * "miss" for that species. From `softStart` misses on, each further miss adds
 * `bonusPerMiss` to its mutation chance; at `guaranteeAt` misses the next summon
 * of that species is guaranteed to mutate. The counter resets when it mutates.
 * Misses only come from real, paid summons of that species, so it cannot be farmed.
 */
export const MOONS_FAVOR = {
  softStart: 12,
  bonusPerMiss: 0.02,
  guaranteeAt: 30,
};

/**
 * Attunement: one discovered species at a time has its summon weight multiplied.
 * Kept modest, especially for rarer tiers. It never changes the species' tier.
 */
export const ATTUNEMENT: Record<'common' | 'uncommon' | 'rare' | 'epic' | 'legendary', number> = {
  common: 1.6,
  uncommon: 1.6,
  rare: 1.5,
  epic: 1.4,
  legendary: 1.25,
};
