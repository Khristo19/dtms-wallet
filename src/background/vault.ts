/**
 * Password-encrypted seed storage using WebCrypto only:
 * PBKDF2-SHA256 → 256-bit key → AES-256-GCM.
 */

export const DEFAULT_ITERATIONS = 600_000;

export interface VaultBlob {
  v: 1;
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

export const b64 = {
  encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
  decode: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

const enc = new TextEncoder();
const dec = new TextDecoder();

export class WrongPasswordError extends Error {
  constructor() {
    super('Incorrect password');
    this.name = 'WrongPasswordError';
  }
}

/** Derives raw AES key bytes from a password (the bytes are what we cache in session storage). */
export async function deriveKeyBytes(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, 256);
  return new Uint8Array(bits);
}

const aesKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function encryptSeed(
  seed: string,
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<{ vault: VaultBlob; keyBytes: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await deriveKeyBytes(password, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyBytes), enc.encode(seed));
  return {
    vault: { v: 1, iterations, salt: b64.encode(salt), iv: b64.encode(iv), ciphertext: b64.encode(new Uint8Array(ct)) },
    keyBytes,
  };
}

export async function decryptWithKey(vault: VaultBlob, keyBytes: Uint8Array): Promise<string> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64.decode(vault.iv) as BufferSource },
      await aesKey(keyBytes),
      b64.decode(vault.ciphertext) as BufferSource,
    );
    return dec.decode(pt);
  } catch {
    throw new WrongPasswordError();
  }
}

export async function decryptSeed(vault: VaultBlob, password: string): Promise<{ seed: string; keyBytes: Uint8Array }> {
  const keyBytes = await deriveKeyBytes(password, b64.decode(vault.salt), vault.iterations);
  return { seed: await decryptWithKey(vault, keyBytes), keyBytes };
}

/**
 * Re-encrypts new contents with the key of an unlocked vault (same salt and iterations, fresh IV),
 * so secrets can be added or removed without asking for the password again.
 */
export async function reencryptWithKey(vault: VaultBlob, keyBytes: Uint8Array, plaintext: string): Promise<VaultBlob> {
  await decryptWithKey(vault, keyBytes); // proves the key belongs to this vault
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyBytes), enc.encode(plaintext));
  return { ...vault, iv: b64.encode(iv), ciphertext: b64.encode(new Uint8Array(ct)) };
}
