import type { NetworkMode } from './networks';

export interface AccountInfo {
  index: number;
  name: string;
  evmAddress: string;
  solanaAddress: string;
}

export type OpenIn = 'popup' | 'panel';

export interface WalletState {
  initialized: boolean;
  unlocked: boolean;
  accounts: AccountInfo[];
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
  addAccount: [void, WalletState];
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
  revealSeed: [{ password: string }, string];
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
