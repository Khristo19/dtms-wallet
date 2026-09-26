import { formatAmount, formatUsd, shortAddress } from '@/src/lib/format';
import { CoinAvatar } from '../components/Avatars';
import { copyText, cx, Grouped, openTab, Row, Separator, SheetPage } from '../components/ui';
import { ArrowDownCircleFill, ArrowUpCircleFill } from '../icons';
import { useAccount, useAssets, useStore, type AssetRef } from '../store';

export function TokenDetail({ asset: ref }: { asset: AssetRef }) {
  const { pop, push, hideBalance } = useStore();
  const account = useAccount()!;
  const asset = useAssets().find((a) => a.networkId === ref.networkId && a.token === ref.token);
  if (!asset) return null;
  const address = asset.network.kind === 'evm' ? account.evmAddress : account.solanaAddress;
  const ch = asset.change24h;

  return (
    <SheetPage title={asset.meta.name} onClose={pop}>
      <div className="flex shrink-0 flex-col items-center pt-2 pb-1">
        <CoinAvatar symbol={asset.meta.symbol} network={asset.network} size={64} />
        <div className="num mt-4 text-sent leading-none">
          {hideBalance ? '••••' : formatAmount(asset.balance, asset.meta.decimals)} <span className="text-label-3">{asset.meta.symbol}</span>
        </div>
        <div className="mt-2 text-callout text-label-2">
          {hideBalance ? '••••' : asset.usd === null ? 'Price unavailable' : formatUsd(asset.usd)}
          {ch !== null && (
            <span className={cx('ml-2 font-semibold', ch >= 0 ? 'text-positive-text' : 'text-negative-text')}>
              {ch >= 0 ? '+' : '−'}
              {Math.abs(ch).toFixed(1)}% today
            </span>
          )}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-[10px]">
        <button
          onClick={() => push({ name: 'send', asset: ref })}
          className="flex h-16 flex-col items-center justify-center gap-1 rounded-tile border-0 bg-accent text-caption font-semibold text-on-accent active:opacity-70"
        >
          <ArrowUpCircleFill />
          Send
        </button>
        <button
          onClick={() => push({ name: 'receive', kind: asset.network.kind })}
          className="flex h-16 flex-col items-center justify-center gap-1 rounded-tile border-0 glass-surface text-caption font-semibold text-label active:opacity-70"
        >
          <ArrowDownCircleFill />
          Receive
        </button>
      </div>

      <Grouped>
        <Row label="Network" value={asset.network.name} />
        <Separator />
        <Row label="Your Address" value={shortAddress(address)} valueClassName="font-mono text-callout" onClick={() => copyText(address, 'Address copied')} />
        {asset.meta.address && (
          <>
            <Separator />
            <Row
              label="Contract"
              value={shortAddress(asset.meta.address)}
              valueClassName="font-mono text-callout"
              onClick={() => copyText(asset.meta.address!, 'Contract copied')}
            />
          </>
        )}
        {asset.error && (
          <>
            <Separator />
            <Row label="Status" value="Balance may be stale" valueClassName="text-warning" />
          </>
        )}
      </Grouped>
      <Grouped>
        <Row label="View on Explorer" tone="accent" chevron onClick={() => openTab(asset.network.addressUrl(address))} />
      </Grouped>
    </SheetPage>
  );
}
