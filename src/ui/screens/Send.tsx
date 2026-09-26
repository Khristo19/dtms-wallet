import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { formatAmount, formatUnits, formatUsd, parseUnits, shortAddress, toNumber } from '@/src/lib/format';
import { rpc, type ActivityItem, type SendParams, type TxStatus } from '@/src/lib/rpc';
import { isValidAddress } from '@/src/lib/validate';
import { AccountAvatar, RecipientAvatar } from '../components/Avatars';
import { Capsule, copyText, cx, Grouped, openTab, SectionHeader, Separator, SheetPage, Spinner, TextField } from '../components/ui';
import { ArrowUp, Checkmark, DeleteLeftFill, SwapUnits, XMark } from '../icons';
import { useAccount, useAssets, useStore, type Asset, type AssetRef } from '../store';
import { AssetRow } from './Home';
import { IS_PANEL } from '../surface';

interface Recipient {
  address: string;
  /** Friendly name when sending to one of the user's own accounts. */
  name?: string;
}

type Step =
  | { id: 'asset' }
  | { id: 'recipient'; asset: AssetRef }
  | { id: 'amount'; asset: AssetRef; to: Recipient }
  | { id: 'sent'; asset: AssetRef; to: Recipient; item: ActivityItem; usd: number | null };

export function Send({ asset: preset }: { asset?: AssetRef }) {
  const pop = useStore((s) => s.pop);
  const [step, setStep] = useState<Step>(preset ? { id: 'recipient', asset: preset } : { id: 'asset' });
  const assets = useAssets();
  const find = (r: AssetRef) => assets.find((a) => a.networkId === r.networkId && a.token === r.token);

  switch (step.id) {
    case 'asset':
      return <PickAsset assets={assets} onClose={pop} onPick={(a) => setStep({ id: 'recipient', asset: a })} />;
    case 'recipient': {
      const a = find(step.asset);
      return a ? (
        <PickRecipient
          asset={a}
          onBack={preset ? undefined : () => setStep({ id: 'asset' })}
          onClose={pop}
          onNext={(to) => setStep({ id: 'amount', asset: step.asset, to })}
        />
      ) : null;
    }
    case 'amount': {
      const a = find(step.asset);
      return a ? (
        <Amount
          asset={a}
          assets={assets}
          to={step.to}
          onClose={pop}
          onChangeRecipient={() => setStep({ id: 'recipient', asset: step.asset })}
          onSent={(item, usd) => setStep({ id: 'sent', asset: step.asset, to: step.to, item, usd })}
        />
      ) : null;
    }
    case 'sent': {
      const a = find(step.asset);
      return a ? <Sent asset={a} assets={assets} to={step.to} item={step.item} usd={step.usd} /> : null;
    }
  }
}

/* ── 1. Asset ─────────────────────────────────────────────── */

function PickAsset({ assets, onClose, onPick }: { assets: Asset[]; onClose: () => void; onPick: (a: Asset) => void }) {
  const push = useStore((s) => s.push);
  const held = assets.filter((a) => a.balance > 0n).sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  return (
    <SheetPage title="Send" onClose={onClose}>
      {held.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 pt-16 text-center">
          <p className="m-0 text-headline">Nothing to send yet</p>
          <p className="m-0 text-callout text-label-2">Add funds to this wallet from the Receive screen.</p>
          <Capsule className="mt-2 w-auto px-8" onClick={() => push({ name: 'receive' })}>
            Receive
          </Capsule>
        </div>
      ) : (
        <Grouped>
          {held.map((a, i) => (
            <div key={a.key}>
              {i > 0 && <Separator inset={66} />}
              <AssetRow asset={a} onClick={() => onPick(a)} />
            </div>
          ))}
        </Grouped>
      )}
    </SheetPage>
  );
}

/* ── 2. Recipient ─────────────────────────────────────────── */

function PickRecipient({ asset, onBack, onClose, onNext }: { asset: Asset; onBack?: () => void; onClose: () => void; onNext: (to: Recipient) => void }) {
  const wallet = useStore((s) => s.wallet)!;
  const me = useAccount()!;
  const [to, setTo] = useState('');
  const kind = asset.network.kind;
  const trimmed = to.trim();
  const valid = isValidAddress(kind, trimmed);
  const addressOf = (a: { evmAddress: string; solanaAddress: string }) => (kind === 'evm' ? a.evmAddress : a.solanaAddress);
  const own = wallet.accounts.find((a) => addressOf(a).toLowerCase() === trimmed.toLowerCase());
  const others = wallet.accounts.filter((a) => a.index !== me.index);

  const paste = async () => {
    try {
      setTo((await navigator.clipboard.readText()).trim());
    } catch {
      useStore.getState().showToast('Clipboard is not available', 'error');
    }
  };

  return (
    <SheetPage
      title={`Send ${asset.meta.name}`}
      onBack={onBack}
      onClose={onClose}
      footer={
        <Capsule disabled={!valid} onClick={() => onNext({ address: trimmed, name: own?.name })}>
          Continue
        </Capsule>
      }
    >
      <SectionHeader>To</SectionHeader>
      <div className="relative shrink-0">
        <TextField
          autoFocus
          spellCheck={false}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={kind === 'evm' ? 'EVM address (0x…)' : 'Solana address'}
          invalid={to.length > 0 && !valid}
          className="pr-[84px] font-mono text-subhead"
        />
        <button
          onClick={paste}
          className="absolute top-1/2 right-[9px] h-[34px] -translate-y-1/2 rounded-full border-0 bg-fill-3 px-[14px] text-callout font-semibold text-accent"
        >
          Paste
        </button>
      </div>
      <p className={cx('-mt-2 min-h-[18px] px-4 text-footnote', to && !valid ? 'text-negative-text' : 'text-label-2')}>
        {to && !valid
          ? `That isn't a valid ${kind === 'evm' ? 'EVM' : 'Solana'} address.`
          : own?.index === me.index
            ? 'This is your own address.'
            : `Sending on ${asset.network.name}.`}
      </p>

      {others.length > 0 && (
        <>
          <SectionHeader>Your accounts</SectionHeader>
          <Grouped>
            {others.map((a, i) => (
              <div key={a.index}>
                {i > 0 && <Separator inset={72} />}
                <button
                  onClick={() => onNext({ address: addressOf(a), name: a.name })}
                  className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-[10px] text-left active:bg-pressed"
                >
                  <AccountAvatar name={a.name} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-headline">{a.name}</div>
                    <div className="truncate text-footnote text-label-2">{shortAddress(addressOf(a), 6)}</div>
                  </div>
                </button>
              </div>
            ))}
          </Grouped>
        </>
      )}
    </SheetPage>
  );
}

/* ── 3. Amount (handoff: Send sheet) ──────────────────────── */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

function Amount({
  asset,
  assets,
  to,
  onClose,
  onChangeRecipient,
  onSent,
}: {
  asset: Asset;
  assets: Asset[];
  to: Recipient;
  onClose: () => void;
  onChangeRecipient: () => void;
  onSent: (item: ActivityItem, usd: number | null) => void;
}) {
  const { prices, guard, refreshBalances } = useStore();
  const account = useAccount()!;
  const [input, setInput] = useState('');
  const [fiat, setFiat] = useState(false);
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeError, setFeeError] = useState('');
  const [sending, setSending] = useState(false);
  const { decimals, symbol, priceId } = asset.meta;
  const price = prices[priceId]?.usd;
  const native = assets.find((a) => a.networkId === asset.networkId && a.token === null)!;

  // Token amount in base units from whatever unit the user is typing in.
  const raw = useMemo(() => {
    if (!input || input === '.') return 0n;
    try {
      if (!fiat) return parseUnits(input, decimals);
      if (!price) return 0n;
      return parseUnits((Number(input) / price).toFixed(Math.min(decimals, 9)), decimals);
    } catch {
      return 0n;
    }
  }, [input, fiat, decimals, price]);

  const tokenAmount = toNumber(raw, decimals);
  const usd = price === undefined ? null : tokenAmount * price;
  const overBalance = raw > asset.balance;
  const needNative = (asset.token ? 0n : raw) + (fee ?? 0n);
  const feeShort = fee !== null && native.balance < needNative && !overBalance;
  const canSend = raw > 0n && !overBalance && fee !== null && !feeShort && !sending;

  // Debounced fee quote.
  useEffect(() => {
    setFee(null);
    setFeeError('');
    if (raw === 0n || overBalance) return;
    let live = true;
    const t = setTimeout(() => {
      rpc('quoteSend', params())
        .then((q) => live && setFee(BigInt(q.fee)))
        .catch((e: Error) => live && setFeeError(e.message));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [raw, overBalance]);

  function params(amount = raw): SendParams {
    return { accountIndex: account.index, networkId: asset.networkId, token: asset.token, to: to.address, amount: amount.toString() };
  }

  const press = (k: (typeof KEYS)[number]) => {
    setInput((cur) => {
      if (k === 'del') return cur.slice(0, -1);
      if (k === '.') return cur.includes('.') ? cur : (cur || '0') + '.';
      if (cur === '0') return k;
      const frac = cur.split('.')[1];
      if (frac !== undefined && frac.length >= (fiat ? 2 : decimals)) return cur;
      return cur.length >= 14 ? cur : cur + k;
    });
  };

  const toggleUnit = () => {
    if (!price) return;
    // Keep the same value when flipping units.
    setInput(raw === 0n ? '' : fiat ? trimZeros(formatUnits(raw, decimals, 8)) : (tokenAmount * price).toFixed(2));
    setFiat((f) => !f);
  };

  const setMax = () =>
    guard(async () => {
      let max = asset.balance;
      if (!asset.token) {
        const { fee: f } = await rpc('quoteSend', params(1n));
        const reserve = (BigInt(f) * 3n) / 2n; // headroom for fee drift
        max = max > reserve ? max - reserve : 0n;
      }
      setFiat(false);
      setInput(trimZeros(formatUnits(max, decimals, 8)));
    });

  const send = () =>
    guard(async () => {
      if (!canSend) return;
      setSending(true);
      try {
        const item = await rpc('send', params());
        void refreshBalances();
        onSent(item, usd);
      } finally {
        setSending(false);
      }
    });

  const shown = input || '0';
  // Shrink long amounts relative to the amount token (80 in the side panel, 56 in the popup).
  const scale = shown.length <= 5 ? 1 : shown.length <= 7 ? 0.86 : shown.length <= 10 ? 0.71 : 0.57;

  return (
    <SheetPage
      dense={!IS_PANEL}
      title={`Send ${asset.meta.name}`}
      onClose={onClose}
      right={
        <button
          aria-label="Send"
          disabled={!canSend}
          onClick={send}
          className="flex size-11 items-center justify-center rounded-full border-0 bg-accent transition-opacity disabled:opacity-40"
        >
          {sending ? <Spinner className="size-[18px] text-on-accent" /> : <ArrowUp />}
        </button>
      }
      footer={
        <Capsule disabled={!canSend} loading={sending} onClick={send}>
          {!sending && 'Send'}
        </Capsule>
      }
    >
      {/* Recipient card */}
      <div className="flex shrink-0 items-center gap-3 rounded-card glass-surface px-4 py-[10px] panel:py-3">
        {to.name ? <AccountAvatar name={to.name} /> : <RecipientAvatar label={to.address} />}
        <div className="flex min-w-0 grow flex-col">
          <span className="truncate text-headline">{to.name ?? shortAddress(to.address, 6)}</span>
          <span className="truncate text-footnote text-label-2">{to.name ? `${shortAddress(to.address)} · ${asset.network.name}` : asset.network.name}</span>
        </div>
        <button onClick={onChangeRecipient} className="h-[34px] shrink-0 rounded-full border-0 bg-fill-3 px-[14px] text-callout font-semibold text-accent">
          Change
        </button>
      </div>

      {/* Amount */}
      <div className="flex shrink-0 flex-col items-center gap-[2px]">
        <div className="flex max-w-full items-baseline gap-[6px]">
          <span className="num truncate leading-none font-bold tracking-[-0.04em]" style={{ fontSize: `calc(var(--text-amount) * ${scale})` }}>
            {fiat ? `$${shown}` : shown}
          </span>
          {!fiat && <span className="num text-amount-unit text-label-3">{symbol}</span>}
        </div>
        <button
          onClick={toggleUnit}
          disabled={!price}
          className="flex h-7 items-center gap-[6px] rounded-full border-0 bg-transparent px-3 text-callout text-label-2 disabled:opacity-60"
        >
          {fiat ? `${formatAmount(raw, decimals)} ${symbol}` : usd === null ? 'No price' : formatUsd(usd)}
          {price && <SwapUnits />}
        </button>
        <div className="flex items-center gap-2 text-footnote">
          {overBalance ? (
            <span className="text-negative-text">Insufficient balance</span>
          ) : (
            <span className="text-label-3">
              {formatAmount(asset.balance, decimals)} {symbol} available
            </span>
          )}
          <button onClick={setMax} className="rounded-full border-0 bg-fill-3 px-2 py-[2px] text-caption font-semibold text-accent">
            Max
          </button>
        </div>
        <div className="min-h-[16px] text-caption text-label-3">
          {feeShort
            ? <span className="text-negative-text">Not enough {native.meta.symbol} for the network fee</span>
            : feeError
              ? <span className="text-negative-text">{feeError}</span>
              : fee !== null
                ? `Network fee ≈ ${formatAmount(fee, native.meta.decimals)} ${native.meta.symbol}`
                : raw > 0n && !overBalance && 'Estimating network fee…'}
        </div>
      </div>

      {/* Round-key number pad */}
      <div className="grid shrink-0 grid-cols-3 gap-x-3 gap-y-[2px] panel:gap-y-2 px-2">
        {KEYS.map((k) => (
          <button
            key={k}
            aria-label={k === 'del' ? 'Delete' : k}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k)}
            className="num flex h-11 panel:h-14 items-center justify-center rounded-full border-0 bg-transparent text-keypad text-label active:bg-pressed"
          >
            {k === 'del' ? <DeleteLeftFill /> : k}
          </button>
        ))}
      </div>
    </SheetPage>
  );
}

const trimZeros = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/* ── 4. Sent ──────────────────────────────────────────────── */

function Sent({ asset, assets, to, item, usd }: { asset: Asset; assets: Asset[]; to: Recipient; item: ActivityItem; usd: number | null }) {
  const { resetNav, wallet } = useStore();
  const [status, setStatus] = useState<TxStatus>(item.status);
  const native = assets.find((a) => a.networkId === asset.networkId && a.token === null)!;
  const url = asset.network.txUrl(item.hash);

  // Poll until the transaction lands.
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(async () => {
      try {
        const list = await rpc('getActivity', { accountIndex: wallet!.selectedAccount });
        const s = list.find((i) => i.hash === item.hash)?.status;
        if (s && s !== 'pending') setStatus(s);
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [status]);

  // The hero, heading and status row all follow the on-chain status.
  const statusView = {
    pending: { dot: 'bg-warning', text: 'Pending', cls: 'text-warning-text', heading: 'Sending to' },
    confirmed: { dot: 'bg-positive', text: 'Confirmed', cls: 'text-positive-text', heading: 'Sent to' },
    failed: { dot: 'bg-negative', text: 'Failed', cls: 'text-negative-text', heading: "Couldn't send to" },
  }[status];

  return (
    <div className="absolute inset-0 flex flex-col items-center overflow-hidden px-4 pt-6 pb-6">
      <StatusHero status={status} />

      <div className="num relative mt-[18px] max-w-full truncate text-sent">
        {formatAmount(BigInt(item.amount), asset.meta.decimals)} {asset.meta.symbol}
      </div>
      <p className="relative m-0 mt-1 text-center text-body text-label-2" aria-live="polite">
        {statusView.heading} {to.name ?? shortAddress(to.address)}
      </p>

      <div className="relative mt-6 panel:mt-8 w-full overflow-hidden rounded-card glass-surface">
        <div className="flex justify-between px-4 py-[13px] text-body">
          <span>Value</span>
          <span className="text-label-2">{usd === null ? '—' : formatUsd(usd)}</span>
        </div>
        <Separator />
        <div className="flex justify-between px-4 py-[13px] text-body">
          <span>Network Fee</span>
          <span className="text-label-2">
            {formatAmount(BigInt(item.fee), native.meta.decimals)} {native.meta.symbol}
          </span>
        </div>
        <Separator />
        <button onClick={() => openTab(url)} className="flex w-full items-center justify-between border-0 bg-transparent px-4 py-[13px] text-body active:bg-pressed">
          <span>Status</span>
          <span className={cx('flex items-center gap-[6px] font-semibold', statusView.cls)}>
            <span className={cx('size-2 rounded-full', statusView.dot)} />
            {statusView.text}
          </span>
        </button>
      </div>

      <div className="relative mt-auto grid w-full grid-cols-2 gap-3">
        <Capsule variant="gray" className="h-[54px]" onClick={() => copyText(url, 'Transaction link copied')}>
          Share
        </Capsule>
        <Capsule className="h-[54px]" onClick={resetNav}>
          Done
        </Capsule>
      </div>
    </div>
  );
}

const HERO = {
  pending: { glow: 'bg-warning', outer: 'border-warning/18', inner: 'border-warning/30', disc: 'bg-warning shadow-pending', label: 'Transaction pending' },
  confirmed: { glow: 'bg-positive', outer: 'border-positive/18', inner: 'border-positive/30', disc: 'bg-positive shadow-success', label: 'Transaction confirmed' },
  failed: { glow: 'bg-negative', outer: 'border-negative/18', inner: 'border-negative/30', disc: 'bg-negative shadow-failure', label: 'Transaction failed' },
} as const;

/** Concentric-ring hero (handoff: Sent). Orange spinner while pending, green check once confirmed, red ✕ on failure. */
function StatusHero({ status }: { status: TxStatus }) {
  const v = HERO[status];
  return (
    <>
      <div
        className={cx(
          'pointer-events-none absolute top-[20px] panel:top-[60px] left-1/2 -ml-[170px] size-[340px] rounded-full opacity-[0.22] blur-[90px] transition-colors duration-500',
          v.glow,
        )}
      />
      <motion.div
        role="img"
        aria-label={v.label}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={status === 'pending' ? { scale: [1, 1.04, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={status === 'pending' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 220, damping: 18 }}
        className={cx('relative mt-5 panel:mt-[110px] flex size-[180px] items-center justify-center rounded-full border-[1.5px] transition-colors duration-500', v.outer)}
      >
        <div className={cx('flex size-[140px] items-center justify-center rounded-full border-[1.5px] transition-colors duration-500', v.inner)}>
          <div className={cx('flex size-[100px] items-center justify-center rounded-full text-on-accent transition-colors duration-500', v.disc)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                className="flex"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              >
                {status === 'pending' && <PendingArc />}
                {status === 'confirmed' && <Checkmark />}
                {status === 'failed' && <XMark size={44} />}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/** Spinning arc for the pending state. */
function PendingArc() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ animationDuration: '1.1s' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.6" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
