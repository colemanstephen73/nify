// Browser smoke test: phone viewport, kart profile → setup sheet → session log → offline reload → dark mode.
// Run: npm run test:ui   (needs Playwright; uses the preinstalled Chromium in cloud sessions)
// Optional: SHOTS=<dir> to save screenshots.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { playwright = require(p); break; } catch {} }
if (!playwright) { console.log('SKIP: Playwright not installed'); process.exit(0); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(root, 'tools/serve.js'), String(port)], { stdio: 'ignore' });
const shots = process.env.SHOTS;
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fail++; };

try {
  await new Promise(r => setTimeout(r, 400));
  const browser = await playwright.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !/open-meteo|ERR_INTERNET/.test(m.text()) && errors.push(m.text()));
  const url = `http://localhost:${port}/app/`;
  await page.goto(url);
  await page.waitForSelector('#track');

  // Kart profile
  await page.click('#nav-kart');
  for (const [k, v] of Object.entries({ weightLb: 92, frontPressurePsi: 14, rearPressurePsi: 14, frontTrackWidthIn: 38, rearTrackWidthIn: 40, axleSprocket: 89, mainJet: 58, jetRefJet: 58, jetRefDaFt: 1200 })) await page.fill(`#p-${k}`, String(v));
  await page.selectOption('#p-engine', 'Comer C52');
  await page.click('text=Save kart profile');

  // Setup
  await page.click('#nav-setup');
  await page.selectOption('#track', 'ovrp');
  for (const [id, v] of Object.entries({ airT: 90, trackT: 128, rh: 45, pr: 29.35, dw: 45 })) await page.fill(`#${id}`, String(v));
  await page.click('button.chip:has-text("Pushes on corner entry")');
  await page.click('#go');
  await page.waitForSelector('#result article.field');
  const sheet = await page.textContent('#result');
  check(sheet.includes('Setup sheet: OVRP'), 'sheet rendered for OVRP');
  check(sheet.includes('10/89'), 'spec gear shown');
  check(/Density altitude/.test(sheet), 'density altitude shown');
  check(sheet.includes('Front track width') && /38\.4/.test(sheet), 'feel change applied to front width');
  check(/doesn't meet/.test(sheet), 'legality warnings shown (C52 / weight)');
  const cards = await page.$$eval('#result article.field', els => els.map(e => e.querySelector('.reason')?.textContent.trim().length || 0));
  check(cards.length >= 15 && cards.every(n => n > 5), `every field shows a reason (${cards.length} fields)`);
  await page.click('#result article.field >> nth=3 >> summary');
  check(await page.isVisible('#result article.field >> nth=3 >> .steps a'), 'source links visible when expanded');
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(scroll <= 0, `no horizontal scroll at 390 px (${scroll})`);
  const small = await page.$$eval('button, select, input:not([type=checkbox]):not(.sr-only)', els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.outerHTML.slice(0, 60)));
  check(small.length === 0, `tap targets ≥ 44 px ${small.slice(0, 3).join(' ')}`);
  if (shots) await page.screenshot({ path: `${shots}/sheet.png`, fullPage: true });

  // Log
  await page.click('text=Save to session log');
  await page.click('#nav-log');
  await page.waitForSelector('details.session');
  check((await page.$$('details.session')).length === 1, 'session saved to the log');
  await page.click('details.session summary');
  await page.fill('details.session textarea >> nth=0', '33.10 32.84 32.90');
  await page.click('details.session button:has-text("Save")');
  await page.waitForSelector('details.session summary:has-text("best 32.84")');
  check(true, 'lap times saved, best lap computed');
  if (shots) await page.screenshot({ path: `${shots}/log.png`, fullPage: true });

  // Offline: the service worker serves the app shell.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForSelector('#track');
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#track', { timeout: 5000 });
  await page.click('#go');
  await page.waitForSelector('#result article.field');
  check(true, 'works offline after first load');
  await ctx.setOffline(false);

  // Dark mode
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(light !== dark, `dark mode follows the system (${light} → ${dark})`);
  if (shots) await page.screenshot({ path: `${shots}/dark.png` });

  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
} catch (e) {
  console.log('FAIL', e.message); fail++;
} finally {
  server.kill();
}
console.log(fail ? `${fail} failure(s)` : 'UI smoke test passed');
process.exit(fail ? 1 : 0);
