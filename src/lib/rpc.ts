import type { ChainKind, NetworkMode } from './networks';

/** Where an account's keys come from. */
export type AccountSource =
  | { type: 'mnemonic'; keyringId: string; derivationIndex: number }
  | { type: 'privateKey'; keyringId: string }
  | { type: 'watch' };

export interface AccountInfo {
  /** Stable, unique account id (not the derivation index). */
  index: number;
  name: string;
  /** Present when the account has an EVM address (phrase accounts, EVM keys, watched EVM addresses). */
  evmAddress?: string;
  /** Present when the account has a Solana address. */
  solanaAddress?: string;
  source: AccountSource;
}

/** Public description of a stored secret (the secret itself only lives in the encrypted vault). */
export interface KeyringInfo {
  id: string;
  kind: 'mnemonic' | 'privateKey';
  label: string;
  /** For private keys: which chain the key belongs to. */
  chain?: ChainKind;
}

/** Id of the recovery phrase the wallet was created or imported with. */
export const PRIMARY_KEYRING = 'primary';

export function accountChains(a: Pick<AccountInfo, 'evmAddress' | 'solanaAddress'>): ChainKind[] {
  return [...(a.evmAddress ? (['evm'] as const) : []), ...(a.solanaAddress ? (['solana'] as const) : [])];
}

export function addressFor(a: Pick<AccountInfo, 'evmAddress' | 'solanaAddress'>, kind: ChainKind): string | undefined {
  return kind === 'evm' ? a.evmAddress : a.solanaAddress;
}

export type OpenIn = 'popup' | 'panel';

export interface WalletState {
  initialized: boolean;
  unlocked: boolean;
  accounts: AccountInfo[];
  keyrings: KeyringInfo[];
  selectedAccount: number;
  networkMode: NetworkMode;
  autoLockMinutes: number;
  /** What the toolbar icon opens. */
  openIn: OpenIn;
}

export interface BalanceEntry {
  networkId: string;
  token: string | null;
  /** Base units as a decimal string (bigint is not message-serializable). */
  raw: string;
  error?: string;
}

export interface SendParams {
  accountIndex: number;
  networkId: string;
  token: string | null;
  to: string;
  /** Base units as a decimal string. */
  amount: string;
}

export interface PriceInfo {
  usd: number;
  /** 24h change in percent, when available. */
  change24h: number | null;
}

export type ChartRange = '1D' | '1W' | '1M' | '1Y' | 'All';

/** [timestamp ms, usd] */
export type PricePoint = [number, number];

export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface ActivityItem {
  hash: string;
  accountIndex: number;
  networkId: string;
  token: string | null;
  to: string;
  amount: string;
  fee: string;
  status: TxStatus;
  timestamp: number;
}

/** method → [params, result] */
export interface RpcMap {
  getState: [void, WalletState];
  generateMnemonic: [void, string];
  validateMnemonic: [{ mnemonic: string }, boolean];
  createWallet: [{ mnemonic: string; password: string }, WalletState];
  unlock: [{ password: string }, WalletState];
  lock: [void, WalletState];
  /** Next account from a recovery phrase (default: the selected account's phrase, else the primary). */
  addAccount: [{ keyringId?: string }, WalletState];
  /** Adds a recovery phrase (imported or newly created) and its first account. */
  importMnemonic: [{ mnemonic: string }, WalletState];
  importPrivateKey: [{ privateKey: string }, WalletState];
  addWatchAddress: [{ address: string; name?: string }, WalletState];
  removeAccount: [{ index: number }, WalletState];
  renameAccount: [{ index: number; name: string }, WalletState];
  selectAccount: [{ index: number }, WalletState];
  setNetworkMode: [{ mode: NetworkMode }, WalletState];
  setAutoLock: [{ minutes: number }, WalletState];
  setOpenIn: [{ openIn: OpenIn }, WalletState];
  getBalances: [{ accountIndex: number }, BalanceEntry[]];
  getPrices: [void, Record<string, PriceInfo>];
  getPriceHistory: [{ range: ChartRange; ids: string[] }, Record<string, PricePoint[]>];
  quoteSend: [SendParams, { fee: string }];
  send: [SendParams, ActivityItem];
  getActivity: [{ accountIndex: number }, ActivityItem[]];
  /** Reveals a stored recovery phrase or private key (default: the primary phrase). */
  revealSecret: [{ password: string; keyringId?: string }, { kind: 'mnemonic' | 'privateKey'; value: string }];
  resetWallet: [void, WalletState];
}

export type RpcMethod = keyof RpcMap;
export type RpcParams<M extends RpcMethod> = RpcMap[M][0];
export type RpcResult<M extends RpcMethod> = RpcMap[M][1];

export interface RpcRequest<M extends RpcMethod = RpcMethod> {
  type: 'dtms-rpc';
  method: M;
  params: RpcParams<M>;
}

export type RpcResponse<T = unknown> = { ok: true; result: T } | { ok: false; error: string; code?: string };

export const LOCKED = 'LOCKED';

export class RpcError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** Popup-side client. */
export async function rpc<M extends RpcMethod>(
  method: M,
  ...args: RpcParams<M> extends void ? [] : [RpcParams<M>]
): Promise<RpcResult<M>> {
  const req: RpcRequest<M> = { type: 'dtms-rpc', method, params: args[0] as RpcParams<M> };
  const res = (await browser.runtime.sendMessage(req)) as RpcResponse<RpcResult<M>> | undefined;
  if (!res) throw new RpcError('Background did not respond');
  if (!res.ok) throw new RpcError(res.error, res.code);
  return res.result;
}
