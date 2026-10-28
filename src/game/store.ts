// GameStore: the single owner of game state. React reads it through
// useSyncExternalStore; the scene, audio and UI react to its events.
//
// Production is time-based, never frame-based: it keeps working in throttled
// background tabs and can never double-count, because `lastTick` records exactly
// how far production has been granted (and is saved with the game).
//
// While the game is open, elapsed time is the SMALLER of the wall clock and the
// browser's monotonic clock, so changing the computer's clock can't mint
// Aether. Time spent closed uses the wall clock, capped by OFFLINE_CAP_SECONDS.

import {
  AUTOSAVE_MS, BOND, OFFLINE_CAP_SECONDS, OFFLINE_NOTICE_SECONDS, SAVE_KEY, SUMMON, TICK_MS, UPGRADES_BY_ID, type UpgradeId,
} from './config';
import { groveLevel, isMaxed, maxAffordable, perClick, perSecond, summonCost, upgradeCost } from './economy';
import { applySummon, canAttune, rollSummon, type SummonResult } from './summoning';
import { RECENT_SUMMONS_KEPT, createInitialState, migrateSave, type DisplayedFamiliar, type GameState, type Settings } from './state';
import type { Variant } from './registry';

export type BuyAmount = 1 | 10 | 'max';

export type GameEvent =
  | { type: 'click'; amount: number }
  | { type: 'purchase'; id: UpgradeId; levels: number; cost: number }
  | { type: 'summon'; result: SummonResult }
  | { type: 'levelup'; level: number }
  | { type: 'bond'; species: string; level: number }
  | { type: 'offline'; seconds: number; gain: number }
  | { type: 'displayChanged' }
  | { type: 'settings'; settings: Settings }
  | { type: 'reset' };

export class GameStore {
  private state: GameState;
  private snapshot: GameState;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: GameEvent) => void>();
  private timers: number[] = [];
  private lastLevel: number;
  private pendingOffline: { seconds: number; gain: number } | null = null;
  /** Monotonic time of the last in-session tick (null before the first one). */
  private lastMono: number | null = null;

  constructor(private storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.state = this.load();
    this.lastLevel = groveLevel(this.state);
    this.snapshot = { ...this.state };
  }

  // ---------------------------------------------------------------- subscription

  /** For useSyncExternalStore. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Immutable view of the current state (new object after every change). */
  getSnapshot = (): GameState => this.snapshot;

  on(listener: (e: GameEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(e: GameEvent): void {
    for (const l of this.eventListeners) l(e);
  }

  private commit(): void {
    this.snapshot = { ...this.state };
    for (const l of this.listeners) l();
  }

  // ---------------------------------------------------------------- lifecycle

  /** Starts production, autosave and lifecycle handling. Call once. */
  start(): void {
    // grant production for the time the game was closed
    this.tick();
    if (this.pendingOffline) {
      const offline = this.pendingOffline;
      this.pendingOffline = null;
      this.emit({ type: 'offline', ...offline });
    }
    this.save();
    this.timers.push(window.setInterval(() => this.tick(), TICK_MS));
    this.timers.push(window.setInterval(() => this.save(), AUTOSAVE_MS));
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onLeave);
    window.addEventListener('beforeunload', this.onLeave);
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onLeave);
    window.removeEventListener('beforeunload', this.onLeave);
  }

  private onVisibility = (): void => {
    // catch up immediately when returning; save when hiding
    this.tick();
    if (document.hidden) this.save();
  };

  private onLeave = (): void => {
    this.tick();
    this.save();
  };

  // ---------------------------------------------------------------- production

  /** Grants production from `lastTick` up to `now`. Safe to call any number of times. */
  tick(now = Date.now(), mono = typeof performance === 'undefined' ? now : performance.now()): void {
    const s = this.state;
    let elapsed = (now - s.lastTick) / 1000;
    if (this.lastMono !== null) {
      // in-session: never trust the wall clock beyond real elapsed time
      elapsed = Math.min(elapsed, (mono - this.lastMono) / 1000);
    }
    this.lastMono = mono;
    if (elapsed <= 0) {
      // clock moved backwards (or no time passed): resync without granting anything
      s.lastTick = now;
      return;
    }
    const seconds = Math.min(elapsed, OFFLINE_CAP_SECONDS);
    const gain = perSecond(s) * seconds;
    s.lastTick = now;
    s.playSeconds += Math.min(seconds, 1);
    s.clockMinutes += seconds * s.settings.timeSpeed;
    if (gain > 0) this.earn(gain);
    this.growBonds(seconds);
    if (elapsed >= OFFLINE_NOTICE_SECONDS && gain > 0) {
      const info = { seconds, gain };
      if (this.timers.length) this.emit({ type: 'offline', ...info });
      else this.pendingOffline = info;
    }
    this.commit();
  }

  /** Active familiars slowly deepen their bond while they live in the grove. */
  private growBonds(seconds: number): void {
    for (const d of this.state.displayed) {
      const c = this.state.collection[d.species];
      if (!c) continue;
      c.activeMinutes += seconds / 60;
      if (c.activeMinutes >= BOND.activeMinutesPerLevel) {
        const levels = Math.floor(c.activeMinutes / BOND.activeMinutesPerLevel);
        c.activeMinutes -= levels * BOND.activeMinutesPerLevel;
        c.bond += levels;
        this.emit({ type: 'bond', species: d.species, level: c.bond });
      }
    }
  }

  private earn(amount: number): void {
    this.state.aether += amount;
    this.state.lifetimeAether += amount;
    const level = groveLevel(this.state);
    if (level > this.lastLevel) {
      this.lastLevel = level;
      this.emit({ type: 'levelup', level });
    }
  }

  // ---------------------------------------------------------------- actions

  click(): number {
    const amount = perClick(this.state);
    this.state.clicks += 1;
    this.earn(amount);
    this.commit();
    this.emit({ type: 'click', amount });
    return amount;
  }

  /** Buys up to `amount` levels. Returns how many were bought. */
  buyUpgrade(id: UpgradeId, amount: BuyAmount = 1): number {
    if (!UPGRADES_BY_ID[id] || isMaxed(this.state, id)) return 0;
    const levels = amount === 'max' ? maxAffordable(this.state, id) : amount;
    if (levels <= 0) return 0;
    const cost = upgradeCost(this.state, id, levels);
    if (cost > this.state.aether) return 0;
    this.state.aether -= cost;
    this.state.upgrades[id] += levels;
    this.commit();
    this.emit({ type: 'purchase', id, levels, cost });
    this.save();
    return levels;
  }

  /** Familiar Calling. Returns the result, or null if it can't be afforded. */
  summon(random: () => number = Math.random): SummonResult | null {
    const cost = summonCost(this.state);
    if (cost > this.state.aether) return null;
    this.state.aether -= cost;
    const { species, variant, chance } = rollSummon(this.state, random(), random());
    const result = applySummon(this.state, species, variant, cost, chance);
    this.state.recentSummons = [
      { species: result.species, variant: result.variant, at: Date.now(), newAppearance: result.newAppearance, favored: result.favored },
      ...this.state.recentSummons,
    ].slice(0, RECENT_SUMMONS_KEPT);
    // a brand-new familiar joins the grove if there is a free slot
    if (result.newSpecies && this.state.displayed.length < SUMMON.maxActive) {
      this.state.displayed = [...this.state.displayed, { species: species.id, variant }];
      this.emit({ type: 'displayChanged' });
    }
    this.commit();
    this.emit({ type: 'summon', result });
    this.save();
    return result;
  }

  // ---------------------------------------------------------------- active familiars

  owns(species: string, variant: Variant): boolean {
    return (this.state.collection[species]?.[variant] ?? 0) > 0;
  }

  /** Replace the active familiars (validated: owned, one per species, at most maxActive). */
  setDisplayed(list: DisplayedFamiliar[]): void {
    const seen = new Set<string>();
    this.state.displayed = list
      .filter((d) => this.owns(d.species, d.variant) && !seen.has(d.species) && seen.add(d.species))
      .slice(0, SUMMON.maxActive)
      .map((d) => ({ species: d.species, variant: d.variant }));
    this.commit();
    this.emit({ type: 'displayChanged' });
    this.save();
  }

  /** Adds a familiar to the grove (replacing the same species' other form), or removes it. */
  toggleDisplayed(species: string, variant: Variant): void {
    const current = this.state.displayed;
    const active = current.find((d) => d.species === species && d.variant === variant);
    if (active) {
      this.setDisplayed(current.filter((d) => d !== active));
    } else if (current.some((d) => d.species === species)) {
      this.setDisplayed(current.map((d) => (d.species === species ? { species, variant } : d)));
    } else if (current.length < SUMMON.maxActive) {
      this.setDisplayed([...current, { species, variant }]);
    }
  }

  /** Puts a familiar into a specific grove slot, replacing whoever was there. */
  swapDisplayed(index: number, familiar: DisplayedFamiliar): void {
    if (!this.owns(familiar.species, familiar.variant)) return;
    const list = [...this.state.displayed];
    const previous = list.findIndex((d) => d.species === familiar.species);
    const target = { species: familiar.species, variant: familiar.variant };
    if (index < list.length) list[index] = target;
    else list.push(target);
    // the familiar was already active elsewhere: it moves rather than appearing twice
    if (previous !== -1 && previous !== index) list.splice(previous, 1);
    this.setDisplayed(list);
  }

  // ---------------------------------------------------------------- attunement

  /** Attune to one discovered species (null clears it). */
  setAttunement(species: string | null): void {
    if (species !== null && !canAttune(this.state, species)) return;
    this.state.attuned = species;
    this.commit();
    this.emit({ type: 'displayChanged' });
    this.save();
  }

  /** Marks the guided tour as finished (or skipped); `false` replays it. */
  setTutorialDone(done: boolean): void {
    this.state.tutorialDone = done;
    this.commit();
    this.save();
  }

  // ---------------------------------------------------------------- settings & reset

  updateSettings(patch: Partial<Settings>): void {
    // settle production at the old speed before changing it
    this.tick();
    this.state.settings = {
      ...this.state.settings,
      ...patch,
      audio: { ...this.state.settings.audio, ...(patch.audio ?? {}) },
    };
    this.commit();
    this.emit({ type: 'settings', settings: this.state.settings });
    this.save();
  }

  reset(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch { /* storage unavailable */ }
    this.state = createInitialState();
    this.lastLevel = 1;
    this.lastMono = null;
    this.commit();
    this.save();
    this.emit({ type: 'reset' });
  }

  // ---------------------------------------------------------------- persistence

  save(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch { /* storage full or blocked: keep playing */ }
  }

  private load(): GameState {
    let raw: string | null = null;
    try {
      raw = this.storage?.getItem(SAVE_KEY) ?? null;
    } catch { /* storage blocked */ }
    if (!raw) return createInitialState();
    try {
      return migrateSave(JSON.parse(raw));
    } catch {
      return createInitialState();
    }
  }
}
