import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { FAMILIARS, RARITIES } from './data.js';
import { Creature, buildLooks, iconDisplay } from './creatures.js';

// The grove is drawn in a fixed 1400 x 1000 "world" that is scaled to fill the stage.
export const W = 1400;
export const H = 1000;

const TREE_BASE = { x: 560, y: 800 };
const HEART = { x: 560, y: 612 };
// Branch tips where owls perch (in un-scaled tree coordinates).
const PERCH_SLOTS = [[300, 462], [822, 456], [405, 318], [728, 300], [478, 236], [648, 226]];
const NIGHT_TINT = 0x8a86d4;
const DAY_TINT = 0xffffff;

const ART_FILES = [
  'environment/sky', 'environment/distant_forest', 'environment/ground',
  'environment/heartwood_tree', 'environment/foreground',
  ...FAMILIARS.map((f) => `creatures/${f.id}`),
  'decorations/glowing_mushrooms', 'decorations/lantern', 'decorations/crystal',
];

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return Texture.from(c);
}

function verticalGradient(stops) {
  return canvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Loads a PNG only if it really exists (the dev server answers missing files with HTML). */
async function tryLoadImage(path) {
  try {
    const res = await fetch(path, { method: 'HEAD' });
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return null;
    return await Assets.load(path);
  } catch {
    return null;
  }
}

export class Scene {
  constructor(el) {
    this.el = el;
    this.tintables = [];
    this.decor = [];
    this.creatures = new Map();
    this.level = 1;
    this.night = 1;
    this.targetNight = 1;
    this.treeScale = 0.8;
    this.treeBounce = 0;
    this.t = 0;
    this.onTreeClick = null;
  }

  async init() {
    this.app = new Application();
    await this.app.init({
      resizeTo: this.el,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.el.appendChild(this.app.canvas);

    this.art = {};
    await Promise.all(ART_FILES.map(async (key) => {
      const tex = await tryLoadImage(`assets/${key}.png`);
      if (tex) this.art[key] = tex;
    }));

    this.glowTex = canvasTexture(128, 128, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    });

    this.world = new Container();
    this.app.stage.addChild(this.world);
    const layer = (sortable = false) => {
      const c = new Container();
      c.sortableChildren = sortable;
      this.world.addChild(c);
      return c;
    };
    this.skyLayer = layer();
    this.farLayer = layer();
    this.skyCreatureLayer = layer();
    this.groundLayer = layer();
    this.treeLayer = layer();
    this.decorLayer = layer();
    this.creatureLayer = layer(true);
    this.foregroundLayer = layer();
    this.fxLayer = layer();

    this.looks = buildLooks(this.app.renderer, this.art);

    this.buildSky();
    this.buildFar();
    this.buildGround();
    this.buildTree();
    this.buildDecor();
    this.buildForeground();
    this.buildEffects();

    this.app.ticker.add((ticker) => this.update(Math.min(ticker.deltaMS / 1000, 0.1)));
  }

  // ------------------------------------------------------------------ helpers

  tinted(obj) {
    this.tintables.push(obj);
    return obj;
  }

  glow(x, y, size, color, alpha = 1) {
    const s = new Sprite(this.glowTex);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.width = s.height = size;
    s.tint = color;
    s.alpha = alpha;
    s.blendMode = 'add';
    return s;
  }

  artSprite(key, { x, y, ax = 0.5, ay = 1, height, width }) {
    const s = new Sprite(this.art[key]);
    s.anchor.set(ax, ay);
    s.position.set(x, y);
    const k = height ? height / s.texture.height : width / s.texture.width;
    s.scale.set(k);
    return s;
  }

  /** Scenery that fades in once the grove reaches `unlock` level. */
  addDecor(unlock, parent, build, update) {
    const node = new Container();
    node.alpha = 0;
    node.visible = false;
    parent.addChild(node);
    const item = { unlock, node, a: 0, update, data: {} };
    build(node, item.data);
    this.decor.push(item);
    return item;
  }

  // ------------------------------------------------------------------ sky

  buildSky() {
    const L = this.skyLayer;
    if (this.art['environment/sky']) {
      this.skyNight = L.addChild(this.artSprite('environment/sky', { x: W / 2, y: 0, ay: 0, width: W }));
    } else {
      this.skyNight = L.addChild(new Sprite(verticalGradient([[0, '#090b26'], [0.45, '#2a1f5e'], [0.78, '#5b3a8c'], [1, '#c26a8e']])));
      this.skyNight.width = W;
      this.skyNight.height = 820;
    }
    this.skyDay = L.addChild(new Sprite(verticalGradient([[0, '#4fa6e0'], [0.5, '#a5d6f2'], [0.85, '#e3eff2'], [1, '#ffe0bd']])));
    this.skyDay.width = W;
    this.skyDay.height = 820;

    const rnd = seeded(7);
    this.stars = L.addChild(new Container());
    for (let i = 0; i < 170; i++) {
      const s = this.glow(rnd() * W, rnd() * 560, 4 + rnd() * 10, rnd() < 0.2 ? 0xc9b8ff : 0xffffff);
      s.twinkle = rnd() * 6;
      this.stars.addChild(s);
    }

    this.moon = L.addChild(new Container());
    this.moon.position.set(1090, 150);
    this.moon.addChild(this.glow(0, 0, 340, 0x9f93ff, 0.55));
    const m = new Graphics();
    m.circle(0, 0, 46).fill(0xf4f1ff);
    m.circle(-14, -10, 9).fill(0xdcd6f5);
    m.circle(12, 14, 7).fill(0xdcd6f5);
    m.circle(16, -16, 5).fill(0xdcd6f5);
    this.moon.addChild(m);

    this.sun = L.addChild(new Container());
    this.sun.position.set(1090, 150);
    this.sun.addChild(this.glow(0, 0, 420, 0xffd27a, 0.8));
    this.sun.addChild(new Graphics().circle(0, 0, 50).fill(0xfff4cf));

    this.addDecor(9, L, (node, d) => {
      d.g = node.addChild(new Graphics());
      d.g.blendMode = 'add';
    }, (d, t) => {
      const g = d.g;
      g.clear();
      g.alpha = this.night;
      const bands = [[0x5cffc8, 120, 0], [0x7f9bff, 175, 1.7], [0xd77bff, 95, 3.1]];
      for (const [color, baseY, ph] of bands) {
        const pts = [];
        const bottom = [];
        for (let i = 0; i <= 28; i++) {
          const x = (i / 28) * W;
          const y = baseY + Math.sin(i * 0.45 + t * 0.6 + ph) * 28 + Math.sin(i * 0.17 - t * 0.3) * 20;
          pts.push(x, y);
          bottom.push(x, y + 80 + Math.sin(i * 0.6 + t + ph) * 25);
        }
        for (let i = bottom.length - 2; i >= 0; i -= 2) pts.push(bottom[i], bottom[i + 1]);
        g.poly(pts).fill({ color, alpha: 0.16 });
      }
    });

    this.shootingStars = L.addChild(new Container());
  }

  // ------------------------------------------------------------------ distant scenery

  buildFar() {
    const L = this.farLayer;
    if (this.art['environment/distant_forest']) {
      L.addChild(this.artSprite('environment/distant_forest', { x: W / 2, y: 790, width: W }));
      return;
    }
    const rnd = seeded(21);
    const ridge = (baseY, amp, step, color) => {
      const g = new Graphics();
      const pts = [0, 820];
      for (let x = 0; x <= W; x += step) pts.push(x, baseY - Math.abs(Math.sin(x * 0.006 + rnd())) * amp - rnd() * amp * 0.4);
      pts.push(W, 820);
      g.poly(pts).fill(color);
      return L.addChild(this.tinted(g));
    };
    ridge(600, 170, 60, 0xa9b9dc);
    ridge(660, 110, 45, 0x86a2c4);

    const trees = new Graphics();
    for (let row = 0; row < 2; row++) {
      const color = row ? 0x4c7f68 : 0x5f9180;
      const baseY = row ? 790 : 760;
      for (let x = -20; x < W + 20; x += 18 + rnd() * 16) {
        const h = 50 + rnd() * 60 + row * 15;
        if (rnd() < 0.55) {
          trees.poly([x - h * 0.28, baseY, x, baseY - h, x + h * 0.28, baseY]).fill(color);
        } else {
          trees.circle(x, baseY - h * 0.55, h * 0.32).fill(color);
          trees.rect(x - 3, baseY - h * 0.3, 6, h * 0.3).fill(color);
        }
      }
    }
    L.addChild(this.tinted(trees));
    L.addChild(new Graphics().rect(0, 700, W, 120).fill({ color: 0xd8d2ff, alpha: 0.08 }));
  }

  // ------------------------------------------------------------------ ground, cliff, waterfall

  buildGround() {
    const L = this.groundLayer;
    const rnd = seeded(42);
    if (this.art['environment/ground']) {
      L.addChild(this.artSprite('environment/ground', { x: W / 2, y: H, width: W }));
    } else {
      const cliff = new Graphics();
      cliff.poly([1030, 830, 1065, 700, 1110, 560, 1160, 500, 1400, 470, 1400, 840]).fill(0x8796a8).stroke({ width: 4, color: 0x5d6878 });
      for (let i = 0; i < 7; i++) {
        const y = 540 + i * 42;
        cliff.moveTo(1100 + i * 6, y).lineTo(1400, y - 18 + rnd() * 20).stroke({ width: 3, color: 0x6d7888, alpha: 0.7 });
      }
      cliff.poly([1150, 505, 1160, 492, 1400, 462, 1400, 492, 1270, 505, 1180, 515]).fill(0x6aa858);
      L.addChild(this.tinted(cliff));

      const ground = new Graphics();
      ground.moveTo(0, 775)
        .quadraticCurveTo(250, 745, 520, 790)
        .quadraticCurveTo(820, 830, 1100, 795)
        .quadraticCurveTo(1260, 780, W, 805)
        .lineTo(W, H).lineTo(0, H).closePath()
        .fill(0x4f8c45);
      ground.moveTo(0, 860).quadraticCurveTo(400, 820, 760, 870).quadraticCurveTo(1100, 910, W, 860)
        .lineTo(W, H).lineTo(0, H).closePath().fill(0x5e9f50);
      // path from the tree down to the viewer
      ground.moveTo(520, 800)
        .bezierCurveTo(520, 860, 420, 900, 400, H)
        .lineTo(640, H)
        .bezierCurveTo(620, 920, 630, 860, 610, 800)
        .closePath()
        .fill(0xc8a774)
        .stroke({ width: 3, color: 0xa88654 });
      for (const [x, y, rx] of [[560, 830, 22], [520, 870, 26], [500, 920, 30], [540, 970, 34], [600, 900, 18]]) {
        ground.ellipse(x, y, rx, rx * 0.4).fill(0xb59a72);
      }
      for (let i = 0; i < 140; i++) {
        const x = rnd() * W;
        const y = 790 + rnd() * 210;
        if (x > 380 && x < 660 && y > 820) continue;
        const h = 6 + rnd() * 10;
        const c = rnd() < 0.5 ? 0x3f7d38 : 0x7cc463;
        ground.poly([x - 3, y, x, y - h, x + 3, y]).fill(c);
        ground.poly([x + 1, y, x + 6, y - h * 0.7, x + 6, y]).fill(c);
      }
      for (const [x, y, r] of [[160, 860, 22], [900, 850, 16], [1000, 960, 26], [300, 975, 14]]) {
        ground.ellipse(x, y, r, r * 0.6).fill(0x8a93a0).stroke({ width: 2, color: 0x5d6878 });
        ground.ellipse(x - r * 0.25, y - r * 0.2, r * 0.4, r * 0.2).fill(0xaab3c0);
      }
      L.addChild(this.tinted(ground));
    }

    // Crystal Falls (level 6)
    this.addDecor(6, L, (node, d) => {
      const water = new Graphics();
      water.poly([1175, 500, 1250, 492, 1258, 800, 1168, 800]).fill({ color: 0x9fd8ff, alpha: 0.85 });
      water.ellipse(1215, 808, 105, 24).fill(0x7cc4ef);
      water.moveTo(1120, 812)
        .bezierCurveTo(1200, 850, 1250, 880, 1400, 890)
        .lineTo(1400, 960)
        .bezierCurveTo(1260, 950, 1180, 880, 1110, 830)
        .closePath()
        .fill(0x7cc4ef);
      node.addChild(this.tinted(water));
      d.streaks = [];
      for (let i = 0; i < 16; i++) {
        const s = node.addChild(new Graphics().rect(-1.5, -30, 3, 60).fill({ color: 0xffffff, alpha: 0.7 }));
        s.x = 1180 + Math.random() * 70;
        s.y = 500 + Math.random() * 300;
        d.streaks.push(s);
      }
      d.foam = [];
      for (let i = 0; i < 5; i++) d.foam.push(node.addChild(this.glow(1180 + i * 18, 805, 70, 0xcff0ff, 0.5)));
      d.shimmer = node.addChild(this.glow(1300, 900, 220, 0x7fe0ff, 0.25));
    }, (d, t, dt) => {
      for (const s of d.streaks) {
        s.y += dt * 260;
        if (s.y > 790) s.y = 500;
      }
      d.foam.forEach((f, i) => {
        f.alpha = 0.35 + Math.sin(t * 4 + i) * 0.2;
      });
      d.shimmer.alpha = (0.15 + Math.sin(t) * 0.08) * (0.4 + this.night * 0.6);
    });

    // Elven village + rope bridge on the cliff (level 10)
    this.addDecor(10, L, (node, d) => {
      const g = new Graphics();
      g.moveTo(850, 470).quadraticCurveTo(990, 560, 1130, 520).stroke({ width: 3, color: 0x5a3d22 });
      g.moveTo(850, 452).quadraticCurveTo(990, 540, 1130, 502).stroke({ width: 2, color: 0x5a3d22 });
      for (let i = 0; i <= 14; i++) {
        const k = i / 14;
        const x = 850 + 280 * k;
        const y = (1 - k) * (1 - k) * 470 + 2 * (1 - k) * k * 560 + k * k * 520;
        g.rect(x - 4, y - 2, 8, 8).fill(0x8a5a36);
      }
      for (const [x, y, w, h, roof] of [[1190, 490, 50, 42, 0x6b3f8a], [1250, 470, 64, 56, 0x3f5f8a], [1330, 465, 46, 40, 0x6b3f8a]]) {
        g.rect(x, y - h, w, h).fill(0xc9b18a).stroke({ width: 2, color: 0x5a3d22 });
        g.poly([x - 8, y - h, x + w / 2, y - h - w * 0.65, x + w + 8, y - h]).fill(roof).stroke({ width: 2, color: 0x2a1f3a });
      }
      node.addChild(this.tinted(g));
      d.lights = [];
      for (const [x, y] of [[1215, 470], [1272, 445], [1296, 445], [1352, 448], [990, 548], [1060, 540], [920, 520]]) {
        const win = node.addChild(new Graphics().rect(-5, -6, 10, 12).fill(0xffd27a));
        win.position.set(x, y);
        d.lights.push(node.addChild(this.glow(x, y, 60, 0xffb85c, 0.8)));
      }
    }, (d, t) => {
      d.lights.forEach((l, i) => {
        l.alpha = (0.6 + Math.sin(t * 3 + i * 1.7) * 0.15) * (0.3 + this.night * 0.7);
      });
    });
  }

  // ------------------------------------------------------------------ the Heartwood Tree

  buildTree() {
    const tree = new Container();
    tree.pivot.set(TREE_BASE.x, TREE_BASE.y);
    tree.position.set(TREE_BASE.x, TREE_BASE.y);
    tree.scale.set(this.treeScale);
    this.tree = this.treeLayer.addChild(tree);

    if (this.art['environment/heartwood_tree']) {
      tree.addChild(this.artSprite('environment/heartwood_tree', { x: TREE_BASE.x, y: TREE_BASE.y + 10, height: 700 }));
    } else {
      this.drawTree(tree);
    }

    // glowing heart
    this.heartGlow = tree.addChild(this.glow(HEART.x, HEART.y, 300, 0xffb347, 0.7));
    const veins = new Graphics();
    for (const [ex, ey] of [[470, 790], [520, 800], [610, 800], [660, 790], [560, 760]]) {
      veins.moveTo(HEART.x, HEART.y + 30).quadraticCurveTo((HEART.x + ex) / 2 + (ex - HEART.x) * 0.3, (HEART.y + ey) / 2, ex, ey)
        .stroke({ width: 3, color: 0xffd36e, alpha: 0.75 });
    }
    veins.blendMode = 'add';
    this.veins = tree.addChild(veins);
    const heart = new Graphics();
    heart.circle(HEART.x - 15, HEART.y - 8, 18).fill(0xffd36e);
    heart.circle(HEART.x + 15, HEART.y - 8, 18).fill(0xffd36e);
    heart.poly([HEART.x - 32, HEART.y - 2, HEART.x + 32, HEART.y - 2, HEART.x, HEART.y + 38]).fill(0xffd36e);
    heart.circle(HEART.x, HEART.y + 4, 14).fill(0xfff2c4);
    this.heart = tree.addChild(heart);
    this.heartCore = tree.addChild(this.glow(HEART.x, HEART.y, 120, 0xfff2c4, 0.9));

    tree.eventMode = 'static';
    tree.cursor = 'pointer';
    tree.hitArea = new Rectangle(250, 160, 640, 660);
    tree.on('pointerdown', (e) => {
      this.treeBounce = 1;
      this.onTreeClick?.(e.global.x, e.global.y);
    });

    // Lanterns (level 3)
    this.addDecor(3, tree, (node, d) => {
      d.glows = [];
      for (const [x, y] of [[335, 505], [445, 470], [560, 432], [680, 462], [795, 505], [400, 400], [722, 392]]) {
        const string = new Graphics().moveTo(x, y - 46).lineTo(x, y - 12).stroke({ width: 2, color: 0x3a2616 });
        node.addChild(string);
        if (this.art['decorations/lantern']) {
          node.addChild(this.artSprite('decorations/lantern', { x, y: y + 14, height: 34 }));
        } else {
          const l = new Graphics();
          l.roundRect(x - 9, y - 12, 18, 24, 4).fill(0xffd98a).stroke({ width: 3, color: 0x5a3d1a });
          l.rect(x - 11, y - 15, 22, 4).fill(0x5a3d1a);
          l.rect(x - 11, y + 11, 22, 4).fill(0x5a3d1a);
          node.addChild(l);
        }
        d.glows.push(node.addChild(this.glow(x, y, 90, 0xffb85c, 0.8)));
      }
    }, (d, t) => {
      d.glows.forEach((g, i) => {
        g.alpha = (0.65 + Math.sin(t * 7 + i * 2.1) * 0.08 + Math.sin(t * 13 + i) * 0.05) * (0.45 + this.night * 0.55);
      });
    });

    // Treehouses (level 7)
    this.addDecor(7, tree, (node, d) => {
      const g = new Graphics();
      d.windows = [];
      for (const [x, y, w] of [[690, 400, 70], [372, 300, 56]]) {
        g.rect(x - 10, y, w + 20, 8).fill(0x6b4423).stroke({ width: 2, color: 0x3a2616 });
        g.rect(x, y - w * 0.7, w, w * 0.7).fill(0xb08350).stroke({ width: 2, color: 0x3a2616 });
        g.poly([x - 10, y - w * 0.7, x + w / 2, y - w * 1.25, x + w + 10, y - w * 0.7]).fill(0x7a3f5a).stroke({ width: 2, color: 0x2a1f3a });
        g.roundRect(x + w * 0.3, y - w * 0.5, w * 0.4, w * 0.32, 6).fill(0xffd27a);
        d.windows.push([x + w * 0.5, y - w * 0.34]);
      }
      node.addChild(this.tinted(g));
      d.glows = d.windows.map(([x, y]) => node.addChild(this.glow(x, y, 80, 0xffb85c, 0.7)));
    }, (d, t) => {
      d.glows.forEach((g, i) => {
        g.alpha = (0.55 + Math.sin(t * 2 + i) * 0.1) * (0.3 + this.night * 0.7);
      });
    });
  }

  drawTree(tree) {
    const rnd = seeded(99);
    const bark = 0x8a5a36;
    const barkDark = 0x5e3a22;

    const trunk = new Graphics();
    for (const [x1, y1, cx, cy, x2, y2] of [[470, 790, 420, 800, 330, 820], [640, 790, 700, 800, 790, 822], [520, 795, 500, 830, 470, 850], [600, 795, 630, 835, 665, 848]]) {
      trunk.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({ width: 22, color: barkDark, cap: 'round' });
      trunk.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({ width: 16, color: bark, cap: 'round' });
    }
    // branches: [startX, startY, ctrlX, ctrlY, endX, endY, width]
    const branches = [
      [455, 425, 380, 430, 290, 470, 30], [445, 410, 420, 340, 400, 322, 24], [450, 400, 380, 280, 300, 230, 18],
      [665, 420, 740, 425, 832, 462, 30], [660, 405, 700, 330, 730, 304, 24], [665, 400, 760, 280, 840, 240, 18],
      [540, 440, 500, 330, 478, 240, 22], [580, 440, 620, 330, 648, 230, 22], [560, 440, 562, 300, 565, 190, 20],
    ];
    for (const [sx, sy, cx, cy, ex, ey, w] of branches) {
      trunk.moveTo(sx, sy).quadraticCurveTo(cx, cy, ex, ey).stroke({ width: w + 6, color: barkDark, cap: 'round' });
      trunk.moveTo(sx, sy).quadraticCurveTo(cx, cy, ex, ey).stroke({ width: w, color: bark, cap: 'round' });
    }
    trunk.moveTo(380, 805)
      .bezierCurveTo(450, 790, 480, 740, 492, 640)
      .bezierCurveTo(502, 560, 482, 470, 432, 412)
      .lineTo(472, 396)
      .bezierCurveTo(520, 450, 545, 458, 560, 440)
      .bezierCurveTo(575, 458, 600, 450, 648, 396)
      .lineTo(688, 412)
      .bezierCurveTo(638, 470, 618, 560, 628, 640)
      .bezierCurveTo(640, 740, 670, 790, 740, 805)
      .closePath()
      .fill(bark)
      .stroke({ width: 5, color: barkDark });
    for (let i = 0; i < 9; i++) {
      const x = 505 + i * 12 + rnd() * 6;
      trunk.moveTo(x, 790).bezierCurveTo(x - 10, 720, x + 12, 640, x - 4 + rnd() * 8, 470 + rnd() * 40)
        .stroke({ width: 2.5, color: barkDark, alpha: 0.7 });
    }
    this.treeLayerTrunk = tree.addChild(this.tinted(trunk));

    // canopy: leafy clusters around the branch ends, with blossoms
    const canopy = new Container();
    canopy.pivot.set(560, 450);
    canopy.position.set(560, 450);
    const leaves = new Graphics();
    const clusters = [[290, 420], [380, 300], [300, 240], [470, 220], [565, 175], [650, 215], [760, 290], [835, 240], [840, 420], [560, 300], [430, 380], [700, 380]];
    for (const [shade, grow] of [[0x2f7444, 1.15], [0x3f8f4f, 1], [0x52a65c, 0.8], [0x67bf6a, 0.55]]) {
      for (const [cx, cy] of clusters) {
        for (let i = 0; i < 4; i++) {
          const r = (34 + rnd() * 28) * grow;
          leaves.circle(cx + (rnd() - 0.5) * 90, cy + (rnd() - 0.5) * 60 - (1 - grow) * 30, r).fill(shade);
        }
      }
    }
    for (let i = 0; i < 70; i++) {
      const [cx, cy] = clusters[Math.floor(rnd() * clusters.length)];
      const x = cx + (rnd() - 0.5) * 120;
      const y = cy + (rnd() - 0.5) * 90;
      leaves.circle(x, y, 3 + rnd() * 4).fill(rnd() < 0.5 ? 0xc58af0 : 0xf3a6d6);
    }
    canopy.addChild(this.tinted(leaves));
    this.canopy = tree.addChild(canopy);
  }

  // ------------------------------------------------------------------ decorations on the ground

  buildDecor() {
    const L = this.decorLayer;

    // Glowcaps (level 2)
    this.addDecor(2, L, (node, d) => {
      d.glows = [];
      const rnd = seeded(5);
      for (const [cx, cy] of [[420, 840], [700, 850], [250, 925], [960, 885], [660, 960], [120, 840]]) {
        if (this.art['decorations/glowing_mushrooms']) {
          node.addChild(this.artSprite('decorations/glowing_mushrooms', { x: cx, y: cy, height: 56 }));
          d.glows.push(node.addChild(this.glow(cx, cy - 20, 110, 0x6fe3ff, 0.5)));
          continue;
        }
        for (let i = 0; i < 4; i++) {
          const x = cx + (rnd() - 0.5) * 60;
          const y = cy + (rnd() - 0.5) * 16;
          const h = 10 + rnd() * 16;
          const r = 7 + rnd() * 9;
          const color = rnd() < 0.55 ? 0x6fe3ff : 0xd17bff;
          const m = new Graphics();
          m.roundRect(x - 2.5, y - h, 5, h, 2).fill(0xe8dcc8);
          m.moveTo(x - r, y - h).arc(x, y - h, r, Math.PI, Math.PI * 2).closePath().fill(color);
          m.circle(x - r * 0.3, y - h - r * 0.5, r * 0.15).fill(0xffffff);
          node.addChild(m);
          d.glows.push(node.addChild(this.glow(x, y - h, r * 6, color, 0.5)));
        }
      }
    }, (d, t) => {
      d.glows.forEach((g, i) => {
        g.alpha = (0.4 + Math.sin(t * 1.5 + i) * 0.15) * (0.35 + this.night * 0.65);
      });
    });

    // Aether crystals (level 5)
    this.addDecor(5, L, (node, d) => {
      d.glows = [];
      for (const [cx, cy, size] of [[300, 885, 1], [880, 872, 0.8], [1060, 950, 1.2], [160, 965, 0.9], [760, 965, 0.7]]) {
        d.glows.push(node.addChild(this.glow(cx, cy - 30 * size, 180 * size, 0x9a7bff, 0.6)));
        if (this.art['decorations/crystal']) {
          node.addChild(this.artSprite('decorations/crystal', { x: cx, y: cy, height: 70 * size }));
          continue;
        }
        const g = new Graphics();
        for (const [dx, h, w, lean] of [[0, 70, 14, 0], [-16, 44, 11, -10], [16, 50, 11, 12], [-5, 30, 9, -18]]) {
          const x = cx + dx * size;
          const top = cy - h * size;
          g.poly([x - w * size, cy, x + lean * size, top, x + w * size, cy]).fill({ color: 0x9a7bff, alpha: 0.92 }).stroke({ width: 2, color: 0x4a2fa8 });
          g.poly([x, cy, x + lean * size, top, x + w * size, cy]).fill({ color: 0xd9c9ff, alpha: 0.45 });
        }
        node.addChild(g);
      }
    }, (d, t) => {
      d.glows.forEach((g, i) => {
        g.alpha = (0.45 + Math.sin(t * 2 + i * 1.3) * 0.2) * (0.4 + this.night * 0.6);
      });
    });

    // Runestone and banner (level 8)
    this.addDecor(8, L, (node, d) => {
      const g = new Graphics();
      g.poly([970, 905, 980, 830, 1010, 812, 1040, 830, 1046, 905]).fill(0x7d8794).stroke({ width: 3, color: 0x4a525e });
      g.rect(140, 650, 10, 180).fill(0x5a3d22).stroke({ width: 2, color: 0x2a1c10 });
      g.rect(120, 650, 70, 8).fill(0x5a3d22);
      node.addChild(this.tinted(g));
      const banner = new Graphics();
      banner.poly([0, 0, 52, 0, 52, 110, 26, 92, 0, 110]).fill(0x5b3c8f).stroke({ width: 3, color: 0xc9a45c });
      banner.circle(26, 40, 14).fill(0xffd36e);
      banner.circle(32, 36, 12).fill(0x5b3c8f);
      banner.position.set(130, 658);
      d.banner = node.addChild(this.tinted(banner));
      const rune = new Graphics();
      rune.circle(1008, 862, 18).stroke({ width: 3, color: 0x7fe8ff });
      rune.moveTo(1008, 846).lineTo(1008, 878).stroke({ width: 3, color: 0x7fe8ff });
      rune.moveTo(996, 856).lineTo(1020, 868).stroke({ width: 3, color: 0x7fe8ff });
      d.rune = node.addChild(rune);
      d.glow = node.addChild(this.glow(1008, 862, 130, 0x7fe8ff, 0.6));
    }, (d, t) => {
      d.banner.skew.y = Math.sin(t * 1.3) * 0.04;
      const p = 0.5 + Math.sin(t * 1.8) * 0.3;
      d.glow.alpha = p;
      d.rune.alpha = 0.6 + p * 0.4;
    });
  }

  // ------------------------------------------------------------------ foreground

  buildForeground() {
    const L = this.foregroundLayer;
    if (this.art['environment/foreground']) {
      L.addChild(this.artSprite('environment/foreground', { x: W / 2, y: H, width: W }));
    } else {
      const rnd = seeded(11);
      const g = new Graphics();
      for (const [cx, cy, spread] of [[40, 1000, 150], [1360, 1000, 140], [880, 1010, 70]]) {
        for (let i = 0; i < 14; i++) {
          const r = 22 + rnd() * 30;
          g.circle(cx + (rnd() - 0.5) * spread * 1.6, cy - rnd() * 60, r).fill(rnd() < 0.5 ? 0x2f6a3a : 0x3f7f47);
        }
      }
      for (let i = 0; i < 10; i++) {
        const x = 140 + rnd() * 180;
        g.moveTo(x, 1000).quadraticCurveTo(x - 30 + rnd() * 60, 930, x - 40 + rnd() * 80, 880 + rnd() * 30)
          .stroke({ width: 4, color: 0x3a7a3e, cap: 'round' });
      }
      L.addChild(this.tinted(g));
    }

    // Wildflowers (level 4)
    this.addDecor(4, L, (node) => {
      const rnd = seeded(77);
      const g = new Graphics();
      const colors = [0xf7a8cf, 0xc58af0, 0xffffff, 0x8fc8ff, 0xffe27a];
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W;
        const y = 820 + rnd() * 175;
        if (x > 400 && x < 650 && y > 830) continue;
        const c = colors[Math.floor(rnd() * colors.length)];
        g.moveTo(x, y).lineTo(x, y - 12).stroke({ width: 2, color: 0x3a7a3e });
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.circle(x + Math.cos(a) * 4, y - 14 + Math.sin(a) * 4, 3.2).fill(c);
        }
        g.circle(x, y - 14, 2.2).fill(0xffd84a);
      }
      node.addChild(this.tinted(g));
    });
  }

  // ------------------------------------------------------------------ fireflies, particles, spirits

  buildEffects() {
    const L = this.fxLayer;
    this.fireflies = [];
    for (let i = 0; i < 160; i++) {
      const f = this.glow(Math.random() * W, 250 + Math.random() * 720, 10 + Math.random() * 14, Math.random() < 0.7 ? 0xfff3a0 : 0xc8ff9a);
      f.vx = (Math.random() - 0.5) * 30;
      f.vy = (Math.random() - 0.5) * 20;
      f.seed = Math.random() * 10;
      f.visible = false;
      this.fireflies.push(L.addChild(f));
    }

    this.particles = [];
    for (let i = 0; i < 260; i++) {
      const p = this.glow(0, 0, 16, 0xffffff);
      p.visible = false;
      p.life = 0;
      this.particles.push(L.addChild(p));
    }

    // Forest spirits (level 12)
    this.addDecor(12, L, (node, d) => {
      d.wisps = [];
      for (let i = 0; i < 6; i++) {
        const w = new Container();
        w.addChild(this.glow(0, 0, 70, 0xbfe8ff, 0.6));
        const g = new Graphics();
        g.circle(0, -6, 10).fill({ color: 0xffffff, alpha: 0.9 });
        g.poly([-10, -6, 10, -6, 6, 12, 0, 8, -6, 12]).fill({ color: 0xffffff, alpha: 0.9 });
        g.circle(-3.5, -7, 1.8).fill(0x2a2a4a);
        g.circle(3.5, -7, 1.8).fill(0x2a2a4a);
        w.addChild(g);
        w.home = { x: 100 + Math.random() * 1000, y: 650 + Math.random() * 230 };
        w.seed = Math.random() * 10;
        d.wisps.push(node.addChild(w));
      }
    }, (d, t) => {
      for (const w of d.wisps) {
        w.x = w.home.x + Math.sin(t * 0.4 + w.seed) * 80;
        w.y = w.home.y + Math.sin(t * 1.1 + w.seed * 2) * 25;
        w.alpha = 0.6 + Math.sin(t * 2 + w.seed) * 0.3;
      }
    });

    // Mythic aura rings (level 18+)
    this.addDecor(18, this.treeLayer, (node, d) => {
      d.rings = [];
      for (let i = 0; i < 4; i++) {
        const r = new Graphics().circle(0, 0, 100).stroke({ width: 6, color: 0xffd36e });
        r.blendMode = 'add';
        r.position.set(HEART.x, HEART.y - 120);
        d.rings.push(node.addChild(r));
      }
      this.treeLayer.setChildIndex(node, 0);
    }, (d, t) => {
      const count = Math.min(4, this.level - 17);
      d.rings.forEach((r, i) => {
        r.visible = i < count;
        const k = ((t * 0.25 + i / 4) % 1);
        r.scale.set(1 + k * 4);
        r.alpha = (1 - k) * 0.5;
      });
    });
  }

  // ------------------------------------------------------------------ public API

  setTheme(theme, instant = false) {
    this.targetNight = theme === 'dark' ? 1 : 0;
    if (instant) {
      this.night = this.targetNight;
      this.applyNight();
    }
  }

  setLevel(level, animate = true) {
    this.level = level;
    for (const item of this.decor) {
      if (!animate) item.a = level >= item.unlock ? 1 : 0;
    }
    if (!animate) this.treeScale = this.targetTreeScale();
  }

  targetTreeScale() {
    return 0.8 + 0.2 * Math.min(1, (this.level - 1) / 9);
  }

  perchPoint(i) {
    const [x, y] = PERCH_SLOTS[i % PERCH_SLOTS.length];
    const s = this.treeScale;
    return { x: TREE_BASE.x + (x - TREE_BASE.x) * s, y: TREE_BASE.y + (y - TREE_BASE.y) * s };
  }

  /** Makes the drawn creatures match what the player owns. */
  syncFamiliars(state, animate = true) {
    for (const def of FAMILIARS) {
      const f = state.familiars[def.id];
      // show the rarest ones first, up to the cap
      const desired = RARITIES.map(() => 0);
      let left = def.cap;
      for (let r = RARITIES.length - 1; r >= 0 && left > 0; r--) {
        desired[r] = Math.min(left, f.rarities[r]);
        left -= desired[r];
      }
      let list = this.creatures.get(def.id) || [];
      for (let r = 0; r < RARITIES.length; r++) {
        let have = list.filter((c) => c.rarity === r);
        while (have.length > desired[r]) {
          const c = have.pop();
          c.destroy();
          list = list.filter((x) => x !== c);
        }
        while (have.length < desired[r]) {
          const c = new Creature(this, def, r);
          (def.behavior === 'wyrm' ? this.skyCreatureLayer : this.creatureLayer).addChild(c.root);
          if (!animate) c.fade = 1;
          have.push(c);
          list.push(c);
          if (animate) c.justSpawned = true;
        }
      }
      const boost = 1 + Math.min(0.4, Math.log10(Math.max(1, f.owned / def.cap)) * 0.15);
      list.forEach((c, i) => {
        c.boost = boost;
        c.slot = i;
      });
      this.creatures.set(def.id, list);
    }
  }

  /** A burst of sparkles at a screen position (from a click). */
  clickBurst(screenX, screenY, power = 1) {
    const p = this.world.toLocal({ x: screenX, y: screenY });
    this.burst(p.x, p.y, [0xffd36e, 0x7fe8ff, 0xffffff], 10 + Math.min(14, Math.floor(power)));
    this.heartFlare = 1;
  }

  heartScreenPos() {
    return this.tree.toGlobal({ x: HEART.x, y: HEART.y });
  }

  burst(x, y, colors, count) {
    for (let i = 0; i < count; i++) {
      const p = this.particles.find((q) => q.life <= 0);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220;
      p.position.set(x, y);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 60;
      p.life = p.maxLife = 0.6 + Math.random() * 0.6;
      p.tint = Array.isArray(colors) ? colors[i % colors.length] : colors;
      p.width = p.height = 10 + Math.random() * 16;
      p.visible = true;
    }
  }

  sparkle(x, y, color) {
    const p = this.particles.find((q) => q.life <= 0);
    if (!p) return;
    p.position.set(x, y);
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = -20 - Math.random() * 30;
    p.life = p.maxLife = 0.8 + Math.random() * 0.6;
    p.tint = color;
    p.width = p.height = 8 + Math.random() * 10;
    p.visible = true;
  }

  async familiarIcons() {
    const icons = {};
    for (const def of FAMILIARS) {
      try {
        const display = iconDisplay(this.looks, def.id);
        icons[def.id] = await this.app.renderer.extract.base64({ target: display, resolution: 1.5 });
        display.destroy({ children: true });
      } catch {
        icons[def.id] = '';
      }
    }
    return icons;
  }

  // ------------------------------------------------------------------ frame update

  applyNight() {
    const n = this.night;
    const tint = lerpColor(DAY_TINT, NIGHT_TINT, n);
    for (const o of this.tintables) o.tint = tint;
    this.skyDay.alpha = this.art['environment/sky'] ? (1 - n) * 0.7 : 1 - n;
    this.stars.alpha = n;
    this.moon.alpha = n;
    this.sun.alpha = 1 - n;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;

    // fit the world to the stage ("cover"), keeping the ground in view
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    if (sw !== this.lastW || sh !== this.lastH) {
      this.lastW = sw;
      this.lastH = sh;
      const s = Math.max(sw / W, sh / H);
      this.world.scale.set(s);
      // centre on the tree, without showing past the world edges
      const x = Math.min(0, Math.max(sw - W * s, sw / 2 - 640 * s));
      this.world.position.set(x, (sh - H * s) * 0.6);
    }

    if (Math.abs(this.night - this.targetNight) > 0.001) {
      this.night += (this.targetNight - this.night) * Math.min(1, dt * 3);
      if (Math.abs(this.night - this.targetNight) < 0.002) this.night = this.targetNight;
      this.applyNight();
    } else if (!this.nightApplied) {
      this.nightApplied = true;
      this.applyNight();
    }

    for (const s of this.stars.children) s.alpha = 0.5 + Math.sin(t * 2 + s.twinkle) * 0.4;

    // tree growth, sway, bounce and the beating heart
    this.treeScale += (this.targetTreeScale() - this.treeScale) * Math.min(1, dt * 2);
    this.treeBounce = Math.max(0, this.treeBounce - dt * 5);
    const bounce = Math.sin(this.treeBounce * Math.PI) * 0.015;
    this.tree.scale.set(this.treeScale * (1 + bounce), this.treeScale * (1 - bounce * 0.5));
    if (this.canopy) this.canopy.rotation = Math.sin(t * 0.7) * 0.012;
    this.heartFlare = Math.max(0, (this.heartFlare || 0) - dt * 3);
    const beat = 0.5 + 0.5 * Math.pow(Math.sin(t * 2.2), 8);
    this.heartGlow.alpha = 0.45 + beat * 0.3 + this.heartFlare * 0.4;
    this.heartGlow.width = this.heartGlow.height = 280 + beat * 40 + this.heartFlare * 80;
    this.heartCore.alpha = 0.7 + beat * 0.3;
    this.veins.alpha = 0.5 + beat * 0.4 + this.heartFlare * 0.3;

    // unlockable scenery
    for (const item of this.decor) {
      const target = this.level >= item.unlock ? 1 : 0;
      if (item.a !== target) {
        item.a += Math.sign(target - item.a) * dt * 0.8;
        item.a = Math.max(0, Math.min(1, item.a));
      }
      item.node.alpha = item.a;
      item.node.visible = item.a > 0.001;
      if (item.node.visible && item.update) item.update(item.data, t, dt);
    }

    // creatures
    for (const list of this.creatures.values()) {
      for (const c of list) {
        c.update(dt, t);
        if (c.justSpawned) {
          c.justSpawned = false;
          const y = c.kind === 'wyrm' || c.kind === 'fly' ? c.y : c.y - c.height * 0.5;
          this.burst(c.x, y, c.rarity === 0 ? [0xffffff, 0xffd36e] : RARITIES[c.rarity].color, 22);
        }
      }
    }

    // fireflies: more of them as the grove grows
    const active = Math.min(this.fireflies.length, 14 + this.level * 9);
    const ffAlpha = 0.35 + this.night * 0.65;
    this.fireflies.forEach((f, i) => {
      f.visible = i < active;
      if (!f.visible) return;
      f.x += (f.vx + Math.sin(t * 0.8 + f.seed) * 18) * dt;
      f.y += (f.vy + Math.cos(t * 0.6 + f.seed * 2) * 12) * dt;
      if (f.x < -20) f.x = W + 20;
      if (f.x > W + 20) f.x = -20;
      if (f.y < 240) f.vy = Math.abs(f.vy);
      if (f.y > 980) f.vy = -Math.abs(f.vy);
      f.alpha = (0.45 + Math.sin(t * 3 + f.seed * 5) * 0.45) * ffAlpha;
    });

    // particles
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.visible = false;
        continue;
      }
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 - 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = p.life / p.maxLife;
    }

    // shooting stars (level 15+)
    if (this.level >= 15 && this.night > 0.5 && Math.random() < dt * 0.6) {
      const s = this.glow(Math.random() * W * 0.8, Math.random() * 200, 20, 0xffffff);
      s.scale.x = 2.4;
      s.scale.y = 0.08;
      s.rotation = 0.45;
      s.life = 1.2;
      this.shootingStars.addChild(s);
    }
    for (const s of [...this.shootingStars.children]) {
      s.life -= dt;
      s.x += Math.cos(0.45) * 700 * dt;
      s.y += Math.sin(0.45) * 700 * dt;
      s.alpha = Math.max(0, s.life / 1.2) * this.night;
      if (s.life <= 0) s.destroy();
    }
  }
}
