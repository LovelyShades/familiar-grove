const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function compact(n: number): string {
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace('e+', 'e');
  const v = n / 10 ** (tier * 3);
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  return (Math.floor(v * 10 ** digits) / 10 ** digits).toFixed(digits) + SUFFIXES[tier];
}

/** Whole amounts: 12,850 below a million; 4.21M, 3.00T above; scientific past Dc. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  return compact(n);
}

/** Rates and benefits, which can be fractional: 0.5, 2.4, 248, 1.20M. */
export function formatRate(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n === 0) return '0';
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  return compact(n);
}

/** Readable time spans: "45 sec", "16 min", "2 hr 5 min", "3 days 4 hr". Never "16M" (which reads as millions). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} hr` : ''}`;
  if (h > 0) return `${h} hr${m ? ` ${m} min` : ''}`;
  if (m > 0) return `${m} min`;
  return `${Math.max(1, s)} sec`;
}
