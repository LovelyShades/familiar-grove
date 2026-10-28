import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useGameState } from '../../app/gameStore';
import { uiEvents } from '../../app/uiEvents';
import { ATTUNEMENT, BOND, MOONS_FAVOR, MUTATION, SUMMON } from '../../game/config';
import { formatNumber } from '../../game/format';
import {
  SPECIES, SPECIES_RARITY, TOTAL_APPEARANCES, TOTAL_SPECIES, appearanceOf, hasArtwork,
  type SpeciesDef, type SpeciesRarity, type Variant,
} from '../../game/registry';
import type { GameState } from '../../game/state';
import {
  bondLevel, bondMutationChance, bondProgress, moonsFavor, mutationChance, speciesOdds,
} from '../../game/summoning';
import { assetUrl } from '../../scene/assets';
import { Modal } from '../Modal';
import { Portrait } from '../Portrait';
import { SwapChooser } from './SwapChooser';
import './bestiary.css';

type Filter = 'all' | 'discovered' | 'undiscovered';
type Sort = 'roster' | 'rarity';

const TIERS: SpeciesRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function owned(state: GameState, species: string, variant: Variant): number {
  return state.collection[species]?.[variant] ?? 0;
}

function speciesKnown(state: GameState, s: SpeciesDef): boolean {
  return owned(state, s.id, 'base') + owned(state, s.id, 'mutation') > 0;
}

/** Props that make an element ask the scene to highlight a familiar while hovered or focused. */
function highlightProps(species: string) {
  return {
    onMouseEnter: () => uiEvents.highlightFamiliar(species),
    onMouseLeave: () => uiEvents.highlightFamiliar(null),
    onFocus: () => uiEvents.highlightFamiliar(species),
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      // moving focus between controls inside the same card keeps the highlight
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) uiEvents.highlightFamiliar(null);
    },
  };
}

/** Exact percentage without float noise: 0.0675 → "6.75%", 0.105 → "10.5%", 0.18 → "18%". */
function pctExact(p: number): string {
  return Number.isFinite(p) ? `${parseFloat((p * 100).toFixed(2))}%` : '—';
}

/** Odds shares are less precise: 0.1934 → "19.3%". */
function pctShare(p: number): string {
  return Number.isFinite(p) ? `${parseFloat((p * 100).toFixed(1))}%` : '—';
}

export function Bestiary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useGameState();
  const [filter, setFilter] = useState<Filter>('all');
  const [tier, setTier] = useState<SpeciesRarity | 'all'>('all');
  const [sort, setSort] = useState<Sort>('roster');

  const appearancesFound = SPECIES.reduce(
    (n, s) => n + (owned(state, s.id, 'base') > 0 ? 1 : 0) + (owned(state, s.id, 'mutation') > 0 ? 1 : 0),
    0,
  );
  const speciesFound = SPECIES.filter((s) => speciesKnown(state, s)).length;
  const mutationIds = SPECIES.filter((s) => owned(state, s.id, 'mutation') > 0).map((s) => s.id);

  // Mutations discovered since the Bestiary was last open get a one-time shimmer reveal.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(mutationIds);
  const fresh = open ? new Set(mutationIds.filter((id) => !seen.current!.has(id))) : new Set<string>();
  const mutationKey = mutationIds.join(',');
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      seen.current = new Set(mutationKey ? mutationKey.split(',') : []);
    }, 2200);
    return () => clearTimeout(t);
  }, [open, mutationKey]);

  // never leave a creature highlighted once the Bestiary closes or unmounts
  useEffect(() => {
    if (!open) uiEvents.highlightFamiliar(null);
  }, [open]);
  useEffect(() => () => uiEvents.highlightFamiliar(null), []);

  const list = useMemo(() => {
    let l = SPECIES.filter((s) => {
      const known = speciesKnown(state, s);
      if (filter === 'discovered' && !known) return false;
      // undiscovered = at least one appearance still missing
      if (filter === 'undiscovered' && owned(state, s.id, 'base') > 0 && owned(state, s.id, 'mutation') > 0) return false;
      if (tier !== 'all' && s.speciesRarity !== tier) return false;
      return true;
    });
    if (sort === 'rarity') l = [...l].sort((a, b) => TIERS.indexOf(a.speciesRarity) - TIERS.indexOf(b.speciesRarity));
    return l;
  }, [state, filter, tier, sort]);

  // summon shares with and without attunement, for the transparent "19% → 27%" note
  const oddsNow = useMemo(() => speciesOdds(state), [state]);
  const oddsPlain = useMemo(() => speciesOdds({ ...state, attuned: null }), [state]);

  return (
    <Modal open={open} onClose={onClose} title="Bestiary" className="modal-wide bestiary-modal">
      <div className="bestiary">
        <section className="bestiary-progress" aria-label="Collection progress">
          <Progress label="Appearances" value={appearancesFound} total={TOTAL_APPEARANCES} />
          <Progress label="Species" value={speciesFound} total={TOTAL_SPECIES} />
          <Progress label="Mutations" value={mutationIds.length} total={TOTAL_SPECIES} accent />
        </section>

        <ActiveGrove state={state} />

        <section className="bestiary-filters" aria-label="Filter familiars">
          <div className="segmented-control" role="group" aria-label="Discovery">
            {(['all', 'discovered', 'undiscovered'] as Filter[]).map((f) => (
              <button key={f} type="button" className={filter === f ? 'active' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'discovered' ? 'Discovered' : 'Undiscovered'}
              </button>
            ))}
          </div>
          <div className="tier-chips" role="group" aria-label="Rarity">
            <button type="button" className={tier === 'all' ? 'active' : ''} aria-pressed={tier === 'all'} onClick={() => setTier('all')}>
              Every tier
            </button>
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                className={tier === t ? 'active' : ''}
                aria-pressed={tier === t}
                style={{ ['--tier' as string]: SPECIES_RARITY[t].color }}
                onClick={() => setTier(t)}
              >
                {SPECIES_RARITY[t].label}
              </button>
            ))}
          </div>
          <label className="sort-select">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="roster">Field guide order</option>
              <option value="rarity">By rarity</option>
            </select>
          </label>
        </section>

        {list.length === 0 ? (
          <p className="bestiary-empty">No familiars match these filters yet.</p>
        ) : (
          <div className="species-grid">
            {list.map((s) => (
              <SpeciesCard
                key={s.id}
                species={s}
                state={state}
                revealMutation={fresh.has(s.id)}
                shareNow={oddsNow.find((o) => o.species.id === s.id)?.chance}
                sharePlain={oddsPlain.find((o) => o.species.id === s.id)?.chance}
                shareAttuned={s.id === state.attuned ? undefined : speciesOdds({ ...state, attuned: s.id }).find((o) => o.species.id === s.id)?.chance}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Progress({ label, value, total, accent = false }: { label: string; value: number; total: number; accent?: boolean }) {
  return (
    <div className={`progress-stat${accent ? ' accent' : ''}`}>
      <div className="progress-stat-top">
        <span>{label}</span>
        <b>
          {value} / {total}
        </b>
      </div>
      <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
        <div className="progress-fill" style={{ width: `${(value / total) * 100}%` }} />
      </div>
    </div>
  );
}

function ActiveGrove({ state }: { state: GameState }) {
  const slots = Array.from({ length: SUMMON.maxActive }, (_, i) => state.displayed[i] ?? null);
  return (
    <section className="active-grove" aria-label="Familiars in the grove">
      <div className="active-grove-head">
        <h3>
          In the Grove <span className="active-count">· {state.displayed.length} / {SUMMON.maxActive} active</span>
        </h3>
        <span>Active familiars deepen their bond over time</span>
      </div>
      <div className="active-slots">
        {slots.map((d, i) =>
          d ? (
            <div
              className={`active-slot${d.variant === 'mutation' ? ' is-mutation' : ''}`}
              key={`${d.species}-${i}`}
              {...highlightProps(d.species)}
            >
              <Portrait id={appearanceOf(d.species, d.variant).asset} />
              <span className="active-name">{appearanceOf(d.species, d.variant).name}</span>
              <button
                type="button"
                className="slot-remove"
                aria-label={`Remove ${appearanceOf(d.species, d.variant).name} from the grove`}
                onClick={() => store.toggleDisplayed(d.species, d.variant)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="active-slot empty" key={`empty-${i}`}>
              <span>Empty socket</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

interface CardProps {
  species: SpeciesDef;
  state: GameState;
  revealMutation: boolean;
  shareNow?: number;
  sharePlain?: number;
  shareAttuned?: number;
}

function SpeciesCard({ species, state, revealMutation, shareNow, sharePlain, shareAttuned }: CardProps) {
  const known = speciesKnown(state, species);
  const tier = SPECIES_RARITY[species.speciesRarity];
  const hasMutation = owned(state, species.id, 'mutation') > 0;
  const attuned = state.attuned === species.id;
  const inGrove = state.displayed.some((d) => d.species === species.id);

  return (
    <article
      className={`species-card tier-${species.speciesRarity}${known ? '' : ' unknown'}${hasMutation ? ' has-mutation' : ''}${attuned ? ' is-attuned' : ''}${inGrove ? ' in-grove' : ''}`}
      style={{ ['--tier' as string]: tier.color }}
      aria-label={known ? `${species.name}${inGrove ? ', in the grove' : ''}` : 'Undiscovered familiar'}
      {...(known ? highlightProps(species.id) : {})}
    >
      <header className="species-head">
        <h3>{known ? species.name : '???'}</h3>
        <span className="species-badges">
          {inGrove && <span className="in-grove-badge">In grove</span>}
          {attuned && <span className="attuned-badge">✦ Attuned</span>}
          <span className={`tier-badge tier-${species.speciesRarity}`}>{tier.label}</span>
        </span>
      </header>

      <div className="species-forms">
        <FormPanel species={species} variant="base" state={state} />
        <FormPanel species={species} variant="mutation" state={state} revealing={revealMutation} />
      </div>

      {/* Every card uses the same five rows (header, forms, lore, bond, attune) so
          cards in a grid row line up section by section (see .species-card subgrid). */}
      {known ? (
        <>
          <p className="species-lore">{species.lore}</p>
          <BondPanel species={species} state={state} />
          <AttuneRow species={species} attuned={attuned} anyAttuned={state.attuned} shareNow={shareNow} sharePlain={sharePlain} shareAttuned={shareAttuned} />
        </>
      ) : (
        <p className="species-lore muted">
          {species.unlock.groveLevel > 1
            ? `Answers the call from Grove Level ${species.unlock.groveLevel}.`
            : 'Summon this familiar to learn its secrets.'}
        </p>
      )}
    </article>
  );
}

function BondPanel({ species, state }: { species: SpeciesDef; state: GameState }) {
  const bond = bondLevel(state, species.id);
  const progress = bondProgress(state, species.id);
  const chance = mutationChance(state, species);
  const fromBond = bondMutationChance(bond);
  const favor = moonsFavor(state, species.id);
  const inGrove = state.displayed.some((d) => d.species === species.id);
  const minutesLeft = Math.max(1, Math.ceil(BOND.activeMinutesPerLevel * (1 - progress)));
  const capped = fromBond >= MUTATION.max;
  const guaranteed = chance >= 1;
  const favorActive = favor.misses >= MOONS_FAVOR.softStart || guaranteed;

  return (
    <div className="bond-panel">
      <div className="bond-row">
        <span className="bond-level">
          Bond <b>{bond}</b>
        </span>
        <span className={`bond-chance${guaranteed ? ' guaranteed' : ''}`} title="Chance that the next summon of this species is its rare mutation">
          ✦ {guaranteed ? 'Mutation guaranteed' : `${pctExact(chance)} rare chance`}
        </span>
      </div>
      <div
        className="bond-bar"
        role="progressbar"
        aria-label={`Progress to Bond ${bond + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="bond-bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="bond-meta">
        <span>
          {inGrove
            ? `Bond ${bond + 1} in about ${minutesLeft} min in the grove`
            : `${Math.round(progress * 100)}% to Bond ${bond + 1} · place in the grove to grow`}
        </span>
        <span className="bond-bonus">+{Math.round(bond * BOND.bonusPerPoint * 100)}% Aether</span>
      </div>
      <p className="bond-hint">
        Raise Bond: duplicates +{BOND.perDuplicate} (mutations +{BOND.perMutationDuplicate}) · {BOND.activeMinutesPerLevel} min active in the grove = +1.
        Each level: +{pctExact(MUTATION.perBond)} rare chance{capped ? ` (at the ${pctExact(MUTATION.max)} cap)` : ` (up to ${pctExact(MUTATION.max)})`} and +
        {Math.round(BOND.bonusPerPoint * 100)}% Aether.
      </p>
      <p className={`favor-line${favorActive ? ' active' : ''}`}>
        <span aria-hidden="true">☾</span>{' '}
        {guaranteed
          ? "Moon's Favor: the next summon of this species will be its mutation."
          : favorActive
            ? `Moon's Favor: +${pctExact(favor.bonus)} · guaranteed within ${favor.guaranteeIn} summons`
            : `Moon's Favor gathers after ${MOONS_FAVOR.softStart} summons without a mutation (${favor.misses}/${MOONS_FAVOR.softStart})`}
      </p>
    </div>
  );
}

function AttuneRow({
  species, attuned, anyAttuned, shareNow, sharePlain, shareAttuned,
}: { species: SpeciesDef; attuned: boolean; anyAttuned: string | null; shareNow?: number; sharePlain?: number; shareAttuned?: number }) {
  const mult = ATTUNEMENT[species.speciesRarity];
  const summonable = sharePlain !== undefined;
  const boosted = attuned ? shareNow : shareAttuned;
  const label = attuned ? 'Release attunement' : anyAttuned ? `Attune to ${species.name} instead` : `Attune to ${species.name}`;
  return (
    <div className="attune-row">
      <button
        type="button"
        className={`attune-button${attuned ? ' active' : ''}`}
        aria-pressed={attuned}
        aria-label={label}
        title={label}
        onClick={() => store.setAttunement(attuned ? null : species.id)}
      >
        ✦ {attuned ? 'Attuned' : 'Attune'}
      </button>
      <span className="attune-note">
        {summonable && boosted !== undefined
          ? (
            <>
              ×{mult} summon weight · <span className="attune-from">{pctShare(sharePlain!)}</span> → <b>{pctShare(boosted)}</b>
              {attuned ? ' now' : ''}
            </>
          )
          : `×${mult} summon weight once it can be summoned`}
      </span>
    </div>
  );
}

function FormPanel({ species, variant, state, revealing = false }: { species: SpeciesDef; variant: Variant; state: GameState; revealing?: boolean }) {
  const [choosing, setChoosing] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const count = owned(state, species.id, variant);
  const look = appearanceOf(species.id, variant);
  const isMutation = variant === 'mutation';
  const inGrove = state.displayed.some((d) => d.species === species.id && d.variant === variant);
  const speciesInGrove = state.displayed.some((d) => d.species === species.id);
  const groveFull = state.displayed.length >= SUMMON.maxActive;
  const art = hasArtwork(species.id, variant);

  // undiscovered: a silhouette; an unknown mutation keeps its name hidden
  if (count === 0) {
    return (
      <div className={`form-panel locked${isMutation ? ' mutation-hidden' : ''}`}>
        <div className="form-art">
          {art ? (
            <img className={isMutation ? 'silhouette mutation-silhouette' : 'silhouette'} src={assetUrl(look.asset)} alt="" draggable={false} />
          ) : (
            <span className="mystery-glyph" aria-hidden="true">✦</span>
          )}
        </div>
        <span className="form-name">{isMutation ? 'Unknown mutation' : 'Undiscovered'}</span>
        <span className="form-kind">{isMutation ? 'Rare form' : 'Base form'}</span>
        {/* keeps the same structure (and height) as a discovered form's action button */}
        <span className="form-action form-action-empty" aria-hidden="true" />
      </div>
    );
  }

  const needsSwap = !inGrove && !speciesInGrove && groveFull;
  const closeChooser = () => {
    setChoosing(false);
    toggleRef.current?.focus();
  };
  return (
    <div className={`form-panel${isMutation ? ' is-mutation' : ''}${revealing ? ' revealing' : ''}`}>
      <div className="form-art">
        {art ? (
          <img src={assetUrl(look.asset)} alt={look.name} draggable={false} />
        ) : (
          <span className="mystery-glyph" aria-hidden="true">✦</span>
        )}
        {isMutation && <span className="mutation-star" aria-label="Rare mutation">✦</span>}
      </div>
      <span className="form-name">{look.name}</span>
      <span className="form-kind">
        {isMutation ? 'Rare mutation' : 'Base form'} · owned ×{formatNumber(count)}
      </span>
      {choosing ? (
        <div className="form-action form-action-chooser">
          <SwapChooser species={species.id} variant={variant} onDone={closeChooser} />
        </div>
      ) : (
        <button
          ref={toggleRef}
          type="button"
          className={`grove-toggle form-action${inGrove ? ' in-grove' : ''}${needsSwap ? ' swap-in' : ''}`}
          aria-pressed={needsSwap ? undefined : inGrove}
          aria-expanded={needsSwap ? false : undefined}
          title={needsSwap ? 'The grove is full: choose a familiar to swap out' : undefined}
          onClick={() => (needsSwap ? setChoosing(true) : store.toggleDisplayed(species.id, variant))}
        >
          {inGrove ? 'In grove ✓' : speciesInGrove ? 'Swap form into grove' : needsSwap ? '⇄ Swap in' : 'Place in grove'}
        </button>
      )}
    </div>
  );
}
