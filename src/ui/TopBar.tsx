import { useState, type Ref } from 'react';
import { assetUrl } from '../scene/assets';
import { useGameEvents } from '../app/gameStore';
import type { GameState } from '../game/state';
import { levelProgress, perClick, perSecond } from '../game/economy';
import { formatNumber, formatRate } from '../game/format';
import { levelReward } from '../game/progression';
import { useSmoothNumber } from './useSmoothNumber';

function clockLabel(minutes: number): { day: number; time: string } {
  const day = Math.floor(minutes / 1440) + 1;
  const m = Math.floor(minutes % 1440);
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 || 12;
  return { day, time: `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}` };
}

interface Props {
  state: GameState;
  onOpenOptions: () => void;
  /** The Aether crystal icon, so the scene can aim particles at it. */
  counterRef: Ref<HTMLImageElement>;
}

export function TopBar({ state, onOpenOptions, counterRef }: Props) {
  const lp = levelProgress(state);
  const pct = Math.min(100, (lp.current / lp.needed) * 100);
  const clock = clockLabel(state.clockMinutes);
  const speed = state.settings.timeSpeed;

  const shownAether = useSmoothNumber(state.aether);

  // a subtle bump on the counter whenever Aether is gained by clicking
  const [bump, setBump] = useState(0);
  useGameEvents((e) => {
    if (e.type === 'click') setBump((b) => b + 1);
  });

  return (
    <header className="topbar">
      <section className="glass level-card" aria-label="Grove level">
        <img className="level-icon" src={assetUrl('ui.nav.grove')} alt="" draggable={false} />
        <div className="level-info">
          <div className="level-title">Grove Level {lp.level}</div>
          <div className="progress" role="progressbar" aria-label="Progress to next grove level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(pct)}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="level-numbers">
            {formatNumber(lp.current)} / {formatNumber(lp.needed)}
          </div>
          <div className="level-next" title={`Grove Level ${lp.level + 1}: ${levelReward(lp.level + 1).long}`}>
            Next: {levelReward(lp.level + 1).short}
          </div>
        </div>
      </section>

      <section className="title-block">
        <h1 className="game-title">
          <span className="title-leaf" aria-hidden="true" />
          Familiar Grove
          <span className="title-leaf flip" aria-hidden="true" />
        </h1>
        <div className="glass resource-bar">
          <img className="aether-icon" src={assetUrl('ui.aether')} alt="" draggable={false} ref={counterRef} />
          <span className="aether-amount">
            <span key={bump} className={bump ? 'aether-value bump' : 'aether-value'}>
              {formatNumber(shownAether)}
            </span>
          </span>
          <span className="aether-label">Aether</span>
          <span className="rate-chip" title="Aether per click">
            <span className="rate-value">+{formatRate(perClick(state))}</span> / click
          </span>
          <span className="rate-chip violet" title="Aether per second">
            <span className="rate-value">+{formatRate(perSecond(state))}</span> / sec
            {speed !== 1 && <span className="speed-tag">{speed}×</span>}
          </span>
        </div>
      </section>

      <div aria-hidden="true" />

      <section className="top-right">
        <div className="glass cycle-card" aria-label={`Verdant Cycle, day ${clock.day}, ${clock.time}`}>
          <svg className="moon-glyph" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.5 2.5a9.5 9.5 0 1 0 6 16.8A8 8 0 0 1 15.5 2.5Z" />
          </svg>
          <span>
            Day {clock.day} <span className="dot">•</span> {clock.time}
          </span>
        </div>
        <button className="glass icon-button" type="button" aria-label="Options" onClick={onOpenOptions}>
          <img src={assetUrl('ui.nav.options')} alt="" draggable={false} />
        </button>
      </section>
    </header>
  );
}
