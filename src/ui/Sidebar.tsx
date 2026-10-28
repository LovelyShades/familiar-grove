import { useState } from 'react';
import { assetUrl } from '../scene/assets';
import { store } from '../app/gameStore';
import { audio } from '../audio';
import type { GameState } from '../game/state';
import type { BuyAmount } from '../game/store';
import { SUMMON, UPGRADES, UPGRADE_REVEAL_FRACTION, type UpgradeDef, type UpgradeId } from '../game/config';
import {
  currentEffect, isMaxed, isRevealed, maxAffordable, nextBenefit, perClick, perSecond, summonCost, upgradeCost,
} from '../game/economy';
import { appearanceOf, TOTAL_APPEARANCES } from '../game/registry';
import { formatNumber, formatRate } from '../game/format';
import { Portrait } from './Portrait';
import { uiEvents } from '../app/uiEvents';

const BUY_AMOUNTS: BuyAmount[] = [1, 10, 'max'];

function Icon({ id }: { id: string }) {
  return id.startsWith('familiar.') ? (
    <Portrait id={id} zoom={2.2} />
  ) : (
    <img className="portrait-img" src={assetUrl(id)} alt="" draggable={false} />
  );
}

interface Quote {
  levels: number;
  cost: number;
  affordable: boolean;
  maxed: boolean;
}

/** Price and level count for the selected buy amount. */
function quote(state: GameState, id: UpgradeId, amount: BuyAmount): Quote {
  const maxed = isMaxed(state, id);
  if (maxed) return { levels: 0, cost: 0, affordable: false, maxed };
  if (amount === 'max') {
    const n = maxAffordable(state, id);
    return n > 0
      ? { levels: n, cost: upgradeCost(state, id, n), affordable: true, maxed }
      : { levels: 1, cost: upgradeCost(state, id, 1), affordable: false, maxed };
  }
  const cost = upgradeCost(state, id, amount);
  return { levels: amount, cost, affordable: cost <= state.aether, maxed };
}

interface PurchaseFx {
  key: number;
  /** e.g. "+8.5 Aether/sec": exactly what this purchase added. */
  gain: string;
  levels: number;
}

/**
 * Reusable purchase feedback: buys, then records what was gained so the card can
 * glow, burst, bump its level and float the exact improvement.
 */
function usePurchase(state: GameState, def: UpgradeDef, amount: BuyAmount) {
  const [fx, setFx] = useState<PurchaseFx | null>(null);
  const onBuy = () => {
    const q = quote(state, def.id, amount);
    const gain = nextBenefit(state, def.id, Math.max(1, q.levels));
    const bought = store.buyUpgrade(def.id, amount);
    if (bought > 0) {
      audio.play('purchase', { intensity: Math.min(1, 0.6 + bought / 25) });
      const unit = gain.unit === 'per sec' ? 'Aether/sec' : 'per click';
      setFx({ key: Date.now(), gain: `+${formatRate(gain.amount)} ${unit}`, levels: bought });
    } else {
      audio.play('denied');
    }
  };
  return { fx, onBuy };
}

function PurchaseFeedback({ fx }: { fx: PurchaseFx | null }) {
  if (!fx) return null;
  return (
    <span className="purchase-fx" key={fx.key} aria-hidden="true">
      <span className="purchase-glow" />
      <span className="purchase-burst" />
      <span className="purchase-gain">
        {fx.gain}
        {fx.levels > 1 && <small> · {fx.levels} levels</small>}
      </span>
    </span>
  );
}

function BuyButton({ q, label, compact, onBuy }: { q: Quote; label: string; compact?: boolean; onBuy: () => void }) {
  const what = q.maxed
    ? `${label} is at maximum level`
    : `Buy ${q.levels} level${q.levels === 1 ? '' : 's'} of ${label} for ${formatNumber(q.cost)} Aether${q.affordable ? '' : ' (not enough Aether)'}`;
  return (
    <button className={`buy-button${compact ? ' compact' : ''}`} type="button" disabled={!q.affordable} onClick={onBuy} aria-label={what} title={what}>
      <img className="buy-crystal" src={assetUrl('ui.aether')} alt="" draggable={false} />
      <span className="buy-cost">{q.maxed ? 'MAX' : formatNumber(q.cost)}</span>
      {!compact && <span className="buy-unit">Aether</span>}
      {!compact && <span className="buy-divider" aria-hidden="true" />}
      {!compact && <span className="buy-label">{q.levels > 1 ? `Upgrade ×${q.levels}` : 'Upgrade'}</span>}
      {compact && q.levels > 1 && <span className="buy-count">×{q.levels}</span>}
      <svg className="buy-arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l7 8h-4.5v8h-5v-8H5z" />
      </svg>
    </button>
  );
}

function benefitText(state: GameState, def: UpgradeDef, levels: number): string {
  const b = nextBenefit(state, def.id, Math.max(1, levels));
  return `+${formatRate(b.amount)} ${b.unit}`;
}

function currentText(state: GameState, def: UpgradeDef): string {
  if (def.kind === 'passive') {
    const mine = currentEffect(state, def.id);
    const total = perSecond(state);
    const share = total > 0 ? Math.round((mine / total) * 100) : 0;
    return `${formatRate(mine)} Aether/sec · ${share}% of income`;
  }
  if (def.kind === 'clickMultiplier') return `×${formatRate(currentEffect(state, def.id))} click power`;
  return `${formatRate(perClick(state))} Aether per click`;
}

function SpellCard({ state, def, amount }: { state: GameState; def: UpgradeDef; amount: BuyAmount }) {
  const q = quote(state, def.id, amount);
  const { fx, onBuy } = usePurchase(state, def, amount);
  const level = state.upgrades[def.id];
  return (
    <article className="spell-card">
      <PurchaseFeedback fx={fx} />
      <div className="spell-icon frame-icon">
        <Icon id={def.icon} />
      </div>
      <div className="spell-text">
        <div className="card-heading">
          <h3>{def.name}</h3>
          <span className="card-level">
            Lv.{' '}
            <span className={fx ? 'level-num bump' : 'level-num'} key={level}>
              {level}
            </span>
          </span>
        </div>
        <p className="card-effect">Now: {currentText(state, def)}</p>
        <p className="card-next">
          Next{q.levels > 1 ? ` ×${q.levels}` : ''}: <b>{benefitText(state, def, q.levels)}</b>
        </p>
      </div>
      <BuyButton q={q} label={def.name} onBuy={onBuy} />
    </article>
  );
}

/** Mystery Summon: makes it obvious that summoning gives a RANDOM familiar. */
function CallingCard({ state, onSummon }: { state: GameState; onSummon: () => void }) {
  const cost = summonCost(state);
  const affordable = cost <= state.aether;
  return (
    <article className={`spell-card calling-card${affordable ? ' ready' : ''}`}>
      <div className="spell-icon frame-icon mystery-icon" aria-hidden="true">
        <img className="mystery-portal" src={assetUrl('fx.summonPortal')} alt="" draggable={false} />
        <span className="mystery-rune">?</span>
      </div>
      <div className="spell-text">
        <div className="card-heading">
          <h3>Mystery Summon</h3>
          <span className="card-level">{state.summons} called</span>
        </div>
        <p className="card-effect">Summon a random mythical creature</p>
        <p className="card-next">{affordable ? 'Rare mutations possible' : `Need ${formatNumber(cost - state.aether)} more Aether`}</p>
      </div>
      <button
        className={`buy-button summon-button${affordable ? '' : ' waiting'}`}
        type="button"
        onClick={onSummon}
        aria-label={`Open Mystery Summon: summon a random familiar for ${formatNumber(cost)} Aether`}
      >
        <img className="buy-crystal" src={assetUrl('ui.aether')} alt="" draggable={false} />
        <span className="buy-cost">{formatNumber(cost)}</span>
        <span className="buy-unit">Aether</span>
        <span className="buy-divider" aria-hidden="true" />
        <span className="buy-label">Summon Random</span>
        <img className="buy-paw" src={assetUrl('ui.nav.summon')} alt="" draggable={false} />
      </button>
    </article>
  );
}

function UpgradeRow({ state, def, amount }: { state: GameState; def: UpgradeDef; amount: BuyAmount }) {
  const q = quote(state, def.id, amount);
  const { fx, onBuy } = usePurchase(state, def, amount);
  const level = state.upgrades[def.id];
  return (
    <article className="upgrade-row">
      <PurchaseFeedback fx={fx} />
      <div className="upgrade-icon frame-icon">
        <Icon id={def.icon} />
      </div>
      <div className="upgrade-text">
        <h4>{def.name}</h4>
        <p className="row-level">
          <span className="card-level">
            Lv.{' '}
            <span className={fx ? 'level-num bump' : 'level-num'} key={level}>
              {level}
            </span>
          </span>
          {' · '}
          {level > 0 ? currentText(state, def) : def.description}
        </p>
        <p className="row-next">
          Next{q.levels > 1 ? ` ×${q.levels}` : ''}: <b>{benefitText(state, def, q.levels)}</b>
        </p>
      </div>
      <BuyButton q={q} label={def.name} compact onBuy={onBuy} />
    </article>
  );
}

interface Props {
  state: GameState;
  onOpenSummon: () => void;
  onOpenBestiary: () => void;
}

export function Sidebar({ state, onOpenSummon, onOpenBestiary }: Props) {
  const [amount, setAmount] = useState<BuyAmount>(1);
  const spells = UPGRADES.filter((u) => u.kind === 'click');
  const grove = UPGRADES.filter((u) => u.kind !== 'click');
  const visibleGrove = grove.filter((u) => isRevealed(state, u.id));
  const nextHidden = grove.find((u) => !isRevealed(state, u.id));

  const found = Object.values(state.collection).reduce((n, c) => n + (c.base > 0 ? 1 : 0) + (c.mutation > 0 ? 1 : 0), 0);
  const slots = Array.from({ length: SUMMON.maxActive }, (_, i) => state.displayed[i] ?? null);

  return (
    <aside className="glass sidebar" aria-label="Spells and familiars">
      <h2 className="panel-title">
        <span className="title-sprig" aria-hidden="true" />
        Spells &amp; Familiars
      </h2>

      <div className="shop-toolbar">
        <span className="shop-toolbar-label" id="buy-amount-label">
          Buy amount
        </span>
        <div className="buy-amount" role="radiogroup" aria-labelledby="buy-amount-label">
          {BUY_AMOUNTS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={amount === a} className={amount === a ? 'active' : ''} onClick={() => setAmount(a)}>
              {a === 'max' ? 'Max' : `×${a}`}
            </button>
          ))}
        </div>
      </div>

      <div className="section-heading spells-heading">
        <h3>Spells</h3>
        <span className="section-meta">Click power &amp; summoning</span>
      </div>
      <div className="spell-list">
        {spells.map((def) => (
          <SpellCard key={def.id} state={state} def={def} amount={amount} />
        ))}
        <CallingCard state={state} onSummon={onOpenSummon} />
      </div>

      <section className="sidebar-section">
        <div className="section-heading">
          <h3>Your Familiars</h3>
          <span className="section-meta" title={`${found} of ${TOTAL_APPEARANCES} appearances discovered`}>
            {state.displayed.length}/{SUMMON.maxActive} active · {found}/{TOTAL_APPEARANCES}
          </span>
        </div>
        <div className="familiar-row">
          {slots.map((d, i) => {
            if (!d) {
              return (
                <button type="button" className="familiar-tile empty" key={`empty-${i}`} onClick={onOpenBestiary} aria-label="Empty grove slot. Open the Bestiary to place a familiar">
                  <span className="empty-socket" aria-hidden="true">+</span>
                  <span className="tile-caption">Empty</span>
                </button>
              );
            }
            const look = appearanceOf(d.species, d.variant);
            return (
              <button
                type="button"
                className={`familiar-tile species-${d.species}${d.variant === 'mutation' ? ' mutation' : ''}`}
                key={`${d.species}-${d.variant}`}
                onClick={onOpenBestiary}
                onMouseEnter={() => uiEvents.highlightFamiliar(d.species)}
                onMouseLeave={() => uiEvents.highlightFamiliar(null)}
                onFocus={() => uiEvents.highlightFamiliar(d.species)}
                onBlur={() => uiEvents.highlightFamiliar(null)}
                title={look.name}
                aria-label={`${look.name}. Open the Bestiary`}
              >
                <Portrait id={look.asset} />
                <span className="tile-caption">
                  {d.variant === 'mutation' ? '✦ ' : ''}Bond {state.collection[d.species]?.bond ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sidebar-section">
        <div className="section-heading">
          <h3>Grove Upgrades</h3>
          <span className="section-meta">Aether over time{amount !== 1 ? ` · buying ${amount === 'max' ? 'max' : `×${amount}`}` : ''}</span>
        </div>
        <div className="upgrade-list">
          {visibleGrove.map((def) => (
            <UpgradeRow key={def.id} state={state} def={def} amount={amount} />
          ))}
          {nextHidden && (
            <div className="upgrade-row locked">
              <div className="upgrade-icon frame-icon locked-icon" aria-hidden="true">
                ?
              </div>
              <div className="upgrade-text">
                <h4>Undiscovered</h4>
                <p>Revealed at {formatNumber(nextHidden.baseCost * UPGRADE_REVEAL_FRACTION)} lifetime Aether</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
