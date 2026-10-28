// The saved game. Everything persisted lives in GameState; anything that can be
// calculated from it (rates, costs, levels) is derived in economy.ts instead.

import { CLOCK_START_MINUTES, SAVE_VERSION, SUMMON, TIME_SPEEDS, UPGRADES, type UpgradeId } from './config';
import { SPECIES, SPECIES_BY_ID, type Variant } from './registry';

export interface CollectionEntry {
  /** How many of each appearance the player owns. 0 = not discovered. */
  base: number;
  mutation: number;
  /** Familiar Bond level: from duplicate summons and time spent active in the grove. */
  bond: number;
  /** Minutes active in the grove toward the next bond level. */
  activeMinutes: number;
  /** Moon's Favor: summons of this species since its last mutation. */
  misses: number;
}

export interface DisplayedFamiliar {
  species: string;
  variant: Variant;
}

export interface AudioSettings {
  master: number;
  ambience: number;
  effects: number;
  muted: boolean;
}

export interface RecentSummon {
  species: string;
  variant: Variant;
  at: number;
  newAppearance: boolean;
  favored: boolean;
}

export const RECENT_SUMMONS_KEPT = 10;

export interface Settings {
  theme: 'dark' | 'light';
  timeSpeed: number;
  audio: AudioSettings;
  reducedMotion: boolean;
  /** Pointer-driven depth movement of the scene layers. */
  parallax: boolean;
  /** Skip the long summon reveal (offered after the first summon). */
  quickSummon: boolean;
}

export interface GameState {
  version: number;
  aether: number;
  lifetimeAether: number;
  clicks: number;
  upgrades: Record<UpgradeId, number>;
  /** Owned familiars by species id. Missing species = never summoned. */
  collection: Record<string, CollectionEntry>;
  /** Familiars active in the grove scene (at most SUMMON.maxActive), in slot order. */
  displayed: DisplayedFamiliar[];
  summons: number;
  mutationsSummoned: number;
  /** Species whose summon weight is boosted by Attunement (one at a time). */
  attuned: string | null;
  /** Latest summon results, newest first. */
  recentSummons: RecentSummon[];
  settings: Settings;
  clockMinutes: number;
  playSeconds: number;
  /** Wall-clock time (ms) up to which production has been granted. */
  lastTick: number;
  createdAt: number;
  /** The first-time guided tour has been completed or skipped. */
  tutorialDone: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { master: 0.7, ambience: 0.5, effects: 0.7, muted: false };

export function createInitialState(now = Date.now()): GameState {
  const starters = SPECIES.filter((s) => s.starter);
  return {
    version: SAVE_VERSION,
    aether: 0,
    lifetimeAether: 0,
    clicks: 0,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpgradeId, number>,
    // the four original familiars begin as your starting companions (base forms only)
    collection: Object.fromEntries(starters.map((s) => [s.id, { base: 1, mutation: 0, bond: 0, activeMinutes: 0, misses: 0 }])),
    displayed: starters.slice(0, SUMMON.maxActive).map((s) => ({ species: s.id, variant: 'base' as Variant })),
    summons: 0,
    mutationsSummoned: 0,
    attuned: null,
    recentSummons: [],
    settings: { theme: 'dark', timeSpeed: 1, audio: { ...DEFAULT_AUDIO }, reducedMotion: false, parallax: true, quickSummon: false },
    clockMinutes: CLOCK_START_MINUTES,
    playSeconds: 0,
    lastTick: now,
    createdAt: now,
    tutorialDone: false,
  };
}

const num = (v: unknown, fallback: number, min = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback;
const unit = (v: unknown, fallback: number): number => Math.min(1, num(v, fallback));
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/**
 * Turns any saved data (older versions, partial, corrupted) into a valid GameState.
 * Unknown fields are dropped; missing or invalid ones get safe defaults, so adding
 * upgrades or creatures later never breaks an existing save.
 */
export function migrateSave(raw: unknown, now = Date.now()): GameState {
  const base = createInitialState(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Record<string, any>;

  const state: GameState = {
    ...base,
    aether: num(s.aether, 0),
    lifetimeAether: num(s.lifetimeAether, 0),
    clicks: Math.floor(num(s.clicks, 0)),
    summons: Math.floor(num(s.summons, 0)),
    mutationsSummoned: Math.floor(num(s.mutationsSummoned, 0)),
    clockMinutes: num(s.clockMinutes, base.clockMinutes),
    playSeconds: num(s.playSeconds, 0),
    lastTick: num(s.lastTick, now),
    createdAt: num(s.createdAt, now),
  };
  state.lifetimeAether = Math.max(state.lifetimeAether, state.aether);
  // older saves never saw the tour; anyone who has already played skips it
  state.tutorialDone = bool(s.tutorialDone, state.clicks > 0 || state.lifetimeAether > 0);

  for (const u of UPGRADES) {
    const lvl = Math.floor(num(s.upgrades?.[u.id], 0));
    state.upgrades[u.id] = u.maxLevel !== undefined ? Math.min(lvl, u.maxLevel) : lvl;
  }

  // v1 saves had no bond; v2 had no activeMinutes/misses: all default to 0
  if (s.collection && typeof s.collection === 'object') {
    state.collection = {};
    for (const [id, entry] of Object.entries(s.collection as Record<string, any>)) {
      if (!SPECIES_BY_ID[id]) continue; // species no longer in the roster
      const owned = {
        base: Math.floor(num(entry?.base, 0)),
        mutation: Math.floor(num(entry?.mutation, 0)),
        bond: Math.floor(num(entry?.bond, 0)),
        activeMinutes: num(entry?.activeMinutes, 0),
        misses: Math.floor(num(entry?.misses, 0)),
      };
      if (owned.base + owned.mutation > 0) state.collection[id] = owned;
    }
  }

  if (Array.isArray(s.displayed)) {
    const seen = new Set<string>();
    state.displayed = s.displayed
      .filter((d: any) => d && SPECIES_BY_ID[d.species] && (d.variant === 'base' || d.variant === 'mutation'))
      .filter((d: DisplayedFamiliar) => (state.collection[d.species]?.[d.variant] ?? 0) > 0)
      .filter((d: DisplayedFamiliar) => !seen.has(d.species) && seen.add(d.species))
      .slice(0, SUMMON.maxActive)
      .map((d: DisplayedFamiliar) => ({ species: d.species, variant: d.variant }));
  }

  state.attuned = typeof s.attuned === 'string' && state.collection[s.attuned] ? s.attuned : null;
  state.recentSummons = Array.isArray(s.recentSummons)
    ? s.recentSummons
        .filter((r: any) => r && SPECIES_BY_ID[r.species] && (r.variant === 'base' || r.variant === 'mutation'))
        .slice(0, RECENT_SUMMONS_KEPT)
        .map((r: any) => ({ species: r.species, variant: r.variant, at: num(r.at, 0), newAppearance: bool(r.newAppearance, false), favored: bool(r.favored, false) }))
    : [];

  const st = s.settings ?? {};
  state.settings = {
    theme: st.theme === 'light' ? 'light' : 'dark',
    timeSpeed: TIME_SPEEDS.includes(st.timeSpeed) ? st.timeSpeed : 1,
    audio: {
      master: unit(st.audio?.master, base.settings.audio.master),
      ambience: unit(st.audio?.ambience, base.settings.audio.ambience),
      effects: unit(st.audio?.effects, base.settings.audio.effects),
      muted: bool(st.audio?.muted, false),
    },
    reducedMotion: bool(st.reducedMotion, false),
    parallax: bool(st.parallax, true),
    quickSummon: bool(st.quickSummon, false),
  };

  // a clock set backwards must never produce negative time
  if (state.lastTick > now) state.lastTick = now;
  state.version = SAVE_VERSION;
  return state;
}
