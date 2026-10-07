// Headless QA: loads a built dashboard (Plotly served locally), checks for JS errors,
// linked selection behaviour and screenshots each section.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [,, file, outDir = '/tmp/claude-0/shots', plotlyPath = '/tmp/claude-0/plotly.min.js'] = process.argv;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/plotly*.js', r => r.fulfill({ body: fs.readFileSync(plotlyPath), contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto('file://' + require('path').resolve(file));
  await page.waitForFunction(() => window.__dashboardReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const R = window.__analysis; if (!R) return null;
    return { laps: R.laps.length, rows: document.querySelectorAll('#tbl-laps tbody tr').length, corners: document.querySelectorAll('#tbl-corners tbody tr').length,
      kpis: Array.from(document.querySelectorAll('.kpi')).map(k => k.innerText.replace(/\n/g, ' | ')) };
  });
  console.log(JSON.stringify(res, null, 1));
  await page.screenshot({ path: outDir + '/full.png', fullPage: true });
  for (const id of ['overview', 'laps', 'corners', 'theoretical', 'telemetry', 'track', 'insights']) {
    const el = await page.$('#' + id); if (el) await el.screenshot({ path: `${outDir}/${id}.png` });
  }
  if (res) {
    // linked selection: click lap row 5, then corner row 3
    await page.click('#tbl-laps tbody tr:nth-child(5)');
    await page.waitForTimeout(400);
    const sel1 = await page.evaluate(() => ({ detail: document.querySelector('#lap-detail h3').innerText, tmLap: document.getElementById('tm-lap').value, mapLap: document.getElementById('map-lap').value }));
    await page.click('#tbl-corners tbody tr:nth-child(3)');
    await page.waitForTimeout(400);
    console.log('ERR so far:', errors.join('\n')); const sel2 = await page.evaluate(() => ({ corner: document.querySelector('#corner-detail h3').innerText, xr: (document.getElementById('ch-telemetry').layout||{xaxis:{}}).xaxis.range }));
    // shift-click compare
    await page.click('#lap-strip .cell:nth-child(8)', { modifiers: ['Shift'] });
    await page.waitForTimeout(300);
    const cmp = await page.evaluate(() => document.querySelectorAll('#tm-cmp .chip').length);
    // incident focus
    await page.evaluate(() => { const i = document.querySelector('#corner-detail .inc, #lap-detail .inc'); if (i) i.click(); }); await page.waitForTimeout(400);
    // toggle channels and map colour modes
    for (const c of ['rpm', 'lonG', 'gear']) { await page.click(`#tm-ch [data-ch="${c}"]`); await page.waitForTimeout(150); }
    for (const m of ['delta', 'consistency', 'mistakes', 'speed']) { await page.click(`#map-controls [data-mc="${m}"]`); await page.waitForTimeout(200); await page.locator('#ch-map').screenshot({ path: `${outDir}/map-${m}.png` }); }
    await page.locator('#telemetry').screenshot({ path: `${outDir}/telemetry-zoom.png` });
    await page.selectOption('#tm-ref', 'median'); await page.waitForTimeout(300);
    await page.click('#btn-dq'); await page.waitForTimeout(200);
    console.log('linked:', JSON.stringify({ sel1, sel2, cmp }));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log('mobile horizontal overflow px:', overflow);
    await page.screenshot({ path: outDir + '/mobile.png', fullPage: false });
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
