// Familiars living in the grove: slot assignment and gentle procedural idle motion.
// All motion is transform-based and small, so the pixel art is never distorted.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { asset } from './assets';
import { APPEARANCE_TINT, FEET } from './layout';
import { familiarKey, type Placement } from './placement';
import { SPECIES_BY_ID, appearanceOf, type IdleStyle } from '../game/registry';
import type { DisplayedFamiliar } from '../game/state';

export { familiarKey };

export interface FamiliarFx {
  aura: Texture | undefined;
  sparkle: Texture | undefined;
  portal: Texture | undefined;
  /** Soft round glow (white), used for shadows, rim light and highlight. */
  glow: Texture;
}

/** Contact shadow colour: dark blue-green, never pure black. */
const SHADOW_TINT = 0x0a1a20;
/** Faint cool ambient light from the Heartwood and crystals. */
const RIM_TINT = 0x86d8e6;
/**
 * Shape-following glow: rare mutations glow soft white; Epic/Legendary species
 * glow faintly in their tier colour. [tint, base alpha, pulse amount]
 */
const MUTATION_GLOW: [number, number, number] = [0xffffff, 0.3, 0.1];
const TIER_GLOW: Partial<Record<string, [number, number, number]>> = {
  epic: [0xcbb4ff, 0.16, 0.06],
  legendary: [0xf2ecff, 0.2, 0.07],
};
/** The glow is this much larger than the creature, centred on its body. */
const GLOW_ENLARGE = 1.05;

const glowCache = new Map<number, { texture: Texture; pad: number }>();

/**
 * A soft white silhouette of a sprite (same shape, blurred edges), baked once
 * per texture on a canvas, so a familiar can glow along its own outline.
 */
export function silhouetteGlow(texture: Texture): { texture: Texture; pad: number } | null {
  const cached = glowCache.get(texture.uid);
  if (cached) return cached;
  const src = texture.source.resource as CanvasImageSource | undefined;
  if (!src || typeof document === 'undefined') return null;
  const { x, y, width: w, height: h } = texture.frame;
  const pad = Math.ceil(Math.max(w, h) * 0.06);
  const shape = document.createElement('canvas');
  shape.width = w;
  shape.height = h;
  const sc = shape.getContext('2d');
  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const oc = out.getContext('2d');
  if (!sc || !oc) return null;
  sc.drawImage(src, x, y, w, h, 0, 0, w, h);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = '#ffffff';
  sc.fillRect(0, 0, w, h);
  oc.filter = `blur(${Math.round(pad * 0.45)}px)`;
  oc.drawImage(shape, pad, pad);
  const result = { texture: Texture.from(out), pad };
  glowCache.set(texture.uid, result);
  return result;
}

const TAU = Math.PI * 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Seconds per idle cycle at tempo 1. */
const PERIOD: Record<IdleStyle, number> = {
  breathe: 3.6,
  sway: 5.2,
  perch: 3.2,
  hover: 4.2,
  swim: 9,
  flutter: 2.6,
  creep: 18,
};

export class FamiliarActor {
  readonly key: string;
  readonly familiar: DisplayedFamiliar;
  /** Where this actor stands; a different position means a new actor. */
  readonly positionId: string;
  readonly root = new Container();
  private body = new Container();
  private sprite: Sprite;
  private shine: Sprite;
  private rim: Sprite;
  private shadow?: Sprite;
  private shadowCore?: Sprite;
  private shadowBase = { w: 0, h: 0 };
  /** Soft glow that follows the creature's own silhouette (rare/special familiars). */
  private shapeGlow?: Sprite;
  private glowStyle: [number, number, number] | null = null;
  private highlight = 0;
  private highlightTarget = 0;
  /** Point just above the creature's head, in root coordinates. */
  readonly headOffset: { x: number; y: number };
  private portal?: Sprite;
  private sparkles: { sprite: Sprite; t: number; life: number; x: number; y: number }[] = [];
  private sparkleTimer = 1 + Math.random() * 2;
  private style: IdleStyle;
  private omega: number;
  private phase = Math.random() * TAU;
  private time = 0;
  private height: number;
  private centerY: number;
  private width: number;
  private lean = 0;
  private leanTarget = 0;
  private leanTimer = 2 + Math.random() * 4;
  private arrival = -1;
  private portalTime = -1;

  constructor(familiar: DisplayedFamiliar, place: Placement, texture: Texture, fx: FamiliarFx) {
    const def = SPECIES_BY_ID[familiar.species];
    const assetId = appearanceOf(familiar.species, familiar.variant).asset;
    const record = asset(assetId);
    this.familiar = familiar;
    this.key = familiarKey(familiar);
    this.positionId = `${place.zoneId}:${place.x},${place.y}`;
    this.style = def.animation.idle;
    this.omega = (TAU / PERIOD[this.style]) * (def.animation.tempo ?? 1);
    this.height = def.display.height * place.scale;

    const anchor = def.display.anchor ?? FEET;
    const k = this.height / record.crop.height / record.scale;
    const flip = def.display.facing !== 'front' && def.display.facing !== place.face;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(anchor.x, anchor.y);
    this.sprite.scale.set(flip ? -k : k, k);
    const tint = APPEARANCE_TINT[this.key];
    if (tint !== undefined) this.sprite.tint = tint;
    this.width = texture.width * k;
    this.centerY = (0.5 - anchor.y) * this.height;
    const ax = flip ? 1 - anchor.x : anchor.x;
    const left = -ax * this.width;
    this.headOffset = { x: left + this.width / 2, y: -anchor.y * this.height - 6 };

    // contact shadow for creatures standing on the ground: a flat, feathered ellipse
    // at the feet (perspective-flattened), not part of the breathing body
    // Two layers: a wide soft pool and a darker core right under the feet, so the
    // creature visibly sits ON the floor even against the dark moss.
    const tier = def.speciesRarity;
    const isMutation = familiar.variant === 'mutation';
    if (def.display.habitat === 'ground' && anchor.y > 0.8) {
      const cx = left + this.width / 2;
      const footY = -this.height * 0.012;
      this.shadow = new Sprite(fx.glow);
      this.shadow.anchor.set(0.5);
      this.shadowBase = { w: this.width * 0.92, h: Math.max(18, this.width * 0.17) };
      this.shadow.width = this.shadowBase.w;
      this.shadow.height = this.shadowBase.h;
      this.shadow.position.set(cx, footY);
      this.shadow.tint = SHADOW_TINT;
      this.shadow.alpha = 0.8;
      this.root.addChild(this.shadow);
      this.shadowCore = new Sprite(fx.glow);
      this.shadowCore.anchor.set(0.5);
      this.shadowCore.width = this.width * 0.55;
      this.shadowCore.height = Math.max(9, this.width * 0.075);
      this.shadowCore.position.set(cx, footY + 1);
      this.shadowCore.tint = 0x050c12;
      this.shadowCore.alpha = 0.85;
      this.root.addChild(this.shadowCore);
    }

    // faint cool rim/ambient light behind the creature (static, additive, low)
    this.rim = new Sprite(fx.glow);
    this.rim.anchor.set(0.5);
    this.rim.position.set(left + this.width / 2, this.centerY);
    this.rim.width = this.width * 1.25;
    this.rim.height = this.height * 1.15;
    this.rim.tint = RIM_TINT;
    this.rim.blendMode = 'add';
    this.rim.alpha = 0.06;
    this.body.addChild(this.rim);

    // rare mutations (white) and Epic/Legendary species (tier tint) glow along their own outline
    this.glowStyle = isMutation ? MUTATION_GLOW : (TIER_GLOW[tier] ?? null);
    const baked = this.glowStyle ? silhouetteGlow(texture) : null;
    if (this.glowStyle && baked) {
      const glow = new Sprite(baked.texture);
      const tw = texture.width;
      const th = texture.height;
      glow.anchor.set((anchor.x * tw + baked.pad) / (tw + 2 * baked.pad), (anchor.y * th + baked.pad) / (th + 2 * baked.pad));
      const gk = k * GLOW_ENLARGE;
      glow.scale.set(flip ? -gk : gk, gk);
      // enlarge around the body's centre rather than its feet
      const cx = left + this.width / 2;
      glow.position.set(cx * (1 - GLOW_ENLARGE), this.centerY * (1 - GLOW_ENLARGE));
      glow.tint = this.glowStyle[0];
      glow.blendMode = 'add';
      glow.alpha = this.glowStyle[1];
      this.body.addChild(glow);
      this.shapeGlow = glow;
    }
    if (fx.sparkle && isMutation) {
      for (let i = 0; i < 3; i++) {
        const s = new Sprite(fx.sparkle);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.visible = false;
        this.sparkles.push({ sprite: s, t: 0, life: 0, x: 0, y: 0 });
      }
    }
    if (fx.portal) {
      this.portal = new Sprite(fx.portal);
      this.portal.anchor.set(0.5);
      this.portal.blendMode = 'add';
      this.portal.visible = false;
      this.portal.position.set(0, this.centerY);
      this.root.addChild(this.portal);
    }
    this.body.addChild(this.sprite);
    // highlight: the same artwork added on top at low strength brightens it softly (no outline)
    this.shine = new Sprite(texture);
    this.shine.anchor.copyFrom(this.sprite.anchor);
    this.shine.scale.copyFrom(this.sprite.scale);
    this.shine.blendMode = 'add';
    this.shine.alpha = 0;
    this.shine.visible = false;
    this.body.addChild(this.shine);
    for (const s of this.sparkles) this.body.addChild(s.sprite);
    this.root.addChild(this.body);
    this.root.position.set(place.x, place.y);
    this.root.label = this.key;

    // hover / tap target: the sprite's bounds
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    this.root.hitArea = new Rectangle(left, -anchor.y * this.height, this.width, this.height);
  }

  setHighlight(on: boolean): void {
    this.highlightTarget = on ? 1 : 0;
  }

  /** Gentle appearance with a brief portal glow (used right after a summon). */
  startArrival(): void {
    this.arrival = 0;
    this.portalTime = 0;
    this.root.alpha = 0;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const amp = reducedMotion ? 0.3 : 1;
    const a = this.time * this.omega + this.phase;
    const s = Math.sin(a);
    let x = 0;
    let y = 0;
    let rot = 0;
    let sy = 1;
    let sx = 1;

    switch (this.style) {
      case 'breathe':
        sy = 1 + 0.01 * amp * s;
        sx = 1 - 0.003 * amp * s;
        break;
      case 'sway':
        rot = 0.02 * amp * s; // about 1.1 degrees, pivoting on the feet
        sy = 1 + 0.004 * amp * Math.sin(a * 2);
        break;
      case 'perch': {
        this.leanTimer -= dt;
        if (this.leanTimer <= 0) {
          this.leanTimer = 4 + Math.random() * 5;
          this.leanTarget = (Math.random() - 0.5) * 0.045;
        }
        this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 1.6);
        rot = this.lean * amp;
        sy = 1 + 0.008 * amp * s;
        x = this.lean * 60 * amp;
        break;
      }
      case 'hover':
        y = 8 * amp * s;
        rot = 0.02 * amp * Math.sin(a * 0.5);
        break;
      case 'swim':
        // slow figure-eight glide with a gentle bank into the turns
        x = 22 * amp * s;
        y = 10 * amp * Math.sin(a * 2);
        rot = 0.05 * amp * Math.cos(a);
        break;
      case 'flutter':
        x = (10 * Math.sin(a) + 4 * Math.sin(a * 3.1)) * amp;
        y = (7 * Math.sin(a * 1.7) + 3 * Math.cos(a * 2.3)) * amp;
        rot = 0.03 * amp * Math.sin(a * 2);
        break;
      case 'creep':
        x = 3 * amp * s;
        sy = 1 + 0.004 * amp * Math.sin(a * 6);
        break;
    }

    // arrival: fade and settle into place
    let grow = 1;
    if (this.arrival >= 0) {
      this.arrival += dt / 1.1;
      const e = easeOut(Math.min(1, this.arrival));
      this.root.alpha = e;
      grow = 0.9 + 0.1 * e;
      if (this.arrival >= 1) {
        this.arrival = -1;
        this.root.alpha = 1;
      }
    }
    if (this.portal && this.portalTime >= 0) {
      this.portalTime += dt;
      const t = this.portalTime / 1.8;
      this.portal.visible = t < 1;
      // rises quickly, lingers, then fades: never a flash
      this.portal.alpha = 0.5 * Math.min(1, t * 3.5) * (1 - easeOut(Math.max(0, (t - 0.35) / 0.65)));
      const pk = ((this.height * 1.35) / this.portal.texture.height) * (0.85 + 0.15 * easeOut(Math.min(1, t * 2)));
      this.portal.scale.set(pk);
      this.portal.rotation = this.portalTime * 0.25;
      if (t >= 1) this.portalTime = -1;
    }

    this.body.position.set(x, y);
    this.body.rotation = rot;
    this.body.scale.set(sx * grow, sy * grow);
    if (this.shadow) {
      // follows sideways drift, stays put while breathing
      this.shadow.x = this.headOffset.x + x;
      this.shadow.width = this.shadowBase.w * grow;
    }

    // highlight fades smoothly in and out
    if (this.highlight !== this.highlightTarget) {
      const step = dt / (reducedMotion ? 0.05 : 0.25);
      this.highlight = this.highlightTarget > this.highlight ? Math.min(1, this.highlight + step) : Math.max(0, this.highlight - step);
      this.shine.visible = this.highlight > 0.001;
    }
    this.shine.alpha = this.highlight * (0.14 + 0.04 * Math.sin(this.time * 2.4));
    this.rim.alpha = 0.06 + this.highlight * 0.16;

    // the shape glow breathes slowly
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.3 + this.phase);
    if (this.shapeGlow && this.glowStyle) this.shapeGlow.alpha = this.glowStyle[1] + this.glowStyle[2] * pulse;
    if (this.shadowCore) this.shadowCore.x = this.headOffset.x + x;
    this.updateSparkles(dt, reducedMotion);
  }

  private updateSparkles(dt: number, reducedMotion: boolean): void {
    if (!this.sparkles.length) return;
    this.sparkleTimer -= dt;
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = (reducedMotion ? 3.5 : 1.6) + Math.random() * 2;
      const free = this.sparkles.find((p) => p.life <= 0);
      if (free) {
        free.life = 0.9 + Math.random() * 0.5;
        free.t = 0;
        free.x = (Math.random() - 0.5) * Math.abs(this.width) * 0.7;
        free.y = this.centerY + (Math.random() - 0.5) * this.height * 0.7;
        const size = 8 + Math.random() * 6;
        free.sprite.scale.set(size / free.sprite.texture.height);
        free.sprite.visible = true;
      }
    }
    for (const p of this.sparkles) {
      if (p.life <= 0) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        p.life = 0;
        p.sprite.visible = false;
        continue;
      }
      p.sprite.alpha = Math.sin(k * Math.PI) * 0.85;
      p.sprite.position.set(p.x, p.y - k * 10);
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
