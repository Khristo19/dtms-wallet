import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { networksFor, type ChainKind } from '@/src/lib/networks';
import { Capsule, copyText, Grouped, openTab, Row, SectionHeader, Segmented, Separator, SheetPage } from '../components/ui';
import { useAccount, useStore } from '../store';

export function Receive({ initialKind = 'evm' }: { initialKind?: ChainKind }) {
  const { pop, wallet } = useStore();
  const account = useAccount()!;
  const [kind, setKind] = useState<ChainKind>(initialKind);
  const address = kind === 'evm' ? account.evmAddress : account.solanaAddress;
  const nets = networksFor(wallet!.networkMode).filter((n) => n.kind === kind);
  const label = kind === 'evm' ? 'EVM' : 'Solana';

  return (
    <SheetPage
      title="Receive"
      onClose={pop}
      footer={<Capsule onClick={() => copyText(address, `${label} address copied`)}>Copy {label} Address</Capsule>}
    >
      <Segmented
        label="Chain"
        options={['evm', 'solana'] as const}
        value={kind}
        onChange={setKind}
        render={(k) => (k === 'evm' ? 'Ethereum & EVM' : 'Solana')}
      />

      <div className="flex shrink-0 flex-col items-center gap-3 rounded-card glass-surface px-5 pt-5 pb-4">
        {/* QR stays dark-on-white in both appearances so it scans reliably. */}
        <div className="rounded-field bg-qr-bg p-2">
          <QRCodeSVG value={address} size={156} level="M" bgColor="var(--color-qr-bg)" fgColor="var(--color-qr-fg)" />
        </div>
        <div className="text-center">
          <div className="text-headline">{account.name}</div>
          <button
            onClick={() => copyText(address, `${label} address copied`)}
            className="mt-1 border-0 bg-transparent font-mono text-footnote leading-relaxed break-all text-label-2"
          >
            {address}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-[6px]">
          {nets.map((n) => (
            <span key={n.id} className="flex items-center gap-[6px] rounded-full bg-fill-3 px-[10px] py-1 text-caption text-label-2">
              <span className="size-2 rounded-full" style={{ background: n.color }} />
              {n.name}
            </span>
          ))}
        </div>
      </div>

      {wallet!.networkMode === 'testnet' && nets.some((n) => n.faucet) && (
        <>
          <SectionHeader>Free testnet tokens</SectionHeader>
          <Grouped>
            {nets
              .filter((n) => n.faucet)
              .map((n, i) => (
                <div key={n.id}>
                  {i > 0 && <Separator />}
                  <Row label={`${n.name} Faucet`} tone="accent" chevron onClick={() => openTab(n.faucet!)} />
                </div>
              ))}
          </Grouped>
        </>
      )}
    </SheetPage>
  );
}
