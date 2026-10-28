// Tiny UI-only event channel (not game state): lets any panel ask the scene to
// highlight a familiar, e.g. while hovering its Bestiary entry or sidebar tile.

type Listener = (species: string | null) => void;
const listeners = new Set<Listener>();

export const uiEvents = {
  highlightFamiliar(species: string | null): void {
    for (const l of listeners) l(species);
  },
  onHighlight(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
