// Generative forest-night ambience: a soft detuned pad, faint wind through
// leaves, distant glass chimes and the occasional cricket. Continuous nodes are
// created once; short events are scheduled a little ahead and clean themselves up.

import type { Buses } from './engine';
import { noiseBurst, tone } from './sounds';

const CHIME_NOTES = [587.33, 659.25, 739.99, 880, 987.77, 1174.66];

export class Ambience {
  private bed: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private timers: number[] = [];
  private on = false;

  constructor(private b: Buses) {}

  start(): void {
    if (this.on) return;
    this.on = true;
    const { ctx, ambience } = this.b;
    const t = ctx.currentTime;

    this.bed = ctx.createGain();
    this.bed.gain.setValueAtTime(0, t);
    this.bed.gain.linearRampToValueAtTime(1, t + 4);
    this.bed.connect(ambience);

    // pad: D minor-ish open fifths, slowly breathing through a lowpass
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 650;
    padFilter.Q.value = 0.6;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    padFilter.connect(padGain).connect(this.bed);
    for (const [freq, detune] of [[73.42, -5], [110, 4], [146.83, -3], [220, 6]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      osc.connect(g).connect(padFilter);
      osc.start();
      this.nodes.push(osc);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(padFilter.frequency);
    lfo.start();
    this.nodes.push(lfo);

    // wind: looping noise through a slowly wandering bandpass
    const wind = ctx.createBufferSource();
    wind.buffer = this.b.noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.018;
    wind.connect(windFilter).connect(windGain).connect(this.bed);
    wind.start();
    this.nodes.push(wind);
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.08;
    const windDepth = ctx.createGain();
    windDepth.gain.value = 350;
    windLfo.connect(windDepth).connect(windFilter.frequency);
    windLfo.start();
    this.nodes.push(windLfo);

    this.scheduleChime(3000);
    this.scheduleCricket(5000);
  }

  stop(): void {
    if (!this.on) return;
    this.on = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    const bed = this.bed;
    const nodes = this.nodes;
    this.bed = null;
    this.nodes = [];
    if (!bed) return;
    const t = this.b.ctx.currentTime;
    bed.gain.cancelScheduledValues(t);
    bed.gain.setValueAtTime(bed.gain.value, t);
    bed.gain.linearRampToValueAtTime(0, t + 1.5);
    window.setTimeout(() => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch { /* already stopped */ }
        n.disconnect();
      }
      bed.disconnect();
    }, 1700);
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== id);
      if (this.on) fn();
    }, ms);
    this.timers.push(id);
  }

  /** Distant chimes every 6-15 seconds (skipped while the tab is hidden). */
  private scheduleChime(delay: number): void {
    this.later(delay, () => {
      if (!document.hidden && this.bed) {
        const t = this.b.ctx.currentTime;
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const f = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
          tone(this.b, { freq: f, start: t + i * (0.25 + Math.random() * 0.3), duration: 2.4, gain: 0.03, shimmer: 5, dest: this.bed });
        }
      }
      this.scheduleChime(6000 + Math.random() * 9000);
    });
  }

  /** Very soft cricket-like pulses now and then. */
  private scheduleCricket(delay: number): void {
    this.later(delay, () => {
      if (!document.hidden && this.bed) {
        const t = this.b.ctx.currentTime;
        const pulses = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < pulses; i++) {
          noiseBurst(this.b, { start: t + i * 0.09, duration: 0.05, gain: 0.006, from: 4200, to: 4400, q: 12, attack: 0.01, dest: this.bed });
        }
      }
      this.scheduleCricket(4000 + Math.random() * 8000);
    });
  }
}
