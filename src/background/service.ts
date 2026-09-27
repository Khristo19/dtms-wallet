import { decryptSeed, decryptWithKey, encryptSeed, reencryptWithKey, b64, type VaultBlob } from './vault';
import { WalletEngine, WatchOnlyError, normalizeMnemonic } from './wallet';
import { migrateAccounts, migrateKeyrings, newKeyringId, nextLabel, parsePayload, serializePayload, type Secret, type VaultPayload } from './keyrings';
import { detectAddressChain, exportSolanaKey, KeyFormatError, parsePrivateKey } from '@/src/lib/keys';
import { networksFor, type NetworkMode } from '@/src/lib/networks';
import {
  LOCKED,
  PRIMARY_KEYRING,
  RpcError,
  type AccountInfo,
  type AccountSource,
  type KeyringInfo,
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
  keyrings?: KeyringInfo[]; // public labels only; the secrets live in the vault
  settings?: Settings;
  activity?: ActivityItem[];
}

const DEFAULT_SETTINGS: Settings = { networkMode: 'testnet', autoLockMinutes: 15, selectedAccount: 0, openIn: 'popup' };
const AUTOLOCK_ALARM = 'dtms-autolock';
const SESSION_KEY = 'sessionKey';
const MAX_ACTIVITY = 200;

const local = {
  async get(): Promise<LocalData> {
    return (await browser.storage.local.get(['vault', 'accounts', 'keyrings', 'settings', 'activity'])) as LocalData;
  },
  set: (d: Partial<LocalData>) => browser.storage.local.set(d),
};

async function settings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await local.get()).settings };
}

/** Accounts, upgraded from the single-phrase format if needed. */
async function accounts(): Promise<AccountInfo[]> {
  return migrateAccounts((await local.get()).accounts ?? []);
}

async function keyrings(): Promise<KeyringInfo[]> {
  const d = await local.get();
  return migrateKeyrings(d.keyrings, !!d.vault);
}

async function accountById(index: number): Promise<AccountInfo> {
  const a = (await accounts()).find((x) => x.index === index);
  if (!a) throw new RpcError('Account not found');
  return a;
}

/** Changes to accounts and the vault run one at a time so rapid clicks can't interleave writes. */
let writeQueue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn);
  writeQueue = run.catch(() => undefined);
  return run;
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
    engine.load(parsePayload(await decryptWithKey(vault, b64.decode(key))).secrets, (await settings()).networkMode);
    return true;
  } catch {
    await lock();
    return false;
  }
}

async function startSession(payload: VaultPayload, keyBytes: Uint8Array) {
  await browser.storage.session.set({ [SESSION_KEY]: b64.encode(keyBytes) });
  engine.load(payload.secrets, (await settings()).networkMode);
  await touchAutoLock();
}

/**
 * Edits the vault's secrets with the unlocked session key (no password prompt), re-encrypts,
 * and reloads the engine with the result.
 */
async function updateVault(edit: (p: VaultPayload) => VaultPayload): Promise<void> {
  const { [SESSION_KEY]: key } = (await browser.storage.session.get(SESSION_KEY)) as { sessionKey?: string };
  const { vault } = await local.get();
  if (!key || !vault) throw new RpcError('Wallet is locked', LOCKED);
  const keyBytes = b64.decode(key);
  const next = edit(parsePayload(await decryptWithKey(vault, keyBytes)));
  await local.set({ vault: await reencryptWithKey(vault, keyBytes, serializePayload(next)) });
  engine.load(next.secrets, (await settings()).networkMode);
}

const nextAccountId = (list: AccountInfo[]) => list.reduce((m, a) => Math.max(m, a.index), -1) + 1;
const countOf = (list: AccountInfo[], type: AccountSource['type']) => list.filter((a) => a.source.type === type).length;
const sameAddress = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Throws if any existing account already has one of these addresses. */
function assertNew(list: AccountInfo[], addrs: { evmAddress?: string; solanaAddress?: string }) {
  const dup = list.find((a) => sameAddress(a.evmAddress, addrs.evmAddress) || sameAddress(a.solanaAddress, addrs.solanaAddress));
  if (dup) throw new RpcError(`This account is already in your wallet (${dup.name})`);
}

async function addAndSelect(account: AccountInfo) {
  await local.set({ accounts: [...(await accounts()), account] });
  await updateSettings({ selectedAccount: account.index });
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
  const [data, s, list, rings] = await Promise.all([local.get(), settings(), accounts(), keyrings()]);
  return {
    initialized: !!data.vault,
    unlocked: data.vault ? await ensureLoaded() : false,
    accounts: list,
    keyrings: rings,
    selectedAccount: list.some((a) => a.index === s.selectedAccount) ? s.selectedAccount : (list[0]?.index ?? 0),
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

async function checkPassword(password: string): Promise<{ payload: VaultPayload; keyBytes: Uint8Array }> {
  const { vault } = await local.get();
  if (!vault) throw new RpcError('No wallet');
  const { seed: plaintext, keyBytes } = await decryptSeed(vault, password);
  return { payload: parsePayload(plaintext), keyBytes };
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
    const payload: VaultPayload = { v: 2, secrets: [{ id: PRIMARY_KEYRING, kind: 'mnemonic', mnemonic: seed }] };
    const { vault, keyBytes } = await encryptSeed(serializePayload(payload), password);
    await local.set({
      vault,
      keyrings: [{ id: PRIMARY_KEYRING, kind: 'mnemonic', label: 'Recovery Phrase 1' }],
      settings: { ...DEFAULT_SETTINGS, openIn: (await settings()).openIn },
      activity: [],
    });
    await startSession(payload, keyBytes);
    const addrs = await engine.addressesForMnemonic(PRIMARY_KEYRING, 0);
    await local.set({ accounts: [{ index: 0, name: 'Account 1', ...addrs, source: { type: 'mnemonic', keyringId: PRIMARY_KEYRING, derivationIndex: 0 } }] });
    return state();
  },

  async unlock({ password }) {
    const { payload, keyBytes } = await checkPassword(password);
    await startSession(payload, keyBytes);
    return state();
  },

  async lock() {
    await lock();
    return state();
  },

  addAccount: ({ keyringId }) =>
    exclusive(async () => {
      await requireUnlocked(true);
      const [list, rings, s] = await Promise.all([accounts(), keyrings(), settings()]);
      // Default: the selected account's phrase (like Phantom), else the primary phrase.
      const selected = list.find((a) => a.index === s.selectedAccount)?.source;
      const kid = keyringId ?? (selected?.type === 'mnemonic' ? selected.keyringId : PRIMARY_KEYRING);
      if (!rings.some((k) => k.id === kid && k.kind === 'mnemonic')) throw new RpcError('Recovery phrase not found');
      const used = list.flatMap((a) => (a.source.type === 'mnemonic' && a.source.keyringId === kid ? [a.source.derivationIndex] : []));
      const derivationIndex = used.length ? Math.max(...used) + 1 : 0;
      const addrs = await engine.addressesForMnemonic(kid, derivationIndex);
      const index = nextAccountId(list);
      await addAndSelect({ index, name: `Account ${index + 1}`, ...addrs, source: { type: 'mnemonic', keyringId: kid, derivationIndex } });
      return state();
    }),

  importMnemonic: ({ mnemonic }) =>
    exclusive(async () => {
      await requireUnlocked(true);
      const seed = normalizeMnemonic(mnemonic);
      if (!WalletEngine.isValidMnemonic(seed)) throw new RpcError('Invalid recovery phrase');
      const [list, rings] = await Promise.all([accounts(), keyrings()]);
      const id = newKeyringId('m');
      let duplicate = false;
      await updateVault((p) => {
        duplicate = p.secrets.some((x) => x.kind === 'mnemonic' && x.mnemonic === seed);
        return duplicate ? p : { ...p, secrets: [...p.secrets, { id, kind: 'mnemonic', mnemonic: seed }] };
      });
      if (duplicate) throw new RpcError('This recovery phrase is already in your wallet');
      try {
        const addrs = await engine.addressesForMnemonic(id, 0);
        assertNew(list, addrs);
        await local.set({ keyrings: [...rings, { id, kind: 'mnemonic', label: nextLabel(rings, 'mnemonic', 'Recovery Phrase') }] });
        const index = nextAccountId(list);
        await addAndSelect({ index, name: `Account ${index + 1}`, ...addrs, source: { type: 'mnemonic', keyringId: id, derivationIndex: 0 } });
      } catch (e) {
        await updateVault((p) => ({ ...p, secrets: p.secrets.filter((x) => x.id !== id) })); // roll back
        throw e;
      }
      return state();
    }),

  importPrivateKey: ({ privateKey }) =>
    exclusive(async () => {
      await requireUnlocked(true);
      let parsed;
      try {
        parsed = await parsePrivateKey(privateKey);
      } catch (e) {
        throw new RpcError(e instanceof KeyFormatError ? e.message : 'Invalid private key');
      }
      const address = await WalletEngine.addressForKey(parsed);
      const addrs = parsed.chain === 'evm' ? { evmAddress: address } : { solanaAddress: address };
      const [list, rings] = await Promise.all([accounts(), keyrings()]);
      assertNew(list, addrs);
      const id = newKeyringId('k');
      await updateVault((p) => ({ ...p, secrets: [...p.secrets, { id, kind: 'privateKey', chain: parsed.chain, key: parsed.key }] }));
      await local.set({ keyrings: [...rings, { id, kind: 'privateKey', chain: parsed.chain, label: nextLabel(rings, 'privateKey', 'Private Key') }] });
      await addAndSelect({ index: nextAccountId(list), name: `Imported ${countOf(list, 'privateKey') + 1}`, ...addrs, source: { type: 'privateKey', keyringId: id } });
      return state();
    }),

  addWatchAddress: ({ address, name }) =>
    exclusive(async () => {
      await requireUnlocked(true);
      const trimmed = address.trim();
      const chain = detectAddressChain(trimmed);
      if (!chain) throw new RpcError('Not a valid EVM or Solana address');
      const addrs = chain === 'evm' ? { evmAddress: trimmed } : { solanaAddress: trimmed };
      const list = await accounts();
      assertNew(list, addrs);
      const label = name?.trim().slice(0, 24) || `Watch ${countOf(list, 'watch') + 1}`;
      await addAndSelect({ index: nextAccountId(list), name: label, ...addrs, source: { type: 'watch' } });
      return state();
    }),

  removeAccount: ({ index }) =>
    exclusive(async () => {
      await requireUnlocked(true);
      const [list, rings, s] = await Promise.all([accounts(), keyrings(), settings()]);
      const target = list.find((a) => a.index === index);
      if (!target) throw new RpcError('Account not found');
      if (list.length === 1) throw new RpcError('You need at least one account');
      const src = target.source;
      const primaryAccounts = list.filter((a) => a.source.type === 'mnemonic' && a.source.keyringId === PRIMARY_KEYRING);
      if (src.type === 'mnemonic' && src.keyringId === PRIMARY_KEYRING && primaryAccounts.length === 1) {
        throw new RpcError("The last account of your main recovery phrase can't be removed");
      }
      const remaining = list.filter((a) => a.index !== index);
      // Drop the secret when nothing uses it any more (never the primary phrase).
      const orphan =
        src.type === 'privateKey' ||
        (src.type === 'mnemonic' && src.keyringId !== PRIMARY_KEYRING && !remaining.some((a) => a.source.type === 'mnemonic' && a.source.keyringId === src.keyringId))
          ? src.keyringId
          : null;
      if (orphan) {
        await updateVault((p) => ({ ...p, secrets: p.secrets.filter((x) => x.id !== orphan) }));
        await local.set({ keyrings: rings.filter((k) => k.id !== orphan) });
      }
      const activity = ((await local.get()).activity ?? []).filter((i) => i.accountIndex !== index);
      await local.set({ accounts: remaining, activity });
      if (s.selectedAccount === index) await updateSettings({ selectedAccount: remaining[0]!.index });
      return state();
    }),

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
    return engine.getBalances(await accountById(accountIndex));
  },

  getPrices: prices,

  async getPriceHistory({ range, ids }) {
    if (!(range in RANGE_DAYS)) throw new RpcError('Unsupported range');
    return priceHistory(range, ids);
  },

  async quoteSend(p) {
    await requireUnlocked(true);
    try {
      return { fee: (await engine.quote(p, await accountById(p.accountIndex))).toString() };
    } catch (e) {
      throw e instanceof WatchOnlyError ? new RpcError(e.message) : e;
    }
  },

  async send(p) {
    await requireUnlocked(true);
    let result;
    try {
      result = await engine.send(p, await accountById(p.accountIndex));
    } catch (e) {
      throw e instanceof WatchOnlyError ? new RpcError(e.message) : e;
    }
    const { hash, fee } = result;
    const item: ActivityItem = { ...p, hash, fee: fee.toString(), status: 'pending', timestamp: Date.now() };
    const activity = (await local.get()).activity ?? [];
    await local.set({ activity: [item, ...activity].slice(0, MAX_ACTIVITY) });
    return item;
  },

  async getActivity({ accountIndex }) {
    await requireUnlocked(false);
    const { networkMode } = await settings();
    const all = (await local.get()).activity ?? [];
    const byId = new Map((await accounts()).map((a) => [a.index, a]));
    const active = new Set(networksFor(networkMode).map((n) => n.id));
    let changed = false;
    // Refresh pending entries on the currently active networks.
    await Promise.all(
      all.map(async (item) => {
        const acct = byId.get(item.accountIndex);
        if (item.status !== 'pending' || !active.has(item.networkId) || !acct) return;
        try {
          const s = await engine.txStatus(item.networkId, acct, item.hash);
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

  async revealSecret({ password, keyringId }) {
    const { payload } = await checkPassword(password);
    const secret: Secret | undefined = payload.secrets.find((x) => x.id === (keyringId ?? PRIMARY_KEYRING));
    if (!secret) throw new RpcError('Secret not found');
    if (secret.kind === 'mnemonic') return { kind: 'mnemonic', value: secret.mnemonic };
    // Solana keys are exported in the 64-byte format Phantom and Solflare import.
    return { kind: 'privateKey', value: secret.chain === 'solana' ? await exportSolanaKey(secret.key) : secret.key };
  },

  async resetWallet() {
    await lock();
    const { openIn } = await settings(); // a UI preference, not wallet data: keep it
    await browser.storage.local.clear();
    await updateSettings({ openIn });
    return state();
  },
};
