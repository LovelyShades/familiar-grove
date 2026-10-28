import { Application, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { anchorFromSource, asset, loadTextures, manifest } from './assets';
import type { GroveSceneApi, HostRect } from './sceneApi';
import type { DisplayedFamiliar } from '../game/state';
import type { UpgradeId } from '../game/config';
import { APPEARANCES } from '../game/registry';
import {
  BACKGROUND, FOREGROUND, HEARTWOOD, LOGICAL_HEIGHT, LOGICAL_WIDTH, MIDGROUND, PARALLAX_OVERSCAN,
  BLOSSOM_SPOTS, CONDUIT_VEINS, PARALLAX_SHIFT, PARALLAX_SMOOTHING, PROPS, STREAM, TERRAIN, TREE_HIT,
  type Placement as LayoutPlacement,
} from './layout';
import {
  ParticlePool, createFogTexture, createGlowTexture, createHazeTexture, createPetalTexture, type Particle,
} from './effects';
import { store } from '../app/gameStore';
import { groveLevel } from '../game/economy';
import { FamiliarActor, familiarKey } from './familiars';
import { placeFamiliars, type Placement } from './placement';

/** Draw order, back to front. */
const LAYER_ORDER = [
  'sky', 'mountains', 'ruins', 'farForest', 'haze', 'midground', 'heartwood',
  'terrain', 'familiars', 'foreground', 'overlay',
] as const;
type LayerName = (typeof LAYER_ORDER)[number];

// The scene owns a live PixiJS app created once by React. Hot-swapping scene
// code would leave the old instance running (old visuals until a manual
// refresh), so any change to scene code reloads the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

/**
 * How the grove grows livelier with the grove level (which comes from lifetime
 * Aether). Everything is capped, so it stays elegant at enormous numbers.
 */
const GROWTH = { baseFireflies: 8, firefliesPerLevel: 3, maxFireflies: 48, fullAtLevel: 20 };

const FX_ASSETS = ['fx.heartPulse', 'fx.aetherParticle', 'fx.rareAura', 'fx.summonPortal', 'decor.moonlitBlossoms'];

const TEAL = 0x7ff0e6;
const LAVENDER = 0xcdbcff;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// upgrade flourish particle modes
const SWEEP = 0; // light gliding across the canopy
const PETAL = 1; // lavender petal drifting up
const PATH = 2; // energy travelling along a curve (roots / veins)
const TWINKLE = 3; // star glint fading in and out
const SPARK = 4; // short sparkle rising from a point

interface Firefly {
  sprite: Sprite;
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
  blink: number;
}

type FamiliarHit = { familiar: DisplayedFamiliar; x: number; y: number; pinned: boolean } | null;

export class GroveScene implements GroveSceneApi {
  private app = new Application();
  private world = new Container();
  private fxStage = new Container(); // screen-space effects (click rings, flying motes)
  private layers = {} as Record<LayerName, Container>;
  private textures = new Map<string, Texture>();
  private destroyed = false;
  private ready = false;
  private host: HTMLElement | null = null;
  private hostRect = { left: 0, top: 0, width: 1, height: 1 };
  private lastW = 0;
  private lastH = 0;
  private worldScale = 1;
  private marginX = 0;
  private marginY = 0;
  private time = 0;

  // settings / queued calls
  private reducedMotion = false;
  private parallaxOn = true;
  private pendingFamiliars: DisplayedFamiliar[] | null = null;
  private pendingArrivals = new Set<string>();
  private treeRectListeners: ((rect: HostRect) => void)[] = [];
  private treeRect: HostRect | null = null;
  private counter = { x: 0, y: 0, set: false };

  // heartwood
  private tree: Sprite | null = null;
  private treeScale = 1;
  private squash = 0;
  private heartGlow: Sprite | null = null;
  private heartShimmer: Sprite | null = null;
  private heartRing: Sprite | null = null;
  private heartRingTime = 0;
  private heartRingNext = 2;
  private flare = 0;
  private lanternGlows: { sprite: Sprite; base: number; phase: number }[] = [];
  private crystalGlows: { sprite: Sprite; base: number; phase: number; x: number; y: number; h: number }[] = [];
  private crystalBoost = 0;
  /** Glimmercap Mushrooms lights the glowing mushrooms: a steady glow by level, a flare on purchase. */
  private mushroomGlows: { sprite: Sprite; phase: number; x: number; y: number; h: number }[] = [];
  private mushroomBoost = 0;
  private canopyLevel = 0;

  // particles
  private motes!: ParticlePool; // idle motes drifting up from the heart (world space)
  private moteTimer = 0;
  private rings!: ParticlePool; // click rings (screen space)
  private flyers!: ParticlePool; // aether flying to the counter (screen space)
  private upgradeFx!: ParticlePool; // upgrade flourishes (world space, over the scene)
  private petals!: ParticlePool;
  private starGlints!: ParticlePool; // sky shimmer (sky layer)
  private upgradeCooldown = new Map<UpgradeId, number>();
  private fireflies: Firefly[] = [];
  /** Grove level (from lifetime Aether): the forest grows livelier as the count grows. */
  private groveLevel = 1;
  private fogs: { sprite: Sprite; speed: number; base: number; phase: number }[] = [];

  // familiars
  private actors = new Map<string, FamiliarActor>();
  private placements = new Map<string, Placement>();
  private highlighted: string | null = null;
  private familiarListeners: ((hit: FamiliarHit) => void)[] = [];

  // upgrades made visible in the world
  private blossoms: { holder: Container; glow: Sprite; level: number; x: number; y: number; shown: number; phase: number }[] = [];
  private veinGlows: { sprite: Sprite; phase: number }[] = [];
  private blossomLevel = 0;
  private conduitLevel = 0;
  private conduitPulse = 0;
  private conduitTimer = 4;
  private petalTimer = 3;
  private unsubscribeStore: (() => void) | null = null;

  // parallax: latest pointer position (client px), smoothed offset (-1..1)
  private pointer = { x: 0, y: 0, active: false };
  private para = { x: 0, y: 0 };

  async mount(host: HTMLElement): Promise<void> {
    this.host = host;
    await this.app.init({
      resizeTo: host,
      backgroundColor: 0x070b1c,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.app.stage.addChild(this.fxStage);
    for (const name of LAYER_ORDER) this.layers[name] = this.world.addChild(new Container({ label: name }));

    const familiarAssets = APPEARANCES.map((a) => a.asset).filter((id) => id in manifest.assets);
    const all = [...BACKGROUND, ...MIDGROUND, HEARTWOOD, TERRAIN, STREAM, ...PROPS, ...FOREGROUND].map((p) => p.asset);
    this.textures = await loadTextures([...new Set([...all, ...familiarAssets, ...FX_ASSETS])]);
    if (this.destroyed) return;

    const [sky, mountains, ruins, farForest] = BACKGROUND;
    this.place(this.layers.sky, sky);
    this.place(this.layers.mountains, mountains);
    this.place(this.layers.ruins, ruins);
    this.place(this.layers.farForest, farForest);
    for (const p of MIDGROUND) this.place(this.layers.midground, p);
    this.tree = this.place(this.layers.heartwood, HEARTWOOD);
    this.treeScale = this.tree ? this.tree.scale.y : 1;
    this.place(this.layers.terrain, TERRAIN);
    this.place(this.layers.terrain, STREAM);
    for (const p of PROPS) this.place(this.layers.terrain, p);
    for (const p of FOREGROUND) this.place(this.layers.foreground, p);

    this.buildAtmosphere();
    this.buildHeartwoodFx();
    this.buildWorldUpgrades();
    this.syncUpgradeLevels();
    this.unsubscribeStore = store.subscribe(this.syncUpgradeLevels);
    this.layers.familiars.sortableChildren = true;

    this.ready = true;
    if (this.pendingFamiliars) this.setFamiliars(this.pendingFamiliars);

    // pointer from the whole window: the HUD sits above the canvas
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('blur', this.onPointerLeave);
    window.addEventListener('scroll', this.cacheHostRect, { passive: true });
    this.app.ticker.add((ticker) => this.update(Math.min(ticker.deltaMS / 1000, 0.1)));
    this.fit();
  }

  // ------------------------------------------------------------------ layout

  /** Scale the 1600 x 900 world uniformly to cover the screen, plus a little overscan for parallax. */
  private fit(): void {
    const { width, height } = this.app.screen;
    if (width === this.lastW && height === this.lastH) return;
    this.lastW = width;
    this.lastH = height;
    const s = Math.max(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT) * (1 + PARALLAX_OVERSCAN);
    this.worldScale = s;
    this.world.scale.set(s);
    this.world.position.set((width - LOGICAL_WIDTH * s) / 2, (height - LOGICAL_HEIGHT * s) / 2);
    // how far (in logical px) each edge extends past the screen
    this.marginX = (LOGICAL_WIDTH - width / s) / 2;
    this.marginY = (LOGICAL_HEIGHT - height / s) / 2;
    if (!this.counter.set) {
      this.counter.x = width / 2;
      this.counter.y = 90;
    }
    this.cacheHostRect();
    this.reportTreeRect();
  }

  private cacheHostRect = (): void => {
    if (!this.host) return;
    const r = this.host.getBoundingClientRect();
    this.hostRect = { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) };
  };

  private toHost(lx: number, ly: number): { x: number; y: number } {
    return { x: this.world.x + lx * this.worldScale, y: this.world.y + ly * this.worldScale };
  }

  private reportTreeRect(): void {
    const tl = this.toHost(TREE_HIT.x, TREE_HIT.y);
    this.treeRect = { x: tl.x, y: tl.y, width: TREE_HIT.width * this.worldScale, height: TREE_HIT.height * this.worldScale };
    for (const cb of this.treeRectListeners) cb(this.treeRect);
  }

  private place(layer: Container, p: LayoutPlacement): Sprite | null {
    const base = this.textures.get(p.asset);
    if (!base) return null;
    const record = asset(p.asset);

    let texture = base;
    let cropH = record.crop.height;
    if (p.frame) {
      const [fx, fy, fw, fh] = p.frame;
      const k = record.scale;
      texture = new Texture({
        source: base.source,
        frame: new Rectangle((fx - record.crop.left) * k, (fy - record.crop.top) * k, fw * k, fh * k),
      });
      cropH = fh;
    }

    const sprite = new Sprite(texture);
    sprite.label = p.label ?? p.asset;

    if (Array.isArray(p.anchor)) {
      const a = anchorFromSource(p.asset, p.anchor[0], p.anchor[1]);
      sprite.anchor.set(a.x, a.y);
    } else if (p.anchor) {
      sprite.anchor.set(p.anchor.x, p.anchor.y);
    }

    // logical pixels per original pixel -> sprite scale on the processed texture
    const perSource = p.height !== undefined ? p.height / cropH : (p.scale ?? 1);
    const k = perSource / record.scale;
    sprite.scale.set(p.flipX ? -k : k, k);
    sprite.position.set(p.x, p.y);
    if (p.tint !== undefined) sprite.tint = p.tint;
    if (p.alpha !== undefined) sprite.alpha = p.alpha;
    layer.addChild(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------ build effects

  private glowTex!: Texture;

  private glow(parent: Container, x: number, y: number, size: number, tint: number, alpha: number): Sprite {
    const s = new Sprite(this.glowTex);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.width = s.height = size;
    s.tint = tint;
    s.alpha = alpha;
    s.blendMode = 'add';
    parent.addChild(s);
    return s;
  }

  // ------------------------------------------------------------------ upgrades shown in the world

  /** Moonlit Blossoms flower clusters and Moonveil Elderwood vein glows (hidden until purchased). */
  private buildWorldUpgrades(): void {
    // the Moonlit Blossoms art itself (falls back to the flower bush if it's missing)
    const bush = this.textures.get('decor.moonlitBlossoms') ?? this.textures.get('decor.flowerBush');
    for (const spot of BLOSSOM_SPOTS) {
      const holder = new Container();
      holder.position.set(spot.x, spot.y);
      holder.alpha = 0;
      holder.visible = false;
      if (bush) {
        const s = new Sprite(bush);
        s.anchor.set(0.5, 0.96);
        const k = spot.height / bush.height;
        s.scale.set(spot.flipX ? -k : k, k);
        holder.addChild(s);
      }
      // soft lavender light, used from level 5 on
      const glow = this.glow(holder, 0, -spot.height * 0.45, spot.height * 2.6, 0xc9b8ff, 0);
      this.layers.terrain.addChild(holder);
      this.blossoms.push({ holder, glow, level: spot.level, x: spot.x, y: spot.y - spot.height * 0.6, shown: 0, phase: Math.random() * 6 });
    }
    for (const [x, y] of CONDUIT_VEINS) {
      const g = this.glow(this.layers.heartwood, x, y, 34, 0x3fe8d8, 0);
      g.height = 72; // elongated, lying along the vertical veins
      this.veinGlows.push({ sprite: g, phase: Math.random() * 6 });
    }
  }

  /** Reads purchased upgrade levels from the game state (also correct right after loading a save). */
  private syncUpgradeLevels = (): void => {
    const u = store.getSnapshot().upgrades;
    this.blossomLevel = u.moonlit_blossoms ?? 0;
    this.canopyLevel = u.luminous_canopy ?? 0;
    this.conduitLevel = u.elderwood_conduit ?? 0;
    this.groveLevel = groveLevel(store.getSnapshot());
  };

  private updateWorldUpgrades(dt: number): void {
    const t = this.time;
    // blossoms: each cluster fades in once its level is reached; gentle light from level 5
    // a faint lavender glow from the start, a little richer from level 5
    const light = this.blossomLevel >= 5 ? Math.min(1, 0.55 + this.blossomLevel / 40) : 0.35;
    for (const b of this.blossoms) {
      const target = this.blossomLevel >= b.level ? 1 : 0;
      if (b.shown !== target) {
        b.shown = target > b.shown ? Math.min(1, b.shown + dt / 1.2) : Math.max(0, b.shown - dt / 0.4);
        b.holder.visible = b.shown > 0.001;
      }
      b.holder.alpha = b.shown;
      b.glow.alpha = light * 0.22 * (0.75 + 0.25 * Math.sin(t * 0.8 + b.phase));
    }
    // now and then a petal drifts up from an open cluster (level 10+)
    if (this.blossomLevel >= 10 && !this.reducedMotion) {
      this.petalTimer -= dt;
      if (this.petalTimer <= 0) {
        this.petalTimer = 5 + Math.random() * 5;
        const open = this.blossoms.filter((b) => b.shown > 0.9);
        const from = open[Math.floor(Math.random() * open.length)];
        if (from) this.releasePetal(from.x, from.y, 0);
      }
    }
    // conduit: the Heartwood's own veins glow brighter with each level, never the whole tree
    const level = this.conduitLevel;
    const strength = level > 0 ? Math.min(1, 0.25 + Math.log2(1 + level) * 0.14) : 0;
    this.conduitPulse = Math.max(0, this.conduitPulse - dt * 0.9);
    for (const v of this.veinGlows) {
      v.sprite.alpha = strength * (0.85 + 0.15 * Math.sin(t * 1.4 + v.phase)) + this.conduitPulse * 0.5;
    }
    // occasional energy pulse down through the roots (more often at higher levels)
    if (level > 0 && !this.reducedMotion) {
      this.conduitTimer -= dt;
      if (this.conduitTimer <= 0) {
        this.conduitTimer = Math.max(6, 16 - level * 0.4) + Math.random() * 4;
        this.rootPulse(0.45 + strength * 0.3, 2);
      }
    }
  }

  private releasePetal(x: number, y: number, delay: number): void {
    this.fx(this.petals, PETAL, (p) => {
      p.x0 = x + (Math.random() - 0.5) * 30;
      p.y0 = y;
      p.vx = (Math.random() - 0.5) * 12;
      p.vy = 16 + Math.random() * 12;
      p.life = 2.6 + Math.random() * 1.2;
      p.delay = delay;
      p.sprite.tint = Math.random() < 0.7 ? 0xd9c8ff : 0xbfe9ff;
      p.sprite.scale.set(0.35 + Math.random() * 0.25);
    });
  }

  /** A teal pulse running from the heart down the trunk and out along the roots, both ways. */
  private rootPulse(strength: number, beads: number): void {
    for (const side of [-1, 1]) {
      for (let i = 0; i < beads; i++) {
        this.fx(this.upgradeFx, PATH, (p) => {
          p.x0 = HEARTWOOD.x + side * 20;
          p.y0 = HEARTWOOD.y + 70;
          p.x1 = HEARTWOOD.x + side * 70;
          p.y1 = 600;
          p.x2 = HEARTWOOD.x + side * (130 + Math.random() * 30);
          p.y2 = 636 + Math.random() * 12;
          p.life = 1.3;
          p.delay = i * 0.08;
          p.vx = strength * (1 - i * 0.25);
          p.sprite.tint = TEAL;
          p.sprite.width = p.sprite.height = 30 - i * 6;
        });
      }
    }
  }

  private buildAtmosphere(): void {
    this.glowTex = createGlowTexture();
    const fogTex = createFogTexture();
    const hazeTex = createHazeTexture();

    // depth haze between the far forest and the midground groves
    const haze = new Sprite(hazeTex);
    haze.position.set(-60, 330);
    haze.width = LOGICAL_WIDTH + 120;
    haze.height = 330;
    haze.tint = 0x5d64a8;
    haze.alpha = 0.16;
    this.layers.haze.addChild(haze);

    // slow fog: two bands far back, two low over the clearing (creatures stand in front of them)
    const fogSpec: [Container, number, number, number, number][] = [
      [this.layers.haze, 560, 1000, 7, 0.09],
      [this.layers.haze, 640, 820, -5, 0.07],
      [this.layers.terrain, 720, 900, 4, 0.06],
      [this.layers.terrain, 805, 760, -6, 0.05],
    ];
    for (const [layer, y, w, speed, alpha] of fogSpec) {
      const f = new Sprite(fogTex);
      f.anchor.set(0.5);
      f.width = w;
      f.height = w * 0.17;
      f.position.set(Math.random() * LOGICAL_WIDTH, y);
      f.tint = 0xaab3e6;
      f.alpha = alpha;
      layer.addChild(f);
      this.fogs.push({ sprite: f, speed, base: alpha, phase: Math.random() * 6 });
    }

    // fireflies and spores: more appear as the grove level rises (capped, see updateFireflies)
    for (let i = 0; i < GROWTH.maxFireflies; i++) {
      const s = this.glow(this.layers.overlay, 0, 0, 6 + Math.random() * 6, i % 3 ? 0xbffff0 : LAVENDER, 0);
      this.fireflies.push({
        sprite: s,
        hx: 60 + Math.random() * 1060,
        hy: 300 + Math.random() * 520,
        rx: 20 + Math.random() * 50,
        ry: 10 + Math.random() * 30,
        speed: 0.08 + Math.random() * 0.15,
        phase: Math.random() * 100,
        blink: 2.5 + Math.random() * 4,
      });
    }

    // lantern and crystal glows
    for (const p of PROPS) {
      const h = p.height ?? 100;
      if (p.asset === 'decor.lantern') {
        const g = this.glow(this.layers.terrain, p.x, p.y + h * 0.6, h * 1.4, 0x8ff4ff, 0.35);
        this.lanternGlows.push({ sprite: g, base: 0.32, phase: Math.random() * 10 });
      } else if (p.asset === 'decor.crystals') {
        const g = this.glow(this.layers.terrain, p.x, p.y - h * 0.45, h * 2.4, 0x86d8ff, 0.16);
        this.crystalGlows.push({ sprite: g, base: 0.16, phase: Math.random() * 10, x: p.x, y: p.y, h });
      } else if (p.asset === 'decor.mushrooms') {
        // glow around the mushroom caps (the caps sit in the upper part of the sprite)
        const g = this.glow(this.layers.terrain, p.x, p.y - h * 0.7, h * 2.2, 0x7fe8ff, 0);
        this.mushroomGlows.push({ sprite: g, phase: Math.random() * 10, x: p.x, y: p.y, h });
      }
    }

    // pools
    const mote = this.textures.get('fx.aetherParticle') ?? this.glowTex;
    const ring = this.textures.get('fx.heartPulse') ?? this.glowTex;
    this.motes = new ParticlePool(this.layers.overlay, mote, 26);
    this.rings = new ParticlePool(this.fxStage, ring, 10);
    this.flyers = new ParticlePool(this.fxStage, mote, 60);
    this.upgradeFx = new ParticlePool(this.layers.overlay, this.glowTex, 40);
    this.petals = new ParticlePool(this.layers.overlay, createPetalTexture(), 16, 'normal');
    this.starGlints = new ParticlePool(this.layers.sky, mote, 16);
  }

  private buildHeartwoodFx(): void {
    const L = this.layers.heartwood;
    const { x, y } = HEARTWOOD;
    this.heartShimmer = this.glow(L, x, y + 10, 420, 0x4fd8d0, 0.1);
    this.heartGlow = this.glow(L, x, y, 190, TEAL, 0.4);
    const ringTex = this.textures.get('fx.heartPulse');
    if (ringTex) {
      this.heartRing = new Sprite(ringTex);
      this.heartRing.anchor.set(0.5);
      this.heartRing.position.set(x, y);
      this.heartRing.blendMode = 'add';
      this.heartRing.alpha = 0;
      L.addChild(this.heartRing);
    }
  }

  // ------------------------------------------------------------------ frame update

  private update(dt: number): void {
    this.fit();
    this.time += dt;
    const t = this.time;
    const rm = this.reducedMotion;

    this.updateParallax(dt);

    // heartwood: slow breathing glow, flare on click, gentle squash
    this.flare = Math.max(0, this.flare - dt * 2.4);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.25);
    if (this.heartGlow) {
      // Moonveil Elderwood deepens the heart's own glow a little with each level
      const conduit = this.conduitLevel > 0 ? Math.min(0.14, 0.04 + Math.log2(1 + this.conduitLevel) * 0.025) : 0;
      // the heart also grows brighter and larger with the grove level (capped)
      const growth = Math.min(1, (this.groveLevel - 1) / GROWTH.fullAtLevel);
      this.heartGlow.alpha = 0.32 + 0.1 * growth + conduit + 0.14 * pulse + 0.45 * Math.min(1.2, this.flare);
      const size = 180 + 46 * growth + 22 * pulse + 70 * Math.min(1.4, this.flare);
      this.heartGlow.width = this.heartGlow.height = size;
    }
    if (this.heartShimmer) this.heartShimmer.alpha = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.45)) + 0.08 * Math.min(1.2, this.flare);
    if (this.tree) {
      this.squash = Math.max(0, this.squash - dt / 0.15);
      const q = Math.sin(this.squash * Math.PI) * 0.012;
      const sx = this.tree.scale.x < 0 ? -1 : 1;
      this.tree.scale.set(sx * this.treeScale * (1 + q), this.treeScale * (1 - q));
    }
    this.updateHeartRing(dt);

    for (const g of this.lanternGlows) {
      g.sprite.alpha = g.base + 0.06 * Math.sin(t * 2.3 + g.phase) + 0.03 * Math.sin(t * 7.1 + g.phase * 2);
    }
    this.crystalBoost = Math.max(0, this.crystalBoost - dt * 0.8);
    // Moonveil Elderwood also nudges nearby crystal light up a little
    const crystalLift = this.conduitLevel > 0 ? Math.min(0.08, 0.02 + this.conduitLevel * 0.002) : 0;
    for (const g of this.crystalGlows) g.sprite.alpha = g.base * (0.75 + 0.25 * Math.sin(t * 0.9 + g.phase)) + crystalLift + 0.3 * this.crystalBoost;
    // Glimmercap Mushrooms: the mushrooms glow brighter with its level and flare when it is bought
    this.mushroomBoost = Math.max(0, this.mushroomBoost - dt * 0.7);
    const mushroomBase = this.canopyLevel > 0 ? Math.min(0.32, 0.08 + this.canopyLevel * 0.006) : 0.04;
    for (const g of this.mushroomGlows) {
      g.sprite.alpha = mushroomBase * (0.8 + 0.2 * Math.sin(t * 1.1 + g.phase)) + 0.45 * this.mushroomBoost;
    }

    for (const f of this.fogs) {
      f.sprite.x += f.speed * dt * (rm ? 0.3 : 1);
      const half = f.sprite.width / 2;
      if (f.sprite.x - half > LOGICAL_WIDTH + 40) f.sprite.x = -half - 40;
      if (f.sprite.x + half < -40) f.sprite.x = LOGICAL_WIDTH + half + 40;
      f.sprite.alpha = f.base * (0.8 + 0.2 * Math.sin(t * 0.2 + f.phase));
    }

    const fireflyCount = Math.min(GROWTH.maxFireflies, GROWTH.baseFireflies + (this.groveLevel - 1) * GROWTH.firefliesPerLevel);
    for (let i = 0; i < this.fireflies.length; i++) {
      const f = this.fireflies[i];
      f.sprite.visible = i < fireflyCount;
      if (!f.sprite.visible) continue;
      const a = t * f.speed + f.phase;
      f.sprite.position.set(f.hx + Math.sin(a) * f.rx + Math.sin(a * 2.7) * 6, f.hy + Math.cos(a * 1.3) * f.ry);
      const blink = Math.max(0, Math.sin((t + f.phase) * (Math.PI * 2 / f.blink)));
      f.sprite.alpha = blink * blink * 0.75;
    }

    this.updateMotes(dt);
    this.updateRings(dt);
    this.updateFlyers(dt);
    this.updateUpgradeFx(dt);
    this.updateWorldUpgrades(dt);

    for (const actor of this.actors.values()) actor.update(dt, rm);
  }

  /**
   * Parallax: frame-rate independent exponential smoothing toward the latest
   * pointer position (time constant PARALLAX_SMOOTHING), small per-layer shifts,
   * clamped to the overscan margin so no edge is ever exposed.
   */
  private updateParallax(dt: number): void {
    let tx = 0;
    let ty = 0;
    if (this.parallaxOn && !this.reducedMotion && this.pointer.active) {
      const r = this.hostRect;
      tx = Math.max(-1, Math.min(1, ((this.pointer.x - r.left) / r.width) * 2 - 1));
      ty = Math.max(-1, Math.min(1, ((this.pointer.y - r.top) / r.height) * 2 - 1));
    }
    const k = 1 - Math.exp(-dt / PARALLAX_SMOOTHING);
    this.para.x += (tx - this.para.x) * k;
    this.para.y += (ty - this.para.y) * k;
    if (Math.abs(this.para.x) < 1e-4) this.para.x = 0;
    if (Math.abs(this.para.y) < 1e-4) this.para.y = 0;
    const mx = Math.max(0, this.marginX - 0.5);
    const my = Math.max(0, this.marginY - 0.5);
    for (const name of LAYER_ORDER) {
      const shift = PARALLAX_SHIFT[name] ?? { x: 0, y: 0 };
      this.layers[name].position.set(-this.para.x * Math.min(shift.x, mx), -this.para.y * Math.min(shift.y, my));
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.active = true;
  };

  private onPointerLeave = (): void => {
    this.pointer.active = false;
  };

  private updateHeartRing(dt: number): void {
    if (!this.heartRing) return;
    this.heartRingNext -= dt;
    if (this.heartRingNext <= 0 && this.heartRingTime <= 0) {
      this.heartRingTime = 0.0001;
      this.heartRingNext = 4 + Math.random() * 2.5;
    }
    if (this.heartRingTime > 0) {
      this.heartRingTime += dt;
      const k = this.heartRingTime / 2.4;
      if (k >= 1) {
        this.heartRingTime = 0;
        this.heartRing.alpha = 0;
        return;
      }
      const size = 120 + 200 * Math.sqrt(k);
      this.heartRing.scale.set(size / this.heartRing.texture.height);
      this.heartRing.alpha = 0.22 * Math.sin(k * Math.PI);
    }
  }

  private updateMotes(dt: number): void {
    this.moteTimer -= dt;
    const growth = Math.min(1, (this.groveLevel - 1) / GROWTH.fullAtLevel);
    const cap = this.reducedMotion ? 6 : Math.round(10 + 12 * growth);
    if (this.moteTimer <= 0 && this.motes.activeCount() < cap) {
      this.moteTimer = (0.32 + Math.random() * 0.4) * (1 - 0.45 * growth);
      const p = this.motes.spawn();
      if (p) {
        p.x0 = HEARTWOOD.x + (Math.random() - 0.5) * 260;
        p.y0 = HEARTWOOD.y + 40 + (Math.random() - 0.3) * 260;
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -(10 + Math.random() * 14);
        p.life = 3 + Math.random() * 3;
        p.size = 7 + Math.random() * 7;
        p.sprite.tint = Math.random() < 0.65 ? 0xa8fff6 : LAVENDER;
        p.sprite.scale.set(p.size / p.sprite.texture.height);
        p.sprite.visible = true;
      }
    }
    for (const p of this.motes.items) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        this.motes.kill(p);
        continue;
      }
      p.sprite.position.set(p.x0 + p.vx * p.t + Math.sin(p.t * 1.3 + p.seed) * 8, p.y0 + p.vy * p.t);
      p.sprite.alpha = Math.sin(k * Math.PI) * 0.7;
    }
  }

  private updateRings(dt: number): void {
    for (const p of this.rings.items) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        this.rings.kill(p);
        continue;
      }
      const size = p.size * (0.25 + 0.75 * (1 - Math.pow(1 - k, 3)));
      p.sprite.scale.set(size / p.sprite.texture.height);
      p.sprite.alpha = 0.85 * Math.pow(1 - k, 1.5) * p.vx;
    }
  }

  private updateFlyers(dt: number): void {
    for (const p of this.flyers.items) {
      if (!p.active) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.sprite.visible = true;
      p.t += dt;
      const k = Math.min(1, p.t / p.life);
      const e = easeInOut(k);
      const u = 1 - e;
      // quadratic curve: start -> control -> counter
      const x = u * u * p.x0 + 2 * u * e * p.x1 + e * e * p.x2;
      const y = u * u * p.y0 + 2 * u * e * p.y1 + e * e * p.y2;
      p.sprite.position.set(x, y);
      p.sprite.scale.set((p.size * (1 - 0.5 * e)) / p.sprite.texture.height);
      p.sprite.alpha = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 8);
      if (k >= 1) this.flyers.kill(p);
    }
  }

  // ------------------------------------------------------------------ upgrade flourishes

  private spawnRing(hostX: number, hostY: number, size: number, strength: number, life = 0.55): void {
    const ring = this.rings.spawn();
    if (!ring) return;
    ring.life = life;
    ring.size = size;
    ring.vx = strength; // alpha multiplier
    ring.sprite.position.set(hostX, hostY);
    ring.sprite.tint = 0xffffff;
    ring.sprite.scale.set(0.01);
    ring.sprite.visible = true;
  }

  /** Configure a pooled upgrade particle. */
  private fx(pool: ParticlePool, mode: number, init: (p: Particle) => void): void {
    const p = pool.spawn();
    if (!p) return;
    p.mode = mode;
    p.vx = p.vy = 0;
    init(p);
    p.sprite.alpha = 0;
    p.sprite.visible = false;
  }

  private updateUpgradeFx(dt: number): void {
    for (const pool of [this.upgradeFx, this.petals, this.starGlints]) {
      for (const p of pool.items) {
        if (!p.active) continue;
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        p.sprite.visible = true;
        p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) {
          pool.kill(p);
          continue;
        }
        const fade = Math.sin(k * Math.PI);
        switch (p.mode) {
          case SWEEP: {
            const e = easeInOut(k);
            p.sprite.position.set(p.x0 + (p.x2 - p.x0) * e, p.y0 + (p.y2 - p.y0) * e + Math.sin(k * Math.PI * 2 + p.seed) * 6);
            p.sprite.alpha = fade * p.vx;
            break;
          }
          case PETAL: {
            p.sprite.position.set(p.x0 + Math.sin(p.t * 1.6 + p.seed) * 14 + p.vx * p.t, p.y0 - p.vy * p.t);
            p.sprite.rotation = Math.sin(p.t * 2 + p.seed) * 0.6;
            p.sprite.alpha = fade * 0.85;
            break;
          }
          case PATH: {
            const e = easeInOut(k);
            const u = 1 - e;
            p.sprite.position.set(u * u * p.x0 + 2 * u * e * p.x1 + e * e * p.x2, u * u * p.y0 + 2 * u * e * p.y1 + e * e * p.y2);
            p.sprite.alpha = fade * p.vx;
            break;
          }
          case TWINKLE:
            p.sprite.alpha = Math.pow(fade, 2) * p.vx;
            break;
          case SPARK:
            p.sprite.position.set(p.x0, p.y0 - p.vy * p.t);
            p.sprite.alpha = fade * p.vx;
            break;
        }
      }
    }
  }

  playUpgradeEffect(id: UpgradeId, info: { levelsBought: number; newLevel: number; milestone: boolean }): void {
    if (!this.ready) return;
    // coalesce rapid purchases (Buy Max spam): at most one flourish per upgrade every 0.6s
    const last = this.upgradeCooldown.get(id) ?? -10;
    if (this.time - last < 0.6) return;
    this.upgradeCooldown.set(id, this.time);
    const strong = info.milestone ? 1.6 : 1;
    const rm = this.reducedMotion;
    const heart = this.toHost(HEARTWOOD.x, HEARTWOOD.y);

    switch (id) {
      case 'arcane_touch':
        this.flare = Math.max(this.flare, 0.9 * strong);
        this.spawnRing(heart.x, heart.y, 300 * this.worldScale * strong, 1);
        break;
      case 'crystal_springs':
        this.crystalBoost = Math.min(1.4, 0.8 * strong);
        if (!rm) {
          for (const g of this.crystalGlows) {
            for (let i = 0; i < Math.round(3 * strong); i++) {
              this.fx(this.upgradeFx, SPARK, (p) => {
                p.x0 = g.x + (Math.random() - 0.5) * g.h * 0.8;
                p.y0 = g.y - Math.random() * g.h;
                p.vy = 18 + Math.random() * 14;
                p.life = 0.9 + Math.random() * 0.5;
                p.delay = i * 0.12;
                p.vx = 0.8;
                p.sprite.tint = 0xb8f2ff;
                p.sprite.width = p.sprite.height = 14;
              });
            }
          }
        }
        break;
      case 'luminous_canopy': {
        // the glowing mushrooms (its icon) answer: their caps flare and release spores
        this.canopyLevel = Math.max(this.canopyLevel, info.newLevel);
        this.mushroomBoost = Math.min(1.4, 0.9 * strong);
        const spores = Math.round((rm ? 2 : 6) * strong);
        for (const g of this.mushroomGlows) {
          for (let i = 0; i < spores; i++) {
            this.fx(this.upgradeFx, SPARK, (p) => {
              p.x0 = g.x + (Math.random() - 0.5) * g.h * 0.9;
              p.y0 = g.y - g.h * (0.55 + Math.random() * 0.3);
              p.vy = 20 + Math.random() * 22;
              p.life = 1.3 + Math.random() * 0.9;
              p.delay = i * 0.09;
              p.vx = 0.6;
              p.sprite.tint = i % 3 === 0 ? 0xd9c6ff : 0x9ff6ff;
              p.sprite.width = p.sprite.height = 9 + Math.random() * 7;
            });
          }
        }
        break;
      }
      case 'whispering_roots':
        // a short magical pulse along the Heartwood's existing roots
        this.rootPulse(0.7 * strong, Math.round(3 * strong));
        break;
      case 'moonlit_blossoms': {
        // the blossom clusters themselves appear via the upgrade level; on purchase,
        // the open clusters release a few petals so the link is clear
        this.blossomLevel = Math.max(this.blossomLevel, info.newLevel);
        if (rm) break;
        const open = this.blossoms.filter((b) => this.blossomLevel >= b.level);
        open.forEach((b, i) => {
          for (let k = 0; k < Math.round(2 * strong); k++) this.releasePetal(b.x, b.y, 0.4 + i * 0.1 + k * 0.15);
        });
        break;
      }
      case 'elderwood_conduit':
        // the Heartwood's own veins brighten and a pulse runs down to the roots
        this.conduitLevel = Math.max(this.conduitLevel, info.newLevel);
        this.conduitPulse = Math.min(1.2, 0.8 * strong);
        this.flare = Math.max(this.flare, 0.6 * strong);
        if (!rm) this.rootPulse(0.8, Math.round(3 * strong));
        break;
      case 'astral_resonance': {
        for (let i = 0; i < Math.round(9 * strong); i++) {
          this.fx(this.starGlints, TWINKLE, (p) => {
            p.sprite.position.set(80 + Math.random() * 1040, 30 + Math.random() * 260);
            p.life = 1.2 + Math.random() * 1;
            p.delay = Math.random() * 0.8;
            p.vx = 0.9;
            p.sprite.tint = i % 2 ? 0xe8eaff : 0xbff4ff;
            p.sprite.width = p.sprite.height = 10 + Math.random() * 10;
          });
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------------ GroveSceneApi

  setFamiliars(list: DisplayedFamiliar[]): void {
    if (!this.ready) {
      this.pendingFamiliars = list;
      return;
    }
    this.pendingFamiliars = null;
    const placed = placeFamiliars(list, this.placements);
    this.placements = new Map(placed.map((p) => [p.key, p]));

    const keep = new Set<string>();
    for (const place of placed) {
      const key = place.key;
      keep.add(key);
      const existing = this.actors.get(key);
      if (existing && existing.positionId === `${place.zoneId}:${place.x},${place.y}`) continue;
      existing?.destroy();
      const texture = this.textures.get(APPEARANCES.find((a) => a.species === place.familiar.species && a.variant === place.familiar.variant)?.asset ?? '');
      if (!texture) {
        this.actors.delete(key);
        continue;
      }
      const actor = new FamiliarActor(place.familiar, place, texture, {
        aura: this.textures.get('fx.rareAura'),
        sparkle: this.textures.get('fx.aetherParticle'),
        portal: this.textures.get('fx.summonPortal'),
        glow: this.glowTex,
      });
      actor.root.zIndex = place.y;
      this.wireActorPointer(actor);
      if (this.highlighted === place.familiar.species) actor.setHighlight(true);
      this.actors.set(key, actor);
      this.layers.familiars.addChild(actor.root);
      if (this.pendingArrivals.delete(key)) actor.startArrival();
    }
    for (const [key, actor] of this.actors) {
      if (!keep.has(key)) {
        actor.destroy();
        this.actors.delete(key);
      }
    }
  }

  private wireActorPointer(actor: FamiliarActor): void {
    const report = (pinned: boolean) => {
      const head = actor.root.toGlobal(actor.headOffset);
      const hit = { familiar: actor.familiar, x: head.x, y: head.y, pinned };
      for (const cb of this.familiarListeners) cb(hit);
    };
    actor.root.on('pointerover', () => report(false));
    actor.root.on('pointerout', () => {
      for (const cb of this.familiarListeners) cb(null);
    });
    actor.root.on('pointertap', () => report(true));
  }

  onFamiliarPointer(cb: (hit: FamiliarHit) => void): void {
    this.familiarListeners.push(cb);
  }

  highlightFamiliar(species: string | null): void {
    this.highlighted = species;
    for (const a of this.actors.values()) a.setHighlight(species !== null && a.familiar.species === species);
  }

  onTreeRect(cb: (rect: HostRect) => void): void {
    this.treeRectListeners.push(cb);
    if (this.treeRect) cb(this.treeRect);
  }

  clickFeedback(x: number, y: number, amount: number): void {
    if (!this.ready) return;
    this.flare = Math.max(this.flare, 1);
    this.squash = 1;
    this.spawnRing(x, y, 240 * this.worldScale, 1);

    if (this.reducedMotion) return;
    const count = Math.min(5, 2 + Math.floor(Math.log10(Math.max(1, amount)) / 1.5));
    for (let i = 0; i < count; i++) {
      const p: Particle | null = this.flyers.spawn();
      if (!p) break;
      const side = (Math.random() - 0.5) * 2;
      p.x0 = x + (Math.random() - 0.5) * 30;
      p.y0 = y + (Math.random() - 0.5) * 30;
      p.x2 = this.counter.x + (Math.random() - 0.5) * 10;
      p.y2 = this.counter.y + (Math.random() - 0.5) * 6;
      p.x1 = (p.x0 + p.x2) / 2 + side * 140;
      p.y1 = Math.min(p.y0, p.y2) - 60 - Math.random() * 80;
      p.life = 0.6 + Math.random() * 0.3;
      p.delay = i * 0.04;
      p.size = (16 + Math.random() * 8) * Math.max(0.6, this.worldScale);
      p.sprite.tint = i % 2 ? LAVENDER : 0xa8fff6;
      p.sprite.alpha = 0;
    }
  }

  setCounterTarget(x: number, y: number): void {
    this.counter = { x, y, set: true };
  }

  /**
   * Environment lighting is independent of the UI theme: the forest always shows
   * its original artwork. Reserved for future dedicated environment-lighting layers.
   */
  setTheme(_theme: 'dark' | 'light'): void {}

  setParallax(on: boolean): void {
    this.parallaxOn = on;
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    if (on && this.ready) this.flyers.clear();
  }

  celebrateArrival(familiar: DisplayedFamiliar): void {
    const key = familiarKey(familiar);
    const actor = this.actors.get(key);
    if (actor) actor.startArrival();
    else this.pendingArrivals.add(key);
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribeStore?.();
    window.removeEventListener('pointermove', this.onPointerMove);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('blur', this.onPointerLeave);
    window.removeEventListener('scroll', this.cacheHostRect);
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
    if (this.app.renderer) this.app.destroy(true, { children: true });
  }
}
