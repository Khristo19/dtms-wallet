import type { Network } from '@/src/lib/networks';
import { HexGlyph } from '../icons';
import { cx } from './ui';

/** Coin avatar colors (DESIGN.md: SOL, BTC, USDC; the rest extend the palette). Theme tokens, same in both appearances. */
const COIN_COLORS: Record<string, string> = {
  SOL: 'var(--color-coin-sol)',
  BTC: 'var(--color-coin-btc)',
  USDC: 'var(--color-coin-usdc)',
  ETH: 'var(--color-coin-eth)',
  POL: 'var(--color-coin-pol)',
  USDT: 'var(--color-coin-usdt)',
};

const NETWORK_BADGES: Record<string, string> = {
  sepolia: 'E', ethereum: 'E',
  'arbitrum-sepolia': 'A', arbitrum: 'A',
  'base-sepolia': 'B', base: 'B',
  'polygon-amoy': 'P', polygon: 'P',
  'solana-devnet': 'S', solana: 'S',
};

/** Solid circle with the coin's initial (handoff: 38px, 16/700) plus a small network badge. */
export function CoinAvatar({ symbol, network, size = 38 }: { symbol: string; network?: Network; size?: number }) {
  const b = Math.round(size * 0.42);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex size-full items-center justify-center rounded-full font-bold text-on-accent"
        style={{ background: COIN_COLORS[symbol] ?? 'var(--color-coin-other)', fontSize: Math.round(size * 0.42) }}
      >
        {symbol[0]}
      </div>
      {network && (
        <div
          className="absolute -right-[3px] -bottom-[3px] flex items-center justify-center rounded-full border-2 border-badge-ring font-bold text-on-accent"
          // Chain brand colors are data (networks.ts), not theme colors.
          style={{ width: b, height: b, background: network.color, fontSize: Math.round(b * 0.52) }}
          title={network.name}
        >
          {NETWORK_BADGES[network.id] ?? network.name[0]}
        </div>
      )}
    </div>
  );
}

/** Gray gradient initials avatar (handoff top-right "NT" button). */
export function AccountAvatar({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  return (
    <div
      role="img"
      aria-label={name}
      className={cx('flex shrink-0 items-center justify-center rounded-full border border-avatar-border font-semibold text-on-accent', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: 'linear-gradient(180deg, var(--dt-avatar-from), var(--dt-avatar-to))' }}
    >
      {initials(name)}
    </div>
  );
}

/** Orange gradient recipient avatar (handoff Send sheet "M"). */
export function RecipientAvatar({ label, size = 44 }: { label: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-on-accent"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.41), background: 'linear-gradient(180deg, var(--dt-recipient-from), var(--dt-recipient-to))' }}
    >
      {label.replace(/^0x/i, '').charAt(0).toUpperCase() || '?'}
    </div>
  );
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** 84pt app icon: black (light) / #1C1C1E with border and blue glow (dark), soft highlight, hexagon glyph. */
export function AppIcon({ size = 84 }: { size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center self-center overflow-hidden border border-solid shadow-icon"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.238, // 20 at 84pt
        background: 'var(--dt-icon-bg)',
        borderColor: 'var(--dt-icon-border)',
        color: 'var(--dt-on-accent)',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 70% at 20% 10%, color-mix(in srgb, var(--dt-on-accent) 28%, transparent), transparent 60%)' }} />
      <HexGlyph size={Math.round(size * 0.52)} />
    </div>
  );
}
