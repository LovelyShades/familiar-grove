import { useCallback, useEffect, useRef, useState } from 'react';
import { GroveScene } from '../scene/GroveScene';
import type { HostRect } from '../scene/sceneApi';
import { store, useGameEvents, useGameState } from './gameStore';
import { audio } from '../audio';
import { formatDuration, formatNumber, formatRate } from '../game/format';
import { perClick } from '../game/economy';
import { appearanceOf, SPECIES_BY_ID } from '../game/registry';
import { levelReward } from '../game/progression';
import { CLICK_MILESTONE_EVERY, PASSIVE_MILESTONE_EVERY, UPGRADES_BY_ID } from '../game/config';
import type { DisplayedFamiliar } from '../game/state';
import { uiEvents } from './uiEvents';
import { FamiliarTip } from '../ui/FamiliarTip';
import { TitleScreen } from '../ui/intro/TitleScreen';
import { Tutorial } from '../ui/intro/Tutorial';
import { Awakening } from '../ui/intro/Awakening';
import { SPECIES, type SpeciesDef } from '../game/registry';
import { TopBar } from '../ui/TopBar';
import { Sidebar } from '../ui/Sidebar';
import { NavBar, type Panel } from '../ui/NavBar';
import { SummonChamber } from '../ui/summon/SummonChamber';
import { Bestiary } from '../ui/bestiary/Bestiary';
import { OptionsPanel } from '../ui/settings/OptionsPanel';

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
}

interface Toast {
  id: number;
  title: string;
  body: string;
  tone?: 'rare' | 'level';
}

let nextId = 1;

export function App() {
  const state = useGameState();
  const [panel, setPanel] = useState<Panel>('grove');
  const [tip, setTip] = useState<{ familiar: DisplayedFamiliar; x: number; y: number; pinned: boolean } | null>(null);
  // opening scene, then (first time only, or on request) the guided tour
  const [showTitle, setShowTitle] = useState(true);
  const [touring, setTouringRaw] = useState(false);
  /** Starting the tour always returns to the grove first, so it highlights the real HUD, never a menu. */
  const setTouring = useCallback((on: boolean) => {
    if (on) {
      setPanel('grove');
      setTip(null);
    }
    setTouringRaw(on);
  }, []);
  // "Something awakens…": new species became summonable at this grove level
  const [awakening, setAwakening] = useState<{ level: number; species: SpeciesDef[] } | null>(null);
  const [treeRect, setTreeRect] = useState<HostRect | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sceneRef = useRef<GroveScene | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLImageElement>(null);

  // ---- scene lifecycle
  useEffect(() => {
    const scene = new GroveScene();
    sceneRef.current = scene;
    const s = store.getSnapshot();
    scene.setReducedMotion(s.settings.reducedMotion);
    scene.setParallax(s.settings.parallax);
    scene.setFamiliars(s.displayed);
    scene.onTreeRect(setTreeRect);
    // hovering shows a light tooltip; a tap pins it until dismissed
    scene.onFamiliarPointer((hit) => setTip((current) => (hit ? hit : current?.pinned ? current : null)));
    const stopHighlight = uiEvents.onHighlight((species) => sceneRef.current?.highlightFamiliar(species));
    scene.mount(hostRef.current!).catch((err) => console.error('[Familiar Grove] Scene failed to start', err));
    return () => {
      stopHighlight();
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  // ---- keep the scene, theme and audio in sync with settings
  const { theme, reducedMotion, parallax, audio: audioSettings } = state.settings;
  // The UI theme only restyles interface elements. The forest artwork is never
  // re-coloured by it: environment lighting is independent of the UI theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
  }, [reducedMotion]);
  useEffect(() => {
    sceneRef.current?.setParallax(parallax);
  }, [parallax]);
  useEffect(() => {
    audio.applySettings(audioSettings);
  }, [audioSettings]);
  useEffect(() => {
    sceneRef.current?.setFamiliars(state.displayed);
  }, [state.displayed]);

  // aim click particles at the Aether crystal in the top bar
  useEffect(() => {
    const aim = () => {
      const icon = counterRef.current?.getBoundingClientRect();
      const host = hostRef.current?.getBoundingClientRect();
      if (icon && host) sceneRef.current?.setCounterTarget(icon.left + icon.width / 2 - host.left, icon.top + icon.height / 2 - host.top);
    };
    aim();
    window.addEventListener('resize', aim);
    const t = window.setTimeout(aim, 500); // after fonts settle
    return () => {
      window.removeEventListener('resize', aim);
      clearTimeout(t);
    };
  }, []);

  // audio may only start after a user gesture
  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      audio.applySettings(store.getSnapshot().settings.audio);
      audio.setAmbience(true);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ---- toasts
  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4800);
  }, []);

  useGameEvents((e) => {
    switch (e.type) {
      case 'levelup': {
        audio.play('levelUp');
        const unlocked = SPECIES.filter((s) => s.unlock.groveLevel === e.level);
        if (unlocked.length) {
          // a bigger moment than a toast: these familiars can now be summoned
          setAwakening((cur) => (cur ? { level: e.level, species: [...cur.species, ...unlocked] } : { level: e.level, species: unlocked }));
        } else {
          pushToast({ title: `Grove Level ${e.level}`, body: levelReward(e.level).long, tone: 'level' });
        }
        break;
      }
      case 'offline':
        pushToast({
          title: 'Welcome back',
          body: `Your grove gathered ${formatNumber(e.gain)} Aether while you were away (${formatDuration(e.seconds)}).`,
        });
        break;
      case 'summon': {
        const r = e.result;
        if (r.newSpecies && store.getSnapshot().displayed.some((d) => d.species === r.species && d.variant === r.variant)) {
          sceneRef.current?.celebrateArrival({ species: r.species, variant: r.variant });
        }
        break;
      }
      case 'purchase': {
        const def = UPGRADES_BY_ID[e.id];
        const newLevel = store.getSnapshot().upgrades[e.id];
        const every = def.kind === 'passive' ? PASSIVE_MILESTONE_EVERY : CLICK_MILESTONE_EVERY;
        const milestone = Math.floor(newLevel / every) > Math.floor((newLevel - e.levels) / every);
        sceneRef.current?.playUpgradeEffect(e.id, { levelsBought: e.levels, newLevel, milestone });
        if (milestone && def.kind !== 'clickMultiplier') {
          pushToast({ title: `${def.name} · Level ${newLevel}`, body: 'A milestone! Its power doubles.', tone: 'level' });
        }
        break;
      }
      case 'reset':
        setPanel('grove');
        setTouring(false);
        setShowTitle(true);
        pushToast({ title: 'A new beginning', body: 'The grove returns to a quiet seedling. Your journey begins anew.' });
        break;
    }
  }, [pushToast]);

  // ---- clicking the Heartwood
  const clickTree = (x: number, y: number) => {
    const amount = store.click();
    audio.play('click');
    sceneRef.current?.clickFeedback(x, y, amount);
    const id = nextId++;
    setFloaters((list) => [...list.slice(-14), { id, x: x + (Math.random() - 0.5) * 24, y, text: `+${formatRate(amount)}` }]);
    window.setTimeout(() => setFloaters((list) => list.filter((f) => f.id !== id)), 1100);
  };

  const onTreePointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const host = hostRef.current!.getBoundingClientRect();
    clickTree(e.clientX - host.left, e.clientY - host.top);
  };

  const onTreeKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && treeRect) {
      e.preventDefault();
      if (e.repeat) return;
      clickTree(treeRect.x + treeRect.width / 2, treeRect.y + treeRect.height * 0.45);
    }
  };

  const navigate = (p: Panel) => {
    if (p !== panel) audio.play(p === 'grove' ? 'uiClose' : 'uiOpen');
    setPanel(p);
  };
  const close = useCallback(() => {
    audio.play('uiClose');
    setPanel('grove');
  }, []);

  const firstFamiliar = state.displayed[0];

  return (
    <div className="grove-app">
      <div className="scene-host" ref={hostRef} />

      {treeRect && (
        <button
          type="button"
          className="tree-target"
          style={{ left: treeRect.x, top: treeRect.y, width: treeRect.width, height: treeRect.height }}
          onPointerDown={onTreePointer}
          onKeyDown={onTreeKey}
          aria-label={`Channel Aether from the Heartwood Tree (+${formatRate(perClick(state))} per click)`}
          title="Channel Aether"
        />
      )}

      <div className="floaters" aria-hidden="true">
        {floaters.map((f) => (
          <span key={f.id} className="floater" style={{ left: f.x, top: f.y }}>
            {f.text}
          </span>
        ))}
      </div>

      <div className="hud">
        <TopBar state={state} onOpenOptions={() => navigate('options')} counterRef={counterRef} />
        <Sidebar state={state} onOpenSummon={() => navigate('summon')} onOpenBestiary={() => navigate('bestiary')} />
        <NavBar active={panel} onNavigate={navigate} />
      </div>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`glass toast${t.tone ? ` ${t.tone}` : ''}`}>
            <strong>{t.title}</strong>
            <span>{t.body}</span>
          </div>
        ))}
      </div>

      {state.clicks === 0 && panel === 'grove' && !showTitle && !touring && (
        <div className="first-hint" aria-hidden="true">
          Tap the Heartwood to gather Aether
          {firstFamiliar && <span className="hint-sub">{SPECIES_BY_ID[firstFamiliar.species] && appearanceOf(firstFamiliar.species, firstFamiliar.variant).name} is watching…</span>}
        </div>
      )}

      {tip && panel === 'grove' && (
        <FamiliarTip
          tip={tip}
          state={state}
          onClose={() => setTip(null)}
          onOpenBestiary={() => {
            setTip(null);
            navigate('bestiary');
          }}
        />
      )}

      {awakening && !showTitle && !touring && (
        <Awakening
          level={awakening.level}
          species={awakening.species}
          onSummon={() => {
            setAwakening(null);
            navigate('summon');
          }}
          onClose={() => setAwakening(null)}
        />
      )}

      {touring && (
        <Tutorial
          onDone={() => {
            setTouring(false);
            store.setTutorialDone(true);
          }}
        />
      )}

      {showTitle && (
        <TitleScreen
          state={state}
          onStart={() => {
            setShowTitle(false);
            if (!store.getSnapshot().tutorialDone) setTouring(true);
          }}
          onHowToPlay={() => {
            setShowTitle(false);
            setTouring(true);
          }}
        />
      )}

      <SummonChamber open={panel === 'summon'} onClose={close} />
      <Bestiary open={panel === 'bestiary'} onClose={close} />
      <OptionsPanel
        open={panel === 'options'}
        onClose={close}
        onReplayTour={() => {
          setPanel('grove');
          setTouring(true);
        }}
      />
    </div>
  );
}
