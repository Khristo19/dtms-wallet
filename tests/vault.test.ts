import { describe, expect, it } from 'vitest';
import { decryptSeed, decryptWithKey, encryptSeed, reencryptWithKey, WrongPasswordError } from '../src/background/vault';

const SEED = 'test test test test test test test test test test test junk';
const ITER = 1_000; // keep tests fast; production uses 600k

describe('vault', () => {
  it('round-trips a seed with the right password', async () => {
    const { vault } = await encryptSeed(SEED, 'correct horse', ITER);
    const { seed } = await decryptSeed(vault, 'correct horse');
    expect(seed).toBe(SEED);
  });

  it('rejects a wrong password', async () => {
    const { vault } = await encryptSeed(SEED, 'correct horse', ITER);
    await expect(decryptSeed(vault, 'wrong horse')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('decrypts with the cached session key bytes', async () => {
    const { vault, keyBytes } = await encryptSeed(SEED, 'pw12345678', ITER);
    expect(await decryptWithKey(vault, keyBytes)).toBe(SEED);
  });

  it('uses a fresh salt and iv each time and never stores plaintext', async () => {
    const a = await encryptSeed(SEED, 'pw12345678', ITER);
    const b = await encryptSeed(SEED, 'pw12345678', ITER);
    expect(a.vault.salt).not.toBe(b.vault.salt);
    expect(a.vault.iv).not.toBe(b.vault.iv);
    expect(JSON.stringify(a.vault)).not.toContain('junk');
  });

  it('detects tampering', async () => {
    const { vault } = await encryptSeed(SEED, 'pw12345678', ITER);
    const bytes = atob(vault.ciphertext).split('');
    bytes[0] = String.fromCharCode(bytes[0]!.charCodeAt(0) ^ 1);
    await expect(decryptSeed({ ...vault, ciphertext: btoa(bytes.join('')) }, 'pw12345678')).rejects.toThrow();
  });
});

describe('reencryptWithKey', () => {
  it('replaces the contents, keeps the password, and rejects a foreign key', async () => {
    const { vault, keyBytes } = await encryptSeed(SEED, 'pw12345678', ITER);
    const next = await reencryptWithKey(vault, keyBytes, '{"v":2,"secrets":[]}');
    expect(next.iv).not.toBe(vault.iv);
    expect((await decryptSeed(next, 'pw12345678')).seed).toBe('{"v":2,"secrets":[]}');
    const other = await encryptSeed(SEED, 'different-pw', ITER);
    await expect(reencryptWithKey(vault, other.keyBytes, 'x')).rejects.toBeInstanceOf(WrongPasswordError);
  });
});
