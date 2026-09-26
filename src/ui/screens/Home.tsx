import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dayChange, portfolioSeries, sparkPath } from '@/src/lib/chart';
import { formatAmount, formatUsd } from '@/src/lib/format';
import type { ChartRange } from '@/src/lib/rpc';
import { AccountSheet } from '../components/AccountSheet';
import { AccountAvatar, CoinAvatar } from '../components/Avatars';
import { cx, LargeTitle, Segmented, Separator, Skeleton } from '../components/ui';
import { ArrowDownCircleFill, ArrowUpCircleFill, Chevron, EyeFill, EyeSlashFill, PlusCircleFill, PopupWindow, SidebarRight, SwapCircleFill, Triangle } from '../icons';
import { IS_PANEL, switchSurface, useWindowId } from '../surface';
import { toHoldings, useAccount, useAssets, useStore, volatileIds, type Asset } from '../store';

const RANGES: ChartRange[] = ['1D', '1W', '1M', '1Y', 'All'];
const HIDDEN = '••••';

export function Home() {
  const { balances, hideBalance, toggleHideBalance, range, setRange, history, loadHistory, push, showToast, wallet, setWallet, guard } = useStore();
  const windowId = useWindowId();
  const account = useAccount();
  const assets = useAssets();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const loaded = balances !== null;

  const holdings = toHoldings(assets);
  const total = holdings.reduce((s, h) => s + h.usd, 0);
  const change = dayChange(holdings);
  const ids = volatileIds(assets);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (loaded) void loadHistory(range, ids);
  }, [range, idsKey, loaded]);

  const series = portfolioSeries(holdings, history[range] ?? {});
  const [chartRef, chartWidth] = useElementWidth(390);
  // End dot sits 18px in from the right edge, as in the handoff (372 of 390).
  const spark = sparkPath(series, chartWidth - 18);

  // Handoff shows only a few coins; show every held asset plus native coins so empty wallets aren't blank.
  const visible = assets.filter((a) => a.balance > 0n || a.meta.address === null);
  visible.sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || Number(b.balance > 0n) - Number(a.balance > 0n));

  const [whole, cents] = splitUsd(total);
  const up = change.abs >= 0;

  return (
    <div className="relative h-full">
      <div className="scroll-area h-full">
        <div className="relative flex min-h-full flex-col gap-[14px] px-4 pt-4 pb-[110px]">
          {/* Top buttons */}
          <div className="relative flex items-center justify-end gap-[10px]">
            {wallet?.networkMode === 'testnet' && (
              <span className="mr-auto rounded-full bg-warning/15 px-[10px] py-1 text-caption font-semibold text-warning-text">Testnet</span>
            )}
            <button
              aria-label={IS_PANEL ? 'Switch to popup' : 'Open in side panel'}
              title={IS_PANEL ? 'Switch to popup' : 'Open in side panel'}
              onClick={() => guard(async () => setWallet(await switchSurface(IS_PANEL ? 'popup' : 'panel', windowId)))}
              className="glass-sm flex size-11 items-center justify-center rounded-full"
            >
              {IS_PANEL ? <PopupWindow /> : <SidebarRight />}
            </button>
            <button
              aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
              aria-pressed={hideBalance}
              onClick={toggleHideBalance}
              className="glass-sm flex size-11 items-center justify-center rounded-full"
            >
              {hideBalance ? <EyeSlashFill /> : <EyeFill />}
            </button>
            <button
              aria-label="Accounts"
              onClick={() => setAccountsOpen(true)}
              className="rounded-full border-0 bg-transparent p-0 shadow-avatar"
            >
              <AccountAvatar name={account?.name ?? '?'} />
            </button>
          </div>

          {/* Title + balance */}
          <div className="relative flex flex-col gap-[2px] px-1">
            <LargeTitle>Wallet</LargeTitle>
            <div className="mt-[6px] flex h-[54px] items-end">
              {!loaded ? (
                <Skeleton className="h-[46px] w-[230px] rounded-xl" />
              ) : (
                <div className="num text-balance">
                  {hideBalance ? (
                    <span className="text-label-3">••••••</span>
                  ) : (
                    <>
                      {whole}
                      <span className="text-label-3">{cents}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className={cx('flex items-center gap-1 text-callout font-semibold', up ? 'text-positive-text' : 'text-negative-text')}>
              <Triangle down={!up} />
              {hideBalance ? HIDDEN : `${formatUsd(Math.abs(change.abs))} (${Math.abs(change.pct).toFixed(1)}%)`}{' '}
              <span className="font-normal text-label-2">Today</span>
            </div>
          </div>

          {/* Sparkline */}
          <div ref={chartRef} className={cx('relative -mx-4 h-[110px] shrink-0', spark.up ? 'text-positive' : 'text-negative')}>
            <svg width={chartWidth} height="110" viewBox={`0 0 ${chartWidth} 110`} fill="none" role="img" aria-label={`Portfolio value chart, ${range}`}>
              <defs>
                <linearGradient id="dtms-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={spark.area} fill="url(#dtms-area)" />
              <path d={spark.line} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {/* End-dot ring matches the background. */}
              <circle cx={spark.lastX} cy={spark.lastY} r="5" fill="currentColor" strokeWidth="2.5" className="stroke-chart-ring" />
            </svg>
          </div>

          {/* Range segmented control */}
          <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />

          {/* Action tiles */}
          <div className="relative grid shrink-0 grid-cols-4 gap-[10px]">
            <Tile primary icon={<ArrowUpCircleFill />} label="Send" onClick={() => push({ name: 'send' })} />
            <Tile icon={<ArrowDownCircleFill />} label="Receive" onClick={() => push({ name: 'receive' })} />
            <Tile icon={<SwapCircleFill />} label="Swap" onClick={() => showToast('Swaps are coming soon')} />
            <Tile icon={<PlusCircleFill />} label="Buy" onClick={() => showToast('Buying crypto is coming soon')} />
          </div>

          {/* Inset grouped asset list */}
          <div className="relative shrink-0 overflow-hidden rounded-card glass-surface">
            {!loaded
              ? Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-[11px]">
                    <Skeleton className="size-[38px] rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))
              : visible.map((a, i) => (
                  <div key={a.key}>
                    {i > 0 && <Separator inset={66} />}
                    <AssetRow asset={a} hidden={hideBalance} onClick={() => push({ name: 'token', asset: a })} />
                  </div>
                ))}
          </div>
        </div>
      </div>
      <AccountSheet open={accountsOpen} onClose={() => setAccountsOpen(false)} />
    </div>
  );
}

function splitUsd(n: number): [string, string] {
  const s = formatUsd(n);
  const i = s.lastIndexOf('.');
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i)];
}

function Tile({ icon, label, primary, onClick }: { icon: ReactNode; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex h-16 flex-col items-center justify-center gap-1 rounded-tile border-0 text-caption font-semibold transition-opacity active:opacity-70',
        primary ? 'bg-accent text-on-accent' : 'glass-surface text-label',
      )}
    >
      <span className={cx('flex', primary ? 'text-on-accent' : 'text-accent')}>{icon}</span>
      {label}
    </button>
  );
}

export function AssetRow({ asset: a, hidden, onClick }: { asset: Asset; hidden?: boolean; onClick?: () => void }) {
  const ch = a.change24h;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-[11px] text-left active:bg-pressed">
      <CoinAvatar symbol={a.meta.symbol} network={a.network} />
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-headline">{a.meta.name}</span>
        <span className="truncate text-footnote text-label-2">
          {hidden ? HIDDEN : `${formatAmount(a.balance, a.meta.decimals)} ${a.meta.symbol}`} · {a.network.name}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-body tabular-nums">{hidden ? '••••••' : a.usd === null ? '—' : formatUsd(a.usd)}</span>
        {a.error ? (
          <span className="text-footnote text-warning">Offline</span>
        ) : (
          ch !== null && (
            <span className={cx('text-footnote', ch >= 0 ? 'text-positive-text' : 'text-negative-text')}>
              {ch >= 0 ? '+' : '−'}
              {Math.abs(ch).toFixed(1)}%
            </span>
          )
        )}
      </div>
      <Chevron />
    </button>
  );
}

/** Tracks an element's width (the side panel can be resized). */
function useElementWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
