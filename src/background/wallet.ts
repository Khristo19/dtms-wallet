import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import { getNetwork, networksFor, type NetworkMode } from '@/src/lib/networks';
import type { BalanceEntry, SendParams } from '@/src/lib/rpc';

type Account = Awaited<ReturnType<WDK['getAccount']>>;

/**
 * Each WDK wallet package pins its own exact @tetherto/wdk-wallet beta, so TypeScript sees
 * distinct base classes. At runtime WDK only does `new Manager(seed, config)`, so this is safe.
 */
type Manager = Parameters<WDK['registerWallet']>[1];
const EvmManager = WalletManagerEvm as unknown as Manager;
const SolanaManager = WalletManagerSolana as unknown as Manager;
type EvmConfig = ConstructorParameters<typeof WalletManagerEvm>[1];
type SolanaConfig = ConstructorParameters<typeof WalletManagerSolana>[1];

/** Owns the live WDK instance. Holds the seed only while unlocked. */
export class WalletEngine {
  private wdk: WDK | null = null;
  private mode: NetworkMode | null = null;

  static generateMnemonic(): string {
    return WDK.getRandomSeedPhrase();
  }

  static isValidMnemonic(m: string): boolean {
    return WDK.isValidSeed(normalizeMnemonic(m));
  }

  get isLoaded() {
    return this.wdk !== null;
  }

  load(seed: string, mode: NetworkMode) {
    this.unload();
    const wdk = new WDK(seed);
    for (const n of networksFor(mode)) {
      if (n.kind === 'evm') {
        const config: EvmConfig = { provider: n.rpc, chainId: n.chainId };
        wdk.registerWallet(n.id, EvmManager, config);
      } else {
        const config: SolanaConfig = { provider: n.rpc, commitment: 'confirmed' };
        wdk.registerWallet(n.id, SolanaManager, config);
      }
    }
    this.wdk = wdk;
    this.mode = mode;
  }

  unload() {
    this.wdk?.dispose();
    this.wdk = null;
    this.mode = null;
  }

  private account(networkId: string, index: number): Promise<Account> {
    if (!this.wdk) throw new Error('Wallet is not loaded');
    if (getNetwork(networkId).mode !== this.mode) throw new Error(`${networkId} is not active in ${this.mode} mode`);
    return this.wdk.getAccount(networkId, index);
  }

  /** The EVM address is identical on every EVM network, so one EVM + one Solana network is enough. */
  async deriveAddresses(index: number): Promise<{ evmAddress: string; solanaAddress: string }> {
    const nets = networksFor(this.mode!);
    const evm = nets.find((n) => n.kind === 'evm')!;
    const sol = nets.find((n) => n.kind === 'solana')!;
    const [evmAddress, solanaAddress] = await Promise.all([
      this.account(evm.id, index).then((a) => a.getAddress()),
      this.account(sol.id, index).then((a) => a.getAddress()),
    ]);
    return { evmAddress, solanaAddress };
  }

  async getBalances(index: number): Promise<BalanceEntry[]> {
    const jobs = networksFor(this.mode!).flatMap((n) =>
      n.tokens.map(async (t): Promise<BalanceEntry> => {
        try {
          const acct = await this.account(n.id, index);
          const raw = t.address ? await acct.getTokenBalance(t.address) : await acct.getBalance();
          return { networkId: n.id, token: t.address, raw: raw.toString() };
        } catch (e) {
          return { networkId: n.id, token: t.address, raw: '0', error: errorMessage(e) };
        }
      }),
    );
    return Promise.all(jobs);
  }

  async quote(p: SendParams): Promise<bigint> {
    const acct = await this.account(p.networkId, p.accountIndex);
    const amount = BigInt(p.amount);
    const q = p.token
      ? await acct.quoteTransfer({ token: p.token, recipient: p.to, amount })
      : await acct.quoteSendTransaction({ to: p.to, value: amount });
    return q.fee;
  }

  async send(p: SendParams): Promise<{ hash: string; fee: bigint }> {
    const acct = await this.account(p.networkId, p.accountIndex);
    const amount = BigInt(p.amount);
    return p.token
      ? acct.transfer({ token: p.token, recipient: p.to, amount })
      : acct.sendTransaction({ to: p.to, value: amount });
  }

  /** Returns 'confirmed' / 'failed' once the tx has a receipt, otherwise null. */
  async txStatus(networkId: string, index: number, hash: string): Promise<'confirmed' | 'failed' | null> {
    const acct = await this.account(networkId, index);
    const receipt = (await acct.getTransactionReceipt(hash)) as Record<string, unknown> | null;
    if (!receipt) return null;
    if (getNetwork(networkId).kind === 'evm') return receipt.status === 0 ? 'failed' : 'confirmed';
    const meta = receipt.meta as { err?: unknown } | undefined;
    return meta?.err ? 'failed' : 'confirmed';
  }
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
