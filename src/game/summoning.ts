// Familiar Calling: the summon roll. Two independent rolls:
//   1. which species — weighted by species rarity tier (and Attunement), only unlocked species
//   2. whether it appears as its rare mutation — that species' Bond + Moon's Favor only
// A high bond with one species never changes any other species' odds.

import { ATTUNEMENT, BOND, MOONS_FAVOR, MUTATION } from './config';
import { groveLevel } from './economy';
import { SPECIES, SPECIES_BY_ID, SPECIES_RARITY, type SpeciesDef, type Variant } from './registry';
import type { GameState } from './state';

export interface SummonResult {
  species: string;
  variant: Variant;
  /** First time this species has ever been summoned/owned. */
  newSpecies: boolean;
  /** First time this particular appearance (base or mutation) has been owned. */
  newAppearance: boolean;
  /** Bond gained (duplicates only). */
  bondGained: number;
  /** The mutation was guaranteed by Moon's Favor. */
  favored: boolean;
  /** Mutation chance that applied to this summon (for display). */
  mutationChance: number;
  cost: number;
}

/** A finite, non-negative number or 0 (guards against blank/NaN values in any state). */
const safe = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

export function bondLevel(state: GameState, speciesId: string): number {
  return Math.floor(safe(state.collection[speciesId]?.bond));
}

/** Progress (0..1) toward the next bond level from time spent active in the grove. */
export function bondProgress(state: GameState, speciesId: string): number {
  const minutes = safe(state.collection[speciesId]?.activeMinutes);
  return Math.min(1, minutes / BOND.activeMinutesPerLevel);
}

/** Mutation chance from bond alone: min(base + perBond × bond, max). */
export function bondMutationChance(bond: number): number {
  return Math.min(MUTATION.base + MUTATION.perBond * bond, MUTATION.max);
}

export interface FavorInfo {
  misses: number;
  /** Extra chance added by Moon's Favor right now. */
  bonus: number;
  /** Summons of this species left until a guaranteed mutation. */
  guaranteeIn: number;
}

export function moonsFavor(state: GameState, speciesId: string): FavorInfo {
  const misses = Math.floor(safe(state.collection[speciesId]?.misses));
  const over = Math.max(0, misses - MOONS_FAVOR.softStart + 1);
  return {
    misses,
    bonus: over * MOONS_FAVOR.bonusPerMiss,
    guaranteeIn: Math.max(1, MOONS_FAVOR.guaranteeAt - misses),
  };
}

/** The full chance that the NEXT summon of this species is its rare mutation. */
export function mutationChance(state: GameState, species: SpeciesDef | string): number {
  const def = typeof species === 'string' ? SPECIES_BY_ID[species] : species;
  const favor = moonsFavor(state, def.id);
  if (favor.misses + 1 >= MOONS_FAVOR.guaranteeAt) return 1;
  return Math.min(1, bondMutationChance(bondLevel(state, def.id)) + favor.bonus);
}

/** Summon weight multiplier from Attunement (1 when not attuned). */
export function attunementMultiplier(state: GameState, species: SpeciesDef): number {
  return state.attuned === species.id ? ATTUNEMENT[species.speciesRarity] : 1;
}

/** A species can be attuned once it has been discovered. */
export function canAttune(state: GameState, speciesId: string): boolean {
  const c = state.collection[speciesId];
  return !!c && c.base + c.mutation > 0;
}

/** Species that can currently be summoned. */
export function summonPool(state: GameState): SpeciesDef[] {
  const level = groveLevel(state);
  return SPECIES.filter((s) => s.unlock.groveLevel <= level);
}

/** Probability of each species in the current pool (includes Attunement). */
export function speciesOdds(state: GameState): { species: SpeciesDef; chance: number; attuned: boolean }[] {
  const pool = summonPool(state);
  const weight = (s: SpeciesDef) => SPECIES_RARITY[s.speciesRarity].weight * attunementMultiplier(state, s);
  const total = pool.reduce((sum, s) => sum + weight(s), 0);
  return pool.map((s) => ({ species: s, chance: weight(s) / total, attuned: state.attuned === s.id }));
}

/** Pure roll: pass random numbers in [0, 1) so it can be tested deterministically. */
export function rollSummon(state: GameState, r1: number, r2: number): { species: SpeciesDef; variant: Variant; chance: number } {
  const odds = speciesOdds(state);
  let acc = 0;
  let picked = odds[odds.length - 1].species;
  for (const o of odds) {
    acc += o.chance;
    if (r1 < acc) {
      picked = o.species;
      break;
    }
  }
  const chance = mutationChance(state, picked);
  return { species: picked, variant: r2 < chance ? 'mutation' : 'base', chance };
}

/** Adds a summoned familiar to the collection (mutates state) and describes the outcome. */
export function applySummon(state: GameState, species: SpeciesDef, variant: Variant, cost: number, chance = 0): SummonResult {
  const old = state.collection[species.id];
  // rebuild the entry so a missing or invalid field can never poison later rolls
  const entry = {
    base: Math.floor(safe(old?.base)),
    mutation: Math.floor(safe(old?.mutation)),
    bond: Math.floor(safe(old?.bond)),
    activeMinutes: safe(old?.activeMinutes),
    misses: Math.floor(safe(old?.misses)),
  };
  const newSpecies = entry.base + entry.mutation === 0;
  const newAppearance = entry[variant] === 0;
  const favored = variant === 'mutation' && entry.misses + 1 >= MOONS_FAVOR.guaranteeAt;
  const bondGained = newAppearance ? 0 : variant === 'mutation' ? BOND.perMutationDuplicate : BOND.perDuplicate;
  entry[variant] += 1;
  entry.bond += bondGained;
  entry.misses = variant === 'mutation' ? 0 : entry.misses + 1;
  state.collection[species.id] = entry;
  state.summons += 1;
  if (variant === 'mutation') state.mutationsSummoned += 1;
  return { species: species.id, variant, newSpecies, newAppearance, bondGained, favored, mutationChance: chance, cost };
}
