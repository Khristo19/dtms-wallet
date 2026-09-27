import { getPublicKeyAsync } from '@noble/ed25519';
import type { ChainKind } from './networks';
import { base58Decode, base58Encode, isEvmAddress, isSolanaAddress } from './validate';

/**
 * A private key normalized for storage:
 * - EVM: `0x` + 64 lowercase hex chars
 * - Solana: base58 of the 32-byte Ed25519 seed
 */
export interface ParsedKey {
  chain: ChainKind;
  key: string;
}

export class KeyFormatError extends Error {}

const EVM_HEX = /^(0x)?[0-9a-fA-F]{64}$/;
// secp256k1 group order; valid private keys are 1 … n-1.
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/**
 * Parses a user-supplied private key and detects its chain:
 * - EVM: 64 hex chars, with or without `0x`
 * - Solana: base58 of the 64-byte secret key (Phantom/Solflare export: seed ‖ public key),
 *   base58 of the 32-byte seed, or a JSON array of 64/32 bytes (Solana CLI keypair file).
 */
export async function parsePrivateKey(input: string): Promise<ParsedKey> {
  const text = input.trim();
  if (!text) throw new KeyFormatError('Enter a private key');

  if (EVM_HEX.test(text)) {
    const hex = text.replace(/^0x/, '').toLowerCase();
    const n = BigInt('0x' + hex);
    if (n === 0n || n >= SECP256K1_N) throw new KeyFormatError('Not a valid EVM private key');
    return { chain: 'evm', key: '0x' + hex };
  }

  let bytes: Uint8Array | null = null;
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text) as unknown;
      if (Array.isArray(arr) && arr.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) bytes = Uint8Array.from(arr as number[]);
    } catch {
      /* not JSON */
    }
  } else {
    bytes = base58Decode(text);
  }
  if (!bytes || (bytes.length !== 64 && bytes.length !== 32)) {
    throw new KeyFormatError('Unrecognized key. Paste an EVM key (64 hex characters) or a Solana private key.');
  }

  const seed = bytes.slice(0, 32);
  if (bytes.length === 64) {
    // Phantom-style secret key: the second half must be the public key of the first.
    const pub = await getPublicKeyAsync(seed);
    if (!equalBytes(pub, bytes.slice(32))) throw new KeyFormatError('This Solana key is corrupted (public key mismatch)');
  }
  return { chain: 'solana', key: base58Encode(seed) };
}

/** The Solana address (base58 public key) for a normalized Solana key. */
export async function solanaAddressFromKey(key: string): Promise<string> {
  const seed = base58Decode(key);
  if (!seed || seed.length !== 32) throw new KeyFormatError('Invalid Solana key');
  return base58Encode(await getPublicKeyAsync(seed));
}

/** Detects the chain of a public address, or null if it's neither. */
export function detectAddressChain(address: string): ChainKind | null {
  const a = address.trim();
  if (isEvmAddress(a)) return 'evm';
  if (isSolanaAddress(a)) return 'solana';
  return null;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** A stored Solana key in the 64-byte base58 format (seed ‖ public key) that Phantom and Solflare import. */
export async function exportSolanaKey(key: string): Promise<string> {
  const seed = base58Decode(key);
  if (!seed || seed.length !== 32) throw new KeyFormatError('Invalid Solana key');
  return base58Encode(new Uint8Array([...seed, ...(await getPublicKeyAsync(seed))]));
}
