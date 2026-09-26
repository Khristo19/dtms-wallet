import { decryptSeed, decryptWithKey, encryptSeed, b64, type VaultBlob } from './vault';
import { WalletEngine, normalizeMnemonic } from './wallet';
import { networksFor, type NetworkMode } from '@/src/lib/networks';
import {
  LOCKED,
  RpcError,
  type AccountInfo,
  type OpenIn,
  type ActivityItem,
  type ChartRange,
  type PriceInfo,
  type PricePoint,
  type RpcMap,
  type RpcMethod,
  type WalletState,
} from '@/src/lib/rpc';

/* ── Persistent storage layout ───────────────────────────────── */

interface Settings {
  networkMode: NetworkMode;
  autoLockMinutes: number;
  selectedAccount: number;
  openIn: OpenIn;
}

interface LocalData {
  vault?: VaultBlob;
  accounts?: AccountInfo[]; // public data only
  settings?: Settings;
  activity?: ActivityItem[];
}

const DEFAULT_SETTINGS: Settings = { networkMode: 'testnet', autoLockMinutes: 15, selectedAccount: 0, openIn: 'popup' };
const AUTOLOCK_ALARM = 'dtms-autolock';
const SESSION_KEY = 'sessionKey';
const MAX_ACTIVITY = 200;

const local = {
  async get(): Promise<LocalData> {
    return (await browser.storage.local.get(['vault', 'accounts', 'settings', 'activity'])) as LocalData;
  },
  set: (d: Partial<LocalData>) => browser.storage.local.set(d),
};

async function settings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await local.get()).settings };
}

/* ── Session ─────────────────────────────────────────────────── */

const engine = new WalletEngine();

/**
 * MV3 service workers are killed when idle. The derived vault key lives in
 * storage.session (memory only, cleared on browser exit), so we can restore
 * the unlocked session without asking for the password again.
 */
async function ensureLoaded(): Promise<boolean> {
  if (engine.isLoaded) return true;
  const { [SESSION_KEY]: key } = (await browser.storage.session.get(SESSION_KEY)) as { sessionKey?: string };
  const { vault } = await local.get();
  if (!key || !vault) return false;
  try {
    engine.load(await decryptWithKey(vault, b64.decode(key)), (await settings()).networkMode);
    return true;
  } catch {
    await lock();
    return false;
  }
}

async function startSession(seed: string, keyBytes: Uint8Array) {
  await browser.storage.session.set({ [SESSION_KEY]: b64.encode(keyBytes) });
  engine.load(seed, (await settings()).networkMode);
  await touchAutoLock();
}

async function lock() {
  engine.unload();
  await browser.storage.session.remove(SESSION_KEY);
  await browser.alarms.clear(AUTOLOCK_ALARM);
}

async function touchAutoLock() {
  const { autoLockMinutes } = await settings();
  await browser.alarms.create(AUTOLOCK_ALARM, { delayInMinutes: autoLockMinutes });
}

/**
 * Point the toolbar icon at the popup or the side panel. An action with a popup always opens the
 * popup, so the side-panel mode clears it and lets Chrome open the panel on click instead.
 * Called on every service-worker start and whenever the setting changes.
 */
export async function applyOpenIn(openIn?: OpenIn) {
  const target = openIn ?? (await settings()).openIn;
  await browser.action.setPopup({ popup: target === 'popup' ? 'popup.html' : '' });
  await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: target === 'panel' });
}

export function onAlarm(name: string) {
  if (name === AUTOLOCK_ALARM) void lock();
}

/**
 * @param userAction whether this call is a deliberate user action that should push back
 * auto-lock. Background polling (balances, activity) must not keep the wallet unlocked.
 */
async function requireUnlocked(userAction: boolean) {
  if (!(await ensureLoaded())) throw new RpcError('Wallet is locked', LOCKED);
  if (userAction) await touchAutoLock();
}

async function state(): Promise<WalletState> {
  const [data, s] = await Promise.all([local.get(), settings()]);
  return {
    initialized: !!data.vault,
    unlocked: data.vault ? await ensureLoaded() : false,
    accounts: data.accounts ?? [],
    selectedAccount: s.selectedAccount,
    networkMode: s.networkMode,
    autoLockMinutes: s.autoLockMinutes,
    openIn: s.openIn,
  };
}

async function updateSettings(patch: Partial<Settings>) {
  await local.set({ settings: { ...(await settings()), ...patch } });
}

/* ── Price cache ─────────────────────────────────────────────── */

const COINGECKO = 'https://api.coingecko.com/api/v3';
const PRICE_TTL = 60_000;
const HISTORY_TTL = 5 * 60_000;
const MAX_POINTS = 90;
const RANGE_DAYS: Record<ChartRange, string> = { '1D': '1', '1W': '7', '1M': '30', '1Y': '365', All: 'max' };

/**
 * CoinGecko's free API rate-limits bursts (HTTP 429). Responses are cached in storage.session
 * so they survive MV3 service-worker restarts (otherwise every popup open refetches), and after
 * a 429 we stop calling until the Retry-After window passes, serving cached data meanwhile.
 */
interface PriceCache {
  prices?: { at: number; data: Record<string, PriceInfo> };
  history?: Record<string, { at: number; points: PricePoint[] }>;
  cooldownUntil?: number;
}

const CACHE_KEY = 'coingecko';

async function readCache(): Promise<PriceCache> {
  return ((await browser.storage.session.get(CACHE_KEY)) as { coingecko?: PriceCache }).coingecko ?? {};
}

async function writeCache(patch: Partial<PriceCache>) {
  await browser.storage.session.set({ [CACHE_KEY]: { ...(await readCache()), ...patch } });
}

class RateLimitedError extends Error {}

async function coingecko<T>(path: string): Promise<T> {
  const { cooldownUntil = 0 } = await readCache();
  if (Date.now() < cooldownUntil) throw new RateLimitedError('CoinGecko rate limit cooldown');
  const res = await fetch(`${COINGECKO}${path}`);
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || 60;
    await writeCache({ cooldownUntil: Date.now() + retryAfter * 1000 });
    throw new RateLimitedError('CoinGecko rate limited');
  }
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function prices(): Promise<Record<string, PriceInfo>> {
  const cached = (await readCache()).prices;
  if (cached && Date.now() - cached.at < PRICE_TTL) return cached.data;
  const ids = [...new Set(networksFor('mainnet').flatMap((n) => n.tokens.map((t) => t.priceId)))];
  try {
    const json = await coingecko<Record<string, { usd?: number; usd_24h_change?: number }>>(
      `/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`,
    );
    const data: Record<string, PriceInfo> = {};
    for (const [id, v] of Object.entries(json)) {
      if (typeof v.usd === 'number') data[id] = { usd: v.usd, change24h: typeof v.usd_24h_change === 'number' ? v.usd_24h_change : null };
    }
    await writeCache({ prices: { at: Date.now(), data } });
    return data;
  } catch {
    return cached?.data ?? {};
  }
}

/** USD price history per CoinGecko id, downsampled. Missing ids are simply absent. */
async function priceHistory(range: ChartRange, ids: string[]): Promise<Record<string, PricePoint[]>> {
  const history = { ...(await readCache()).history };
  const out: Record<string, PricePoint[]> = {};
  // Sequential on purpose: CoinGecko's free tier rate-limits bursts.
  for (const id of [...new Set(ids)].slice(0, 6)) {
    const key = `${id}:${range}`;
    const cached = history[key];
    if (cached && Date.now() - cached.at < HISTORY_TTL) {
      out[id] = cached.points;
      continue;
    }
    try {
      const raw = (await coingecko<{ prices?: PricePoint[] }>(`/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${RANGE_DAYS[range]}`)).prices ?? [];
      const step = Math.max(1, Math.ceil(raw.length / MAX_POINTS));
      const points = raw.filter((_, i) => i % step === 0 || i === raw.length - 1);
      history[key] = { at: Date.now(), points };
      out[id] = points;
    } catch (e) {
      if (cached) out[id] = cached.points;
      if (e instanceof RateLimitedError) break; // don't keep hitting a rate-limited API
    }
  }
  await writeCache({ history });
  return out;
}

/* ── Handlers ────────────────────────────────────────────────── */

type Handlers = { [M in RpcMethod]: (p: RpcMap[M][0]) => Promise<RpcMap[M][1]> };

async function checkPassword(password: string) {
  const { vault } = await local.get();
  if (!vault) throw new RpcError('No wallet');
  return decryptSeed(vault, password);
}

export const handlers: Handlers = {
  getState: state,

  async generateMnemonic() {
    return WalletEngine.generateMnemonic();
  },

  async validateMnemonic({ mnemonic }) {
    return WalletEngine.isValidMnemonic(mnemonic);
  },

  async createWallet({ mnemonic, password }) {
    if ((await local.get()).vault) throw new RpcError('A wallet already exists. Reset it first.');
    const seed = normalizeMnemonic(mnemonic);
    if (!WalletEngine.isValidMnemonic(seed)) throw new RpcError('Invalid recovery phrase');
    const { vault, keyBytes } = await encryptSeed(seed, password);
    await local.set({ vault, settings: { ...DEFAULT_SETTINGS, openIn: (await settings()).openIn }, activity: [] });
    await startSession(seed, keyBytes);
    const addrs = await engine.deriveAddresses(0);
    await local.set({ accounts: [{ index: 0, name: 'Account 1', ...addrs }] });
    return state();
  },

  async unlock({ password }) {
    const { seed, keyBytes } = await checkPassword(password);
    await startSession(seed, keyBytes);
    return state();
  },

  async lock() {
    await lock();
    return state();
  },

  async addAccount() {
    await requireUnlocked(true);
    const accounts = (await local.get()).accounts ?? [];
    const index = accounts.reduce((m, a) => Math.max(m, a.index), -1) + 1;
    const addrs = await engine.deriveAddresses(index);
    await local.set({ accounts: [...accounts, { index, name: `Account ${index + 1}`, ...addrs }] });
    await updateSettings({ selectedAccount: index });
    return state();
  },

  async renameAccount({ index, name }) {
    const accounts = (await local.get()).accounts ?? [];
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) throw new RpcError('Name cannot be empty');
    await local.set({ accounts: accounts.map((a) => (a.index === index ? { ...a, name: trimmed } : a)) });
    return state();
  },

  async selectAccount({ index }) {
    await updateSettings({ selectedAccount: index });
    return state();
  },

  async setNetworkMode({ mode }) {
    await updateSettings({ networkMode: mode });
    // Rebuild the WDK instance against the new set of networks.
    if (engine.isLoaded) {
      engine.unload();
      await ensureLoaded();
    }
    return state();
  },

  async setOpenIn({ openIn }) {
    if (openIn !== 'popup' && openIn !== 'panel') throw new RpcError('Unsupported surface');
    await updateSettings({ openIn });
    await applyOpenIn(openIn);
    return state();
  },

  async setAutoLock({ minutes }) {
    if (![1, 5, 15, 30, 60].includes(minutes)) throw new RpcError('Unsupported auto-lock interval');
    await updateSettings({ autoLockMinutes: minutes });
    if (engine.isLoaded) await touchAutoLock();
    return state();
  },

  async getBalances({ accountIndex }) {
    await requireUnlocked(false);
    return engine.getBalances(accountIndex);
  },

  getPrices: prices,

  async getPriceHistory({ range, ids }) {
    if (!(range in RANGE_DAYS)) throw new RpcError('Unsupported range');
    return priceHistory(range, ids);
  },

  async quoteSend(p) {
    await requireUnlocked(true);
    return { fee: (await engine.quote(p)).toString() };
  },

  async send(p) {
    await requireUnlocked(true);
    const { hash, fee } = await engine.send(p);
    const item: ActivityItem = { ...p, hash, fee: fee.toString(), status: 'pending', timestamp: Date.now() };
    const activity = (await local.get()).activity ?? [];
    await local.set({ activity: [item, ...activity].slice(0, MAX_ACTIVITY) });
    return item;
  },

  async getActivity({ accountIndex }) {
    await requireUnlocked(false);
    const { networkMode } = await settings();
    const all = (await local.get()).activity ?? [];
    const active = new Set(networksFor(networkMode).map((n) => n.id));
    let changed = false;
    // Refresh pending entries on the currently active networks.
    await Promise.all(
      all.map(async (item) => {
        if (item.status !== 'pending' || !active.has(item.networkId)) return;
        try {
          const s = await engine.txStatus(item.networkId, item.accountIndex, item.hash);
          if (s) {
            item.status = s;
            changed = true;
          }
        } catch {
          /* keep pending; RPC hiccup */
        }
      }),
    );
    if (changed) await local.set({ activity: all });
    return all.filter((i) => i.accountIndex === accountIndex && active.has(i.networkId));
  },

  async revealSeed({ password }) {
    return (await checkPassword(password)).seed;
  },

  async resetWallet() {
    await lock();
    const { openIn } = await settings(); // a UI preference, not wallet data: keep it
    await browser.storage.local.clear();
    await updateSettings({ openIn });
    return state();
  },
};
