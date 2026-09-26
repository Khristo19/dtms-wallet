export type ChainKind = 'evm' | 'solana';
export type NetworkMode = 'testnet' | 'mainnet';

export interface Token {
  symbol: string;
  name: string;
  /** Contract address (EVM) or mint (Solana); null for the native coin. */
  address: string | null;
  decimals: number;
  /** CoinGecko id used for USD pricing. */
  priceId: string;
}

export interface Network {
  /** Label passed to WDK.registerWallet. */
  id: string;
  name: string;
  kind: ChainKind;
  mode: NetworkMode;
  chainId?: number;
  rpc: string[];
  txUrl: (hash: string) => string;
  addressUrl: (address: string) => string;
  faucet?: string;
  /** Brand color for the chain badge. */
  color: string;
  tokens: Token[];
}

const ETH = (): Token => ({ symbol: 'ETH', name: 'Ethereum', address: null, decimals: 18, priceId: 'ethereum' });
const POL = (): Token => ({ symbol: 'POL', name: 'Polygon', address: null, decimals: 18, priceId: 'polygon-ecosystem-token' });
const SOL = (): Token => ({ symbol: 'SOL', name: 'Solana', address: null, decimals: 9, priceId: 'solana' });
const USDC = (address: string): Token => ({ symbol: 'USDC', name: 'USD Coin', address, decimals: 6, priceId: 'usd-coin' });
const USDT = (address: string): Token => ({ symbol: 'USDT', name: 'Tether USD', address, decimals: 6, priceId: 'tether' });

const evmExplorer = (base: string) => ({
  txUrl: (h: string) => `${base}/tx/${h}`,
  addressUrl: (a: string) => `${base}/address/${a}`,
});

const solExplorer = (cluster?: string) => {
  const q = cluster ? `?cluster=${cluster}` : '';
  return {
    txUrl: (h: string) => `https://explorer.solana.com/tx/${h}${q}`,
    addressUrl: (a: string) => `https://explorer.solana.com/address/${a}${q}`,
  };
};

export const NETWORKS: Network[] = [
  // ── Testnets ──────────────────────────────────────────────
  {
    id: 'sepolia', name: 'Sepolia', kind: 'evm', mode: 'testnet', chainId: 11155111, color: '#627EEA',
    rpc: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.drpc.org'],
    ...evmExplorer('https://sepolia.etherscan.io'),
    faucet: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
    tokens: [ETH(), USDC('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')],
  },
  {
    id: 'arbitrum-sepolia', name: 'Arbitrum Sepolia', kind: 'evm', mode: 'testnet', chainId: 421614, color: '#28A0F0',
    rpc: ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia-rpc.publicnode.com'],
    ...evmExplorer('https://sepolia.arbiscan.io'),
    faucet: 'https://faucet.quicknode.com/arbitrum/sepolia',
    tokens: [ETH(), USDC('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d')],
  },
  {
    id: 'base-sepolia', name: 'Base Sepolia', kind: 'evm', mode: 'testnet', chainId: 84532, color: '#0052FF',
    rpc: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    ...evmExplorer('https://sepolia.basescan.org'),
    faucet: 'https://www.alchemy.com/faucets/base-sepolia',
    tokens: [ETH(), USDC('0x036CbD53842c5426634e7929541eC2318f3dCF7e')],
  },
  {
    id: 'polygon-amoy', name: 'Polygon Amoy', kind: 'evm', mode: 'testnet', chainId: 80002, color: '#8247E5',
    rpc: ['https://rpc-amoy.polygon.technology', 'https://polygon-amoy-bor-rpc.publicnode.com'],
    ...evmExplorer('https://amoy.polygonscan.com'),
    faucet: 'https://faucet.polygon.technology',
    tokens: [POL(), USDC('0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582')],
  },
  {
    id: 'solana-devnet', name: 'Solana Devnet', kind: 'solana', mode: 'testnet', color: '#9945FF',
    rpc: ['https://api.devnet.solana.com'],
    ...solExplorer('devnet'),
    faucet: 'https://faucet.solana.com',
    tokens: [SOL(), USDC('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')],
  },

  // ── Mainnets ──────────────────────────────────────────────
  {
    id: 'ethereum', name: 'Ethereum', kind: 'evm', mode: 'mainnet', chainId: 1, color: '#627EEA',
    rpc: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
    ...evmExplorer('https://etherscan.io'),
    tokens: [ETH(), USDT('0xdAC17F958D2ee523a2206206994597C13D831ec7'), USDC('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')],
  },
  {
    id: 'arbitrum', name: 'Arbitrum', kind: 'evm', mode: 'mainnet', chainId: 42161, color: '#28A0F0',
    rpc: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'],
    ...evmExplorer('https://arbiscan.io'),
    tokens: [ETH(), USDT('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'), USDC('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')],
  },
  {
    id: 'base', name: 'Base', kind: 'evm', mode: 'mainnet', chainId: 8453, color: '#0052FF',
    rpc: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    ...evmExplorer('https://basescan.org'),
    tokens: [ETH(), USDC('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')],
  },
  {
    id: 'polygon', name: 'Polygon', kind: 'evm', mode: 'mainnet', chainId: 137, color: '#8247E5',
    rpc: ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
    ...evmExplorer('https://polygonscan.com'),
    tokens: [POL(), USDT('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'), USDC('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359')],
  },
  {
    id: 'solana', name: 'Solana', kind: 'solana', mode: 'mainnet', color: '#9945FF',
    // api.mainnet-beta returns 403 to extension origins, so it's only a fallback.
    rpc: ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'],
    ...solExplorer(),
    tokens: [SOL(), USDT('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'), USDC('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')],
  },
];

export const networksFor = (mode: NetworkMode) => NETWORKS.filter((n) => n.mode === mode);

export function getNetwork(id: string): Network {
  const n = NETWORKS.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown network: ${id}`);
  return n;
}

export function getToken(networkId: string, address: string | null): Token {
  const t = getNetwork(networkId).tokens.find((x) => x.address === address);
  if (!t) throw new Error(`Unknown token ${address ?? 'native'} on ${networkId}`);
  return t;
}

/** Stable key for a (network, token) pair. */
export const assetKey = (networkId: string, address: string | null) => `${networkId}:${address ?? 'native'}`;
