import { Download, Eye, KeyRound, Plus, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { detectAddressChain, parsePrivateKey, type ParsedKey } from '@/src/lib/keys';
import { rpc, type WalletState } from '@/src/lib/rpc';
import { ConfirmSeed, ImportSeed, ShowSeed, type FrameProps } from '../components/seed';
import { Capsule, cx, Grouped, Row, SectionHeader, Separator, SheetPage, Spinner, TextField } from '../components/ui';
import { useStore } from '../store';

type Step =
  | { id: 'menu' }
  | { id: 'pickPhrase' }
  | { id: 'importPhrase' }
  | { id: 'newPhrase'; mnemonic: string; confirm: boolean }
  | { id: 'privateKey' }
  | { id: 'watch' };

/** Sheet chrome for the shared phrase screens. Module-level so its identity is stable across renders. */
function SheetFrame({ title, subtitle, onBack, footer, children }: FrameProps) {
  return (
    <SheetPage title={title} onBack={onBack} footer={footer}>
      {subtitle && <p className="m-0 px-1 text-callout leading-[1.35] text-label-2">{subtitle}</p>}
      {children}
    </SheetPage>
  );
}

const CHAIN_LABEL = { evm: 'EVM account — Ethereum, Arbitrum, Base, Polygon', solana: 'Solana account' } as const;

/** Phantom-style "Add Account": derive, import/create a phrase, import a private key, or watch an address. */
export function AddAccount() {
  const { wallet, pop, resetNav, setWallet, showToast, guard } = useStore();
  const [step, setStep] = useState<Step>({ id: 'menu' });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const phrases = wallet?.keyrings.filter((k) => k.kind === 'mnemonic') ?? [];
  const menu = () => setStep({ id: 'menu' });

  /** Runs one add action; on success selects the new account and returns to Home. */
  const run = (fn: () => Promise<WalletState>) =>
    guard(async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        setWallet(await fn());
        showToast('Account added', 'success');
        resetNav();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    });

  switch (step.id) {
    case 'menu':
      return (
        <SheetPage title="Add Account" onClose={pop}>
          <Grouped>
            <Option
              icon={<Plus />}
              title="Create New Account"
              body={phrases.length > 1 ? 'Next account from one of your recovery phrases' : 'Next account from your recovery phrase'}
              onClick={() => (phrases.length > 1 ? setStep({ id: 'pickPhrase' }) : run(() => rpc('addAccount', {})))}
              busy={busy}
            />
            <Separator inset={64} />
            <Option icon={<Download />} title="Import Recovery Phrase" body="Add accounts from another 12 or 24-word phrase" onClick={() => setStep({ id: 'importPhrase' })} />
            <Separator inset={64} />
            <Option
              icon={<Sparkles />}
              title="Create New Recovery Phrase"
              body="A fresh, independent wallet with its own backup"
              onClick={() => guard(async () => setStep({ id: 'newPhrase', mnemonic: await rpc('generateMnemonic'), confirm: false }))}
            />
            <Separator inset={64} />
            <Option icon={<KeyRound />} title="Import Private Key" body="A single EVM or Solana account" onClick={() => setStep({ id: 'privateKey' })} />
            <Separator inset={64} />
            <Option icon={<Eye />} title="Watch Address" body="Follow any address's balances — view only" onClick={() => setStep({ id: 'watch' })} />
          </Grouped>
        </SheetPage>
      );

    case 'pickPhrase':
      return (
        <SheetPage title="Create New Account" onBack={menu}>
          <SectionHeader>From recovery phrase</SectionHeader>
          <Grouped>
            {phrases.map((k, i) => (
              <div key={k.id}>
                {i > 0 && <Separator />}
                <Row label={busy ? 'Adding…' : k.label} chevron onClick={busy ? undefined : () => run(() => rpc('addAccount', { keyringId: k.id }))} />
              </div>
            ))}
          </Grouped>
        </SheetPage>
      );

    case 'importPhrase':
      return <ImportSeed frame={SheetFrame} title="Import Recovery Phrase" onBack={menu} onNext={(mnemonic) => run(() => rpc('importMnemonic', { mnemonic }))} />;

    case 'newPhrase':
      return step.confirm ? (
        <ConfirmSeed
          frame={SheetFrame}
          mnemonic={step.mnemonic}
          onBack={() => setStep({ ...step, confirm: false })}
          onNext={() => run(() => rpc('importMnemonic', { mnemonic: step.mnemonic }))}
        />
      ) : (
        <ShowSeed frame={SheetFrame} mnemonic={step.mnemonic} onBack={menu} onNext={() => setStep({ ...step, confirm: true })} />
      );

    case 'privateKey':
      return <ImportKey onBack={menu} busy={busy} onSubmit={(privateKey) => run(() => rpc('importPrivateKey', { privateKey }))} />;

    case 'watch':
      return <WatchAddress onBack={menu} busy={busy} onSubmit={(address, name) => run(() => rpc('addWatchAddress', { address, name }))} />;
  }
}

function Option({ icon, title, body, onClick, busy }: { icon: ReactNode; title: string; body: string; onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={busy ? undefined : onClick} className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left active:bg-pressed">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent [&_svg]:size-[18px]">
        {busy ? <Spinner className="size-[18px] text-accent" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline">{title}</span>
        <span className="block text-footnote text-label-2">{body}</span>
      </span>
    </button>
  );
}

function ImportKey({ onBack, onSubmit, busy }: { onBack: () => void; onSubmit: (key: string) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedKey | null>(null);
  const [error, setError] = useState('');

  // Parse locally as the user types, to show which chain the key belongs to.
  useEffect(() => {
    setParsed(null);
    setError('');
    if (!text.trim()) return;
    let live = true;
    parsePrivateKey(text).then(
      (p) => live && setParsed(p),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [text]);

  return (
    <SheetPage
      title="Import Private Key"
      onBack={onBack}
      footer={
        <Capsule disabled={!parsed} loading={busy} onClick={() => onSubmit(text)}>
          Import
        </Capsule>
      }
    >
      <p className="m-0 px-1 text-callout leading-[1.35] text-label-2">
        Paste an EVM private key (64 hex characters) or a Solana private key. It's encrypted with your password and never leaves this device.
      </p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        rows={4}
        placeholder="Private key"
        aria-label="Private key"
        className={cx(
          'w-full shrink-0 resize-none rounded-card border-0 glass-surface p-4 font-mono text-subhead leading-relaxed break-all outline-none ring-2 ring-transparent focus:ring-accent/40',
          error && 'ring-negative/50',
        )}
      />
      <p className={cx('m-0 min-h-[18px] px-4 text-footnote', error ? 'text-negative-text' : 'text-positive-text')} aria-live="polite">
        {error || (parsed ? `Detected: ${CHAIN_LABEL[parsed.chain]}` : '')}
      </p>
    </SheetPage>
  );
}

function WatchAddress({ onBack, onSubmit, busy }: { onBack: () => void; onSubmit: (address: string, name: string) => void; busy: boolean }) {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const chain = detectAddressChain(address);
  const invalid = address.trim().length > 0 && !chain;

  return (
    <SheetPage
      title="Watch Address"
      onBack={onBack}
      footer={
        <Capsule disabled={!chain} loading={busy} onClick={() => onSubmit(address, name)}>
          Add
        </Capsule>
      }
    >
      <p className="m-0 px-1 text-callout leading-[1.35] text-label-2">Follow the balances of any EVM or Solana address. You can't send from a watched address.</p>
      <SectionHeader>Address</SectionHeader>
      <TextField
        autoFocus
        spellCheck={false}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="0x… or Solana address"
        aria-label="Address to watch"
        invalid={invalid}
        className="font-mono text-subhead"
      />
      <p className={cx('-mt-2 m-0 min-h-[18px] px-4 text-footnote', invalid ? 'text-negative-text' : 'text-positive-text')} aria-live="polite">
        {invalid ? 'Not a valid EVM or Solana address' : chain ? `Detected: ${CHAIN_LABEL[chain]}` : ''}
      </p>
      <SectionHeader>Name (optional)</SectionHeader>
      <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Savings" aria-label="Account name" maxLength={24} />
    </SheetPage>
  );
}
