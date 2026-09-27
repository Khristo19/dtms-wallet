# Security

DTMS Wallet is a **prototype**. It defaults to testnets; don't use it with funds you can't afford to lose.

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately via
[GitHub private vulnerability reporting](https://github.com/Khristo19/dtms-wallet/security/advisories/new).

## Known limitations

- Minimum password length is 8 characters.
- No maximum-fee cap on sends; the network fee is shown for review before sending.
- Balances and transactions go through public RPC endpoints and CoinGecko, which can see your addresses.
- The unlocked session key is kept in `chrome.storage.session` (memory only) until auto-lock or browser exit.
- All recovery phrases and imported private keys share one password. Removing an imported account deletes its key from the vault — keep your own backup.

## Official source

The only official source is this repository. Beware of copies published elsewhere or on extension stores.
