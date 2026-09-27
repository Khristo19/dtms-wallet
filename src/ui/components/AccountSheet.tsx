import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PRIMARY_KEYRING, rpc, type AccountInfo, type WalletState } from '@/src/lib/rpc';
import { shortAddress } from '@/src/lib/format';
import { useStore } from '../store';
import { AccountAvatar } from './Avatars';
import { ActionSheet, Capsule, Grouped, Row, SectionHeader, Separator, TextField } from './ui';

interface Group {
  key: string;
  label: string;
  accounts: AccountInfo[];
}

/** Accounts grouped by where their keys come from, in Phantom's order. */
function groupAccounts(wallet: WalletState): Group[] {
  const groups: Group[] = wallet.keyrings
    .filter((k) => k.kind === 'mnemonic')
    .map((k) => ({
      key: k.id,
      label: k.label,
      accounts: wallet.accounts.filter((a) => a.source.type === 'mnemonic' && a.source.keyringId === k.id),
    }));
  groups.push({ key: 'keys', label: 'Private Keys', accounts: wallet.accounts.filter((a) => a.source.type === 'privateKey') });
  groups.push({ key: 'watch', label: 'Watching', accounts: wallet.accounts.filter((a) => a.source.type === 'watch') });
  return groups.filter((g) => g.accounts.length > 0);
}

/** Mirrors the background's rules: keep one account, and the primary phrase's last account. */
function canRemove(wallet: WalletState, a: AccountInfo): boolean {
  if (wallet.accounts.length === 1) return false;
  const isPrimary = (x: AccountInfo) => x.source.type === 'mnemonic' && x.source.keyringId === PRIMARY_KEYRING;
  return !(isPrimary(a) && wallet.accounts.filter(isPrimary).length === 1);
}

function removalWarning(wallet: WalletState, a: AccountInfo): string {
  const src = a.source;
  if (src.type === 'watch') return 'You can watch this address again at any time.';
  if (src.type === 'privateKey') return "This deletes the private key from DTMS Wallet. Make sure you have a backup, or you'll lose access to its funds.";
  const lastOfPhrase = !wallet.accounts.some((x) => x.index !== a.index && x.source.type === 'mnemonic' && x.source.keyringId === src.keyringId);
  const label = wallet.keyrings.find((k) => k.id === src.keyringId)?.label ?? 'this recovery phrase';
  return lastOfPhrase
    ? `This also removes ${label} from DTMS Wallet. Make sure it's backed up, or you'll lose access to its funds.`
    : 'The account stays recoverable from its recovery phrase.';
}

const addressLine = (a: AccountInfo) => [a.evmAddress, a.solanaAddress].filter(Boolean).map((x) => shortAddress(x!)).join(' · ');

/** Opened from the avatar button: switch/add/rename/remove accounts, settings, lock. */
export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallet, setWallet, guard, push, showToast } = useStore();
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<AccountInfo | null>(null);
  if (!wallet) return null;
  const groups = groupAccounts(wallet);

  const select = (index: number) =>
    guard(async () => {
      setWallet(await rpc('selectAccount', { index }));
      onClose();
    });

  const saveName = (index: number) =>
    guard(async () => {
      setWallet(await rpc('renameAccount', { index, name }));
      setEditing(null);
    });

  const remove = (a: AccountInfo) =>
    guard(async () => {
      setWallet(await rpc('removeAccount', { index: a.index }));
      setRemoving(null);
      setEditing(null);
      showToast(`${a.name} removed`, 'success');
    });

  return (
    <>
      <ActionSheet open={open} onClose={onClose} title="Accounts">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-[14px]">
            {groups.length > 1 && <SectionHeader>{g.label}</SectionHeader>}
            <Grouped>
              {g.accounts.map((a, i) => {
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
                          <TextField autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="h-11" aria-label="Account name" />
                          <button type="submit" aria-label="Save name" className="flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-accent text-on-accent">
                            <Check className="size-5" />
                          </button>
                          {canRemove(wallet, a) && (
                            <button
                              type="button"
                              aria-label={`Remove ${a.name}`}
                              onClick={() => setRemoving(a)}
                              className="flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-negative/15 text-negative"
                            >
                              <Trash2 className="size-5" />
                            </button>
                          )}
                        </form>
                      ) : (
                        <>
                          <button onClick={() => select(a.index)} className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left">
                            <AccountAvatar name={a.name} size={40} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-headline">{a.name}</span>
                                {a.source.type === 'watch' && (
                                  <span className="shrink-0 rounded-full bg-fill-3 px-2 py-[1px] text-caption font-semibold text-label-2">View only</span>
                                )}
                              </div>
                              <div className="truncate text-footnote text-label-2">{addressLine(a)}</div>
                            </div>
                          </button>
                          {active && <Check className="size-5 shrink-0 text-accent" strokeWidth={2.6} aria-label="Selected" />}
                          <button
                            aria-label={`Edit ${a.name}`}
                            onClick={() => {
                              setEditing(a.index);
                              setName(a.name);
                            }}
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-label-3 active:bg-pressed"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </Grouped>
          </div>
        ))}
        <Grouped>
          <Row
            label="Add Account"
            tone="accent"
            onClick={() => {
              onClose();
              push({ name: 'addAccount' });
            }}
          />
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

      <ActionSheet open={removing !== null} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? ''}?`}>
        {removing && (
          <>
            <p className="m-0 px-2 text-callout leading-[1.4] text-label-2">{removalWarning(wallet, removing)}</p>
            <Capsule variant="destructive" onClick={() => remove(removing)}>
              Remove Account
            </Capsule>
          </>
        )}
      </ActionSheet>
    </>
  );
}
