import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_BY_ID } from '../game/registry';
import type { DisplayedFamiliar } from '../game/state';
import { FOCAL_KEEP_OUT, STARTER_HOMES, UI_KEEP_OUT } from './layout';
import { GROUND_LINE_Y, familiarKey, insideSafeArea, overlapArea, placeFamiliars, problemsFor } from './placement';

const ids = SPECIES.map((s) => s.id);

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, i) => combinations(items.slice(i + 1), k - 1).map((rest) => [item, ...rest]));
}

function check(list: DisplayedFamiliar[]): string[] {
  const placed = placeFamiliars(list);
  const issues: string[] = [];
  if (placed.length !== list.length) issues.push(`placed ${placed.length}/${list.length}`);
  placed.forEach((p, i) => {
    const others = placed.filter((_, j) => j !== i).map((o) => o.box);
    for (const problem of problemsFor(p.box, others)) issues.push(`${p.key}: ${problem}`);
  });
  return issues;
}

describe('familiar placement', () => {
  it('places every appearance on its own, fully visible', () => {
    for (const species of ids) {
      for (const variant of ['base', 'mutation'] as const) {
        const [p] = placeFamiliars([{ species, variant }]);
        expect(p, `${species} ${variant}`).toBeTruthy();
        expect(insideSafeArea(p.box), `${species} ${variant}`).toBe(true);
        for (const k of UI_KEEP_OUT) expect(overlapArea(p.box, k) / (p.box.w * p.box.h)).toBeLessThanOrEqual(0.06);
      }
    }
  });

  it('keeps the original four-familiar composition', () => {
    const starters = Object.keys(STARTER_HOMES).map((species) => ({ species, variant: 'base' as const }));
    const placed = placeFamiliars(starters);
    for (const p of placed) {
      const home = STARTER_HOMES[p.familiar.species];
      expect([p.x, p.y], p.key).toEqual([home.x, home.y]);
    }
    expect(check(starters)).toEqual([]);
  });

  it('fits every combination of four species with no overlaps or hidden familiars', () => {
    const failures: string[] = [];
    for (const combo of combinations(ids, 4)) {
      for (const variant of ['base', 'mutation'] as const) {
        const list = combo.map((species) => ({ species, variant }));
        const issues = check(list);
        if (issues.length) failures.push(`${combo.join('+')} (${variant}): ${issues.join('; ')}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('never covers the Heartwood heart', () => {
    for (const combo of combinations(ids, 4)) {
      for (const p of placeFamiliars(combo.map((species) => ({ species, variant: 'base' as const })))) {
        const area = Math.min(p.box.w * p.box.h, FOCAL_KEEP_OUT.w * FOCAL_KEEP_OUT.h);
        expect(overlapArea(p.box, FOCAL_KEEP_OUT) / area).toBeLessThanOrEqual(0.06);
      }
    }
  });

  it('is deterministic and keeps existing familiars in place when one is added', () => {
    const three: DisplayedFamiliar[] = [
      { species: 'lunabloom_fawn', variant: 'base' },
      { species: 'arcveil_pangolith', variant: 'base' },
      { species: 'lanternshell_nimbi', variant: 'base' },
    ];
    const a = placeFamiliars(three);
    expect(placeFamiliars(three)).toEqual(a);
    const previous = new Map(a.map((p) => [familiarKey(p.familiar), p]));
    // a newcomer that fits leaves everyone else where they are
    const four = placeFamiliars([...three, { species: 'echoglass_pipbat', variant: 'base' }], previous);
    for (const p of a) {
      const after = four.find((q) => q.key === p.key)!;
      expect([after.x, after.y]).toEqual([p.x, p.y]);
    }
    // a large newcomer may rearrange the grove, but everyone still fits cleanly
    const big = [...three, { species: 'starhollow_tapir', variant: 'base' as const }];
    expect(placeFamiliars(big, previous).length).toBe(4);
    expect(check(big)).toEqual([]);
  });

  it('keeps every ground familiar on the clearing floor, never above its back rim', () => {
    for (const combo of combinations(ids, 4)) {
      for (const p of placeFamiliars(combo.map((species) => ({ species, variant: 'base' as const })))) {
        if (SPECIES_BY_ID[p.familiar.species].display.habitat !== 'ground') continue;
        expect(p.y, p.key).toBeGreaterThanOrEqual(GROUND_LINE_Y);
      }
    }
  });
});
