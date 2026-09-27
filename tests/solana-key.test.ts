import { describe, expect, it } from 'vitest';
import { WalletAccountSolana } from '@tetherto/wdk-wallet-solana';
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import { SolanaKeyAccount } from '../src/background/solanaKey';
import { parsePrivateKey, solanaAddressFromKey } from '../src/lib/keys';
import { base58Encode } from '../src/lib/validate';

// Public Hardhat/Anvil test mnemonic and its first EVM key.
const SEED = 'test test test test test test test test test test test junk';
const EVM_KEY_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('imported Solana key account', () => {
  it('matches the phrase-derived account for the same key (address + signatures)', async () => {
    for (const index of [0, 1]) {
      const derived = new WalletAccountSolana(SEED, `${index}'/0'`);
      const key = base58Encode(Uint8Array.from(derived.keyPair.privateKey!));
      const imported = await SolanaKeyAccount.create(key, {});

      expect(await imported.getAddress()).toBe(await derived.getAddress());
      expect(await solanaAddressFromKey(key)).toBe(await derived.getAddress());
      expect(Buffer.from(imported.keyPair.publicKey).equals(Buffer.from(derived.keyPair.publicKey))).toBe(true);
      expect(await imported.sign('hello dtms')).toBe(await derived.sign('hello dtms'));
    }
  });

  it("derives the wallet's known account-0 address", async () => {
    const derived = new WalletAccountSolana(SEED, "0'/0'");
    const imported = await SolanaKeyAccount.create(base58Encode(Uint8Array.from(derived.keyPair.privateKey!)), {});
    expect(await imported.getAddress()).toBe('oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96');
  });

  it('accepts a Phantom-format 64-byte secret key', async () => {
    const derived = new WalletAccountSolana(SEED, "1'/0'");
    const secret64 = new Uint8Array([...derived.keyPair.privateKey!, ...derived.keyPair.publicKey]);
    const parsed = await parsePrivateKey(base58Encode(secret64));
    expect(parsed.chain).toBe('solana');
    const imported = await SolanaKeyAccount.create(parsed.key, {});
    expect(await imported.getAddress()).toBe(await derived.getAddress());
  });
});

describe('imported EVM key account', () => {
  it('matches the phrase-derived address', async () => {
    const parsed = await parsePrivateKey(EVM_KEY_0.slice(2)); // without 0x
    expect(parsed).toEqual({ chain: 'evm', key: EVM_KEY_0 });
    const acct = WalletAccountEvm.fromPrivateKey(parsed.key);
    expect(await acct.getAddress()).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });
});
