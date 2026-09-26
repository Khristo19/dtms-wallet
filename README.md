# DTMS Wallet

A self-custodial browser-extension wallet for **EVM (Ethereum, Arbitrum, Base, Polygon)** and **Solana**,
built on [Tether WDK](https://docs.wdk.tether.io). One 12/24-word recovery phrase derives both an EVM address
(`m/44'/60'/0'/0/i`) and a Solana address (`m/44'/501'/i'/0'`) per account.

> ⚠️ Prototype. Defaults to **testnets** (Sepolia, Arbitrum Sepolia, Base Sepolia, Polygon Amoy, Solana Devnet).
> Mainnet can be enabled in Settings — use only small amounts.

## Design
UI follows the DTMS handoff in `design/dtms/` (iOS "Liquid Glass" look: SF Pro, capsule buttons, grouped lists, glass tab bar).
Tokens live in `src/ui/styles.css` (light + dark, following `prefers-color-scheme`).

**Popup or side panel.** Settings → *Open wallet in* switches what the toolbar icon opens. The popup is capped at 390×600 by Chrome, so a few screens use a denser layout there; the side panel is as tall as the window and uses the handoff's full sizes (the `panel:` Tailwind variant and `src/ui/surface.ts`).

## Features
- Create (with phrase confirmation) or import a wallet; password-encrypted vault
- Multiple accounts, rename/switch
- Balances for native coins + USDC/USDT across all networks, indicative USD values (CoinGecko)
- Send native coins and tokens with fee quote → review → confirm; local activity history with live status
- Receive with QR codes; testnet faucet shortcuts
- Auto-lock (1–60 min), reveal recovery phrase (password-gated), testnet/mainnet switch, reset

## Getting started
Requires **Node ≥ 20.19** (Node 22 LTS recommended — `nvm use 22`).

```bash
npm install
npm run build          # → .output/chrome-mv3
```
Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select `.output/chrome-mv3`.

For development, run `npm run dev` and load `.output/chrome-mv3-dev` the same way; it rebuilds on save.

```bash
npm test               # vitest: vault crypto, amount formatting, address validation, chart math
npm run test:e2e       # headless Chrome: full flow in popup + side panel, light + dark (real devnet send)
npm run compile        # typecheck
```

## Architecture
```
popup (React UI)  ── typed RPC (chrome.runtime messages) ──►  background service worker
  entrypoints/popup/                                           src/background/service.ts  handlers, session, auto-lock
  src/ui/{screens,components,store}                            src/background/wallet.ts   WDK instance (EVM + Solana)
                                                               src/background/vault.ts    PBKDF2 → AES-256-GCM vault
```
- The seed never leaves the background except when the user explicitly reveals it (password required) or during onboarding.
- Vault: PBKDF2-SHA256 (600k iterations) → AES-256-GCM, stored in `chrome.storage.local`.
- Unlocked session: the derived key is kept in `chrome.storage.session` (memory-only) so the WDK instance can be rebuilt
  after MV3 suspends the service worker. Auto-lock clears it via `chrome.alarms`; balance polling does not extend it.
- Networks and tokens are configured in `src/lib/networks.ts`.

### Browser-compat notes for WDK
- `sodium-native` is aliased to `sodium-javascript` (pure JS) in `wxt.config.ts`.
- Node built-ins are polyfilled with `vite-plugin-node-polyfills`.
- The extension CSP adds `'wasm-unsafe-eval'` — WDK's EVM stack compiles WebAssembly.
- Each WDK wallet package pins its own `@tetherto/wdk-wallet` beta; `src/background/wallet.ts` bridges the types.

## Roadmap
dApp connectivity (EIP-1193 + Solana Wallet Standard) · swaps (WDK Velora module) · incoming tx history (WDK Indexer API) ·
privacy layer (Hinkal, once testnet/MV3 support allows)
