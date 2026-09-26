import { describe, expect, it } from 'vitest';
import { formatAmount, formatUnits, parseUnits, shortAddress } from '../src/lib/format';
import { isEvmAddress, isSolanaAddress, isValidAddress } from '../src/lib/validate';

describe('parseUnits', () => {
  it('parses whole and fractional amounts', () => {
    expect(parseUnits('1', 18)).toBe(10n ** 18n);
    expect(parseUnits('0.5', 6)).toBe(500_000n);
    expect(parseUnits('.25', 9)).toBe(250_000_000n);
    expect(parseUnits('12.', 6)).toBe(12_000_000n);
  });

  it('rejects invalid input and excess precision', () => {
    expect(() => parseUnits('', 6)).toThrow();
    expect(() => parseUnits('.', 6)).toThrow();
    expect(() => parseUnits('1e5', 6)).toThrow();
    expect(() => parseUnits('-1', 6)).toThrow();
    expect(() => parseUnits('0.1234567', 6)).toThrow(/decimals/);
  });
});

describe('formatUnits / formatAmount', () => {
  it('formats and trims', () => {
    expect(formatUnits(1_500_000n, 6)).toBe('1.5');
    expect(formatUnits(10n ** 18n, 18)).toBe('1');
    expect(formatUnits(1n, 18)).toBe('0.000000000000000001');
  });

  it('round-trips with parseUnits', () => {
    for (const s of ['0', '1', '0.000001', '123456.789']) expect(formatUnits(parseUnits(s, 9), 9)).toBe(s);
  });

  it('produces friendly display strings', () => {
    expect(formatAmount(0n, 18)).toBe('0');
    expect(formatAmount(1n, 18)).toBe('<0.000001');
    expect(formatAmount(1_234_567_890_000n, 6)).toBe('1,234,567.89');
  });
});

describe('address validation', () => {
  it('validates EVM addresses', () => {
    expect(isEvmAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe(true);
    expect(isEvmAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb9226')).toBe(false);
    expect(isEvmAddress('f39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe(false);
  });

  it('validates Solana addresses', () => {
    expect(isSolanaAddress('oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96')).toBe(true);
    expect(isSolanaAddress('11111111111111111111111111111111')).toBe(true); // system program
    expect(isSolanaAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe(false);
    expect(isSolanaAddress('oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq9l')).toBe(false); // 'l' not base58
  });

  it('dispatches by chain kind', () => {
    expect(isValidAddress('evm', 'oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96')).toBe(false);
    expect(isValidAddress('solana', ' oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96 ')).toBe(true);
  });

  it('shortens addresses', () => {
    expect(shortAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe('0xf39F…2266');
  });
});
