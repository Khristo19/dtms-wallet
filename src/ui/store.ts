import { create } from 'zustand';
import { assetKey, networksFor, type ChainKind, type Network, type Token } from '@/src/lib/networks';
import {
  LOCKED,
  rpc,
  RpcError,
  type BalanceEntry,
  type ChartRange,
  type PriceInfo,
  type PricePoint,
  type WalletState,
} from '@/src/lib/rpc';
import { toNumber } from '@/src/lib/format';
import { STABLE_PRICE_IDS, type Holding } from '@/src/lib/chart';

export type Tab = 'wallet' | 'collectibles' | 'activity';

export interface AssetRef {
  networkId: string;
  token: string | null;
}

/** Pages presented as sheets over the tabs. */
export type Page =
  | { name: 'send'; asset?: AssetRef }
  | { name: 'receive'; kind?: ChainKind }
  | { name: 'token'; asset: AssetRef }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'revealSeed' };

export interface Asset extends AssetRef {
  key: string;
  network: Network;
  meta: Token;
  balance: bigint;
  usd: number | null;
  change24h: number | null;
  error?: string;
}

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error';
}

const HIDE_KEY = 'dtms.hideBalance';
const readHidden = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
};

interface Store {
  wallet: WalletState | null;
  balances: BalanceEntry[] | null;
  prices: Record<string, PriceInfo>;
  history: Partial<Record<ChartRange, Record<string, PricePoint[]>>>;
  range: ChartRange;
  hideBalance: boolean;
  loadingBalances: boolean;
  tab: Tab;
  stack: Page[];
  toast: Toast | null;

  setWallet: (w: WalletState) => void;
  refreshState: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  loadHistory: (range: ChartRange, ids: string[]) => Promise<void>;
  setRange: (r: ChartRange) => void;
  toggleHideBalance: () => void;
  setTab: (t: Tab) => void;
  push: (p: Page) => void;
  pop: () => void;
  resetNav: () => void;
  showToast: (message: string, tone?: Toast['tone']) => void;
  /** Runs an RPC-driven action, surfacing errors as toasts and handling auto-lock. */
  guard: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

export const useStore = create<Store>((set, get) => ({
  wallet: null,
  balances: null,
  prices: {},
  history: {},
  range: '1W',
  hideBalance: readHidden(),
  loadingBalances: false,
  tab: 'wallet',
  stack: [],
  toast: null,

  setWallet: (wallet) => {
    const prev = get().wallet;
    const accountChanged = prev && (prev.selectedAccount !== wallet.selectedAccount || prev.networkMode !== wallet.networkMode);
    // Locking drops any open page (e.g. revealed seed) and returns to Wallet on next unlock.
    const locked = !wallet.unlocked;
    set({ wallet, ...(accountChanged || locked ? { balances: null } : {}), ...(locked ? { stack: [], tab: 'wallet' as Tab } : {}) });
  },

  refreshState: async () => get().setWallet(await rpc('getState')),

  refreshBalances: async () => {
    const w = get().wallet;
    if (!w?.unlocked || get().loadingBalances) return;
    set({ loadingBalances: true });
    try {
      const [balances, prices] = await Promise.all([
        rpc('getBalances', { accountIndex: w.selectedAccount }),
        rpc('getPrices').catch(() => get().prices),
      ]);
      // Ignore results if the user switched account/network meanwhile.
      const now = get().wallet;
      if (now?.selectedAccount === w.selectedAccount && now.networkMode === w.networkMode) set({ balances, prices });
    } catch (e) {
      if (e instanceof RpcError && e.code === LOCKED) await get().refreshState();
    } finally {
      set({ loadingBalances: false });
    }
  },

  loadHistory: async (range, ids) => {
    if (ids.length === 0) return;
    try {
      const data = await rpc('getPriceHistory', { range, ids });
      set((s) => ({ history: { ...s.history, [range]: { ...s.history[range], ...data } } }));
    } catch {
      /* chart falls back to a flat line */
    }
  },

  setRange: (range) => set({ range }),

  toggleHideBalance: () => {
    const hideBalance = !get().hideBalance;
    try {
      localStorage.setItem(HIDE_KEY, hideBalance ? '1' : '0');
    } catch {
      /* preference just won't persist */
    }
    set({ hideBalance });
  },

  setTab: (tab) => set({ tab, stack: [] }),
  push: (p) => set((s) => ({ stack: [...s.stack, p] })),
  pop: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  resetNav: () => set({ stack: [], tab: 'wallet' }),

  showToast: (message, tone = 'default') => {
    const id = Date.now();
    set({ toast: { id, message, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2600);
  },

  guard: async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof RpcError && e.code === LOCKED) {
        await get().refreshState();
        return undefined;
      }
      get().showToast(e instanceof Error ? e.message : String(e), 'error');
      return undefined;
    }
  },
}));

/** Joins balances with network/token metadata and prices. */
export function buildAssets(wallet: WalletState, balances: BalanceEntry[] | null, prices: Record<string, PriceInfo>): Asset[] {
  const byKey = new Map((balances ?? []).map((b) => [assetKey(b.networkId, b.token), b]));
  return networksFor(wallet.networkMode).flatMap((network) =>
    network.tokens.map((meta) => {
      const key = assetKey(network.id, meta.address);
      const entry = byKey.get(key);
      const balance = entry ? BigInt(entry.raw) : 0n;
      const price = prices[meta.priceId];
      return {
        key,
        networkId: network.id,
        token: meta.address,
        network,
        meta,
        balance,
        usd: price === undefined ? null : toNumber(balance, meta.decimals) * price.usd,
        change24h: price?.change24h ?? null,
        error: entry?.error,
      };
    }),
  );
}

export function useAssets(): Asset[] {
  const { wallet, balances, prices } = useStore();
  return wallet ? buildAssets(wallet, balances, prices) : [];
}

export function toHoldings(assets: Asset[]): Holding[] {
  return assets
    .filter((a) => a.balance > 0n && a.usd !== null)
    .map((a) => ({ priceId: a.meta.priceId, amount: toNumber(a.balance, a.meta.decimals), usd: a.usd!, change24h: a.change24h }));
}

/** CoinGecko ids worth fetching history for (held, non-stable). */
export function volatileIds(assets: Asset[]): string[] {
  return [...new Set(assets.filter((a) => a.balance > 0n && !STABLE_PRICE_IDS.has(a.meta.priceId)).map((a) => a.meta.priceId))].sort();
}

export function useAccount() {
  const wallet = useStore((s) => s.wallet);
  return wallet?.accounts.find((a) => a.index === wallet.selectedAccount) ?? wallet?.accounts[0];
}
