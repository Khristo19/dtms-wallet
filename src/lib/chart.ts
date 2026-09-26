import type { PricePoint } from './rpc';

export const STABLE_PRICE_IDS = new Set(['usd-coin', 'tether']);

export interface Holding {
  priceId: string;
  /** Token amount (not base units). */
  amount: number;
  /** Current USD value. */
  usd: number;
  /** 24h change in percent, if known. */
  change24h: number | null;
}

/** Linear interpolation of a price series at time t (clamped to the ends). */
export function priceAt(points: PricePoint[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (t >= last[0]) return last[1];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]![0] <= t) lo = mid;
    else hi = mid;
  }
  const [t0, p0] = points[lo]!;
  const [t1, p1] = points[hi]!;
  return p0 + ((p1 - p0) * (t - t0)) / (t1 - t0);
}

/**
 * Portfolio value over time using current holdings × historical prices (the usual wallet approach).
 * Stablecoins count at their current value. Returns null when there is nothing volatile to chart
 * or a needed price history is missing.
 */
export function portfolioSeries(holdings: Holding[], history: Record<string, PricePoint[]>, points = 60): number[] | null {
  const stableUsd = holdings.filter((h) => STABLE_PRICE_IDS.has(h.priceId)).reduce((s, h) => s + h.usd, 0);
  const amounts = new Map<string, number>();
  for (const h of holdings) {
    if (STABLE_PRICE_IDS.has(h.priceId) || h.amount <= 0) continue;
    amounts.set(h.priceId, (amounts.get(h.priceId) ?? 0) + h.amount);
  }
  if (amounts.size === 0) return null;

  const series = [...amounts.keys()].map((id) => history[id]);
  if (series.some((s) => !s || s.length < 2)) return null;
  const start = Math.max(...series.map((s) => s![0]![0]));
  const end = Math.min(...series.map((s) => s![s!.length - 1]![0]));
  if (end <= start) return null;

  const ids = [...amounts.entries()];
  return Array.from({ length: points }, (_, k) => {
    const t = start + ((end - start) * k) / (points - 1);
    return stableUsd + ids.reduce((sum, [id, amt]) => sum + amt * priceAt(history[id]!, t), 0);
  });
}

/** Today's USD change of the whole portfolio from each asset's 24h change. */
export function dayChange(holdings: Holding[]): { abs: number; pct: number } {
  let abs = 0;
  let before = 0;
  for (const h of holdings) {
    const prev = h.change24h === null ? h.usd : h.usd / (1 + h.change24h / 100);
    abs += h.usd - prev;
    before += prev;
  }
  return { abs, pct: before > 0 ? (abs / before) * 100 : 0 };
}

/**
 * SVG path in the handoff's 390×110 sparkline box: x spans 0…372 (room for the end dot),
 * y spans 20 (max) … 100 (min). A flat or missing series renders as a flat line.
 */
export function sparkPath(series: number[] | null, xMax = 372, yTop = 20, yBottom = 100) {
  const data = series && series.length >= 2 ? series : [0, 0];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i): [number, number] => {
    const x = (xMax * i) / (data.length - 1);
    const y = max === min ? (yTop + yBottom) / 2 : yBottom - ((v - min) / (max - min)) * (yBottom - yTop);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const [lastX, lastY] = pts[pts.length - 1]!;
  return { line, area: `${line} L${lastX} 110 L0 110 Z`, lastX, lastY, up: data[data.length - 1]! >= data[0]! };
}
