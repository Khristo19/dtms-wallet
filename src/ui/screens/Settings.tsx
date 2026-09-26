import { useState } from 'react';
import { rpc, type OpenIn } from '@/src/lib/rpc';
import type { NetworkMode } from '@/src/lib/networks';
import { ActionSheet, Capsule, Grouped, Row, SectionHeader, Segmented, Separator, SheetPage, TextField } from '../components/ui';
import { Checkmark } from '../icons';
import { useStore } from '../store';
import { switchSurface, useWindowId } from '../surface';

const AUTOLOCK = [1, 5, 15, 30, 60];

export function Settings() {
  const { wallet, setWallet, guard, push, pop, showToast, resetNav } = useStore();
  const [mainnetConfirm, setMainnetConfirm] = useState(false);
  const [autoLockOpen, setAutoLockOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const windowId = useWindowId();
  if (!wallet) return null;

  const setOpenIn = (openIn: OpenIn) => guard(async () => setWallet(await switchSurface(openIn, windowId)));

  const setMode = (mode: NetworkMode) =>
    guard(async () => {
      setWallet(await rpc('setNetworkMode', { mode }));
      showToast(mode === 'mainnet' ? 'Switched to Mainnet' : 'Switched to Testnet', 'success');
    });

  return (
    <SheetPage title="Settings" onClose={pop}>
      <SectionHeader>Network</SectionHeader>
      <Segmented
        label="Network mode"
        options={['testnet', 'mainnet'] as const}
        value={wallet.networkMode}
        onChange={(m) => (m === 'mainnet' ? setMainnetConfirm(true) : setMode('testnet'))}
        render={(m) => (m === 'testnet' ? 'Testnet' : 'Mainnet')}
      />

      <SectionHeader>Open wallet in</SectionHeader>
      <Segmented
        label="Open wallet in"
        options={['popup', 'panel'] as const}
        value={wallet.openIn}
        onChange={setOpenIn}
        render={(o) => (o === 'popup' ? 'Popup' : 'Side Panel')}
      />
      <p className="-mt-2 m-0 px-4 text-footnote text-label-2">
        The side panel stays open next to the page and has room for the full-size layout.
      </p>

      <SectionHeader>Security</SectionHeader>
      <Grouped>
        <Row label="Auto-Lock" value={`${wallet.autoLockMinutes} min`} chevron onClick={() => setAutoLockOpen(true)} />
        <Separator />
        <Row label="Show Recovery Phrase" chevron onClick={() => push({ name: 'revealSeed' })} />
        <Separator />
        <Row label="Lock Wallet" onClick={() => guard(async () => setWallet(await rpc('lock')))} />
      </Grouped>

      <Grouped>
        <Row label="Reset Wallet" tone="destructive" onClick={() => setResetOpen(true)} />
      </Grouped>

      <p className="m-0 text-center text-footnote text-label-3">
        DTMS Wallet {browser.runtime.getManifest().version} · Built on Tether WDK
      </p>

      <ActionSheet open={mainnetConfirm} onClose={() => setMainnetConfirm(false)} title="Switch to Mainnet?">
        <p className="m-0 px-2 text-callout leading-[1.4] text-label-2">
          Mainnet uses real funds. This is prototype software — only use small amounts you can afford to lose.
        </p>
        <Capsule
          onClick={() => {
            setMainnetConfirm(false);
            void setMode('mainnet');
          }}
        >
          I Understand, Switch
        </Capsule>
      </ActionSheet>

      <ActionSheet open={autoLockOpen} onClose={() => setAutoLockOpen(false)} title="Auto-Lock">
        <Grouped>
          {AUTOLOCK.map((m, i) => (
            <div key={m}>
              {i > 0 && <Separator />}
              <Row
                label={`After ${m} ${m === 1 ? 'minute' : 'minutes'}`}
                value={wallet.autoLockMinutes === m ? <span className="flex text-accent"><Checkmark size={18} /></span> : ''}
                onClick={() =>
                  guard(async () => {
                    setWallet(await rpc('setAutoLock', { minutes: m }));
                    setAutoLockOpen(false);
                  })
                }
              />
            </div>
          ))}
        </Grouped>
      </ActionSheet>

      <ActionSheet
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetText('');
        }}
        title="Reset Wallet"
      >
        <p className="m-0 px-2 text-callout leading-[1.4] text-label-2">
          This removes the wallet from this device. You'll need your recovery phrase to restore it. Type <b className="text-label">RESET</b> to confirm.
        </p>
        <TextField value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" />
        <Capsule
          variant="destructive"
          disabled={resetText !== 'RESET'}
          onClick={() =>
            guard(async () => {
              setWallet(await rpc('resetWallet'));
              resetNav();
            })
          }
        >
          Remove Wallet From This Device
        </Capsule>
      </ActionSheet>
    </SheetPage>
  );
}
