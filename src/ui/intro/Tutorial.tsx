import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import './intro.css';

interface Step {
  /** CSS selector of the element to spotlight (null = centred, no spotlight). */
  target: string | null;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    target: null,
    title: 'Welcome to Familiar Grove',
    text: 'A quick tour of your enchanted grove. It takes about half a minute.',
  },
  {
    target: '.tree-target',
    title: 'The Heartwood Tree',
    text: 'Tap the glowing heart to gather Aether, the magic that powers everything in the grove.',
  },
  {
    target: '.resource-bar',
    title: 'Your Aether',
    text: 'Your total Aether, how much each tap gives, and how much your grove gathers every second.',
  },
  {
    target: '.spell-card:not(.calling-card)',
    title: 'Arcane Touch',
    text: 'Spend Aether to make every tap stronger. The price rises with each level, and Buy ×10 / Max saves clicks later.',
  },
  {
    target: '.upgrade-list',
    title: 'Grove Upgrades',
    text: 'These gather Aether on their own, even while you are away. New ones appear as your grove grows.',
  },
  {
    target: '.calling-card',
    title: 'Mystery Summon',
    text: 'Call a random mythical familiar. Rare mutations are possible, and bonding with a familiar raises its odds.',
  },
  {
    target: '.navbar',
    title: 'Bestiary & Options',
    text: 'Track your collection and choose who lives in your grove in the Bestiary. Theme, time speed and sound live in Options.',
  },
  {
    target: '.level-card',
    title: 'Grow your grove',
    text: 'Lifetime Aether raises your Grove Level and lets new familiars answer the call. Enjoy your grove!',
  },
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 10;

function measure(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

/**
 * First-time guided tour: everything is frosted except the part being
 * explained, which is outlined with a soft glow; a small card explains it.
 */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // bring the target into view (the sidebar scrolls), then keep the spotlight on it
  useLayoutEffect(() => {
    const el = step.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    const update = () => {
      setRect(measure(step.target));
      setView({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    const t = window.setInterval(update, 250);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', update);
    };
  }, [step.target]);

  const next = useCallback(() => (last ? onDone() : setIndex((i) => i + 1)), [last, onDone]);
  const back = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, onDone]);

  // card placement: beside the spotlight where there is room, clamped on screen
  const cardW = Math.min(340, view.w - 32);
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = { left: (view.w - cardW) / 2, top: view.h * 0.36, width: cardW };
  } else {
    const below = rect.y + rect.h + 14;
    const fitsBelow = below + 190 < view.h;
    const right = rect.x + rect.w + 16;
    const fitsRight = right + cardW < view.w - 16 && rect.h < view.h * 0.7;
    const fitsLeft = rect.x - 16 - cardW > 16;
    let left: number;
    let top: number;
    if (fitsBelow && rect.h < view.h * 0.55) {
      left = rect.x + rect.w / 2 - cardW / 2;
      top = below;
    } else if (fitsLeft) {
      left = rect.x - 16 - cardW;
      top = rect.y + 8;
    } else if (fitsRight) {
      left = right;
      top = rect.y + 8;
    } else {
      left = rect.x + rect.w / 2 - cardW / 2;
      top = Math.max(16, rect.y - 200);
    }
    left = Math.max(16, Math.min(left, view.w - cardW - 16));
    top = Math.max(16, Math.min(top, view.h - 210));
    cardStyle = { left, top, width: cardW };
  }

  // ONE continuous full-viewport frost layer. The spotlight is a hole cut with a
  // mask (full layer XOR the target rectangle). Separate blurred panes would
  // each blur only their own area and show seams where they meet.
  const frostStyle: React.CSSProperties = rect
    ? ({
        ['--hole-x' as string]: `${rect.x}px`,
        ['--hole-y' as string]: `${rect.y}px`,
        ['--hole-w' as string]: `${rect.w}px`,
        ['--hole-h' as string]: `${rect.h}px`,
      } as React.CSSProperties)
    : {};

  return (
    <div className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-text">
      <div className={`tutorial-frost${rect ? ' has-hole' : ''}`} style={frostStyle} />
      {rect && <div className="tutorial-spotlight" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}

      <div className="glass tutorial-card" style={cardStyle} key={index}>
        <div className="tutorial-step">
          Step {index + 1} of {STEPS.length}
        </div>
        <h2 id="tutorial-title">{step.title}</h2>
        <p id="tutorial-text">{step.text}</p>
        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === index ? 'on' : i < index ? 'done' : ''} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-skip" onClick={onDone}>
            Skip tour
          </button>
          <span className="tutorial-nav">
            {index > 0 && (
              <button type="button" className="tutorial-back" onClick={back}>
                Back
              </button>
            )}
            <button type="button" className="tutorial-next" onClick={next} autoFocus>
              {last ? 'Start playing' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
