import { useCallback, useEffect, useRef, useState } from 'react';
import { store, useGameState } from '../../app/gameStore';
import { audio } from '../../audio';
import { ATTUNEMENT, BOND, MOONS_FAVOR, MUTATION, SUMMON } from '../../game/config';
import { groveLevel, summonCost } from '../../game/economy';
import { formatNumber } from '../../game/format';
import { SPECIES, SPECIES_BY_ID, SPECIES_RARITY, appearanceOf, type SpeciesRarity } from '../../game/registry';
import type { RecentSummon } from '../../game/state';
import { mutationChance, speciesOdds, type SummonResult } from '../../game/summoning';
import { assetUrl } from '../../scene/assets';
import { Modal } from '../Modal';
import { Portrait } from '../Portrait';
import { SwapChooser } from '../bestiary/SwapChooser';
import './summon.css';

type Stage = 'idle' | 'portal' | 'gather' | 'intensify' | 'hold' | 'reveal';

/** Milliseconds from the start of a summon until each stage begins. */
const TIMELINE: Record<'normal' | 'mutation', [Stage, number][]> = {
  normal: [['portal', 0], ['gather', 380], ['intensify', 950], ['reveal', 1250]],
  // mutations hold a beat longer: the portal turns violet-rose before the reveal
  mutation: [['portal', 0], ['gather', 450], ['intensify', 1150], ['hold', 1700], ['reveal', 2650]],
};

const TIER_ORDER: SpeciesRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Summon shares: one decimal ("19.3%"). Never renders NaN. */
function pctShare(p: number): string {
  return Number.isFinite(p) ? `${parseFloat((p * 100).toFixed(1))}%` : '—';
}

/** Mutation chances: exact ("6.75%", "10.5%", "18%"). Never renders NaN. */
function pctExact(p: number): string {
  return Number.isFinite(p) ? `${parseFloat((p * 100).toFixed(2))}%` : '—';
}

function timeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function SummonChamber({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useGameState();
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<SummonResult | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const timers = useRef<number[]>([]);

  const cost = summonCost(state);
  const affordable = state.aether >= cost;
  const level = groveLevel(state);
  const reduced = state.settings.reducedMotion || prefersReducedMotion();
  const sequencePlaying = stage !== 'idle' && stage !== 'reveal';

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  const reveal = useCallback((r: SummonResult) => {
    clearTimers();
    setStage('reveal');
    audio.play(r.variant === 'mutation' ? 'rareReveal' : 'summonReveal');
  }, []);

  // reset when the chamber is closed
  useEffect(() => {
    if (!open) {
      clearTimers();
      setStage('idle');
      setResult(null);
    }
  }, [open]);

  useEffect(() => clearTimers, []);

  const summon = () => {
    if (sequencePlaying) return;
    const hadSummonedBefore = state.summons > 0;
    const r = store.summon();
    if (!r) {
      audio.play('denied');
      return;
    }
    clearTimers();
    setResult(r);
    setCanSkip(hadSummonedBefore);
    audio.play('summonStart');

    if (reduced) {
      reveal(r);
      return;
    }
    if (state.settings.quickSummon) {
      setStage(r.variant === 'mutation' ? 'hold' : 'intensify');
      timers.current.push(window.setTimeout(() => reveal(r), r.variant === 'mutation' ? 520 : 240));
      return;
    }
    for (const [s, at] of TIMELINE[r.variant === 'mutation' ? 'mutation' : 'normal']) {
      timers.current.push(
        window.setTimeout(() => {
          if (s === 'reveal') reveal(r);
          else setStage(s);
        }, at),
      );
    }
  };

  const skip = useCallback(() => {
    if (sequencePlaying && canSkip && result) reveal(result);
  }, [sequencePlaying, canSkip, result, reveal]);

  // Space or Enter fast-forwards the sequence (after the first summon)
  useEffect(() => {
    if (!open || !sequencePlaying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sequencePlaying, skip]);

  const odds = speciesOdds(state);
  const locked = SPECIES.filter((s) => s.unlock.groveLevel > level);
  const isMutation = result?.variant === 'mutation';
  const attunedSpecies = state.attuned ? SPECIES_BY_ID[state.attuned] : null;

  return (
    <Modal open={open} onClose={onClose} title="Mystery Summon" className="summon-modal">
      <div className={`summon-chamber${isMutation ? ' is-mutation' : ''}`}>
        <section
          className={`summon-stage stage-${stage}${reduced ? ' reduced' : ''}`}
          onClick={skip}
          aria-live="polite"
        >
          <div className="summon-energy" aria-hidden="true" />
          <img className="summon-portal" src={assetUrl('fx.summonPortal')} alt="" draggable={false} />
          {isMutation && (stage === 'hold' || stage === 'reveal') && <Constellation />}
          {/* the unidentified familiar takes shape in the portal before it is revealed */}
          {result && (stage === 'intensify' || stage === 'hold') && (
            <img
              className="summon-silhouette"
              src={assetUrl(appearanceOf(result.species, result.variant).asset)}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          )}
          {stage === 'reveal' && isMutation && <RareBurst />}
          {stage === 'idle' && (
            <p className="summon-idle-hint">The portal rests, waiting for Aether.</p>
          )}
          {stage === 'reveal' && result && <RevealCard result={result} />}
          {sequencePlaying && canSkip && (
            <span className="summon-skip-hint">Click or press Space to skip</span>
          )}
        </section>

        <section className="summon-controls">
          {stage === 'reveal' && result ? (
            <AfterReveal result={result} cost={cost} affordable={affordable} onAgain={summon} onClose={onClose} />
          ) : (
            <div className="summon-action">
              <div className="summon-wallet">
                <span>
                  <img src={assetUrl('ui.aether')} alt="" draggable={false} />
                  {formatNumber(state.aether)} Aether available
                </span>
                <span className="summon-count">{formatNumber(state.summons)} summoned so far</span>
              </div>
              <button
                className="buy-button summon-button"
                type="button"
                onClick={summon}
                disabled={!affordable || sequencePlaying}
                aria-describedby="summon-reason"
              >
                <img className="buy-crystal" src={assetUrl('ui.aether')} alt="" draggable={false} />
                <span className="buy-cost">{formatNumber(cost)}</span>
                <span className="buy-unit">Aether</span>
                <span className="buy-divider" aria-hidden="true" />
                <span className="buy-label">{sequencePlaying ? 'Calling…' : 'Summon Random'}</span>
              </button>
              <p id="summon-reason" className="summon-reason">
                {sequencePlaying
                  ? 'The portal is opening…'
                  : affordable
                    ? 'Spend Aether to call a familiar through the portal.'
                    : `You need ${formatNumber(cost - state.aether)} more Aether.`}
              </p>
              <label className="summon-toggle">
                <input
                  type="checkbox"
                  checked={state.settings.quickSummon}
                  onChange={(e) => store.updateSettings({ quickSummon: e.target.checked })}
                />
                <span className="toggle-track" aria-hidden="true" />
                Quick summon <small>(skip the portal sequence)</small>
              </label>
            </div>
          )}

          <div className="summon-recent">
            <button
              type="button"
              className="ghost-button recent-toggle"
              aria-expanded={showRecent}
              aria-controls="recent-calls"
              onClick={() => setShowRecent((v) => !v)}
            >
              <span>Recent Calls</span>
              <span className="recent-count">{state.recentSummons.length}</span>
              <span className={`recent-caret${showRecent ? ' open' : ''}`} aria-hidden="true">▾</span>
            </button>
            {showRecent && <RecentCalls id="recent-calls" list={state.recentSummons} />}
          </div>

          <div className="summon-odds">
            <h3>Who answers the call</h3>
            <p className="summon-rules">
              The species is chosen first, then its own rare-mutation chance: {pctExact(MUTATION.base)} plus {pctExact(MUTATION.perBond)} per Bond level
              (up to {pctExact(MUTATION.max)}). Bond grows from duplicates (+{BOND.perDuplicate}, mutations +{BOND.perMutationDuplicate}) and from
              time active in the grove; each level also adds +{Math.round(BOND.bonusPerPoint * 100)}% to all Aether. Moon&rsquo;s Favor guarantees a
              mutation after {MOONS_FAVOR.guaranteeAt} summons of a species without one.
            </p>
            {attunedSpecies && (
              <p className="attuned-note">
                <span className="attuned-mark">✦ Attuned</span> to {attunedSpecies.name}: ×{ATTUNEMENT[attunedSpecies.speciesRarity]} summon weight.
                Change it in the Bestiary.
              </p>
            )}
            <div className="odds-head" aria-hidden="true">
              <span>Familiar</span>
              <span title="Probability that a summon calls this species">Summon chance</span>
              <span title="Once this species answers, the chance it appears as its rare mutation">✦ Mutation</span>
            </div>
            <ul className="odds-list">
              {TIER_ORDER.map((tier) => {
                const inTier = odds.filter((o) => o.species.speciesRarity === tier);
                if (!inTier.length) return null;
                const info = SPECIES_RARITY[tier];
                return (
                  <li key={tier} className="odds-tier" style={{ ['--tier' as string]: info.color }}>
                    <span className={`tier-badge tier-${tier}`}>{info.label}</span>
                    <ul>
                      {inTier.map((o) => {
                        const known = (state.collection[o.species.id]?.base ?? 0) + (state.collection[o.species.id]?.mutation ?? 0) > 0;
                        const name = known ? o.species.name : 'Unknown familiar';
                        const share = pctShare(o.chance);
                        const mut = pctExact(mutationChance(state, o.species));
                        return (
                          <li key={o.species.id} className={`odds-row${o.attuned ? ' attuned' : ''}`}>
                            <span className="odds-name">
                              {name}
                              {o.attuned && <span className="attuned-mark" title="Attuned: more likely to answer"> ✦ Attuned</span>}
                            </span>
                            <span className="odds-value" title={`Summon chance for ${name}: ${share}`}>
                              {share}
                            </span>
                            <span className="odds-mutation" title={`Rare-mutation chance when ${name} answers: ${mut}`}>
                              ✦ {mut}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
              {locked.length > 0 && (
                <li className="odds-tier locked">
                  <span className="tier-badge">Sealed</span>
                  <ul>
                    {locked.map((s) => (
                      <li key={s.id} className="odds-row sealed">
                        <span className="odds-name">Unknown familiar</span>
                        <span className="odds-value">Unlocks at Grove Level {s.unlock.groveLevel}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** A small, restrained burst of silver-lavender sparkles for a rare mutation reveal. */
function RareBurst() {
  return (
    <div className="summon-rare-burst" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} style={{ ['--angle' as string]: `${i * 30 + (i % 2) * 12}deg`, ['--dist' as string]: `${70 + (i % 3) * 22}px` }} />
      ))}
    </div>
  );
}

/** Faint constellation: glinting stars joined by slowly drawn lines. */
function Constellation() {
  return (
    <div className="summon-constellation" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="14,22 27,14 41,19 52,9 66,16" />
        <polyline points="72,70 83,61 88,74 79,86" />
        <polyline points="10,64 18,76 31,72" />
      </svg>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ ['--i' as string]: i }} />
      ))}
    </div>
  );
}

function RevealCard({ result }: { result: SummonResult }) {
  const species = SPECIES_BY_ID[result.species];
  const look = appearanceOf(result.species, result.variant);
  const tier = SPECIES_RARITY[species.speciesRarity];
  const mutation = result.variant === 'mutation';
  const tag = result.newSpecies ? 'New species' : result.newAppearance ? 'New form' : `Duplicate · +${result.bondGained} Bond`;
  return (
    <div className="reveal-card">
      <img className="reveal-sprite" src={assetUrl(look.asset)} alt={look.name} draggable={false} />
      <div className="reveal-text">
        <div className="reveal-badges">
          <span className={`tier-badge tier-${species.speciesRarity}`} style={{ ['--tier' as string]: tier.color }}>{tier.label}</span>
          {mutation && <span className="mutation-badge">✦ Rare mutation</span>}
          {result.favored && <span className="favor-tag" title="Guaranteed by Moon's Favor">☾ Moon&rsquo;s Favor</span>}
          <span className={`reveal-tag${result.newAppearance ? ' is-new' : ''}`}>{tag}</span>
        </div>
        <h3 className="reveal-name">{look.name}</h3>
        <p className="reveal-identity">
          {mutation ? `Rare ${species.name} mutation` : species.lore}
        </p>
        {mutation && Number.isFinite(result.mutationChance) && result.mutationChance > 0 && (
          <p className="reveal-chance">
            {result.favored ? 'Guaranteed by the moon' : `✦ ${pctExact(result.mutationChance)} chance`}
          </p>
        )}
      </div>
    </div>
  );
}

function RecentCalls({ id, list }: { id: string; list: RecentSummon[] }) {
  if (!list.length) {
    return (
      <p id={id} className="recent-empty">
        No familiars called yet.
      </p>
    );
  }
  return (
    <ol id={id} className="recent-list" aria-label="Last summons, newest first">
      {list.map((r, i) => {
        const look = appearanceOf(r.species, r.variant);
        const mutation = r.variant === 'mutation';
        return (
          <li key={`${r.at}-${i}`} className={`recent-item${mutation ? ' is-mutation' : ''}`}>
            <Portrait id={look.asset} zoom={2.2} />
            <span className="recent-name">
              {mutation && <span className="recent-star" aria-label="Rare mutation">✦ </span>}
              {look.name}
            </span>
            <span className="recent-tags">
              {r.newAppearance ? <span className="recent-new">New</span> : <span className="recent-dup">Duplicate</span>}
              {r.favored && <span className="recent-favor" title="Guaranteed by Moon's Favor">☾</span>}
            </span>
            <time className="recent-time" dateTime={new Date(r.at).toISOString()}>
              {r.at ? timeAgo(r.at) : ''}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

function AfterReveal({
  result, cost, affordable, onAgain, onClose,
}: { result: SummonResult; cost: number; affordable: boolean; onAgain: () => void; onClose: () => void }) {
  const state = useGameState();
  const [choosing, setChoosing] = useState(false);
  const inGrove = state.displayed.some((d) => d.species === result.species && d.variant === result.variant);
  const speciesInGrove = state.displayed.some((d) => d.species === result.species);
  const room = state.displayed.length < SUMMON.maxActive;
  const name = appearanceOf(result.species, result.variant).name;

  // Layout never shifts between summons: "Summon again" always sits in the same
  // place at the top, and the grove action lives in a fixed-height slot below it
  // (kept even when empty), so rapid re-summoning can't hit a button that just appeared.
  const placeAction = !inGrove && (room || speciesInGrove);
  const swapAction = !inGrove && !room && !speciesInGrove;
  return (
    <div className="summon-after">
      <div className="summon-after-buttons">
        <button className="buy-button summon-button" type="button" onClick={onAgain} disabled={!affordable}>
          <img className="buy-crystal" src={assetUrl('ui.aether')} alt="" draggable={false} />
          <span className="buy-cost">{formatNumber(cost)}</span>
          <span className="buy-divider" aria-hidden="true" />
          <span className="buy-label">Summon another</span>
        </button>
        <button className="ghost-button" type="button" onClick={onClose}>
          Return to grove
        </button>
      </div>
      <div className="summon-grove-slot">
        <p className="summon-placement">
          {inGrove
            ? `${name} is now in your grove.`
            : speciesInGrove
              ? `Another form of this familiar is already in the grove.`
              : room
                ? `There is room in the grove for ${name}.`
                : `The grove is full. Swap ${name} in for one of your familiars?`}
        </p>
        {choosing ? (
          <SwapChooser species={result.species} variant={result.variant} onDone={() => setChoosing(false)} />
        ) : (
          <button
            className="ghost-button grove-action"
            type="button"
            style={{ visibility: placeAction || swapAction ? 'visible' : 'hidden' }}
            tabIndex={placeAction || swapAction ? 0 : -1}
            aria-hidden={!(placeAction || swapAction)}
            onClick={() => (swapAction ? setChoosing(true) : store.toggleDisplayed(result.species, result.variant))}
          >
            {swapAction ? '⇄ Swap into grove' : speciesInGrove ? 'Swap form into grove' : 'Place in grove'}
          </button>
        )}
      </div>
      {!affordable && <p className="summon-reason">You need {formatNumber(cost - state.aether)} more Aether to summon again.</p>}
    </div>
  );
}
