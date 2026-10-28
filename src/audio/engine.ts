// Familiar Grove audio engine. Everything is synthesized with the Web Audio API:
// no audio files are downloaded or shipped.
//
// Graph:  voices -> effects bus --\
//         ambience -> ambience bus -+-> master gain -> compressor -> speakers

import type { AudioSettings } from '../game/state';

export interface Buses {
  ctx: AudioContext;
  effects: GainNode;
  ambience: GainNode;
  /** Shared white-noise buffer for breathy sounds. */
  noise: AudioBuffer;
}

const RAMP = 0.08;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambience: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: AudioSettings = { master: 0.7, ambience: 0.5, effects: 0.7, muted: false };
  private failed = false;

  /** Creates (or resumes) the AudioContext. Must be called from a user gesture. */
  unlock(): Buses | null {
    if (this.failed) return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error('Web Audio unavailable');
        const ctx = new Ctor();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.25;
        compressor.connect(ctx.destination);

        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(compressor);
        this.effects = ctx.createGain();
        this.effects.connect(this.master);
        this.ambience = ctx.createGain();
        this.ambience.connect(this.master);

        const len = ctx.sampleRate * 2;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        this.ctx = ctx;
        this.applySettings(this.settings);
      } catch {
        this.failed = true;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.buses();
  }

  /** Buses if audio is unlocked and running, otherwise null. */
  buses(): Buses | null {
    if (!this.ctx || !this.effects || !this.ambience || !this.noise) return null;
    return { ctx: this.ctx, effects: this.effects, ambience: this.ambience, noise: this.noise };
  }

  get running(): boolean {
    // 'suspended' right after unlock still counts: sounds queue up and play once resume() completes
    return !!this.ctx && this.ctx.state !== 'closed';
  }

  applySettings(s: AudioSettings): void {
    this.settings = { ...s };
    if (!this.ctx || !this.master || !this.effects || !this.ambience) return;
    const t = this.ctx.currentTime;
    const ramp = (param: AudioParam, value: number) => {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(value, t + RAMP);
    };
    // perceptual curve: slider 50% is noticeably quieter than 100%
    const curve = (v: number) => Math.max(0, Math.min(1, v)) ** 1.6;
    ramp(this.master.gain, s.muted ? 0 : curve(s.master));
    ramp(this.effects.gain, curve(s.effects));
    ramp(this.ambience.gain, curve(s.ambience));
  }

  get effectsAudible(): boolean {
    return !this.settings.muted && this.settings.master > 0 && this.settings.effects > 0;
  }
}
