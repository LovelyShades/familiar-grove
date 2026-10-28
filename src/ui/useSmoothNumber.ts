import { useEffect, useRef, useState } from 'react';

/**
 * Follows `value`, but glides over ~350ms when it DROPS noticeably (e.g. after a
 * purchase) so the counter visibly "spends" instead of snapping. Increases are
 * shown instantly so clicks and income always feel immediate.
 */
export function useSmoothNumber(value: number, durationMs = 350): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    cancelAnimationFrame(frame.current);
    const bigDrop = value < from && from - value > Math.max(1, from * 0.02);
    if (!bigDrop || document.documentElement.classList.contains('reduced-motion')) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (value - from) * eased;
      shownRef.current = v;
      setShown(v);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, durationMs]);

  return shown;
}
