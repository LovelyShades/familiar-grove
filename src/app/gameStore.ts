import { useEffect, useSyncExternalStore } from 'react';
import { GameStore, type GameEvent } from '../game/store';
import type { GameState } from '../game/state';

/** The one game store for the whole app. */
export const store = new GameStore();

/** Re-renders when game state changes (about 10 times a second while producing). */
export function useGameState(): GameState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Runs `handler` for every game event while the component is mounted. */
export function useGameEvents(handler: (e: GameEvent) => void, deps: unknown[] = []): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => store.on(handler), deps);
}
