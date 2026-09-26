/** Parses a user-entered decimal string into base units. Throws on invalid input. */
export function parseUnits(value: string, decimals: number): bigint {
  const v = value.trim();
  if (!/^\d*\.?\d*$/.test(v) || v === '' || v === '.') throw new Error('Invalid amount');
  const [whole = '', frac = ''] = v.split('.');
  if (frac.length > decimals) throw new Error(`Too many decimals (max ${decimals})`);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

/** Formats base units as a decimal string, trimming trailing zeros. */
export function formatUnits(value: bigint, decimals: number, maxFraction = decimals): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  const out = frac ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${out}` : out;
}

/** Human-friendly token amount: up to 6 significant fraction digits, "<0.000001" for dust. */
export function formatAmount(value: bigint, decimals: number): string {
  if (value === 0n) return '0';
  const s = formatUnits(value, decimals, 6);
  if (s === '0') return '<0.000001';
  const [w = '0', f] = s.split('.');
  const grouped = BigInt(w).toLocaleString('en-US');
  return f ? `${grouped}.${f}` : grouped;
}

export function toNumber(value: bigint, decimals: number): number {
  return Number(formatUnits(value, decimals));
}

export function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortAddress(a: string, chars = 4): string {
  return a.length <= chars * 2 + 3 ? a : `${a.slice(0, chars + (a.startsWith('0x') ? 2 : 0))}…${a.slice(-chars)}`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
