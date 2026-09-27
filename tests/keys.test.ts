import { describe, expect, it } from 'vitest';
import { detectAddressChain, KeyFormatError, parsePrivateKey } from '../src/lib/keys';
import { migrateAccounts, migrateKeyrings, parsePayload, serializePayload } from '../src/background/keyrings';
import { base58Encode } from '../src/lib/validate';

describe('parsePrivateKey', () => {
  it('normalizes EVM keys', async () => {
    const hex = 'AC0974BEC39A17E36BA4A6B4D238FF944BACB478CBED5EFCAE784D7BF4F2FF80';
    expect(await parsePrivateKey(`  0x${hex} `)).toEqual({ chain: 'evm', key: '0x' + hex.toLowerCase() });
  });

  it('rejects out-of-range and malformed EVM keys', async () => {
    await expect(parsePrivateKey('0x' + '0'.repeat(64))).rejects.toBeInstanceOf(KeyFormatError);
    await expect(parsePrivateKey('0x' + 'f'.repeat(64))).rejects.toBeInstanceOf(KeyFormatError);
    await expect(parsePrivateKey('0x1234')).rejects.toBeInstanceOf(KeyFormatError);
  });

  it('accepts Solana 32-byte seeds as base58 or a JSON array', async () => {
    const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    expect((await parsePrivateKey(base58Encode(seed))).key).toBe(base58Encode(seed));
    expect((await parsePrivateKey(JSON.stringify([...seed]))).key).toBe(base58Encode(seed));
  });

  it('rejects a 64-byte Solana key whose public half does not match', async () => {
    const bad = Uint8Array.from({ length: 64 }, (_, i) => i + 1);
    await expect(parsePrivateKey(base58Encode(bad))).rejects.toThrow(/mismatch/);
  });

  it('rejects garbage', async () => {
    await expect(parsePrivateKey('')).rejects.toThrow();
    await expect(parsePrivateKey('hello world')).rejects.toThrow();
    await expect(parsePrivateKey('[1,2,3]')).rejects.toThrow();
  });
});

describe('detectAddressChain', () => {
  it('detects EVM, Solana and neither', () => {
    expect(detectAddressChain('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe('evm');
    expect(detectAddressChain('oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96')).toBe('solana');
    expect(detectAddressChain('nope')).toBeNull();
  });
});

describe('vault payload + migration', () => {
  it('reads a v1 vault (plain recovery phrase) as the primary phrase', () => {
    expect(parsePayload('test test junk')).toEqual({ v: 2, secrets: [{ id: 'primary', kind: 'mnemonic', mnemonic: 'test test junk' }] });
  });

  it('round-trips a v2 payload', () => {
    const p = { v: 2 as const, secrets: [{ id: 'primary', kind: 'mnemonic' as const, mnemonic: 'a b c' }, { id: 'k-1', kind: 'privateKey' as const, chain: 'evm' as const, key: '0x01' }] };
    expect(parsePayload(serializePayload(p))).toEqual(p);
  });

  it('gives old accounts a primary-phrase source with their index as derivation index', () => {
    const [a] = migrateAccounts([{ index: 2, name: 'Account 3', evmAddress: '0x1', solanaAddress: 'S' }]);
    expect(a!.source).toEqual({ type: 'mnemonic', keyringId: 'primary', derivationIndex: 2 });
  });

  it('creates the primary keyring label for old wallets', () => {
    expect(migrateKeyrings(undefined, true)).toEqual([{ id: 'primary', kind: 'mnemonic', label: 'Recovery Phrase 1' }]);
    expect(migrateKeyrings(undefined, false)).toEqual([]);
  });
});
