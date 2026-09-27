import type { ChainKind } from './networks';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Decodes base58; returns null on invalid characters. */
export function base58Decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== '1') break;
    bytes.unshift(0);
  }
  return new Uint8Array(bytes);
}

/** Encodes bytes as base58 (Bitcoin alphabet, as used by Solana). */
export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function isEvmAddress(a: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

export function isSolanaAddress(a: string): boolean {
  if (a.length < 32 || a.length > 44) return false;
  return base58Decode(a)?.length === 32;
}

export function isValidAddress(kind: ChainKind, a: string): boolean {
  return kind === 'evm' ? isEvmAddress(a.trim()) : isSolanaAddress(a.trim());
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters';
  return null;
}
