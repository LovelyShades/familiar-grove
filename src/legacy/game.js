import {
  SAVE_KEY, OFFLINE_CAP_SEC, FAMILIAR_COST_GROWTH, SPEEDS,
  SPELL, FAMILIARS, RARITIES, GROVE_UPGRADES, levelThreshold,
} from './data.js';

export function freshState() {
  return {
    version: 1,
    aether: 0,
    totalEarned: 0,
    totalClicks: 0,
    spellLevel: 0,
    upgrades: Object.fromEntries(GROVE_UPGRADES.map((u) => [u.id, 0])),
    familiars: Object.fromEntries(FAMILIARS.map((f) => [f.id, { owned: 0, rarities: RARITIES.map(() => 0) }])),
    gameMinutes: 18 * 60,
    playSeconds: 0,
    settings: { theme: 'dark', timeSpeed: 1 },
    lastSaved: Date.now(),
  };
}

// Copy only known, valid fields so an old or corrupted save can never break the game.
function mergeSave(saved) {
  const s = freshState();
  for (const k of ['aether', 'totalEarned', 'totalClicks', 'spellLevel', 'gameMinutes', 'playSeconds', 'lastSaved']) {
    if (Number.isFinite(saved[k])) s[k] = saved[k];
  }
  for (const u of GROVE_UPGRADES) {
    if (Number.isFinite(saved.upgrades?.[u.id])) s.upgrades[u.id] = saved.upgrades[u.id];
  }
  for (const f of FAMILIARS) {
    const sf = saved.familiars?.[f.id];
    if (sf && Array.isArray(sf.rarities)) {
      const r = RARITIES.map((_, i) => Math.max(0, Number(sf.rarities[i]) || 0));
      s.familiars[f.id] = { rarities: r, owned: r.reduce((a, b) => a + b, 0) };
    }
  }
  if (['dark', 'light'].includes(saved.settings?.theme)) s.settings.theme = saved.settings.theme;
  if (SPEEDS.includes(saved.settings?.timeSpeed)) s.settings.timeSpeed = saved.settings.timeSpeed;
  return s;
}

export class Game {
  constructor() {
    this.state = freshState();
    this.handlers = {};
    this.lastLevel = 1;
  }

  on(event, fn) {
    (this.handlers[event] ||= []).push(fn);
  }

  emit(event, ...args) {
    for (const fn of this.handlers[event] || []) fn(...args);
  }

  // ---------- saving ----------

  /** Loads the save and returns offline earnings info (or null). */
  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch { /* storage blocked */ }
    if (!raw) return null;
    try {
      this.state = mergeSave(JSON.parse(raw));
    } catch {
      return null;
    }
    this.lastLevel = this.level;
    const away = Math.min((Date.now() - this.state.lastSaved) / 1000, OFFLINE_CAP_SEC);
    if (away > 10 && this.perSecond() > 0) {
      const gain = this.perSecond() * away;
      this.earn(gain);
      this.lastLevel = this.level;
      return { seconds: away, gain };
    }
    return null;
  }

  save() {
    this.state.lastSaved = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch { /* storage full or blocked */ }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch { /* ignore */ }
    this.state = freshState();
    this.lastLevel = 1;
    this.save();
    this.emit('reset');
  }

  // ---------- derived numbers ----------

  get level() {
    const t = this.state.totalEarned;
    if (t < levelThreshold(2)) return 1;
    let n = Math.floor(Math.log(t / 50) / Math.log(3.2)) + 2;
    while (t < levelThreshold(n)) n--;
    while (t >= levelThreshold(n + 1)) n++;
    return n;
  }

  levelProgress() {
    const n = this.level;
    const lo = levelThreshold(n);
    const hi = levelThreshold(n + 1);
    return { level: n, current: this.state.totalEarned - lo, needed: hi - lo };
  }

  familiarPower(id) {
    return this.state.familiars[id].rarities.reduce((sum, count, i) => sum + count * RARITIES[i].mult, 0);
  }

  passiveMultiplier() {
    return Math.pow(1.2, this.state.upgrades.luminous_canopy);
  }

  /** Aether per second for one familiar type at normal (1x) time. */
  familiarRate(id) {
    const def = FAMILIARS.find((f) => f.id === id);
    return def.baseRate * this.familiarPower(id) * this.passiveMultiplier();
  }

  basePerSecond() {
    return FAMILIARS.reduce((sum, f) => sum + this.familiarRate(f.id), 0);
  }

  /** Actual income per second, including the time-speed setting. */
  perSecond() {
    return this.basePerSecond() * this.state.settings.timeSpeed;
  }

  clickPower() {
    const lvl = this.state.spellLevel;
    const base = (1 + lvl) * Math.pow(2, Math.floor(lvl / 10));
    const springs = Math.pow(1.5, this.state.upgrades.crystal_springs);
    const attune = this.basePerSecond() * 0.02 * this.state.upgrades.star_attunement;
    return base * springs + attune;
  }

  spellCost() {
    return Math.ceil(SPELL.baseCost * Math.pow(SPELL.growth, this.state.spellLevel));
  }

  familiarCost(id) {
    const def = FAMILIARS.find((f) => f.id === id);
    return Math.ceil(def.baseCost * Math.pow(FAMILIAR_COST_GROWTH, this.state.familiars[id].owned));
  }

  upgradeCost(id) {
    const def = GROVE_UPGRADES.find((u) => u.id === id);
    return Math.ceil(def.baseCost * Math.pow(def.growth, this.state.upgrades[id]));
  }

  upgradeMaxed(id) {
    const def = GROVE_UPGRADES.find((u) => u.id === id);
    return def.max !== undefined && this.state.upgrades[id] >= def.max;
  }

  canAfford(cost) {
    return this.state.aether >= cost;
  }

  // ---------- actions ----------

  earn(amount) {
    this.state.aether += amount;
    this.state.totalEarned += amount;
    const lvl = this.level;
    if (lvl > this.lastLevel) {
      const prev = this.lastLevel;
      this.lastLevel = lvl;
      this.emit('levelup', lvl, prev);
    }
  }

  click() {
    const value = this.clickPower();
    this.state.totalClicks++;
    this.earn(value);
    return value;
  }

  buySpell() {
    const cost = this.spellCost();
    if (!this.canAfford(cost)) return false;
    this.state.aether -= cost;
    this.state.spellLevel++;
    return true;
  }

  rollRarity() {
    const luck = 1 + 0.3 * this.state.upgrades.familiar_haven;
    const weights = RARITIES.map((r, i) => (i === 0 ? r.weight : r.weight * luck));
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return i;
    }
    return 0;
  }

  /** Returns { rarity, first } or null if it can't be afforded. */
  buyFamiliar(id) {
    const cost = this.familiarCost(id);
    if (!this.canAfford(cost)) return null;
    this.state.aether -= cost;
    const f = this.state.familiars[id];
    const first = f.owned === 0;
    const rarity = this.rollRarity();
    f.rarities[rarity]++;
    f.owned++;
    return { rarity, first };
  }

  buyUpgrade(id) {
    const cost = this.upgradeCost(id);
    if (this.upgradeMaxed(id) || !this.canAfford(cost)) return false;
    this.state.aether -= cost;
    this.state.upgrades[id]++;
    return true;
  }

  tick(dt) {
    const speed = this.state.settings.timeSpeed;
    this.state.playSeconds += dt;
    this.state.gameMinutes += dt * speed;
    const gain = this.perSecond() * dt;
    if (gain > 0) this.earn(gain);
  }
}

// ---------- number formatting ----------

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];

function short(n) {
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace('e+', 'e');
  let v = n / Math.pow(10, tier * 3);
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  v = Math.floor(v * Math.pow(10, digits)) / Math.pow(10, digits);
  return v.toFixed(digits) + SUFFIXES[tier];
}

/** Whole amounts like the main Aether count and prices. */
export function fmt(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  return short(n);
}

/** Rates, which can be fractional (0.5 / sec). */
export function fmtRate(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n === 0) return '0';
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  return short(n);
}

export function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(sec)}s`;
}
