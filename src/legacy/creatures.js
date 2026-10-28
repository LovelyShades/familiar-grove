import { Container, Graphics, Sprite } from 'pixi.js';
import { FAMILIARS, RARITIES } from './data.js';

// Placeholder creature art, drawn with code. Every creature faces right with its
// feet at (0, 0). Drop a PNG into public/assets/creatures/<id>.png to replace one.

const INK = 0x120c22;
const rand = (a, b) => a + Math.random() * (b - a);
const line = (width, color = INK) => ({ width, color, cap: 'round', join: 'round' });

function mushroomCap(g, x, y, r, color) {
  g.moveTo(x - r, y).arc(x, y, r, Math.PI, Math.PI * 2).closePath().fill(color).stroke(line(1.5));
  g.circle(x - r * 0.4, y - r * 0.45, r * 0.18).fill(0xfff4fa);
  g.circle(x + r * 0.35, y - r * 0.6, r * 0.14).fill(0xfff4fa);
}

function drawCat() {
  const g = new Graphics();
  const fur = 0x2a2147;
  const shade = 0x1b1533;
  const tail = (w, c) => g.moveTo(-32, -26).bezierCurveTo(-64, -24, -72, -66, -50, -82).stroke(line(w, c));
  tail(12);
  tail(7, fur);
  g.roundRect(-30, -18, 13, 18, 6).fill(shade);
  g.roundRect(12, -18, 13, 18, 6).fill(shade);
  g.ellipse(-4, -30, 36, 22).fill(fur).stroke(line(2.5));
  g.roundRect(-20, -16, 12, 16, 6).fill(fur).stroke(line(2));
  g.roundRect(22, -16, 12, 16, 6).fill(fur).stroke(line(2));
  g.poly([16, -62, 19, -92, 38, -70]).fill(fur).stroke(line(2.5));
  g.poly([34, -70, 53, -92, 56, -60]).fill(fur).stroke(line(2.5));
  g.circle(35, -54, 22).fill(fur).stroke(line(2.5));
  g.poly([21, -67, 22, -83, 31, -71]).fill(0x8a5aa8);
  g.poly([41, -71, 50, -84, 51, -65]).fill(0x8a5aa8);
  for (const ex of [27, 44]) {
    g.ellipse(ex, -56, 5.5, 6.5).fill(0xffd84a);
    g.ellipse(ex + 1, -56, 1.8, 5).fill(INK);
    g.circle(ex - 1.5, -58.5, 1.4).fill(0xffffff);
  }
  g.poly([33, -47, 39, -47, 36, -44]).fill(0xe88fb0);
  g.circle(31, -34, 5).fill(0xffd84a).stroke(line(1.5, 0xa07a1a));
  for (const [sx, sy] of [[-20, -38], [-6, -45], [8, -34], [-28, -28], [2, -23], [46, -64], [-14, -27]]) {
    g.star(sx, sy, 4, 2.4, 0.9).fill(0xfff1a8);
  }
  return g;
}

function drawOwl() {
  const g = new Graphics();
  const feather = 0x8b6845;
  const dark = 0x664a2f;
  const cream = 0xeedfbc;
  g.ellipse(-8, -3, 5, 3).fill(0xe8a33d);
  g.ellipse(8, -3, 5, 3).fill(0xe8a33d);
  g.ellipse(0, -32, 24, 30).fill(feather).stroke(line(2.5));
  g.ellipse(0, -26, 15, 20).fill(cream);
  for (const [cx, cy] of [[-6, -34], [6, -34], [0, -26], [-6, -18], [6, -18]]) {
    g.moveTo(cx - 3, cy).lineTo(cx, cy + 3).lineTo(cx + 3, cy).stroke(line(1.5, 0xb49468));
  }
  g.ellipse(-21, -30, 8, 20).fill(dark).stroke(line(2));
  g.ellipse(21, -30, 8, 20).fill(dark).stroke(line(2));
  g.poly([-17, -70, -23, -94, -6, -78]).fill(feather).stroke(line(2.5));
  g.poly([17, -70, 23, -94, 6, -78]).fill(feather).stroke(line(2.5));
  g.circle(0, -64, 21).fill(feather).stroke(line(2.5));
  for (const ex of [-8.5, 8.5]) {
    g.circle(ex, -64, 9.5).fill(cream);
    g.circle(ex, -64, 6).fill(0xffc53a);
    g.circle(ex, -64, 3.2).fill(INK);
    g.circle(ex - 1.6, -66, 1.3).fill(0xffffff);
  }
  g.poly([-3, -58, 3, -58, 0, -51]).fill(0xe8a33d);
  g.star(0, -80, 4, 3, 1.2).fill(0xfff1a8);
  return g;
}

function drawMossling() {
  const g = new Graphics();
  g.ellipse(-12, -3, 7, 4).fill(0x3d7d3e);
  g.ellipse(12, -3, 7, 4).fill(0x3d7d3e);
  g.ellipse(0, -22, 26, 21).fill(0x4f9a4c).stroke(line(2.5, 0x1d3a1f));
  g.circle(-10, -32, 7).fill(0x6fbe5f);
  g.circle(6, -36, 8).fill(0x6fbe5f);
  g.circle(16, -26, 5).fill(0x6fbe5f);
  g.moveTo(0, -42).quadraticCurveTo(2, -52, 6, -56).stroke(line(3, 0x3d7d3e));
  g.poly([6, -56, 18, -66, 26, -58, 12, -52]).fill(0x8fe07a).stroke(line(1.5, 0x1d3a1f));
  g.poly([4, -54, -8, -64, -14, -56, -2, -50]).fill(0x7fd06a).stroke(line(1.5, 0x1d3a1f));
  for (const ex of [-8, 9]) {
    g.circle(ex, -22, 4.2).fill(INK);
    g.circle(ex - 1.3, -23.5, 1.4).fill(0xffffff);
  }
  g.ellipse(-15, -15, 4, 2.5).fill({ color: 0xff9db0, alpha: 0.8 });
  g.ellipse(16, -15, 4, 2.5).fill({ color: 0xff9db0, alpha: 0.8 });
  g.moveTo(-2, -15).quadraticCurveTo(1, -12, 4, -15).stroke(line(1.5));
  g.circle(-14, -40, 3).fill(0xffe9f5);
  g.circle(-14, -40, 1.2).fill(0xffd84a);
  return g;
}

function drawDrakeBody() {
  const g = new Graphics();
  const scale = 0x2fb5a3;
  const belly = 0xf2e6b8;
  const tail = (w, c) => g.moveTo(-28, -22).bezierCurveTo(-56, -10, -72, -36, -94, -30).stroke(line(w, c));
  tail(11);
  tail(7, scale);
  g.poly([-94, -30, -106, -40, -104, -24]).fill(0x7fe8d8).stroke(line(1.5));
  g.roundRect(-16, -14, 8, 14, 4).fill(0x239484).stroke(line(1.5));
  g.roundRect(12, -14, 8, 14, 4).fill(0x239484).stroke(line(1.5));
  g.ellipse(-4, -24, 32, 17).fill(scale).stroke(line(2.5));
  g.ellipse(2, -17, 22, 8).fill(belly);
  g.poly([18, -34, 34, -58, 50, -52, 30, -22]).fill(scale);
  g.moveTo(18, -34).lineTo(34, -58).stroke(line(2.5));
  g.moveTo(50, -52).lineTo(30, -22).stroke(line(2.5));
  g.poly([30, -66, 22, -86, 38, -70]).fill(belly).stroke(line(1.5));
  g.poly([40, -68, 40, -88, 50, -70]).fill(belly).stroke(line(1.5));
  g.ellipse(44, -60, 17, 13).fill(scale).stroke(line(2.5));
  g.ellipse(58, -55, 11, 8).fill(scale).stroke(line(2));
  g.circle(64, -57, 1.5).fill(INK);
  g.ellipse(46, -63, 4.5, 5).fill(0xffe36b);
  g.ellipse(47, -63, 1.5, 4).fill(INK);
  for (const [sx, sy] of [[-24, -40], [-12, -42], [0, -42], [12, -40]]) {
    g.poly([sx - 5, sy + 2, sx, sy - 8, sx + 5, sy + 2]).fill(0x7fe8d8);
  }
  return g;
}

/** Wing pivot is at (0, 0) so it can flap around the shoulder. */
function drawDrakeWing() {
  const g = new Graphics();
  g.poly([0, 0, -10, -46, -34, -68, -40, -46, -60, -44, -46, -24, -58, -12, -24, -4])
    .fill({ color: 0x8ff0e0, alpha: 0.92 })
    .stroke(line(2.5, 0x1d6f66));
  g.moveTo(0, 0).lineTo(-34, -68).stroke(line(2, 0x1d6f66));
  g.moveTo(-4, -2).lineTo(-60, -44).stroke(line(1.5, 0x1d6f66));
  g.moveTo(-6, -2).lineTo(-58, -12).stroke(line(1.5, 0x1d6f66));
  return g;
}

function drawStag() {
  const g = new Graphics();
  const coat = 0xdcb68c;
  const dark = 0xb48c62;
  const cream = 0xf6ead4;
  g.roundRect(-36, -64, 9, 64, 4).fill(dark);
  g.roundRect(26, -64, 9, 64, 4).fill(dark);
  g.ellipse(-48, -88, 8, 7).fill(cream).stroke(line(2));
  g.ellipse(0, -76, 48, 25).fill(coat).stroke(line(2.5));
  g.roundRect(-26, -62, 10, 62, 4).fill(coat).stroke(line(2));
  g.roundRect(34, -62, 10, 62, 4).fill(coat).stroke(line(2));
  g.rect(-36, -6, 9, 6).fill(0x4a3424);
  g.rect(26, -6, 9, 6).fill(0x4a3424);
  g.rect(-26, -6, 10, 6).fill(0x4a3424);
  g.rect(34, -6, 10, 6).fill(0x4a3424);
  for (const [sx, sy, r] of [[-26, -84, 3.5], [-12, -90, 3], [4, -86, 3.5], [18, -92, 3], [-18, -72, 2.5], [10, -74, 2.5], [-34, -76, 2.5]]) {
    g.circle(sx, sy, r).fill(cream);
  }
  g.poly([26, -88, 42, -130, 62, -124, 48, -80]).fill(coat).stroke(line(2.5));
  g.ellipse(36, -98, 10, 6).fill(cream);
  g.poly([46, -136, 30, -150, 48, -142]).fill(dark).stroke(line(2));
  g.ellipse(58, -130, 18, 12).fill(coat).stroke(line(2.5));
  g.ellipse(75, -124, 10, 7.5).fill(cream).stroke(line(2));
  g.ellipse(83, -126, 3, 2.5).fill(INK);
  g.circle(60, -133, 3).fill(INK);
  g.circle(59, -134, 1).fill(0xffffff);
  const antler = 0xeadbc0;
  g.moveTo(54, -140).lineTo(46, -162).lineTo(34, -180).stroke(line(4.5, antler));
  g.moveTo(46, -162).lineTo(56, -178).stroke(line(4, antler));
  g.moveTo(62, -140).lineTo(72, -162).lineTo(84, -176).stroke(line(4.5, antler));
  g.moveTo(72, -162).lineTo(66, -180).stroke(line(4, antler));
  mushroomCap(g, 34, -180, 10, 0xf28cb4);
  mushroomCap(g, 56, -178, 7, 0xf6a8c8);
  mushroomCap(g, 84, -176, 11, 0xf28cb4);
  mushroomCap(g, 66, -180, 6, 0xf6a8c8);
  return g;
}

function drawBear() {
  const g = new Graphics();
  const fur = 0x6e4b33;
  const dark = 0x553724;
  const muzzle = 0xb08a64;
  g.roundRect(-58, -50, 26, 50, 10).fill(dark);
  g.roundRect(22, -50, 26, 50, 10).fill(dark);
  g.ellipse(-6, -70, 66, 46).fill(fur).stroke(line(3));
  g.roundRect(-44, -46, 28, 46, 11).fill(fur).stroke(line(2.5));
  g.roundRect(32, -46, 28, 46, 11).fill(fur).stroke(line(2.5));
  // moss blanket along the back
  for (let x = -62; x <= 36; x += 11) {
    const k = (x + 6) / 66;
    const top = -70 - 46 * Math.sqrt(Math.max(0, 1 - k * k));
    g.circle(x, top + 10, 12 + ((x * 7) % 5)).fill(x % 2 ? 0x5f9440 : 0x77ad4c);
  }
  for (const [fx, fy, c] of [[-44, -104, 0xffffff], [-20, -116, 0xf7a8cf], [6, -114, 0xffffff], [24, -104, 0xf7a8cf], [-56, -92, 0xfff1a8]]) {
    g.star(fx, fy, 5, 4, 1.8).fill(c);
    g.circle(fx, fy, 1.2).fill(0xffd84a);
  }
  mushroomCap(g, -32, -110, 7, 0xd96a5a);
  g.circle(56, -118, 11).fill(fur).stroke(line(2.5));
  g.circle(56, -118, 5).fill(muzzle);
  g.circle(66, -92, 30).fill(fur).stroke(line(3));
  g.ellipse(92, -84, 15, 11).fill(muzzle).stroke(line(2.5));
  g.ellipse(103, -88, 5, 4).fill(INK);
  g.circle(74, -100, 3.4).fill(INK);
  g.circle(73, -101, 1.1).fill(0xffffff);
  return g;
}

/** Wyrm head is centred on (0, 0) because it rotates along its flight path. */
function drawWyrmHead() {
  const g = new Graphics();
  const body = 0x9d7bff;
  const light = 0xe2d6ff;
  g.poly([-14, -8, -46, -26, -24, -2, -48, 8, -16, 8]).fill({ color: 0x6e4fd8, alpha: 0.9 });
  g.poly([2, -12, -22, -40, 12, -18]).fill(light).stroke(line(1.5, 0x4a2fa8));
  g.ellipse(0, 0, 26, 17).fill(body).stroke(line(2, 0x4a2fa8));
  g.ellipse(26, 5, 19, 10).fill(body).stroke(line(2, 0x4a2fa8));
  g.moveTo(14, 10).lineTo(42, 10).stroke(line(1.5, 0x4a2fa8));
  g.ellipse(8, -5, 6, 4).fill(0xfff6a8);
  g.ellipse(9, -5, 2, 3.4).fill(0x4a2fa8);
  g.moveTo(40, 2).bezierCurveTo(54, -6, 62, 6, 76, -2).stroke(line(2, light));
  g.moveTo(38, 10).bezierCurveTo(52, 18, 62, 10, 74, 18).stroke(line(2, light));
  return g;
}

function drawWyrmSegment() {
  const g = new Graphics();
  g.poly([-8, -12, 0, -26, 8, -12]).fill({ color: 0x6e4fd8, alpha: 0.9 });
  g.circle(0, 0, 15).fill(0x9d7bff).stroke(line(1.5, 0x4a2fa8));
  g.circle(-2, -3, 8).fill({ color: 0xe2d6ff, alpha: 0.6 });
  return g;
}

const DRAWERS = {
  moonpaw_cat: drawCat,
  starlit_owl: drawOwl,
  mossling: drawMossling,
  flutterdrake: drawDrakeBody,
  spirit_stag: drawStag,
  mossback_bear: drawBear,
  astral_wyrm: drawWyrmHead,
};

function bake(renderer, g, height) {
  const b = g.getLocalBounds();
  const texture = renderer.generateTexture({ target: g, resolution: 3, antialias: true });
  g.destroy();
  return {
    texture,
    ax: -b.x / b.width,
    ay: -b.y / b.height,
    scale: height ? height / b.height : 1,
    png: false,
  };
}

/** Builds one "look" per creature: the PNG if it exists, otherwise baked placeholder art. */
export function buildLooks(renderer, art) {
  const looks = {};
  for (const def of FAMILIARS) {
    const tex = art[`creatures/${def.id}`];
    if (tex) {
      looks[def.id] = { texture: tex, ax: 0.5, ay: def.behavior === 'wyrm' ? 0.5 : 1, scale: (def.pngHeight || def.height) / tex.height, png: true };
    } else {
      looks[def.id] = bake(renderer, DRAWERS[def.id](), def.height);
    }
  }
  const drake = looks.flutterdrake;
  looks.drakeWing = bake(renderer, drawDrakeWing(), null);
  looks.drakeWing.scale = drake.scale;
  looks.wyrmSegment = bake(renderer, drawWyrmSegment(), null);
  looks.wyrmSegment.scale = looks.astral_wyrm.scale;
  return looks;
}

export function lookSprite(look) {
  const s = new Sprite(look.texture);
  s.anchor.set(look.ax, look.ay);
  s.scale.set(look.scale);
  return s;
}

/** A display object used to render the UI icon for a creature. */
export function iconDisplay(looks, id) {
  const c = new Container();
  if (id === 'flutterdrake' && !looks.flutterdrake.png) {
    const w = lookSprite(looks.drakeWing);
    w.position.set(-2 * looks.flutterdrake.scale, -36 * looks.flutterdrake.scale);
    c.addChild(w);
  }
  c.addChild(lookSprite(looks[id]));
  return c;
}

// ---------------------------------------------------------------------------

const WALK_X = [70, 1030];

export class Creature {
  constructor(scene, def, rarity) {
    this.scene = scene;
    this.def = def;
    this.rarity = rarity;
    this.seed = Math.random() * 1000;
    this.boost = 1;
    this.slot = 0;
    this.fade = 0;

    const looks = scene.looks;
    this.look = looks[def.id];
    this.kind = def.behavior === 'wyrm' && this.look.png ? 'fly' : def.behavior;

    this.root = new Container();
    this.root.alpha = 0;
    this.body = new Container();
    this.root.addChild(this.body);

    const auraSize = (this.kind === 'wyrm' ? 60 : (this.look.png && def.pngHeight) || def.height) * 2;
    if (rarity > 0) {
      this.aura = new Sprite(scene.glowTex);
      this.aura.anchor.set(0.5);
      this.aura.tint = RARITIES[rarity].color;
      this.aura.blendMode = 'add';
      this.aura.width = this.aura.height = auraSize * (1 + rarity * 0.15);
      this.auraY = this.kind === 'wyrm' || this.look.ay === 0.5 ? 0 : -def.height * 0.5;
      this.aura.y = this.auraY;
    }

    if (this.kind === 'wyrm') {
      this.buildWyrm(looks);
    } else {
      if (this.aura) this.body.addChild(this.aura);
      if (this.kind === 'fly' && !this.look.png) {
        const s = this.look.scale;
        this.wingBack = lookSprite(looks.drakeWing);
        this.wingBack.tint = 0x7aa8b8;
        this.wingBack.position.set(-10 * s, -38 * s);
        this.wingBack.rotation = -0.25;
        this.body.addChild(this.wingBack);
      }
      this.sprite = lookSprite(this.look);
      this.body.addChild(this.sprite);
      if (this.kind === 'fly' && !this.look.png) {
        const s = this.look.scale;
        this.wingFront = lookSprite(looks.drakeWing);
        this.wingFront.position.set(-2 * s, -36 * s);
        this.body.addChild(this.wingFront);
      }
    }
    this.place();
  }

  buildWyrm(looks) {
    this.segments = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
      const k = 1 - i / count;
      const glow = new Sprite(this.scene.glowTex);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = this.rarity > 0 ? RARITIES[this.rarity].color : 0xa98bff;
      glow.width = glow.height = 70 * k + 20;
      glow.alpha = 0.45;
      const seg = lookSprite(looks.wyrmSegment);
      seg.scale.set(looks.wyrmSegment.scale * (0.35 + 0.75 * k));
      this.segments.push({ x: 0, y: 0, glow, seg });
    }
    for (let i = count - 1; i >= 0; i--) this.root.addChild(this.segments[i].glow);
    for (let i = count - 1; i >= 0; i--) this.root.addChild(this.segments[i].seg);
    this.head = lookSprite(this.look);
    this.root.addChild(this.head);
  }

  get height() {
    return (this.look.png && this.def.pngHeight) || this.def.height;
  }

  place() {
    const d = this.def;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.moving = Math.random() < 0.6;
    this.timer = rand(0.5, 4);
    this.offY = 0;
    this.phase = rand(0, Math.PI * 2);
    switch (this.kind) {
      case 'walk':
        this.y = d.id === 'spirit_stag' ? rand(828, 880) : rand(842, 955);
        this.x = rand(...WALK_X);
        break;
      case 'hop':
        this.y = rand(845, 960);
        this.x = rand(...WALK_X);
        break;
      case 'roam':
        this.y = rand(835, 900);
        this.x = rand(...WALK_X);
        break;
      case 'perch':
        this.x = 0;
        this.y = 0;
        break;
      case 'fly':
        this.cx = rand(360, 860);
        this.cy = rand(230, 420);
        this.rx = rand(200, 380);
        this.ry = rand(50, 110);
        this.spd = rand(0.3, 0.55) * (this.def.behavior === 'wyrm' ? 0.4 : 1);
        this.flyPos(0);
        break;
      case 'wyrm':
        this.cy = rand(190, 290);
        this.flyPos(0);
        for (const s of this.segments) {
          s.x = this.x;
          s.y = this.y;
        }
        break;
    }
  }

  flyPos(dt) {
    this.phase += dt * (this.kind === 'wyrm' ? 0.22 : this.spd);
    const p = this.phase;
    let nx;
    let ny;
    if (this.kind === 'wyrm') {
      nx = 760 + Math.cos(p) * 520;
      ny = this.cy + Math.sin(p * 2) * 80 + Math.sin(p * 0.37 + this.seed) * 40;
    } else {
      nx = this.cx + Math.cos(p) * this.rx;
      ny = this.cy + Math.sin(p * 2) * this.ry;
    }
    if (this.x !== undefined && Math.abs(nx - this.x) > 0.01) this.dir = nx > this.x ? 1 : -1;
    this.vx = nx - (this.x ?? nx);
    this.vy = ny - (this.y ?? ny);
    this.x = nx;
    this.y = ny;
  }

  /** Walk-around behaviour shared by cats, mosslings, stags and bears. */
  wander(dt, walkTime, idleTime) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.moving = !this.moving;
      this.timer = this.moving ? rand(...walkTime) : rand(...idleTime);
      if (this.moving && Math.random() < 0.5) this.dir *= -1;
    }
    if (!this.moving) return false;
    this.x += this.dir * this.def.speed * dt;
    if (this.x < WALK_X[0]) {
      this.x = WALK_X[0];
      this.dir = 1;
    } else if (this.x > WALK_X[1]) {
      this.x = WALK_X[1];
      this.dir = -1;
    }
    return true;
  }

  update(dt, t) {
    this.fade = Math.min(1, this.fade + dt * 1.5);
    this.root.alpha = this.fade;
    let depth = 1;
    let squash = 1;
    this.offY = 0;

    switch (this.kind) {
      case 'walk': {
        if (this.wander(dt, [2, 6], [1.5, 4])) this.offY = -Math.abs(Math.sin(t * 9 + this.seed)) * 2.5;
        depth = 0.8 + ((this.y - 820) / 140) * 0.3;
        break;
      }
      case 'hop': {
        if (this.wander(dt, [1.5, 4], [1, 3])) {
          this.phase += dt * 7;
          this.offY = -Math.abs(Math.sin(this.phase)) * 18;
          squash = 1 + Math.max(0, 0.15 - Math.abs(Math.sin(this.phase))) * 1.5;
        }
        depth = 0.8 + ((this.y - 820) / 140) * 0.3;
        break;
      }
      case 'roam': {
        if (this.wander(dt, [3, 6], [4, 9])) this.offY = -Math.abs(Math.sin(t * 4 + this.seed)) * 2;
        depth = 0.8 + ((this.y - 820) / 140) * 0.3;
        break;
      }
      case 'perch': {
        const p = this.scene.perchPoint(this.slot);
        this.x = p.x;
        this.y = p.y;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = rand(3, 8);
          if (Math.random() < 0.4) this.dir *= -1;
        }
        this.body.rotation = Math.sin(t * 0.8 + this.seed) * 0.06;
        depth = this.scene.treeScale;
        break;
      }
      case 'fly': {
        this.flyPos(dt);
        this.offY = Math.sin(t * 6 + this.seed) * 4;
        if (this.wingFront) {
          const flap = Math.cos(t * 10 + this.seed);
          const s = this.look.scale;
          this.wingFront.scale.y = s * (flap > 0 ? flap : flap * 0.5);
          this.wingBack.scale.y = s * (0.6 + 0.4 * flap);
        }
        break;
      }
      case 'wyrm': {
        this.updateWyrm(dt, t);
        return;
      }
    }

    this.root.position.set(this.x, this.y + this.offY);
    this.root.zIndex = this.kind === 'fly' ? 5000 + this.y : this.y;
    const s = depth * this.boost;
    this.root.scale.set(s);
    this.body.scale.set(this.dir, 1 / squash);
    this.body.scale.x *= squash;
    if (this.aura) this.aura.alpha = 0.35 + Math.sin(t * 2.5 + this.seed) * 0.15;
    this.maybeSparkle(dt, this.x, this.y + this.offY - this.height * s * 0.5);
  }

  updateWyrm(dt, t) {
    this.flyPos(dt);
    const head = this.head;
    head.position.set(this.x, this.y);
    const angle = Math.atan2(this.vy, this.vx);
    head.rotation = angle;
    head.scale.y = Math.abs(head.scale.y) * (Math.cos(angle) < 0 ? -1 : 1);
    head.scale.x = Math.abs(head.scale.x);
    const gap = 15 * this.look.scale * this.boost;
    let px = this.x;
    let py = this.y;
    let prevAngle = angle;
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      const dx = s.x - px;
      const dy = s.y - py;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > gap) {
        s.x = px + (dx / dist) * gap;
        s.y = py + (dy / dist) * gap;
      }
      const a = Math.atan2(py - s.y, px - s.x) || prevAngle;
      prevAngle = a;
      s.seg.position.set(s.x, s.y);
      s.seg.rotation = a;
      s.glow.position.set(s.x, s.y);
      s.glow.alpha = 0.3 + 0.2 * Math.sin(t * 3 - i * 0.4);
      px = s.x;
      py = s.y;
    }
    this.maybeSparkle(dt, this.x, this.y);
  }

  maybeSparkle(dt, x, y) {
    if (this.rarity < 2 || this.fade < 1) return;
    if (Math.random() < dt * this.rarity * 0.8) {
      this.scene.sparkle(x + rand(-25, 25), y + rand(-25, 25), RARITIES[this.rarity].color);
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
