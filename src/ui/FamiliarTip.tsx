import { useEffect } from 'react';
import type { DisplayedFamiliar, GameState } from '../game/state';
import { SPECIES_BY_ID, SPECIES_RARITY, appearanceOf } from '../game/registry';
import { bondLevel, mutationChance } from '../game/summoning';

interface Props {
  tip: { familiar: DisplayedFamiliar; x: number; y: number; pinned: boolean };
  state: GameState;
  onClose: () => void;
  onOpenBestiary: () => void;
}

const pct = (n: number) => (Number.isFinite(n) ? `${(Math.round(n * 1000) / 10).toString()}%` : '—');

/**
 * A small contextual card for a familiar in the grove: shown on hover, pinned
 * on tap. Keeps the scene free of permanent name labels.
 */
export function FamiliarTip({ tip, state, onClose, onOpenBestiary }: Props) {
  const { species, variant } = tip.familiar;
  const def = SPECIES_BY_ID[species];
  const look = appearanceOf(species, variant);
  const tier = SPECIES_RARITY[def.speciesRarity];

  useEffect(() => {
    if (!tip.pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.familiar-card-tip')) onClose();
    };
    window.addEventListener('keydown', onKey);
    // wait a tick so the tap that pinned the card doesn't immediately close it
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [tip.pinned, onClose]);

  return (
    <div
      className={`glass familiar-card-tip${tip.pinned ? ' pinned' : ''}`}
      style={{ left: tip.x, top: tip.y }}
      role={tip.pinned ? 'dialog' : 'tooltip'}
      aria-label={look.name}
    >
      <h4>
        {variant === 'mutation' ? '✦ ' : ''}
        {look.name}
      </h4>
      <div className="tip-sub">
        <span style={{ color: tier.color }}>{tier.label}</span>
        {variant === 'mutation' ? ` · rare ${def.name} mutation` : ` · ${def.name}`}
      </div>
      <div className="tip-stats">
        <span>
          Bond <b>{bondLevel(state, species)}</b>
        </span>
        <span>
          ✦ Mutation <b>{pct(mutationChance(state, def))}</b>
        </span>
      </div>
      {tip.pinned && (
        <div className="tip-actions">
          <button type="button" onClick={onOpenBestiary}>
            Bestiary
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
