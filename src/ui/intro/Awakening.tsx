import { useEffect, useRef } from 'react';
import { assetUrl } from '../../scene/assets';
import { SPECIES_RARITY, type SpeciesDef } from '../../game/registry';
import './intro.css';

interface Props {
  level: number;
  species: SpeciesDef[];
  onSummon: () => void;
  onClose: () => void;
}

/**
 * Shown when a grove level lets new species answer the call. The familiar stays
 * a mystery (a glowing silhouette and its rarity) until the player summons it.
 */
export function Awakening({ level, species, onSummon, onClose }: Props) {
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => primary.current?.focus(), 900);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const plural = species.length > 1;
  return (
    <div className="awakening" role="dialog" aria-modal="true" aria-labelledby="awakening-title">
      <div className="awakening-frost" onMouseDown={onClose} />
      <div className="awakening-card">
        <div className="awakening-level">Grove Level {level}</div>
        <h2 id="awakening-title" className="awakening-title">
          Something awakens…
        </h2>
        <p className="awakening-text">
          {plural ? 'New familiars stir' : 'A new familiar stirs'} in the deep grove and can now answer your call.
        </p>

        <div className="awakening-silhouettes">
          {species.map((s) => (
            <figure key={s.id} className="awakening-figure" style={{ ['--tier' as string]: SPECIES_RARITY[s.speciesRarity].color }}>
              <div className="awakening-portal" aria-hidden="true" />
              <img src={assetUrl(s.base.asset)} alt="" draggable={false} />
              <figcaption>
                <span className="awakening-tier">{SPECIES_RARITY[s.speciesRarity].label}</span>
                <span className="awakening-unknown">Unknown familiar</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="awakening-buttons">
          <button ref={primary} type="button" className="title-start awakening-summon" onClick={onSummon}>
            Answer the call
          </button>
          <button type="button" className="title-secondary" onClick={onClose}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
