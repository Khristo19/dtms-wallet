import type { ChainKind } from '@/src/lib/networks';
import { PRIMARY_KEYRING, type AccountInfo, type KeyringInfo } from '@/src/lib/rpc';

/** A secret stored (encrypted) in the vault. */
export type Secret =
  | { id: string; kind: 'mnemonic'; mnemonic: string }
  | { id: string; kind: 'privateKey'; chain: ChainKind; key: string };

/** Decrypted vault contents. */
export interface VaultPayload {
  v: 2;
  secrets: Secret[];
}

/**
 * Parses decrypted vault plaintext. Version 1 vaults (created before multi-account support)
 * contain just the recovery phrase; they become a payload whose only secret is the primary phrase.
 */
export function parsePayload(plaintext: string): VaultPayload {
  if (!plaintext.startsWith('{')) {
    return { v: 2, secrets: [{ id: PRIMARY_KEYRING, kind: 'mnemonic', mnemonic: plaintext }] };
  }
  const p = JSON.parse(plaintext) as VaultPayload;
  if (p.v !== 2 || !Array.isArray(p.secrets)) throw new Error('Unsupported vault format');
  return p;
}

export const serializePayload = (p: VaultPayload) => JSON.stringify(p);

/**
 * Accounts stored before multi-account support had no `source`: they were all derived from the
 * primary phrase, with the account index as the derivation index.
 */
export function migrateAccounts(accounts: (Omit<AccountInfo, 'source'> & { source?: AccountInfo['source'] })[]): AccountInfo[] {
  return accounts.map((a) => (a.source ? (a as AccountInfo) : { ...a, source: { type: 'mnemonic', keyringId: PRIMARY_KEYRING, derivationIndex: a.index } }));
}

/** Public keyring list; wallets from before multi-account support only have the primary phrase. */
export function migrateKeyrings(keyrings: KeyringInfo[] | undefined, hasVault: boolean): KeyringInfo[] {
  if (keyrings?.length) return keyrings;
  return hasVault ? [{ id: PRIMARY_KEYRING, kind: 'mnemonic', label: 'Recovery Phrase 1' }] : [];
}

export function newKeyringId(prefix: 'm' | 'k'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Next free "Recovery Phrase N" / label number. */
export function nextLabel(keyrings: KeyringInfo[], kind: KeyringInfo['kind'], base: string): string {
  const n = keyrings.filter((k) => k.kind === kind).length + 1;
  return `${base} ${n}`;
}
