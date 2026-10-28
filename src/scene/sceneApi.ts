// The contract between the app and the PixiJS scene. GroveScene implements it.

import type { DisplayedFamiliar } from '../game/state';
import type { UpgradeId } from '../game/config';

/** A rectangle in CSS pixels, relative to the scene host element. */
export interface HostRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroveSceneApi {
  mount(host: HTMLElement): Promise<void>;
  destroy(): void;
  /** Show these familiars in the grove (already validated and capped by the store). */
  setFamiliars(list: DisplayedFamiliar[]): void;
  /** Reports where the clickable Heartwood area is on screen; called again on every resize. */
  onTreeRect(cb: (rect: HostRect) => void): void;
  /** Visual response to a Heartwood click at host coordinates. */
  clickFeedback(x: number, y: number, amount: number): void;
  /** Where Aether particles should fly to (the counter), in host coordinates. */
  setCounterTarget(x: number, y: number): void;
  setTheme(theme: 'dark' | 'light'): void;
  setReducedMotion(on: boolean): void;
  /** Turn pointer parallax on/off (reduced motion also disables it). */
  setParallax(on: boolean): void;
  /** A familiar was just summoned and placed in the grove. */
  celebrateArrival(familiar: DisplayedFamiliar): void;

  /** Short environmental flourish after buying an upgrade (bigger on milestone levels). */
  playUpgradeEffect(id: UpgradeId, info: { levelsBought: number; newLevel: number; milestone: boolean }): void;
  /** Softly highlight one active familiar in the grove (null clears). */
  highlightFamiliar(species: string | null): void;
  /**
   * Pointer hover/tap on a familiar in the scene: called with the familiar and an
   * anchor point above it (host CSS px), or null when the pointer leaves.
   */
  onFamiliarPointer(cb: (hit: { familiar: DisplayedFamiliar; x: number; y: number; pinned: boolean } | null) => void): void;
}
