// Headless check: upload files through the file picker of a built dashboard.
// node tests/browser_upload.js dist/dashboard.html file1 [file2 ...]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const [, , page_, ...files] = process.argv;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('**/plotly*.js', r => r.fulfill({ body: fs.readFileSync(require('path').join(__dirname, '..', 'vendor', 'plotly-strict-2.35.2.min.js')), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve(page_)); await p.waitForFunction(() => window.__dashboardReady);
  for (const f of files) {
    await p.evaluate(() => { window.__dashboardReady = false; });
    const t = Date.now();
    await p.setInputFiles('#file-input', f);
    await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 120000 }); await p.waitForTimeout(600);
    const info = await p.evaluate(() => ({ title: document.getElementById('session-title').textContent, badges: document.getElementById('session-badges').innerText.replace(/\n/g, ' | '), err: document.getElementById('welcome-err').innerText, report: !document.getElementById('report').hidden, kpi: Array.from(document.querySelectorAll('.kpi .v')).map(e => e.innerText).join(' · ') }));
    console.log(path.basename(f), `${Date.now() - t} ms`, JSON.stringify(info));
    await p.screenshot({ path: `/tmp/claude-0/shots/upload-${path.basename(f)}.png` });
  }
  console.log('ERRORS:', errs.join('\n') || 'none'); await b.close();
})();
