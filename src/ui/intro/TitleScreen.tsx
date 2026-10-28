import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../../scene/assets';
import { formatNumber } from '../../game/format';
import type { GameState } from '../../game/state';
import './intro.css';

interface Props {
  state: GameState;
  /** Begin playing (also the moment audio may start). */
  onStart: () => void;
  /** Start, then replay the guided tour. */
  onHowToPlay: () => void;
}

const TITLE = 'Familiar Grove';

/**
 * The opening scene: the grove waits behind frosted glass while the title
 * gathers out of drifting light. Pressing Start clears the frost and drifts
 * the menu away into the forest.
 */
export function TitleScreen({ state, onStart, onHowToPlay }: Props) {
  const [leaving, setLeaving] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const returning = state.lifetimeAether > 0 || state.clicks > 0;
  const found = Object.values(state.collection).reduce((n, c) => n + (c.base > 0 ? 1 : 0) + (c.mutation > 0 ? 1 : 0), 0);

  useEffect(() => {
    // focus the main button once it has faded in, so Enter / Space starts the game
    const t = window.setTimeout(() => startRef.current?.focus(), 1400);
    return () => clearTimeout(t);
  }, []);

  const leave = (then: () => void) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(then, 900);
  };

  return (
    <div className={`title-screen${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Familiar Grove title screen">
      <div className="title-frost" aria-hidden="true" />
      <div className="title-motes" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i * 0.71) % 6}s`,
              animationDuration: `${7 + ((i * 13) % 6)}s`,
              ['--drift' as string]: `${((i * 29) % 60) - 30}px`,
            }}
          />
        ))}
      </div>

      <div className="title-card">
        <img className="title-crystal" src={assetUrl('ui.aether')} alt="" draggable={false} />
        <h1 className="title-logo" aria-label={TITLE}>
          {TITLE.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.25 + i * 0.05}s` }} aria-hidden="true">
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        <div className="title-rule" aria-hidden="true" />
        <p className="title-tagline">Tend the Heartwood. Gather Aether. Call mythical familiars.</p>

        {returning && (
          <p className="title-progress">
            Welcome back · {formatNumber(state.lifetimeAether)} lifetime Aether · {found} familiars found
          </p>
        )}

        <div className="title-buttons">
          <button ref={startRef} className="title-start" type="button" onClick={() => leave(onStart)}>
            {returning ? 'Continue' : 'Begin Your Grove'}
          </button>
          <button className="title-secondary" type="button" onClick={() => leave(onHowToPlay)}>
            How to Play
          </button>
        </div>
      </div>

      <p className="title-footnote">Progress saves automatically</p>
    </div>
  );
}
