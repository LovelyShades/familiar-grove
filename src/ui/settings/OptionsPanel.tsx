import { useEffect, useId, useState, type CSSProperties } from 'react';
import { store, useGameState } from '../../app/gameStore';
import { audio } from '../../audio';
import { TIME_SPEEDS } from '../../game/config';
import { formatDuration, formatNumber } from '../../game/format';
import type { AudioSettings } from '../../game/state';
import { Modal } from '../Modal';
import './settings.css';
import './theme-light.css';

function speedLabel(speed: number): string {
  if (speed === 1) return '1× · normal';
  return speed > 1 ? `${speed}× faster` : `${speed}× slower`;
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="opt-row">
      <label className="opt-label" htmlFor={id}>
        {label}
        {hint && <span className="opt-hint">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`opt-switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="opt-knob" />
      </button>
    </div>
  );
}

function VolumeSlider({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className="opt-row opt-slider-row">
      <label className="opt-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ '--fill': `${pct}%` } as CSSProperties}
      />
      <output htmlFor={id} className="opt-value">
        {pct}%
      </output>
    </div>
  );
}

export function OptionsPanel({ open, onClose, onReplayTour }: { open: boolean; onClose: () => void; onReplayTour?: () => void }) {
  const state = useGameState();
  const s = state.settings;
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const speedId = useId();
  const resetId = useId();

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setTyped('');
    }
  }, [open]);

  const setAudio = (patch: Partial<AudioSettings>, previewSound = false) => {
    const next = { ...s.audio, ...patch };
    audio.applySettings(next); // immediate, before the store round-trip
    store.updateSettings({ audio: next });
    if (previewSound) audio.preview();
  };

  const speedIndex = Math.max(0, TIME_SPEEDS.indexOf(s.timeSpeed));
  const doReset = () => {
    // close the menu first, so the fresh game (title screen and tour) starts on a clean screen
    onClose();
    setConfirming(false);
    setTyped('');
    store.reset();
  };

  return (
    <Modal open={open} onClose={onClose} title="Options" className="options-modal">
      <section className="opt-section" aria-labelledby={`${speedId}-appearance`}>
        <h3 id={`${speedId}-appearance`} className="opt-heading">Interface Style</h3>
        <div className="opt-segmented" role="radiogroup" aria-label="Interface style">
          {(['dark', 'light'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={s.theme === theme}
              className={s.theme === theme ? 'active' : ''}
              onClick={() => store.updateSettings({ theme })}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 2.5a9.5 9.5 0 1 0 6 16.8A8 8 0 0 1 15.5 2.5Z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19 9l-7 12.5L5 9z" /><path d="M5 9h14M9.5 9 12 21.5 14.5 9 12 2.5 9.5 9" /></svg>
              )}
              {theme === 'dark' ? 'Moonlit Night' : 'Moonstone Glass'}
            </button>
          ))}
        </div>
        <p className="opt-note">Changes the panels and buttons only. The forest and its creatures always keep their original colours.</p>
      </section>

      <section className="opt-section">
        <h3 className="opt-heading">Time Flow</h3>
        <div className="opt-row opt-slider-row">
          <label className="opt-label" htmlFor={speedId}>
            Speed of passive Aether
          </label>
          <input
            id={speedId}
            type="range"
            min={0}
            max={TIME_SPEEDS.length - 1}
            step={1}
            value={speedIndex}
            aria-valuetext={speedLabel(s.timeSpeed)}
            onChange={(e) => store.updateSettings({ timeSpeed: TIME_SPEEDS[Number(e.target.value)] })}
            style={{ '--fill': `${(speedIndex / (TIME_SPEEDS.length - 1)) * 100}%` } as CSSProperties}
          />
          <output htmlFor={speedId} className="opt-value wide">
            {speedLabel(s.timeSpeed)}
          </output>
        </div>
        <p className="opt-note">Speeds up or slows down the Aether your grove gathers over time. Normal is 1×. Takes effect immediately.</p>
      </section>

      <section className="opt-section">
        <h3 className="opt-heading">Sound</h3>
        <VolumeSlider label="Master" value={s.audio.master} disabled={s.audio.muted} onChange={(v) => setAudio({ master: v })} />
        <VolumeSlider label="Ambience" value={s.audio.ambience} disabled={s.audio.muted} onChange={(v) => setAudio({ ambience: v })} />
        <VolumeSlider label="Effects" value={s.audio.effects} disabled={s.audio.muted} onChange={(v) => setAudio({ effects: v }, true)} />
        <Toggle label="Mute all sound" checked={s.audio.muted} onChange={(muted) => setAudio({ muted })} />
      </section>

      <section className="opt-section">
        <h3 className="opt-heading">Motion &amp; Summoning</h3>
        <Toggle
          label="Reduced motion"
          hint="Calmer scene: no parallax, gentler idle movement, fewer particles."
          checked={s.reducedMotion}
          onChange={(reducedMotion) => store.updateSettings({ reducedMotion })}
        />
        <Toggle
          label="Parallax depth"
          hint="Scenery layers shift gently with your pointer. Off keeps the forest still."
          checked={s.parallax && !s.reducedMotion}
          disabled={s.reducedMotion}
          onChange={(parallax) => store.updateSettings({ parallax })}
        />
        <Toggle
          label="Quick summon"
          hint="Skip the long portal reveal when calling familiars."
          checked={s.quickSummon}
          onChange={(quickSummon) => store.updateSettings({ quickSummon })}
        />
      </section>


      {onReplayTour && (
        <section className="opt-section">
          <h3 className="opt-heading">Help</h3>
          <div className="opt-row">
            <span className="opt-label">
              Guided tour
              <span className="opt-hint">Walk through the grove, upgrades and summoning again.</span>
            </span>
            <button type="button" className="opt-tour-btn" onClick={onReplayTour}>
              Replay tour
            </button>
          </div>
        </section>
      )}

      <section className="opt-section">
        <h3 className="opt-heading">Grove Records</h3>
        <dl className="opt-stats">
          <div><dt>Lifetime Aether</dt><dd>{formatNumber(state.lifetimeAether)}</dd></div>
          <div><dt>Heartwood clicks</dt><dd>{formatNumber(state.clicks)}</dd></div>
          <div><dt>Familiars called</dt><dd>{formatNumber(state.summons)}</dd></div>
          <div><dt>Mutations found</dt><dd>{formatNumber(Object.values(state.collection).filter((c) => c.mutation > 0).length)}</dd></div>
          <div><dt>Time in the grove</dt><dd>{formatDuration(state.playSeconds)}</dd></div>
        </dl>
      </section>

      <section className="opt-section opt-danger" aria-labelledby={resetId}>
        <h3 id={resetId} className="opt-heading">Reset Save</h3>
        {!confirming ? (
          <>
            <p className="opt-note">Start over from a single seed. Your settings return to their defaults too.</p>
            <button type="button" className="opt-danger-btn" onClick={() => setConfirming(true)}>
              Reset all progress…
            </button>
          </>
        ) : (
          <div className="opt-confirm" role="alertdialog" aria-label="Confirm reset">
            <p>
              This erases all Aether, upgrades and familiars. It cannot be undone.
              <br />
              Type <strong>RESET</strong> or press Confirm.
            </p>
            <input
              className="opt-confirm-input"
              aria-label="Type RESET to confirm"
              value={typed}
              autoFocus
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && typed.trim().toUpperCase() === 'RESET') doReset();
              }}
              placeholder="RESET"
            />
            <div className="opt-confirm-actions">
              <button type="button" className="opt-secondary-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="opt-danger-btn" onClick={doReset}>
                Confirm reset
              </button>
            </div>
          </div>
        )}
      </section>
    </Modal>
  );
}
