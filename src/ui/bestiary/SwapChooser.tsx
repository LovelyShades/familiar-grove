import { useEffect, useRef } from 'react';
import { store, useGameState } from '../../app/gameStore';
import { appearanceOf, type Variant } from '../../game/registry';
import { Portrait } from '../Portrait';

interface Props {
  species: string;
  variant: Variant;
  onDone: () => void;
}

/**
 * Inline "which familiar should leave?" picker, shown when the grove is full.
 * Esc cancels it without closing the surrounding modal.
 */
export function SwapChooser({ species, variant, onDone }: Props) {
  const state = useGameState();
  const first = useRef<HTMLButtonElement>(null);
  const incoming = appearanceOf(species, variant);

  useEffect(() => {
    first.current?.focus();
  }, []);

  return (
    <div
      className="swap-chooser"
      role="group"
      aria-label={`Choose a familiar to swap out for ${incoming.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          onDone();
        }
      }}
    >
      <p className="swap-title">Swap {incoming.name} in for…</p>
      <div className="swap-options">
        {state.displayed.map((d, i) => {
          const look = appearanceOf(d.species, d.variant);
          return (
            <button
              key={`${d.species}-${d.variant}`}
              ref={i === 0 ? first : undefined}
              type="button"
              className={`swap-option${d.variant === 'mutation' ? ' is-mutation' : ''}`}
              onClick={() => {
                store.swapDisplayed(i, { species, variant });
                onDone();
              }}
              aria-label={`Replace ${look.name}`}
              title={`Replace ${look.name}`}
            >
              <Portrait id={look.asset} />
              <span>{look.name}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="swap-cancel" onClick={onDone}>
        Cancel
      </button>
    </div>
  );
}
