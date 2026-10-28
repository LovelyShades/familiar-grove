// Audio interface used by the rest of the game. Callers only use these names;
// the synthesis lives in engine.ts, sounds.ts and ambience.ts.

import type { AudioSettings } from '../game/state';
import { Ambience } from './ambience';
import { AudioEngine } from './engine';
import * as sfx from './sounds';

export type SoundName =
  | 'click'          // tapping the Heartwood
  | 'purchase'       // buying an upgrade
  | 'denied'         // trying something unaffordable
  | 'summonStart'    // portal opens
  | 'summonReveal'   // normal familiar revealed
  | 'rareReveal'     // rare mutation revealed
  | 'levelUp'        // grove level up
  | 'uiOpen'         // modal open
  | 'uiClose'        // modal close
  | 'uiHover';       // soft hover tick (use sparingly)

export interface GroveAudio {
  /** Call from a user gesture; browsers block audio until then. Safe to call repeatedly. */
  unlock(): void;
  play(name: SoundName, opts?: { intensity?: number }): void;
  applySettings(settings: AudioSettings): void;
  /** Starts/stops the ambient forest bed (respects volume/mute). */
  setAmbience(on: boolean): void;
}

const engine = new AudioEngine();
let ambience: Ambience | null = null;
let ambienceWanted = false;

function syncAmbience(): void {
  const b = engine.buses();
  if (!b) return;
  if (ambienceWanted) {
    ambience ??= new Ambience(b);
    ambience.start();
  } else {
    ambience?.stop();
  }
}

export const audio: GroveAudio & {
  /** Short blip for previewing the effects volume in Options. */
  preview(): void;
} = {
  unlock() {
    if (engine.unlock()) syncAmbience();
  },

  play(name, opts) {
    const b = engine.buses();
    if (!b || !engine.running || !engine.effectsAudible) return;
    const i = opts?.intensity ?? 1;
    try {
      switch (name) {
        case 'click': sfx.click(b, i); break;
        case 'purchase': sfx.purchase(b, i); break;
        case 'denied': sfx.denied(b); break;
        case 'summonStart': sfx.summonStart(b, i); break;
        case 'summonReveal': sfx.summonReveal(b, i); break;
        case 'rareReveal': sfx.rareReveal(b, i); break;
        case 'levelUp': sfx.levelUp(b, i); break;
        case 'uiOpen': sfx.swish(b, true); break;
        case 'uiClose': sfx.swish(b, false); break;
        case 'uiHover': sfx.hover(b); break;
      }
    } catch { /* never let a sound break the game */ }
  },

  applySettings(settings) {
    engine.applySettings(settings);
  },

  setAmbience(on) {
    ambienceWanted = on;
    syncAmbience();
  },

  preview() {
    const b = engine.buses();
    if (b && engine.running) sfx.preview(b);
  },
};
