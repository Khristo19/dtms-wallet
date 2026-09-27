import { getPublicKeyAsync } from '@noble/ed25519';
import { WalletAccountSolana } from '@tetherto/wdk-wallet-solana';
import { base58Decode, base58Encode } from '@/src/lib/validate';

type SolanaConfig = ConstructorParameters<typeof WalletAccountSolana>[2];

/** Public test vector: only used to satisfy the base constructor, then replaced below. */
const PLACEHOLDER_SEED = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/**
 * A Solana account from an imported private key. WDK's WalletAccountSolana can only be built
 * from a recovery phrase, but it signs exclusively with its `_rawPrivateKey` / `_rawPublicKey`
 * fields (the signer and address are derived from them lazily). This subclass builds the base
 * account and then swaps in the imported key before anything is derived or signed.
 * tests/solana-key.test.ts checks it matches a phrase-derived account for the same key.
 */
export class SolanaKeyAccount extends WalletAccountSolana {
  static async create(key: string, config: SolanaConfig): Promise<SolanaKeyAccount> {
    const seed = base58Decode(key);
    if (!seed || seed.length !== 32) throw new Error('Invalid Solana key');
    return new SolanaKeyAccount(seed, await getPublicKeyAsync(seed), config);
  }

  private constructor(seed: Uint8Array, publicKey: Uint8Array, config: SolanaConfig) {
    super(PLACEHOLDER_SEED, "0'/0'", config);
    const self = this as unknown as Record<string, unknown>;
    self._seed = undefined;
    self._signer = undefined;
    self._rawPrivateKey = Uint8Array.from(seed);
    self._rawPublicKey = publicKey;
    // The read-only base keeps the address behind a `_address` getter over `__address`.
    if (!('__address' in self)) throw new Error('Unsupported @tetherto/wdk-wallet-solana version');
    self.__address = base58Encode(publicKey);
  }
}
