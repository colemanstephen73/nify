// Corner click → replay jump QA.
// node tests/replay_corner_check.js <dashboard.html> <test_replay.webm> <video0SessionTime>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [, , page_, video, v0s] = process.argv;
const V0 = +v0s;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve(page_)); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.click('#btn-replay');
  const fc = p.waitForEvent('filechooser'); await p.click('#rv-addvideo'); await (await fc).setFiles(video);
  await p.waitForFunction(() => document.getElementById('rv-video').readyState >= 2, null, { timeout: 20000 });
  const lap3 = await p.evaluate(() => window.__analysis.laps.find(l => l.lapNo === 3).index);
  await p.evaluate(() => { const v = document.getElementById('rv-video'); v.pause(); v.currentTime = 4.0; }); await p.waitForTimeout(300);
  await p.selectOption('#rv-synclap', String(lap3)); await p.click('#rv-setsync'); await p.waitForTimeout(200);

  // expected session time for corner ci on lap li with lead-in
  const expect = (ci, li, lead) => p.evaluate(([ci, li, lead]) => {
    const R = window.__analysis, c = R.corners[ci], l = R.laps[li];
    const entry = Number.isFinite(c.dist.brake) ? Math.min(c.dist.brake, c.dist.start) : c.dist.start;
    return l.tStart + l.grid.time[Math.round(entry / R.G.ds)] - lead;
  }, [ci, li, lead]);
  const now = () => p.evaluate(() => ({ T: window.__replay.RP.T, vt: document.getElementById('rv-video').currentTime, sel: +document.getElementById('tm-lap').value, toast: document.getElementById('toast').textContent }));
  const check = async (label, ci, li, lead = 2) => {
    await p.waitForTimeout(450);
    const n = await now(), want = await expect(ci, li, lead), cid = await p.evaluate(i => window.__analysis.corners[i].id, ci);
    const frameTime = V0 + n.vt; // the session time burned into the video frame now showing
    ok(Math.abs(n.T - want) < 0.03 && Math.abs(frameTime - want) < 0.06 && n.sel === li,
      `${label}: ${cid} → video ${n.vt.toFixed(2)} s shows t ${frameTime.toFixed(2)} s, expected ${want.toFixed(2)} s (${lead} s before braking) on lap index ${li}`);
    return n;
  };
  const rowOf = async id => (await p.evaluate(id => window.__analysis.corners.findIndex(c => c.id === id), id));

  // 1. corner table: selected lap (best lap) is outside the video → falls back to the covered lap (L3)
  const t7 = await rowOf('T7');
  await p.click(`#tbl-corners tbody tr[data-id="${t7}"]`);
  const n1 = await check('corner table (selected lap not in video)', t7, lap3);
  ok(/is not in the video/.test(n1.toast), `explains the fallback: "${n1.toast}"`);
  // 2. corner table again, now on L3
  const t2 = await rowOf('T2'); await p.click(`#tbl-corners tbody tr[data-id="${t2}"]`); await check('corner table', t2, lap3);
  // 3. consistency heatmap click
  const t5 = await rowOf('T5');
  await p.evaluate(() => document.getElementById('ch-cons-heat').emit('plotly_click', { points: [{ x: 'T5' }] })); await check('consistency heatmap', t5, lap3);
  // 4. telemetry Jump chip
  const t9 = await rowOf('T9'); await p.click(`#tm-jump [data-j="${t9}"]`); await check('telemetry Jump chip', t9, lap3);
  // 5. track-map corner label
  const t3 = await rowOf('T3'); await p.evaluate(i => document.getElementById('ch-map').emit('plotly_click', { points: [{ customdata: ['corner', i] }] }), t3); await check('track-map corner label', t3, lap3);
  // 6. pace/consistency matrix
  const t10 = await rowOf('T10'); await p.evaluate(i => document.getElementById('ch-matrix').emit('plotly_click', { points: [{ customdata: [i] }] }), t10); await check('pace/consistency matrix', t10, lap3);
  // 7. lead-in 0 s → exactly at the braking point
  await p.selectOption('#rv-lead', '0');
  const t1 = await rowOf('T1'); await p.click(`#tbl-corners tbody tr[data-id="${t1}"]`); await check('lead-in 0 s', t1, lap3, 0);
  const at = await p.evaluate(() => { const st = window.__replay.rpState(window.__replay.RP.T), R = window.__analysis, c = R.corners.find(c => c.id === 'T1'); return { d: st.dist, want: Math.min(c.dist.brake, c.dist.start) }; });
  ok(Math.abs(at.d - at.want) < 6, `with 0 s lead-in the car is at the braking point (${at.d.toFixed(0)} m vs ${at.want.toFixed(0)} m)`);
  await p.selectOption('#rv-lead', '2');
  // 8. mistake entry jumps to its own lap and corner (L3 T1 lock-up)
  await p.click(`#tbl-laps tbody tr[data-id="${lap3}"]`); await p.waitForTimeout(300);
  await p.evaluate(() => { const i = Array.from(document.querySelectorAll('#lap-detail .inc')).find(e => /T1/.test(e.textContent)); i.click(); });
  await check('mistake entry (L3 T1 lock-up)', t1, lap3);
  // 9. switch off → corner clicks no longer move the video
  await p.click('#rv-cornerjump'); const before = (await now()).vt;
  await p.click(`#tbl-corners tbody tr[data-id="${t7}"]`); await p.waitForTimeout(400);
  ok(Math.abs((await now()).vt - before) < 0.01, '"Jump to clicked corner" off: video stays put');
  await p.click('#rv-cornerjump');
  // 10. while playing, a corner click jumps and keeps playing
  await p.click('#rv-play'); await p.waitForTimeout(500);
  await p.click(`#tbl-corners tbody tr[data-id="${t5}"]`); await p.waitForTimeout(900);
  const pl = await p.evaluate(() => ({ playing: !document.getElementById('rv-video').paused, T: window.__replay.RP.T }));
  const w5 = await expect(t5, lap3, 2);
  ok(pl.playing && pl.T > w5 && pl.T < w5 + 1.2, `jump while playing: resumes from ${w5.toFixed(2)} s once the charts are redrawn (now ${pl.T.toFixed(2)} s, 0.9 s later)`);
  await p.click('#rv-play');
  // 11. telemetry-only (no video): jumps on the selected lap
  await p.reload(); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.click('#btn-replay'); await p.waitForTimeout(200);
  const sel = await p.evaluate(() => +document.getElementById('tm-lap').value);
  const t8 = await rowOf('T8'); await p.click(`#tbl-corners tbody tr[data-id="${t8}"]`); await p.waitForTimeout(300);
  const tw = await expect(t8, sel, 2), tn = await p.evaluate(() => window.__replay.RP.T);
  ok(Math.abs(tn - tw) < 0.03, `telemetry-only: T8 on the selected lap (${tn.toFixed(2)} vs ${tw.toFixed(2)} s)`);
  // 12. panel closed: corner click does nothing to the replay
  await p.click('#rv-close'); await p.click(`#tbl-corners tbody tr[data-id="${t2}"]`); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !window.__replay.RP.open), 'with the panel closed, corner clicks only change the corner view');
  ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL CORNER-JUMP CHECKS PASSED');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
