// Pure calculations from GameState. No side effects, so the UI, the store and
// other systems (summoning, achievements) all share exactly the same numbers.

import {
  BOND, CLICK_MILESTONE_EVERY, PASSIVE_MILESTONE_EVERY, SUMMON, UPGRADES, UPGRADES_BY_ID,
  UPGRADE_REVEAL_FRACTION, levelThreshold, type UpgradeId,
} from './config';
import type { GameState } from './state';

// ------------------------------------------------------------------ costs

/** Total price of buying `count` levels starting from `level` (geometric series). */
export function costOfLevels(id: UpgradeId, level: number, count: number): number {
  const { baseCost, growth } = UPGRADES_BY_ID[id];
  const first = baseCost * Math.pow(growth, level);
  return Math.ceil(first * ((Math.pow(growth, count) - 1) / (growth - 1)));
}

export function upgradeCost(state: GameState, id: UpgradeId, count = 1): number {
  return costOfLevels(id, state.upgrades[id], count);
}

export function isMaxed(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADES_BY_ID[id];
  return def.maxLevel !== undefined && state.upgrades[id] >= def.maxLevel;
}

/** Most levels affordable right now (at least 0). */
export function maxAffordable(state: GameState, id: UpgradeId): number {
  const { baseCost, growth, maxLevel } = UPGRADES_BY_ID[id];
  const level = state.upgrades[id];
  const first = baseCost * Math.pow(growth, level);
  // solve first * (g^n - 1)/(g - 1) <= aether for n, then correct for rounding
  let n = Math.floor(Math.log((state.aether * (growth - 1)) / first + 1) / Math.log(growth));
  if (!Number.isFinite(n) || n < 0) n = 0;
  while (n > 0 && costOfLevels(id, level, n) > state.aether) n--;
  while (costOfLevels(id, level, n + 1) <= state.aether) n++;
  if (maxLevel !== undefined) n = Math.min(n, maxLevel - level);
  return Math.max(0, n);
}

/** An upgrade appears once the player has earned a fair share of its first price. */
export function isRevealed(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADES_BY_ID[id];
  return state.upgrades[id] > 0 || state.lifetimeAether >= def.baseCost * UPGRADE_REVEAL_FRACTION;
}

// ------------------------------------------------------------------ production

function arcaneClick(level: number): number {
  return (1 + level) * Math.pow(2, Math.floor(level / CLICK_MILESTONE_EVERY));
}

function springsMultiplier(level: number): number {
  return 1 + 0.5 * level;
}

/** Aether/sec from one passive upgrade at a given level (normal time speed, no bonuses). */
export function passiveRate(id: UpgradeId, level: number): number {
  const rate = UPGRADES_BY_ID[id].rate ?? 0;
  return rate * level * Math.pow(2, Math.floor(level / PASSIVE_MILESTONE_EVERY));
}

/** Total Familiar Bond across all species. */
export function totalBond(state: GameState): number {
  return Object.values(state.collection).reduce((sum, c) => sum + c.bond, 0);
}

/** Familiar Bond multiplier applied to all Aether income. */
export function bondMultiplier(state: GameState): number {
  return 1 + totalBond(state) * BOND.bonusPerPoint;
}

export function perClick(state: GameState): number {
  return arcaneClick(state.upgrades.arcane_touch) * springsMultiplier(state.upgrades.crystal_springs) * bondMultiplier(state);
}

/** Passive income at normal time speed. */
export function basePerSecond(state: GameState): number {
  let sum = 0;
  for (const u of UPGRADES) if (u.kind === 'passive') sum += passiveRate(u.id, state.upgrades[u.id]);
  return sum * bondMultiplier(state);
}

/** Passive income actually gained per real second (includes the time-speed setting). */
export function perSecond(state: GameState): number {
  return basePerSecond(state) * state.settings.timeSpeed;
}

/** What buying `count` more levels would add. */
export function nextBenefit(state: GameState, id: UpgradeId, count = 1): { amount: number; unit: 'per click' | 'per sec' } {
  const lvl = state.upgrades[id];
  const bond = bondMultiplier(state);
  const def = UPGRADES_BY_ID[id];
  if (def.kind === 'click') {
    return { amount: (arcaneClick(lvl + count) - arcaneClick(lvl)) * springsMultiplier(state.upgrades.crystal_springs) * bond, unit: 'per click' };
  }
  if (def.kind === 'clickMultiplier') {
    return { amount: arcaneClick(state.upgrades.arcane_touch) * (springsMultiplier(lvl + count) - springsMultiplier(lvl)) * bond, unit: 'per click' };
  }
  return { amount: (passiveRate(id, lvl + count) - passiveRate(id, lvl)) * bond * state.settings.timeSpeed, unit: 'per sec' };
}

/** Current contribution of an upgrade, for its card. */
export function currentEffect(state: GameState, id: UpgradeId): number {
  const def = UPGRADES_BY_ID[id];
  if (def.kind === 'passive') return passiveRate(id, state.upgrades[id]) * bondMultiplier(state) * state.settings.timeSpeed;
  if (def.kind === 'click') return perClick(state);
  return springsMultiplier(state.upgrades[id]);
}

// ------------------------------------------------------------------ grove level

export function groveLevel(state: GameState): number {
  const t = state.lifetimeAether;
  if (t < levelThreshold(2)) return 1;
  let n = Math.floor(Math.log(t / 50) / Math.log(3.2)) + 2;
  while (n > 1 && t < levelThreshold(n)) n--;
  while (t >= levelThreshold(n + 1)) n++;
  return n;
}

export function levelProgress(state: GameState): { level: number; current: number; needed: number } {
  const level = groveLevel(state);
  const lo = levelThreshold(level);
  return { level, current: state.lifetimeAether - lo, needed: levelThreshold(level + 1) - lo };
}

// ------------------------------------------------------------------ summoning price

export function summonCost(state: GameState): number {
  return Math.ceil(SUMMON.baseCost * Math.pow(SUMMON.growth, state.summons));
}
