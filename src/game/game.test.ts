import { describe, expect, it } from 'vitest';
import { ATTUNEMENT, BOND, MOONS_FAVOR, OFFLINE_CAP_SECONDS, SAVE_KEY, SAVE_VERSION, SUMMON, UPGRADES } from './config';
import {
  basePerSecond, costOfLevels, groveLevel, maxAffordable, nextBenefit, perClick, perSecond, summonCost, upgradeCost,
} from './economy';
import { formatNumber, formatRate } from './format';
import { APPEARANCES, SPECIES, TOTAL_APPEARANCES, TOTAL_SPECIES, hasArtwork } from './registry';
import { createInitialState, migrateSave } from './state';
import { GameStore } from './store';
import { applySummon, bondMutationChance, mutationChance, rollSummon, speciesOdds } from './summoning';

/** In-memory stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('registry', () => {
  it('has 10 species and 20 appearances, all with processed artwork', () => {
    expect(TOTAL_SPECIES).toBe(10);
    expect(TOTAL_APPEARANCES).toBe(20);
    for (const a of APPEARANCES) expect(hasArtwork(a.species, a.variant), a.asset).toBe(true);
  });

  it('uses unique ids and assets', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    expect(new Set(APPEARANCES.map((a) => a.asset)).size).toBe(APPEARANCES.length);
  });
});

describe('economy', () => {
  it('starts with 1 Aether per click and no passive income', () => {
    const s = createInitialState(0);
    expect(perClick(s)).toBe(1);
    expect(perSecond(s)).toBe(0);
  });

  it('bulk cost equals the sum of single purchases', () => {
    for (const u of UPGRADES) {
      let sum = 0;
      for (let i = 0; i < 10; i++) sum += costOfLevels(u.id, 3 + i, 1);
      expect(costOfLevels(u.id, 3, 10)).toBeGreaterThanOrEqual(sum - 10);
      expect(costOfLevels(u.id, 3, 10)).toBeLessThanOrEqual(sum + 10);
    }
  });

  it('maxAffordable never exceeds what the player can pay', () => {
    const s = createInitialState(0);
    for (const aether of [0, 11, 12, 1000, 123456, 1e12]) {
      s.aether = aether;
      const n = maxAffordable(s, 'luminous_canopy');
      expect(upgradeCost(s, 'luminous_canopy', Math.max(1, n)) > aether ? n === 0 : true).toBe(true);
      if (n > 0) expect(upgradeCost(s, 'luminous_canopy', n)).toBeLessThanOrEqual(aether);
      expect(upgradeCost(s, 'luminous_canopy', n + 1)).toBeGreaterThan(aether);
    }
  });

  it('next benefit matches the real change', () => {
    const s = createInitialState(0);
    s.upgrades.luminous_canopy = 24;
    const predicted = nextBenefit(s, 'luminous_canopy').amount;
    const before = basePerSecond(s);
    s.upgrades.luminous_canopy = 25;
    expect(basePerSecond(s) - before).toBeCloseTo(predicted);
  });

  it('time speed scales passive income only', () => {
    const s = createInitialState(0);
    s.upgrades.luminous_canopy = 10;
    const click = perClick(s);
    const normal = perSecond(s);
    s.settings.timeSpeed = 2;
    expect(perSecond(s)).toBeCloseTo(normal * 2);
    expect(perClick(s)).toBe(click);
  });

  it('grove level follows lifetime Aether', () => {
    const s = createInitialState(0);
    expect(groveLevel(s)).toBe(1);
    s.lifetimeAether = 50;
    expect(groveLevel(s)).toBe(2);
    s.lifetimeAether = 1e9;
    expect(groveLevel(s)).toBeGreaterThan(8);
  });
});

describe('formatting', () => {
  it('formats large numbers compactly', () => {
    expect(formatNumber(1250)).toBe('1,250');
    expect(formatNumber(24_600_000)).toBe('24.6M');
    expect(formatNumber(3_820_000_000)).toBe('3.82B');
    expect(formatRate(0.5)).toBe('0.5');
    expect(formatNumber(Infinity)).toBe('∞');
  });
});

describe('store', () => {
  it('clicks and buys correctly', () => {
    const store = new GameStore(memoryStorage());
    for (let i = 0; i < 15; i++) store.click();
    expect(store.getSnapshot().aether).toBe(15);
    expect(store.buyUpgrade('arcane_touch')).toBe(1);
    expect(store.getSnapshot().aether).toBe(0);
    expect(perClick(store.getSnapshot())).toBe(2);
    expect(store.buyUpgrade('arcane_touch')).toBe(0); // cannot afford
  });

  it('produces by elapsed wall-clock time and never double counts', () => {
    const store = new GameStore(memoryStorage());
    const t0 = store.getSnapshot().lastTick;
    (store as any).state.upgrades.luminous_canopy = 10; // 10 Aether/sec
    store.tick(t0 + 5000, 0); // first tick: offline gap, wall clock
    expect(store.getSnapshot().aether).toBeCloseTo(50);
    store.tick(t0 + 5000, 0); // same moment again: nothing more
    store.tick(t0 + 4000, 0); // clock set backwards: nothing, and no negative
    expect(store.getSnapshot().aether).toBeCloseTo(50);
    store.tick(t0 + 6000, 1000); // 1 real second passed, though the wall clock jumped 2
    expect(store.getSnapshot().aether).toBeCloseTo(60);
    store.tick(t0 + 3_600_000, 2000); // clock jumped an hour ahead in 1 real second
    expect(store.getSnapshot().aether).toBeCloseTo(70);
  });

  it('caps offline earnings', () => {
    const store = new GameStore(memoryStorage());
    const t0 = store.getSnapshot().lastTick;
    (store as any).state.upgrades.luminous_canopy = 1;
    store.tick(t0 + (OFFLINE_CAP_SECONDS + 10_000) * 1000, 0);
    expect(store.getSnapshot().aether).toBeCloseTo(OFFLINE_CAP_SECONDS);
  });

  it('persists and restores progress', () => {
    const storage = memoryStorage();
    const a = new GameStore(storage);
    for (let i = 0; i < 20; i++) a.click();
    a.buyUpgrade('luminous_canopy');
    a.save();
    const b = new GameStore(storage);
    expect(b.getSnapshot().upgrades.luminous_canopy).toBe(1);
    expect(b.getSnapshot().clicks).toBe(20);
  });

  it('summons, records discoveries and charges the right price', () => {
    const store = new GameStore(memoryStorage());
    (store as any).state.aether = 1e9;
    const cost = summonCost(store.getSnapshot());
    const r = store.summon(() => 0.999)!;
    expect(r.cost).toBe(cost);
    expect(store.getSnapshot().aether).toBe(1e9 - cost);
    expect(store.getSnapshot().collection[r.species]?.[r.variant]).toBeGreaterThan(0);
    expect(store.getSnapshot().summons).toBe(1);
  });

  it('keeps the grove to the active-familiar limit', () => {
    const store = new GameStore(memoryStorage());
    expect(store.getSnapshot().displayed.length).toBeLessThanOrEqual(SUMMON.maxActive);
    store.toggleDisplayed('moonmoth_cat', 'base'); // remove
    expect(store.getSnapshot().displayed.some((d) => d.species === 'moonmoth_cat')).toBe(false);
    store.toggleDisplayed('moonmoth_cat', 'mutation'); // not owned: ignored
    expect(store.getSnapshot().displayed.some((d) => d.species === 'moonmoth_cat')).toBe(false);
  });

  it('a new game starts with only the Moonmoth Cat and the tour pending', () => {
    const store = new GameStore(memoryStorage());
    expect(Object.keys(store.getSnapshot().collection)).toEqual(['moonmoth_cat']);
    expect(store.getSnapshot().displayed).toEqual([{ species: 'moonmoth_cat', variant: 'base' }]);
    expect(store.getSnapshot().tutorialDone).toBe(false);
  });

  it('resets to a fresh game', () => {
    const storage = memoryStorage();
    const store = new GameStore(storage);
    store.click();
    store.reset();
    expect(store.getSnapshot().aether).toBe(0);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).clicks).toBe(0);
  });
});

describe('save migration', () => {
  it('fills defaults for an empty or corrupted save', () => {
    expect(migrateSave(null).aether).toBe(0);
    const s = migrateSave({ aether: 'lots', upgrades: { arcane_touch: -4, made_up: 9 }, settings: { timeSpeed: 7 } });
    expect(s.aether).toBe(0);
    expect(s.upgrades.arcane_touch).toBe(0);
    expect(s.settings.timeSpeed).toBe(1);
    expect(s.version).toBe(SAVE_VERSION);
  });

  it('upgrades a version 1 save without losing progress', () => {
    const v1 = {
      version: 1,
      aether: 500,
      lifetimeAether: 900,
      upgrades: { arcane_touch: 3, luminous_canopy: 2 },
      collection: { moonmoth_cat: { base: 2, mutation: 0 }, ghost_species: { base: 1, mutation: 0 } },
      displayed: [{ species: 'moonmoth_cat', variant: 'base' }],
      settings: { theme: 'light', timeSpeed: 2 },
    };
    const s = migrateSave(v1, Date.now());
    expect(s.aether).toBe(500);
    expect(s.upgrades.arcane_touch).toBe(3);
    expect(s.upgrades.astral_resonance).toBe(0); // new upgrade, safe default
    expect(s.collection.moonmoth_cat).toEqual({ base: 2, mutation: 0, bond: 0, activeMinutes: 0, misses: 0 });
    expect(s.collection.ghost_species).toBeUndefined();
    expect(s.settings.theme).toBe('light');
    expect(s.settings.audio.master).toBeGreaterThan(0);
  });

  it('keeps existing bond levels when upgrading a version 2 save', () => {
    const v2 = {
      version: 2,
      aether: 1234,
      collection: { moonmoth_cat: { base: 4, mutation: 2, bond: 6 } },
      displayed: [{ species: 'moonmoth_cat', variant: 'mutation' }],
      summons: 9,
    };
    const s = migrateSave(v2, Date.now());
    expect(s.collection.moonmoth_cat).toEqual({ base: 4, mutation: 2, bond: 6, activeMinutes: 0, misses: 0 });
    expect(s.displayed).toEqual([{ species: 'moonmoth_cat', variant: 'mutation' }]);
    expect(s.summons).toBe(9);
    expect(s.attuned).toBeNull();
    expect(mutationChance(s, 'moonmoth_cat')).toBeCloseTo(0.075); // the "Bond 6 = 7.5%" example
  });

  it('never trusts a save from the future', () => {
    const now = Date.now();
    expect(migrateSave({ lastTick: now + 1e9 }, now).lastTick).toBe(now);
  });
});

describe('summoning', () => {
  it('only offers species unlocked at the current grove level', () => {
    const s = createInitialState(0);
    const ids = speciesOdds(s).map((o) => o.species.id);
    expect(ids).not.toContain('starhollow_tapir');
    expect(speciesOdds(s).reduce((sum, o) => sum + o.chance, 0)).toBeCloseTo(1);
    s.lifetimeAether = 1e15;
    expect(speciesOdds(s).map((o) => o.species.id)).toContain('starhollow_tapir');
  });

  it('rarer tiers are less likely', () => {
    const s = createInitialState(0);
    s.lifetimeAether = 1e15;
    const odds = Object.fromEntries(speciesOdds(s).map((o) => [o.species.id, o.chance]));
    expect(odds.moonmoth_cat).toBeGreaterThan(odds.lunabloom_fawn);
    expect(odds.lunabloom_fawn).toBeGreaterThan(odds.opaline_wyrmling);
    expect(odds.opaline_wyrmling).toBeGreaterThan(odds.veilfin_drifter);
    expect(odds.veilfin_drifter).toBeGreaterThan(odds.starhollow_tapir);
  });

  it('rolls mutations independently of species', () => {
    const s = createInitialState(0);
    const sp = rollSummon(s, 0, 0).species;
    expect(rollSummon(s, 0, 0).variant).toBe('mutation');
    expect(rollSummon(s, 0, mutationChance(s, sp) + 0.01).variant).toBe('base');
  });

  it('bond raises only that species mutation chance: min(3% + 0.75% x bond, 18%)', () => {
    expect(bondMutationChance(0)).toBeCloseTo(0.03);
    expect(bondMutationChance(5)).toBeCloseTo(0.0675);
    expect(bondMutationChance(10)).toBeCloseTo(0.105);
    expect(bondMutationChance(20)).toBeCloseTo(0.18);
    expect(bondMutationChance(99)).toBeCloseTo(0.18);
    const s = createInitialState(0);
    s.collection.moonmoth_cat.bond = 10;
    expect(mutationChance(s, 'moonmoth_cat')).toBeCloseTo(0.105);
    expect(mutationChance(s, 'fernwhorl')).toBeCloseTo(0.03);
  });

  it("Moon's Favor ramps up and guarantees a mutation, then resets", () => {
    const s = createInitialState(0);
    const cat = SPECIES.find((x) => x.id === 'moonmoth_cat')!;
    for (let i = 0; i < MOONS_FAVOR.softStart - 1; i++) applySummon(s, cat, 'base', 1);
    s.collection.moonmoth_cat.bond = 0; // isolate Moon's Favor from the bond the duplicates gave
    expect(mutationChance(s, cat)).toBeCloseTo(0.03); // not past the soft start yet
    applySummon(s, cat, 'base', 1);
    s.collection.moonmoth_cat.bond = 0;
    expect(mutationChance(s, cat)).toBeGreaterThan(0.03); // favor has begun
    for (let i = MOONS_FAVOR.softStart; i < MOONS_FAVOR.guaranteeAt - 1; i++) applySummon(s, cat, 'base', 1);
    s.collection.moonmoth_cat.bond = 0;
    expect(mutationChance(s, cat)).toBe(1);
    const r = rollSummon({ ...s, attuned: null }, 0, 0.999);
    if (r.species.id === 'moonmoth_cat') expect(r.variant).toBe('mutation');
    const res = applySummon(s, cat, 'mutation', 1, 1);
    expect(res.favored).toBe(true);
    expect(s.collection.moonmoth_cat.misses).toBe(0);
    expect(mutationChance(s, cat)).toBeLessThan(0.2);
  });

  it('mutation rate is about 3% at bond 0 over many summons', () => {
    const s = createInitialState(0);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let mutations = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) if (rollSummon(s, rnd(), rnd()).variant === 'mutation') mutations++;
    expect(mutations / n).toBeGreaterThan(0.025);
    expect(mutations / n).toBeLessThan(0.036);
  });

  it('attunement modestly raises one discovered species and keeps odds summing to 1', () => {
    const s = createInitialState(0);
    const before = Object.fromEntries(speciesOdds(s).map((o) => [o.species.id, o.chance]));
    const store = new GameStore(memoryStorage());
    (store as any).state.collection.lunabloom_fawn = { base: 1, mutation: 0, bond: 0, activeMinutes: 0, misses: 0 };
    store.setAttunement('lunabloom_fawn');
    const after = speciesOdds(store.getSnapshot());
    const fawn = after.find((o) => o.species.id === 'lunabloom_fawn')!;
    expect(fawn.attuned).toBe(true);
    expect(fawn.chance).toBeGreaterThan(before.lunabloom_fawn);
    expect(fawn.chance).toBeLessThan(before.lunabloom_fawn * ATTUNEMENT.uncommon);
    expect(after.reduce((sum, o) => sum + o.chance, 0)).toBeCloseTo(1);
    store.setAttunement('starhollow_tapir'); // not discovered: ignored
    expect(store.getSnapshot().attuned).toBe('lunabloom_fawn');
    store.setAttunement(null);
    expect(store.getSnapshot().attuned).toBeNull();
  });

  it('active familiars gain bond over time', () => {
    const store = new GameStore(memoryStorage());
    const t0 = store.getSnapshot().lastTick;
    store.tick(t0 + BOND.activeMinutesPerLevel * 60_000 + 1000, 0);
    for (const d of store.getSnapshot().displayed) expect(store.getSnapshot().collection[d.species].bond).toBe(1);
  });

  it('swaps a familiar into an occupied slot without losing others', () => {
    const store = new GameStore(memoryStorage());
    for (const id of ['opaline_wyrmling', 'lunabloom_fawn', 'fernwhorl']) {
      (store as any).state.collection[id] = { base: 1, mutation: 0, bond: 0, activeMinutes: 0, misses: 0 };
    }
    store.setDisplayed(['moonmoth_cat', 'opaline_wyrmling', 'lunabloom_fawn', 'fernwhorl'].map((species) => ({ species, variant: 'base' as const })));
    (store as any).state.collection.lanternshell_nimbi = { base: 1, mutation: 0, bond: 0, activeMinutes: 0, misses: 0 };
    const before = store.getSnapshot().displayed.map((d) => d.species);
    store.swapDisplayed(1, { species: 'lanternshell_nimbi', variant: 'base' });
    const after = store.getSnapshot().displayed.map((d) => d.species);
    expect(after).toEqual([before[0], 'lanternshell_nimbi', before[2], before[3]]);
    store.swapDisplayed(3, { species: 'lanternshell_nimbi', variant: 'base' }); // move, not duplicate
    expect(store.getSnapshot().displayed.filter((d) => d.species === 'lanternshell_nimbi').length).toBe(1);
    expect(store.getSnapshot().displayed.length).toBe(3);
  });

  it('blank or invalid collection values never produce NaN odds', () => {
    const s = createInitialState(0);
    (s.collection.moonmoth_cat as any).misses = NaN;
    (s.collection.moonmoth_cat as any).bond = undefined;
    for (const sp of SPECIES) expect(Number.isFinite(mutationChance(s, sp))).toBe(true);
    expect(mutationChance(s, 'moonmoth_cat')).toBeCloseTo(0.03);
    const cat = SPECIES.find((x) => x.id === 'moonmoth_cat')!;
    applySummon(s, cat, 'base', 1);
    expect(s.collection.moonmoth_cat.misses).toBe(1);
    expect(Number.isFinite(mutationChance(s, cat))).toBe(true);
  });

  it('a mutation can actually be rolled at bond 0', () => {
    const s = createInitialState(0);
    let mutations = 0;
    for (let i = 0; i < 1000; i++) if (rollSummon(s, (i * 0.618) % 1, (i * 0.377) % 1).variant === 'mutation') mutations++;
    expect(mutations).toBeGreaterThan(0);
  });

  it('remembers the last summons, newest first', () => {
    const store = new GameStore(memoryStorage());
    (store as any).state.aether = 1e12;
    for (let i = 0; i < 12; i++) store.summon();
    const recent = store.getSnapshot().recentSummons;
    expect(recent.length).toBe(10);
    expect(recent[0].at).toBeGreaterThanOrEqual(recent[9].at);
  });

  it('duplicates grant bond; new forms do not', () => {
    const s = createInitialState(0);
    const cat = SPECIES.find((x) => x.id === 'moonmoth_cat')!;
    const dup = applySummon(s, cat, 'base', 100);
    expect(dup.newSpecies).toBe(false);
    expect(dup.bondGained).toBe(1);
    const mut = applySummon(s, cat, 'mutation', 100);
    expect(mut.newAppearance).toBe(true);
    expect(mut.bondGained).toBe(0);
    expect(s.collection.moonmoth_cat.bond).toBe(1);
    expect(perClick(s)).toBeGreaterThan(1); // bond boosts income
  });
});
