import { describe, expect, it } from 'vitest';
import { dayChange, portfolioSeries, priceAt, sparkPath, type Holding } from '../src/lib/chart';
import type { PricePoint } from '../src/lib/rpc';

const h = (priceId: string, amount: number, usd: number, change24h: number | null = null): Holding => ({ priceId, amount, usd, change24h });

describe('priceAt', () => {
  const pts: PricePoint[] = [[0, 10], [10, 20], [20, 40]];
  it('interpolates and clamps', () => {
    expect(priceAt(pts, 5)).toBe(15);
    expect(priceAt(pts, 15)).toBe(30);
    expect(priceAt(pts, -5)).toBe(10);
    expect(priceAt(pts, 99)).toBe(40);
  });
});

describe('portfolioSeries', () => {
  it('combines holdings × history plus stablecoins', () => {
    const history = { solana: [[0, 100], [100, 200]] as PricePoint[] };
    const s = portfolioSeries([h('solana', 2, 400), h('usd-coin', 50, 50)], history, 3)!;
    expect(s).toEqual([250, 350, 450]);
  });

  it('uses the overlapping window of multiple series', () => {
    const history = {
      solana: [[0, 1], [100, 1]] as PricePoint[],
      ethereum: [[50, 2], [150, 4]] as PricePoint[],
    };
    const s = portfolioSeries([h('solana', 1, 1), h('ethereum', 1, 4)], history, 2)!;
    expect(s).toEqual([1 + 2, 1 + 3]); // window 50…100
  });

  it('returns null with only stablecoins or missing history', () => {
    expect(portfolioSeries([h('usd-coin', 10, 10)], {})).toBeNull();
    expect(portfolioSeries([h('solana', 1, 100)], {})).toBeNull();
  });
});

describe('dayChange', () => {
  it('derives absolute and percent change from 24h changes', () => {
    const { abs, pct } = dayChange([h('solana', 1, 110, 10), h('usd-coin', 100, 100, 0)]);
    expect(abs).toBeCloseTo(10);
    expect(pct).toBeCloseTo(5);
  });
});

describe('sparkPath', () => {
  it('maps into the 390×110 box', () => {
    const p = sparkPath([1, 2, 3]);
    expect(p.line).toBe('M0 100 L186 60 L372 20');
    expect(p.up).toBe(true);
  });
  it('draws a flat line for missing data', () => {
    expect(sparkPath(null).line).toBe('M0 60 L372 60');
  });
});
