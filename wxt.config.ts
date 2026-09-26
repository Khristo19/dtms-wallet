import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'DTMS Wallet',
    description: 'DTMS Wallet — self-custodial EVM + Solana wallet built on Tether WDK',
    permissions: ['storage', 'alarms'],
    // Price data. With host permission the service worker's fetches aren't subject to CORS, so
    // rate-limit (429) replies — which CoinGecko sends without CORS headers — can be read and backed off.
    host_permissions: ['https://api.coingecko.com/*'],
    // WDK's EVM stack compiles WebAssembly; MV3 needs wasm-unsafe-eval (not JS eval).
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    resolve: { alias: { 'sodium-native': 'sodium-javascript' } },
    plugins: [
      tailwindcss(),
      nodePolyfills({ include: ['buffer', 'process', 'events', 'stream', 'util'], globals: { Buffer: true, process: true } }),
    ],
  }),
});
