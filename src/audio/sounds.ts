// Synthesized sound effects: soft glass chimes, music-box plucks and airy swells.

import type { Buses } from './engine';

/** D major pentatonic across two octaves: calm and never dissonant. */
const PENTATONIC = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98, 1760.0];

interface ToneOpts {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain: number;
  attack?: number;
  /** Detuned twin for a soft chorus/shimmer (cents). */
  shimmer?: number;
  /** Optional lowpass cutoff. */
  cutoff?: number;
  dest?: AudioNode;
}

/** One enveloped voice. Nodes disconnect themselves when finished. Returns the end time. */
export function tone(b: Buses, o: ToneOpts): number {
  const { ctx } = b;
  const attack = o.attack ?? 0.008;
  const end = o.start + o.duration;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, o.start);
  env.gain.linearRampToValueAtTime(o.gain, o.start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  let out: AudioNode = env;
  if (o.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.cutoff;
    env.connect(f);
    out = f;
  }
  out.connect(o.dest ?? b.effects);

  const oscs: OscillatorNode[] = [];
  const make = (detune: number, level: number) => {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.value = o.freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(env);
    osc.start(o.start);
    osc.stop(end + 0.05);
    oscs.push(osc);
  };
  make(0, 1);
  if (o.shimmer) make(o.shimmer, 0.45);
  oscs[0].onended = () => {
    env.disconnect();
    out.disconnect();
  };
  return end;
}

/** Filtered noise burst (breaths, swishes, wind). */
export function noiseBurst(
  b: Buses,
  o: { start: number; duration: number; gain: number; from: number; to: number; q?: number; attack?: number; dest?: AudioNode },
): void {
  const { ctx } = b;
  const src = ctx.createBufferSource();
  src.buffer = b.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = o.q ?? 1.2;
  filter.frequency.setValueAtTime(o.from, o.start);
  filter.frequency.exponentialRampToValueAtTime(o.to, o.start + o.duration);
  const env = ctx.createGain();
  const attack = o.attack ?? o.duration * 0.4;
  env.gain.setValueAtTime(0, o.start);
  env.gain.linearRampToValueAtTime(o.gain, o.start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.duration);
  src.connect(filter).connect(env).connect(o.dest ?? b.effects);
  src.start(o.start, Math.random() * 1.5);
  src.stop(o.start + o.duration + 0.05);
  src.onended = () => env.disconnect();
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// ------------------------------------------------------------------ effects

let activeClicks = 0;
let lastClick = 0;
let spam = 0;

export function click(b: Buses, intensity = 1): void {
  const now = b.ctx.currentTime;
  if (now - lastClick < 0.035 || activeClicks >= 4) return;
  // gently quieter when clicking very fast
  spam = now - lastClick < 0.18 ? Math.min(spam + 1, 8) : Math.max(0, spam - 2);
  lastClick = now;
  const level = 0.16 * intensity * (1 - spam * 0.06);
  const freq = pick(PENTATONIC.slice(2));
  activeClicks++;
  const end = tone(b, { freq, start: now, duration: 0.32, type: 'triangle', gain: level, shimmer: 7, cutoff: 5200 });
  tone(b, { freq: freq * 2, start: now, duration: 0.14, gain: level * 0.25 });
  window.setTimeout(() => activeClicks--, (end - now) * 1000);
}

export function purchase(b: Buses, intensity = 1): void {
  const t = b.ctx.currentTime;
  [880, 1108.73, 1318.51].forEach((f, i) => {
    tone(b, { freq: f, start: t + i * 0.075, duration: 0.55, type: 'triangle', gain: 0.13 * intensity, shimmer: 6, cutoff: 6000 });
  });
}

export function denied(b: Buses): void {
  const t = b.ctx.currentTime;
  tone(b, { freq: 196, start: t, duration: 0.22, type: 'sine', gain: 0.08, cutoff: 600, attack: 0.02 });
}

export function summonStart(b: Buses, intensity = 1): void {
  const t = b.ctx.currentTime;
  noiseBurst(b, { start: t, duration: 1.6, gain: 0.09 * intensity, from: 400, to: 5200, q: 2.5, attack: 1.2 });
  for (const [f, d] of [[293.66, 0], [440, 3], [587.33, -4]] as const) {
    tone(b, { freq: f, start: t, duration: 1.7, type: 'sine', gain: 0.05 * intensity, attack: 1.1, shimmer: d + 5 });
  }
  // rising sparkle
  [880, 987.77, 1174.66, 1318.51, 1479.98].forEach((f, i) => {
    tone(b, { freq: f, start: t + 0.6 + i * 0.16, duration: 0.4, gain: 0.03 * intensity });
  });
}

function bell(b: Buses, freq: number, start: number, gain: number, duration = 2.2): void {
  // inharmonic partials give a soft glass-bell colour
  tone(b, { freq, start, duration, gain, shimmer: 4 });
  tone(b, { freq: freq * 2.76, start, duration: duration * 0.5, gain: gain * 0.28 });
  tone(b, { freq: freq * 5.4, start, duration: duration * 0.25, gain: gain * 0.1 });
}

export function summonReveal(b: Buses, intensity = 1): void {
  const t = b.ctx.currentTime;
  [587.33, 739.99, 880].forEach((f, i) => bell(b, f, t + i * 0.03, 0.085 * intensity));
  noiseBurst(b, { start: t, duration: 0.6, gain: 0.03 * intensity, from: 6000, to: 2500, q: 0.8, attack: 0.02 });
}

export function rareReveal(b: Buses, intensity = 1): void {
  const t = b.ctx.currentTime;
  // soft bloom
  for (const f of [146.83, 220, 293.66]) {
    tone(b, { freq: f, start: t, duration: 3.6, gain: 0.05 * intensity, attack: 0.7, shimmer: 6, cutoff: 1800 });
  }
  [587.33, 739.99, 880, 1108.73].forEach((f, i) => bell(b, f, t + 0.05 + i * 0.05, 0.075 * intensity, 3));
  // sparkling high arpeggio
  [1760, 1975.53, 2349.32, 2637.02, 2959.96, 3520].forEach((f, i) => {
    tone(b, { freq: f, start: t + 0.35 + i * 0.09, duration: 0.6, gain: 0.03 * intensity, shimmer: 9 });
  });
}

export function levelUp(b: Buses, intensity = 1): void {
  const t = b.ctx.currentTime;
  [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
    tone(b, { freq: f, start: t + i * 0.11, duration: 0.9, type: 'triangle', gain: 0.1 * intensity, shimmer: 6, cutoff: 5000 });
  });
}

export function swish(b: Buses, opening: boolean): void {
  const t = b.ctx.currentTime;
  noiseBurst(b, { start: t, duration: 0.28, gain: 0.035, from: opening ? 900 : 3200, to: opening ? 3200 : 900, q: 0.9, attack: 0.1 });
}

let lastHover = 0;
export function hover(b: Buses): void {
  const t = b.ctx.currentTime;
  if (t - lastHover < 0.08) return;
  lastHover = t;
  tone(b, { freq: 2349.32, start: t, duration: 0.05, gain: 0.012 });
}

/** Short soft blip used to preview the effects volume. */
export function preview(b: Buses): void {
  const t = b.ctx.currentTime;
  tone(b, { freq: 1174.66, start: t, duration: 0.25, type: 'triangle', gain: 0.1, shimmer: 6 });
}
