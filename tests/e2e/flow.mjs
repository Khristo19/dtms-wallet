/**
 * End-to-end run of the popup in headless Chrome, in light and dark mode.
 *
 *   npm run test:e2e                                  # build + popup and side panel, light and dark
 *   node tests/e2e/flow.mjs [light|dark] [popup|panel]  # run against the existing build
 *
 * The side panel page is loaded in a tab with a tall viewport (400×900), since headless Chrome
 * has no side panel UI.
 *
 * Imports the well-known `test … junk` seed, which has testnet funds, and sends 0.001 SOL on
 * Solana devnet from account 2 to account 1. (Account 1's devnet address is a data account and
 * can't send SOL.) Screenshots go to tests/e2e/shots/<scheme>/.
 *
 * Env: CHROME_PATH (default /usr/bin/google-chrome).
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = resolve(ROOT, '.output/chrome-mv3');
const SEED = 'test test test test test test test test test test test junk';
const PW = 'hunter2hunter2';
const SHEET = '//div[contains(@class,"z-30")]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(scheme, surface) {
  const shots = resolve(ROOT, 'tests/e2e/shots', surface, scheme);
  rmSync(shots, { recursive: true, force: true });
  mkdirSync(shots, { recursive: true });
  const log = (...a) => console.log(`[${surface}/${scheme}]`, ...a);
  const failures = [];
  const check = (ok, what) => (ok ? log('✓', what) : (failures.push(what), log('✗', what)));

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    headless: true,
    pipe: true,
    enableExtensions: true,
    args: ['--no-sandbox', '--enable-unsafe-extension-debugging'],
  });
  try {
    const id = await browser.installExtension(EXT);
    const page = await browser.newPage();
    await page.setViewport(surface === 'panel' ? { width: 400, height: 900, deviceScaleFactor: 2 } : { width: 390, height: 600, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

    const shot = (n) => page.screenshot({ path: `${shots}/${n}.png` });
    const x = async (xp, timeout = 20000) => {
      const el = await page.waitForSelector(`::-p-xpath(${xp})`, { timeout });
      await el.click();
      await sleep(450);
    };
    const btn = (text, scope = '') => x(`${scope}//button[normalize-space(.)="${text}"]`);
    const rpc = (m, p) => page.evaluate((m, p) => chrome.runtime.sendMessage({ type: 'dtms-rpc', method: m, params: p }), m, p);
    const idle = () => page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 30000 });
    const text = () => page.evaluate(() => document.body.innerText);
    // Sheets spring in/out; wait for them to settle instead of sleeping a fixed time.
    const sheetOpen = () => page.waitForFunction(() => document.querySelector('.invisible') !== null, { timeout: 15000 });
    const closeSheet = async () => {
      await page.click('button[aria-label=Close]');
      await page.waitForFunction(() => !document.querySelector('div.z-30') && !document.querySelector('.invisible'), { timeout: 15000 });
      await sleep(200);
    };

    // Onboarding (import)
    await page.goto(`chrome-extension://${id}/${surface === 'panel' ? 'sidepanel' : 'popup'}.html`);
    await sleep(900);
    await shot('01-welcome');
    await btn('Continue');
    await page.waitForSelector('::-p-text(I Already Have a Wallet)');
    await sleep(500); // let the sheet spring settle before clicking inside it
    await shot('02-get-started');
    await btn('I Already Have a Wallet');
    await page.waitForSelector('textarea', { timeout: 10000 });
    await page.type('textarea', SEED, { delay: 15 });
    await page.waitForFunction(() => document.body.innerText.includes('Looks good'), { timeout: 10000 });
    await shot('03-import');
    await btn('Continue');
    await page.waitForSelector('input[type=password]', { timeout: 10000 });
    const pws = await page.$$('input[type=password]');
    await pws[0].type(PW, { delay: 15 });
    await pws[1].type(PW, { delay: 15 });
    await shot('04-password');
    await btn('Create Wallet');
    await page.waitForSelector('button[aria-label=Search]', { timeout: 30000 });
    await idle();
    await sleep(2500);
    await shot('05-home');
    const surfaceBtn = surface === 'panel' ? 'Switch to popup' : 'Open in side panel';
    check(!!(await page.$(`button[aria-label="${surfaceBtn}"]`)), `Home shows "${surfaceBtn}" next to the eye button`);
    check(true, 'wallet imported, Home loaded');

    // Background: animated unless reduced motion
    const t0 = await page.evaluate(() => getComputedStyle(document.querySelector('.gradient-bg > span')).transform);
    await sleep(1200);
    const t1 = await page.evaluate(() => getComputedStyle(document.querySelector('.gradient-bg > span')).transform);
    check(t0 !== t1, 'background gradient is animating');

    await btn('Receive');
    await sheetOpen();
    await shot('06-receive');
    await closeSheet();
    await page.click('button[aria-label=Search]');
    await sheetOpen();
    await page.type('input[placeholder="Tokens and networks"]', 'usdc', { delay: 15 });
    await sleep(300);
    await shot('07-search');
    await closeSheet();

    await page.click('button[aria-label=Accounts]');
    await sleep(500);
    await shot('08-accounts');
    await btn('Add Account');
    await sheetOpen();
    await x(`${SHEET}//button[.//span[normalize-space(.)="Create New Account"]]`);
    await page.waitForFunction(() => !document.querySelector('div.z-30'), { timeout: 20000 });
    await sleep(800);
    const st = await rpc('getState');
    check(st.result.selectedAccount === 1, 'account 2 added and selected');
    await idle();
    await sleep(800);

    // Send 0.001 devnet SOL from account 2 → account 1
    await btn('Send');
    await sheetOpen();
    await shot('09-send-asset');
    await x(`${SHEET}//button[.//span[contains(.,"Solana Devnet")]]`);
    await shot('10-send-recipient');
    await x(`${SHEET}//button[.//div[normalize-space(.)="Account 1"]]`);
    for (const k of ['0', '.', '0', '0', '1']) await page.click(`button[aria-label="${k}"]`);
    await page.waitForFunction(() => document.body.innerText.includes('Network fee ≈'), { timeout: 30000 });
    await shot('11-send-amount');
    check(
      await page.evaluate(() => getComputedStyle(document.querySelector('.invisible') ?? document.body).visibility === 'hidden'),
      'Home is hidden behind the open sheet',
    );
    await btn('Send', SHEET);
    // Hero icon, heading and status row must agree at every step.
    const heroState = () =>
      page.evaluate(() => ({
        hero: document.querySelector('[aria-label^="Transaction "]')?.getAttribute('aria-label'),
        heading: document.querySelector('[aria-live="polite"]')?.textContent ?? '',
        row: document.body.innerText,
      }));
    await page.waitForFunction(() => /Sending to|Sent to/.test(document.body.innerText), { timeout: 60000 });
    let h = await heroState(); // read before the (slow) screenshot; devnet can confirm within a second
    await shot('12-sent-pending');
    if (h.hero === 'Transaction pending') check(h.heading.startsWith('Sending to') && h.row.includes('Pending'), 'pending: hero, heading and status agree');
    const confirmed = await page
      .waitForFunction(() => document.querySelector('[aria-label="Transaction confirmed"]') && document.body.innerText.includes('Confirmed'), { timeout: 60000 })
      .then(() => true, () => false);
    check(confirmed, 'devnet transfer confirmed');
    await sleep(700);
    h = await heroState();
    check(h.hero === 'Transaction confirmed' && h.heading.startsWith('Sent to') && !h.row.includes('Pending'), 'confirmed: hero, heading and status agree');
    await shot('13-sent');
    await btn('Done');
    await sleep(500);

    await x('//nav//button[normalize-space(.)="Activity"]');
    await sleep(1500);
    await shot('14-activity');
    await x('//nav//button[normalize-space(.)="Collectibles"]');
    await shot('15-collectibles');
    await x('//nav//button[normalize-space(.)="Wallet"]');

    await x('(//button[.//span[contains(.,"Solana Devnet")]])[1]');
    await sheetOpen();
    await shot('16-token');
    await closeSheet();

    await page.click('button[aria-label=Accounts]');
    await sleep(400);
    await btn('Settings');
    await sheetOpen();
    await shot('17-settings');
    // "Open wallet in" rewires the toolbar icon.
    // Read from the page: a service-worker handle can go stale when MV3 restarts the worker.
    const wiring = () => page.evaluate(async () => [await chrome.action.getPopup({}), (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick]);
    await rpc('setOpenIn', { openIn: 'panel' });
    const [popupA, panelA] = await wiring();
    check(popupA === '' && panelA === true, 'Open in: Side Panel → toolbar opens the panel');
    await rpc('setOpenIn', { openIn: 'popup' });
    const [popupB, panelB] = await wiring();
    check(popupB.endsWith('/popup.html') && panelB === false, 'Open in: Popup → toolbar opens the popup');
    await btn('Lock Wallet');
    await sleep(700);
    await shot('18-locked');
    await page.type('input[type=password]', 'wrongpassword', { delay: 15 });
    await btn('Unlock');
    await sleep(1500);
    check((await text()).includes('Incorrect password'), 'wrong password rejected');
    await page.type('input[type=password]', PW, { delay: 15 });
    await btn('Unlock');
    await page.waitForSelector('button[aria-label=Search]', { timeout: 30000 });
    check(true, 'unlocked');
  } catch (e) {
    failures.push(String(e?.message ?? e));
    log('✗', e?.message ?? e);
  } finally {
    await browser.close();
  }
  return failures;
}

const schemes = process.argv[2] ? [process.argv[2]] : ['light', 'dark'];
const surfaces = process.argv[3] ? [process.argv[3]] : ['popup', 'panel'];
let failed = 0;
for (const surface of surfaces) for (const s of schemes) failed += (await run(s, surface)).length;
process.exit(failed ? 1 : 0);
