import WDK from '@tetherto/wdk';
import WalletManagerEvm, { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm';
import WalletManagerSolana, { WalletAccountReadOnlySolana } from '@tetherto/wdk-wallet-solana';
import { getNetwork, networksFor, type Network, type NetworkMode } from '@/src/lib/networks';
import { addressFor, type AccountInfo, type BalanceEntry, type SendParams } from '@/src/lib/rpc';
import { solanaAddressFromKey } from '@/src/lib/keys';
import type { Secret } from './keyrings';
import { SolanaKeyAccount } from './solanaKey';

/**
 * Each WDK wallet package pins its own exact @tetherto/wdk-wallet beta, so TypeScript sees
 * distinct base classes. At runtime WDK only does `new Manager(seed, config)`, so this is safe.
 */
type Manager = Parameters<WDK['registerWallet']>[1];
const EvmManager = WalletManagerEvm as unknown as Manager;
const SolanaManager = WalletManagerSolana as unknown as Manager;
type EvmConfig = ConstructorParameters<typeof WalletManagerEvm>[1];
type SolanaConfig = ConstructorParameters<typeof WalletManagerSolana>[1];

type PrivateKeySecret = Extract<Secret, { kind: 'privateKey' }>;

/** The slice of the WDK account API we use; phrase, private-key and read-only accounts all provide it. */
interface ChainAccount {
  getAddress(): Promise<string>;
  getBalance(): Promise<bigint>;
  getTokenBalance(token: string): Promise<bigint>;
  getTransactionReceipt(hash: string): Promise<unknown>;
  quoteSendTransaction(tx: { to: string; value: bigint }): Promise<{ fee: bigint }>;
  quoteTransfer(o: { token: string; recipient: string; amount: bigint }): Promise<{ fee: bigint }>;
  sendTransaction?(tx: { to: string; value: bigint }): Promise<{ hash: string; fee: bigint }>;
  transfer?(o: { token: string; recipient: string; amount: bigint }): Promise<{ hash: string; fee: bigint }>;
  dispose?(): void;
}

export class WatchOnlyError extends Error {
  constructor() {
    super("This is a watch-only account — it can't send.");
  }
}

/**
 * Owns the live WDK state while the wallet is unlocked: one WDK instance per recovery phrase,
 * plus lazily created accounts for imported private keys and watched addresses.
 */
export class WalletEngine {
  private mode: NetworkMode | null = null;
  private wdks = new Map<string, WDK>();
  private keys = new Map<string, PrivateKeySecret>();
  private standalone = new Map<string, Promise<ChainAccount>>();

  static generateMnemonic(): string {
    return WDK.getRandomSeedPhrase();
  }

  static isValidMnemonic(m: string): boolean {
    return WDK.isValidSeed(normalizeMnemonic(m));
  }

  /** Public address for an imported key, without needing a network. */
  static async addressForKey(secret: Pick<PrivateKeySecret, 'chain' | 'key'>): Promise<string> {
    if (secret.chain === 'solana') return solanaAddressFromKey(secret.key);
    const acct = WalletAccountEvm.fromPrivateKey(secret.key);
    try {
      return await acct.getAddress();
    } finally {
      acct.dispose();
    }
  }

  get isLoaded() {
    return this.mode !== null;
  }

  load(secrets: Secret[], mode: NetworkMode) {
    this.unload();
    for (const secret of secrets) {
      if (secret.kind === 'privateKey') {
        this.keys.set(secret.id, secret);
        continue;
      }
      const wdk = new WDK(secret.mnemonic);
      for (const n of networksFor(mode)) {
        if (n.kind === 'evm') wdk.registerWallet(n.id, EvmManager, evmConfig(n));
        else wdk.registerWallet(n.id, SolanaManager, solanaConfig(n));
      }
      this.wdks.set(secret.id, wdk);
    }
    this.mode = mode;
  }

  unload() {
    for (const wdk of this.wdks.values()) wdk.dispose();
    for (const acct of this.standalone.values()) void acct.then((a) => a.dispose?.()).catch(() => undefined);
    this.wdks.clear();
    this.keys.clear();
    this.standalone.clear();
    this.mode = null;
  }

  /** Resolves the WDK account behind `acct` on one network. */
  private account(networkId: string, acct: AccountInfo): Promise<ChainAccount> {
    if (!this.mode) throw new Error('Wallet is not loaded');
    const network = getNetwork(networkId);
    if (network.mode !== this.mode) throw new Error(`${networkId} is not active in ${this.mode} mode`);
    const address = addressFor(acct, network.kind);
    if (!address) throw new Error(`${acct.name} has no ${network.kind === 'evm' ? 'EVM' : 'Solana'} address`);
    const src = acct.source;

    if (src.type === 'mnemonic') {
      const wdk = this.wdks.get(src.keyringId);
      if (!wdk) throw new Error('Recovery phrase not found');
      return wdk.getAccount(networkId, src.derivationIndex) as unknown as Promise<ChainAccount>;
    }

    const cacheKey = src.type === 'privateKey' ? `key:${src.keyringId}:${networkId}` : `watch:${acct.index}:${networkId}`;
    let created = this.standalone.get(cacheKey);
    if (!created) {
      created = src.type === 'privateKey' ? this.keyAccount(src.keyringId, network) : Promise.resolve(watchAccount(address, network));
      this.standalone.set(cacheKey, created);
      created.catch(() => this.standalone.delete(cacheKey));
    }
    return created;
  }

  private async keyAccount(keyringId: string, network: Network): Promise<ChainAccount> {
    const secret = this.keys.get(keyringId);
    if (!secret) throw new Error('Private key not found');
    if (secret.chain !== network.kind) throw new Error('Key does not belong to this network');
    const acct = network.kind === 'evm' ? WalletAccountEvm.fromPrivateKey(secret.key, evmConfig(network)) : await SolanaKeyAccount.create(secret.key, solanaConfig(network));
    return acct as unknown as ChainAccount;
  }

  /** EVM (same on every EVM network) and Solana addresses of account `derivationIndex` of a phrase. */
  async addressesForMnemonic(keyringId: string, derivationIndex: number): Promise<{ evmAddress: string; solanaAddress: string }> {
    const wdk = this.wdks.get(keyringId);
    if (!wdk || !this.mode) throw new Error('Recovery phrase not found');
    const nets = networksFor(this.mode);
    const evm = nets.find((n) => n.kind === 'evm')!;
    const sol = nets.find((n) => n.kind === 'solana')!;
    const [evmAddress, solanaAddress] = await Promise.all([
      wdk.getAccount(evm.id, derivationIndex).then((a) => a.getAddress()),
      wdk.getAccount(sol.id, derivationIndex).then((a) => a.getAddress()),
    ]);
    return { evmAddress, solanaAddress };
  }

  /** Balances for every token on the networks this account has an address for. */
  async getBalances(acct: AccountInfo): Promise<BalanceEntry[]> {
    const nets = networksFor(this.mode!).filter((n) => addressFor(acct, n.kind));
    const jobs = nets.flatMap((n) =>
      n.tokens.map(async (t): Promise<BalanceEntry> => {
        try {
          const a = await this.account(n.id, acct);
          const raw = t.address ? await a.getTokenBalance(t.address) : await a.getBalance();
          return { networkId: n.id, token: t.address, raw: raw.toString() };
        } catch (e) {
          return { networkId: n.id, token: t.address, raw: '0', error: errorMessage(e) };
        }
      }),
    );
    return Promise.all(jobs);
  }

  async quote(p: SendParams, acct: AccountInfo): Promise<bigint> {
    if (acct.source.type === 'watch') throw new WatchOnlyError();
    const a = await this.account(p.networkId, acct);
    const amount = BigInt(p.amount);
    const q = p.token ? await a.quoteTransfer({ token: p.token, recipient: p.to, amount }) : await a.quoteSendTransaction({ to: p.to, value: amount });
    return q.fee;
  }

  async send(p: SendParams, acct: AccountInfo): Promise<{ hash: string; fee: bigint }> {
    if (acct.source.type === 'watch') throw new WatchOnlyError();
    const a = await this.account(p.networkId, acct);
    if (!a.transfer || !a.sendTransaction) throw new WatchOnlyError();
    const amount = BigInt(p.amount);
    return p.token ? a.transfer({ token: p.token, recipient: p.to, amount }) : a.sendTransaction({ to: p.to, value: amount });
  }

  /** Returns 'confirmed' / 'failed' once the tx has a receipt, otherwise null. */
  async txStatus(networkId: string, acct: AccountInfo, hash: string): Promise<'confirmed' | 'failed' | null> {
    const a = await this.account(networkId, acct);
    const receipt = (await a.getTransactionReceipt(hash)) as Record<string, unknown> | null;
    if (!receipt) return null;
    if (getNetwork(networkId).kind === 'evm') return receipt.status === 0 ? 'failed' : 'confirmed';
    const meta = receipt.meta as { err?: unknown } | undefined;
    return meta?.err ? 'failed' : 'confirmed';
  }
}

function evmConfig(n: Network): EvmConfig {
  return { provider: n.rpc, chainId: n.chainId };
}

function solanaConfig(n: Network): SolanaConfig {
  return { provider: n.rpc, commitment: 'confirmed' };
}

function watchAccount(address: string, n: Network): ChainAccount {
  const acct = n.kind === 'evm' ? new WalletAccountReadOnlyEvm(address, evmConfig(n)) : new WalletAccountReadOnlySolana(address, solanaConfig(n));
  return acct as unknown as ChainAccount;
}

export const normalizeMnemonic = (m: string) => m.trim().toLowerCase().split(/\s+/).join(' ');

export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return humanizeSolanaError(msg) ?? msg;
}

/**
 * @solana/kit errors come as "Solana error #N; Decode this error by running `npx @solana/errors decode -- N '<base64>'`".
 * The base64 blob is a query string whose `logs` usually contain the real reason.
 */
function humanizeSolanaError(msg: string): string | null {
  const m = /Solana error #(-?\d+).*?'([A-Za-z0-9+/=]+)'/.exec(msg);
  if (!m) return null;
  try {
    const params = new URLSearchParams(atob(m[2]!));
    const logs = params.get('logs') ?? '';
    const failed = /Program \w+ failed: ([^\],]+)/.exec(logs)?.[1];
    const detail = /(?:Transfer|Allocate|Assign)[^,\]]*?: ([^,\]]+)/.exec(logs)?.[0];
    if (detail || failed) return `Transaction rejected: ${detail ?? failed}`;
    if (m[1] === '-32002') return 'Transaction simulation failed';
  } catch {
    /* fall through */
  }
  return `Solana error ${m[1]}`;
}
