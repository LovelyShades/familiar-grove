// Small reusable pieces for scene effects: generated soft textures and a
// fixed-size particle pool (no allocations while running).

import { Container, Sprite, Texture } from 'pixi.js';

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  return Texture.from(canvas);
}

/** Soft round glow: white centre fading to transparent. Tint it for colour. */
export function createGlowTexture(): Texture {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Wide, very soft cloud for fog bands. */
export function createFogTexture(): Texture {
  return canvasTexture(512, 128, (ctx) => {
    ctx.save();
    ctx.scale(4, 1);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
  });
}

/** Horizontal band, transparent at top and bottom: depth haze between layers. */
export function createHazeTexture(): Texture {
  return canvasTexture(4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  });
}

/** A small soft petal (white; tint it). */
export function createPetalTexture(): Texture {
  return canvasTexture(32, 20, (ctx) => {
    const g = ctx.createRadialGradient(14, 10, 1, 16, 10, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(16, 10, 14, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A particle: a pooled sprite plus whatever per-particle numbers an effect needs. */
export interface Particle {
  sprite: Sprite;
  active: boolean;
  t: number;
  life: number;
  delay: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vx: number;
  vy: number;
  size: number;
  seed: number;
  /** Which effect drives this particle (used by the upgrade flourishes). */
  mode: number;
}

/** Fixed pool of sprites. `spawn` returns null when every particle is busy. */
export class ParticlePool {
  readonly items: Particle[] = [];

  constructor(parent: Container, texture: Texture, count: number, blend: 'add' | 'normal' = 'add') {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = blend;
      sprite.visible = false;
      parent.addChild(sprite);
      this.items.push({ sprite, active: false, t: 0, life: 1, delay: 0, x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, vx: 0, vy: 0, size: 1, seed: 0, mode: 0 });
    }
  }

  spawn(): Particle | null {
    for (const p of this.items) {
      if (!p.active) {
        p.active = true;
        p.t = 0;
        p.delay = 0;
        p.seed = Math.random() * 1000;
        p.sprite.visible = false;
        return p;
      }
    }
    return null;
  }

  activeCount(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  kill(p: Particle): void {
    p.active = false;
    p.sprite.visible = false;
  }

  clear(): void {
    for (const p of this.items) this.kill(p);
  }
}

/** Scale a sprite so its texture is `height` px tall (keeps aspect). */
export function sizeByHeight(sprite: Sprite, height: number): void {
  const k = height / sprite.texture.height;
  sprite.scale.set(k);
}
