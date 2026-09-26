import { Check, Pencil } from 'lucide-react';
import { useState } from 'react';
import { rpc } from '@/src/lib/rpc';
import { shortAddress } from '@/src/lib/format';
import { useStore } from '../store';
import { AccountAvatar } from './Avatars';
import { ActionSheet, Grouped, Row, Separator, TextField } from './ui';

/** Opened from the avatar button: switch/add/rename accounts, settings, lock. */
export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallet, setWallet, guard, push } = useStore();
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  if (!wallet) return null;

  const select = (index: number) =>
    guard(async () => {
      setWallet(await rpc('selectAccount', { index }));
      onClose();
    });

  const add = () =>
    guard(async () => {
      setAdding(true);
      try {
        setWallet(await rpc('addAccount'));
        onClose();
      } finally {
        setAdding(false);
      }
    });

  const saveName = (index: number) =>
    guard(async () => {
      setWallet(await rpc('renameAccount', { index, name }));
      setEditing(null);
    });

  return (
    <ActionSheet open={open} onClose={onClose} title="Accounts">
      <Grouped>
        {wallet.accounts.map((a, i) => {
          const active = a.index === wallet.selectedAccount;
          return (
            <div key={a.index}>
              {i > 0 && <Separator inset={72} />}
              <div className="flex items-center gap-3 px-4 py-[10px]">
                {editing === a.index ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveName(a.index);
                    }}
                  >
                    <TextField autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="h-11" />
                    <button type="submit" aria-label="Save" className="flex size-11 items-center justify-center rounded-full border-0 bg-accent text-on-accent">
                      <Check className="size-5" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button onClick={() => select(a.index)} className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left">
                      <AccountAvatar name={a.name} size={40} />
                      <div className="min-w-0">
                        <div className="truncate text-headline">{a.name}</div>
                        <div className="truncate text-footnote text-label-2">
                          {shortAddress(a.evmAddress)} · {shortAddress(a.solanaAddress)}
                        </div>
                      </div>
                    </button>
                    {active && <Check className="size-5 text-accent" strokeWidth={2.6} />}
                    <button
                      aria-label={`Rename ${a.name}`}
                      onClick={() => {
                        setEditing(a.index);
                        setName(a.name);
                      }}
                      className="flex size-9 items-center justify-center rounded-full border-0 bg-transparent text-label-3 active:bg-pressed"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <Separator inset={16} />
        <Row label={adding ? 'Adding…' : 'Add Account'} onClick={adding ? undefined : add} tone="accent" />
      </Grouped>
      <Grouped>
        <Row
          label="Settings"
          chevron
          onClick={() => {
            onClose();
            push({ name: 'settings' });
          }}
        />
        <Separator />
        <Row label="Lock Wallet" onClick={() => guard(async () => setWallet(await rpc('lock')))} />
      </Grouped>
    </ActionSheet>
  );
}
