/**
 * End-to-end test of the account options (popup, headless Chrome):
 * create account from a phrase, import/create recovery phrases, import EVM and Solana private
 * keys (and send real testnet funds from them), watch addresses, remove accounts, reveal secrets,
 * lock/unlock, and migration of a wallet created before multi-account support.
 *
 *   node tests/e2e/accounts.mjs        # against the existing build (.output/chrome-mv3)
 *
 * Uses public test mnemonics only. The Hardhat `test … junk` keys hold testnet funds.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WalletAccountSolana } from '@tetherto/wdk-wallet-solana';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = resolve(ROOT, '.output/chrome-mv3');
const SHOTS = resolve(ROOT, 'tests/e2e/shots/accounts');
const PW = 'hunter2hunter2';
const PRIMARY = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const HARDHAT = 'test test test test test test test test test test test junk';
const EVM_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // 0xf39F…2266, funded on Arbitrum Sepolia
const SHEET = '//div[contains(@class,"z-30")]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) (out = B58[Number(n % 58n)] + out), (n /= 58n);
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

// Hardhat mnemonic, Solana account 1 (AqynRZ…), in Phantom's 64-byte export format. Funded on devnet.
const solDerived = new WalletAccountSolana(HARDHAT, "1'/0'");
const SOL_KEY = base58(Uint8Array.from([...solDerived.keyPair.privateKey, ...solDerived.keyPair.publicKey]));
const SOL_ADDR = await solDerived.getAddress();

const failures = [];
const log = (...a) => console.log('[accounts]', ...a);
const check = (ok, what) => (ok ? log('✓', what) : (failures.push(what), log('✗', what)));

rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

async function launch() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    headless: true,
    pipe: true,
    enableExtensions: true,
    args: ['--no-sandbox', '--enable-unsafe-extension-debugging'],
  });
  const id = await browser.installExtension(EXT);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 600, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  const url = `chrome-extension://${id}/popup.html`;
  const h = {
    page,
    url,
    shot: (n) => page.screenshot({ path: `${SHOTS}/${n}.png` }),
    rpc: (m, p) => page.evaluate((m, p) => chrome.runtime.sendMessage({ type: 'dtms-rpc', method: m, params: p }), m, p),
    x: async (xp, timeout = 20000) => {
      const el = await page.waitForSelector(`::-p-xpath(${xp})`, { timeout });
      await el.click();
      await sleep(450);
    },
    text: () => page.evaluate(() => document.body.innerText),
    // Case-insensitive: section headers are uppercased by CSS, which innerText reflects.
    waitText: (t, timeout = 20000) => page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout }, t),
    sheetOpen: () => page.waitForFunction(() => document.querySelector('.invisible') !== null, { timeout: 15000 }),
    home: async () => {
      await page.waitForFunction(() => !document.querySelector('div.z-30') && document.querySelector('button[aria-label=Search]'), { timeout: 20000 });
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 30000 });
      await sleep(400);
    },
  };
  h.btn = (label, scope = '') => h.x(`${scope}//button[normalize-space(.)="${label}"]`);
  h.state = async () => (await h.rpc('getState')).result;
  h.openAdd = async () => {
    await page.click('button[aria-label=Accounts]');
    await sleep(500);
    await h.btn('Add Account');
    await h.sheetOpen();
  };
  h.option = (title) => h.x(`${SHEET}//button[.//span[normalize-space(.)="${title}"]]`);
  h.selectAccount = async (name) => {
    await page.click('button[aria-label=Accounts]');
    await sleep(500);
    await h.x(`//button[.//span[normalize-space(.)="${name}"]]`);
    await h.home();
  };
  return { browser, h };
}

async function sendFrom(h, assetMatch, amountKeys, label) {
  await h.btn('Send');
  await h.sheetOpen();
  await h.x(`${SHEET}//button[.//span[contains(.,"${assetMatch}")]]`);
  await h.x(`${SHEET}//button[.//div[normalize-space(.)="Account 1"]]`);
  for (const k of amountKeys) await h.page.click(`button[aria-label="${k}"]`);
  await h.waitText('Network fee ≈', 30000);
  await h.btn('Send', SHEET);
  await h.page.waitForFunction(() => /Sending to|Sent to/.test(document.body.innerText), { timeout: 60000 });
  const ok = await h.page
    .waitForFunction(() => document.querySelector('[aria-label="Transaction confirmed"]'), { timeout: 90000 })
    .then(() => true, () => false);
  await h.shot(`send-${label}`);
  check(ok, `${label}: transaction from an imported key confirmed on-chain`);
  await h.btn('Done');
  await h.home();
}

// ── 1. Main flow ─────────────────────────────────────────────
{
  const { browser, h } = await launch();
  const { page } = h;
  try {
    await page.goto(h.url);
    await sleep(500);
    await h.rpc('createWallet', { mnemonic: PRIMARY, password: PW });
    await page.goto(h.url);
    await h.home();
    let st = await h.state();
    const primaryEvm = st.accounts[0].evmAddress;
    check(st.keyrings.length === 1 && st.accounts[0].source.type === 'mnemonic', 'new wallet: one phrase, Account 1');

    // Create New Account (single phrase → derives directly)
    await h.openAdd();
    await h.shot('01-add-menu');
    await h.option('Create New Account');
    await h.home();
    st = await h.state();
    const acct2 = st.accounts.find((a) => a.name === 'Account 2');
    check(acct2?.source.derivationIndex === 1 && st.selectedAccount === acct2.index, 'Create New Account: derives index 1 and selects it');

    // Import Recovery Phrase
    await h.openAdd();
    await h.option('Import Recovery Phrase');
    await page.waitForSelector('textarea');
    await page.type('textarea', OTHER_PHRASE, { delay: 10 });
    await h.waitText('Looks good');
    await h.btn('Continue', SHEET);
    await h.home();
    st = await h.state();
    check(st.keyrings.some((k) => k.label === 'Recovery Phrase 2'), 'Import Recovery Phrase: adds "Recovery Phrase 2"');

    // Duplicate phrase is rejected
    const dup = await h.rpc('importMnemonic', { mnemonic: OTHER_PHRASE });
    check(!dup.ok && /already/.test(dup.error), 'importing the same phrase again is rejected');

    // Create New Account with several phrases → picker
    await h.openAdd();
    await h.option('Create New Account');
    await h.waitText('From recovery phrase');
    await h.shot('02-pick-phrase');
    await h.x(`${SHEET}//button[.//span[normalize-space(.)="Recovery Phrase 2"]]`);
    await h.home();
    st = await h.state();
    const rp2 = st.keyrings.find((k) => k.label === 'Recovery Phrase 2').id;
    const fromRp2 = st.accounts.filter((a) => a.source.type === 'mnemonic' && a.source.keyringId === rp2).map((a) => a.source.derivationIndex);
    check(fromRp2.join(',') === '0,1', 'Create New Account from Recovery Phrase 2 derives its index 1');

    // Create New Recovery Phrase (backup + confirm)
    await h.openAdd();
    await h.option('Create New Recovery Phrase');
    await h.waitText('Tap to reveal');
    const words = await page.$$eval(`${'.z-30'} .grid-cols-3 > div span:last-child`, (els) => els.map((e) => e.textContent));
    await h.x(`${SHEET}//button[contains(.,"Tap to reveal")]`);
    await page.click('.z-30 input[type=checkbox]');
    await h.shot('03-new-phrase');
    await h.btn('Continue', SHEET);
    await h.waitText('Select the correct word');
    const labels = await page.$$eval('.z-30 div', (els) => els.map((e) => e.textContent?.trim() ?? '').filter((t) => /^Word #\d+$/.test(t)));
    for (const l of [...new Set(labels)]) {
      const w = words[parseInt(l.slice(6)) - 1];
      await h.x(`${SHEET}//div[normalize-space(.)="${l}"]/following-sibling::div//button[normalize-space(.)="${w}"]`);
    }
    await h.btn('Continue', SHEET);
    await h.home();
    st = await h.state();
    check(words.length === 12 && st.keyrings.some((k) => k.label === 'Recovery Phrase 3'), 'Create New Recovery Phrase: backup, confirm, adds "Recovery Phrase 3"');

    // Import Private Key — EVM
    await h.openAdd();
    await h.option('Import Private Key');
    await page.type('textarea[aria-label="Private key"]', EVM_KEY.slice(2), { delay: 5 });
    await h.waitText('Detected: EVM account');
    await h.shot('04-import-evm-key');
    await h.btn('Import', SHEET);
    await h.home();
    st = await h.state();
    const evmImported = st.accounts.find((a) => a.source.type === 'privateKey' && a.evmAddress);
    check(evmImported?.evmAddress === '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' && !evmImported.solanaAddress, 'Import Private Key (EVM): EVM-only account 0xf39F…2266');
    check(!(await h.text()).includes('Solana Devnet'), 'EVM key account shows only EVM networks');

    const dupKey = await h.rpc('importPrivateKey', { privateKey: EVM_KEY });
    check(!dupKey.ok && /already in your wallet/.test(dupKey.error), 'importing the same key again is rejected');
    const badKey = await h.rpc('importPrivateKey', { privateKey: 'not a key' });
    check(!badKey.ok, 'garbage private key is rejected');

    // Import Private Key — Solana (Phantom format)
    await h.openAdd();
    await h.option('Import Private Key');
    await page.type('textarea[aria-label="Private key"]', SOL_KEY, { delay: 2 });
    await h.waitText('Detected: Solana account');
    await h.btn('Import', SHEET);
    await h.home();
    st = await h.state();
    const solImported = st.accounts.find((a) => a.source.type === 'privateKey' && a.solanaAddress);
    check(solImported?.solanaAddress === SOL_ADDR, `Import Private Key (Solana, Phantom format): ${SOL_ADDR.slice(0, 6)}…`);

    // Send real funds from each imported key (proves they sign correctly)
    await sendFrom(h, 'Solana Devnet', ['0', '.', '0', '0', '0', '1'], 'solana-key');
    await h.selectAccount(evmImported.name);
    await sendFrom(h, 'USDC · Arbitrum Sepolia', ['0', '.', '0', '1'], 'evm-key');

    // Watch Address — duplicate is rejected, a new one is added as view-only
    const dupWatch = await h.rpc('addWatchAddress', { address: primaryEvm });
    check(!dupWatch.ok && /already in your wallet/.test(dupWatch.error), 'watching an address already in the wallet is rejected');
    await h.openAdd();
    await h.option('Watch Address');
    await page.type('input[aria-label="Address to watch"]', 'oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96', { delay: 5 });
    await page.type('input[aria-label="Account name"]', 'Watched', { delay: 5 });
    await h.waitText('Detected: Solana account');
    await h.btn('Add', SHEET);
    await h.home();
    await h.shot('05-watch-home');
    st = await h.state();
    const watched = st.accounts.find((a) => a.source.type === 'watch');
    check(watched?.name === 'Watched' && st.selectedAccount === watched.index, 'Watch Address: added and selected');
    check((await h.text()).includes('View Only'), 'Home shows the View Only pill');
    const bal = await h.rpc('getBalances', { accountIndex: watched.index });
    check(bal.ok && bal.result.every((b) => b.networkId === 'solana-devnet'), 'watched Solana address loads only Solana balances');
    const watchSend = await h.rpc('quoteSend', { accountIndex: watched.index, networkId: 'solana-devnet', token: null, to: SOL_ADDR, amount: '1000' });
    check(!watchSend.ok && /watch-only/.test(watchSend.error), 'watch-only account cannot send');
    await h.btn('Send');
    await sleep(500);
    check((await h.text()).toLowerCase().includes('view only'), 'Send tile explains view-only');

    // Accounts sheet groups by source
    await page.click('button[aria-label=Accounts]');
    await sleep(600);
    await h.shot('06-accounts-grouped');
    const sheetText = await h.text();
    check(['RECOVERY PHRASE 1', 'RECOVERY PHRASE 2', 'PRIVATE KEYS', 'WATCHING'].every((g) => sheetText.toUpperCase().includes(g)), 'Accounts sheet groups phrases, private keys and watched');

    // Remove the imported EVM key account → its secret is deleted too
    await h.x(`//button[@aria-label="Edit ${evmImported.name}"]`);
    await h.x(`//button[@aria-label="Remove ${evmImported.name}"]`);
    await h.waitText('deletes the private key');
    await h.shot('07-remove-confirm');
    await h.btn('Remove Account');
    await sleep(800);
    st = await h.state();
    check(!st.accounts.some((a) => a.index === evmImported.index) && st.keyrings.filter((k) => k.kind === 'privateKey').length === 1, 'removing a key account deletes its key');
    const lastPrimary = await h.rpc('removeAccount', { index: 0 });
    // Account 2 still exists on the primary phrase, so removing Account 1 is allowed; put it back afterwards isn't needed.
    check(lastPrimary.ok, 'removing one of two primary-phrase accounts is allowed');
    const primaryLeft = (await h.state()).accounts.filter((a) => a.source.type === 'mnemonic' && a.source.keyringId === 'primary');
    const blocked = await h.rpc('removeAccount', { index: primaryLeft[0].index });
    check(!blocked.ok && /main recovery phrase/.test(blocked.error), "the primary phrase's last account can't be removed");
    await page.goto(h.url);
    await h.home();

    // Reveal: list of secrets, then a chosen phrase
    const reveal = await h.rpc('revealSecret', { password: PW, keyringId: rp2 });
    check(reveal.ok && reveal.result.value === OTHER_PHRASE, 'revealSecret returns the chosen phrase');
    const revealKey = await h.rpc('revealSecret', { password: PW, keyringId: st.keyrings.find((k) => k.kind === 'privateKey').id });
    check(revealKey.ok && revealKey.result.value === SOL_KEY, 'Solana key is exported in Phantom format');
    const wrong = await h.rpc('revealSecret', { password: 'nope', keyringId: rp2 });
    check(!wrong.ok, 'reveal with the wrong password fails');
    await page.click('button[aria-label=Accounts]');
    await sleep(500);
    await h.btn('Settings');
    await h.sheetOpen();
    await h.btn('Recovery Phrases & Keys');
    await h.waitText('PRIVATE KEYS', 5000).catch(() => undefined);
    await h.shot('08-reveal-list');
    const rt = (await h.text()).toUpperCase();
    check(rt.includes('RECOVERY PHRASE 3') && rt.includes('PRIVATE KEY'), 'Settings lists every phrase and key');
    await page.goto(h.url);
    await h.home();

    // Lock / unlock keeps everything; imported accounts still work after reloading from the vault
    const before = (await h.state()).accounts.map((a) => `${a.index}:${a.evmAddress ?? ''}:${a.solanaAddress ?? ''}`).join('|');
    await h.rpc('lock');
    await h.rpc('unlock', { password: PW });
    const after = (await h.state()).accounts.map((a) => `${a.index}:${a.evmAddress ?? ''}:${a.solanaAddress ?? ''}`).join('|');
    check(before === after, 'accounts unchanged after lock/unlock');
    const solBal = await h.rpc('getBalances', { accountIndex: solImported.index });
    check(solBal.ok && solBal.result.some((b) => b.networkId === 'solana-devnet' && BigInt(b.raw) > 0n), 'imported Solana key balance loads after unlock');
  } catch (e) {
    failures.push(String(e?.message ?? e));
    log('✗', e?.message ?? e);
    await h.shot('error').catch(() => undefined);
  } finally {
    await browser.close();
  }
}

// ── 2. Migration of a wallet from before multi-account support ──
{
  const { browser, h } = await launch();
  const { page } = h;
  try {
    await page.goto(h.url);
    await sleep(500);
    // Write an old-format vault: AES-GCM(PBKDF2(password)) over the bare phrase, and accounts without `source`.
    await page.evaluate(
      async (mnemonic, password) => {
        const enc = new TextEncoder();
        const b64 = (u) => btoa(String.fromCharCode(...u));
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const iterations = 1000;
        const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
        const key = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt']);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic)));
        await chrome.storage.local.set({
          vault: { v: 1, iterations, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) },
          accounts: [
            { index: 0, name: 'Account 1', evmAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', solanaAddress: 'oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96' },
            { index: 1, name: 'Savings', evmAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', solanaAddress: 'AqynRZwvVqUPRwRJXvm6odUb3t93fDjnWe3p6BeuUFxD' },
          ],
          settings: { networkMode: 'testnet', autoLockMinutes: 15, selectedAccount: 1, openIn: 'popup' },
          activity: [],
        });
      },
      HARDHAT,
      PW,
    );
    await page.goto(h.url);
    await h.waitText('Welcome back');
    await page.type('input[type=password]', PW, { delay: 10 });
    await h.btn('Unlock');
    await h.home();
    const st = await h.state();
    check(st.keyrings.length === 1 && st.keyrings[0].id === 'primary', 'migration: old wallet gets its primary phrase keyring');
    check(st.accounts.every((a, i) => a.source.type === 'mnemonic' && a.source.derivationIndex === i), 'migration: old accounts keep their derivation index');
    check(st.selectedAccount === 1 && (await h.text()).includes('Wallet'), 'migration: selected account preserved');
    const bal = await h.rpc('getBalances', { accountIndex: 1 });
    check(bal.ok && bal.result.some((b) => BigInt(b.raw) > 0n), 'migration: balances load for the migrated account');
    const added = (await h.rpc('addAccount', {})).result;
    check(added.accounts.at(-1).evmAddress === '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'migration: next account derives index 2 (0x3C44…93BC)');
    const secret = await h.rpc('revealSecret', { password: PW });
    check(secret.ok && secret.result.value === HARDHAT, 'migration: phrase still revealable');
  } catch (e) {
    failures.push(String(e?.message ?? e));
    log('✗', e?.message ?? e);
  } finally {
    await browser.close();
  }
}

console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall account checks passed');
process.exit(failures.length ? 1 : 0);
