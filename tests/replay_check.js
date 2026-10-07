// Replay QA: video ↔ telemetry sync, playback, click-to-seek, .rpy handling, IBT prompt.
// node tests/replay_check.js <tsv-dashboard.html> <test_replay.webm> <video0SessionTime> [ibt-dashboard.html] [any.rpy]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [, , page_, video, v0s, ibtPage, rpy] = process.argv;
const V0 = +v0s; // session time at video 0:00 (known only to the test)
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async () => {
    const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    return p;
  };
  const p = await mk();
  await p.goto('file://' + path.resolve(page_)); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  ok(!(await p.isVisible('#modal.on')), 'TSV load does not show the replay prompt');

  // open the panel and load the video through the Add video button
  await p.click('#btn-replay');
  ok(await p.isVisible('#dock'), 'Replay button opens the docked panel');
  const fc = p.waitForEvent('filechooser'); await p.click('#rv-addvideo'); await (await fc).setFiles(video);
  await p.waitForFunction(() => { const v = document.getElementById('rv-video'); return v.readyState >= 1 && v.duration > 0; }, null, { timeout: 20000 });
  ok(await p.evaluate(() => document.getElementById('rv-syncpill').textContent === 'not synced'), 'status shows "not synced" before a sync point');

  // set sync: video frame at 4.0 s is the start of lap 3
  const lap3 = await p.evaluate(() => window.__analysis.laps.find(l => l.lapNo === 3).index);
  await p.evaluate(() => { const v = document.getElementById('rv-video'); v.pause(); v.currentTime = 4.0; });
  await p.waitForTimeout(400);
  await p.selectOption('#rv-synclap', String(lap3));
  await p.click('#rv-setsync'); await p.waitForTimeout(200);
  const lapStart = await p.evaluate(i => window.__analysis.laps[i].tStart, lap3);
  console.log(`  lap 3 tStart (dashboard) ${lapStart.toFixed(3)} s; video 0 truth ${V0.toFixed(3)} s → expected lap start at video ${(lapStart - V0).toFixed(3)} s`);
  ok(Math.abs((lapStart - V0) - 4.0) < 0.06, `dashboard lap-3 start matches the video's true lap start within 60 ms (|Δ| = ${Math.abs(lapStart - V0 - 4).toFixed(3)} s)`);

  // seek video to 50 s → telemetry clock must equal the burned-in session time
  for (const vt of [10, 50, 95]) {
    await p.evaluate(t => { document.getElementById('rv-video').currentTime = t; }, vt); await p.waitForTimeout(400);
    const st = await p.evaluate(() => ({ T: window.__replay.RP.T, vt: document.getElementById('rv-video').currentTime }));
    const truth = V0 + st.vt;
    ok(Math.abs(st.T - truth) < 0.08, `video ${st.vt.toFixed(2)} s → telemetry t ${st.T.toFixed(2)} s (truth ${truth.toFixed(2)} s, |Δ| ${Math.abs(st.T - truth).toFixed(3)} s)`);
  }
  // live readout speed = raw sample at that time
  const live = await p.evaluate(() => {
    const R = window.__analysis, st = window.__replay.rpState(window.__replay.RP.T), C = R._base.I.table;
    return { shown: +document.getElementById('rl-speed').textContent, raw: C.speed[st.i] * 3.6, lap: document.getElementById('rl-lap').textContent, lapLabel: st.lap && st.lap.label };
  });
  ok(Math.abs(live.shown - live.raw) <= 0.6 && live.lap.startsWith(live.lapLabel), `live readout: ${live.lap}, ${live.shown} km/h (raw ${live.raw.toFixed(1)})`);
  await p.locator('#dock').screenshot({ path: '/tmp/claude-0/shots/dock.png' });

  // playback: play 2 s, telemetry follows; follow-lap selects the playing lap
  await p.evaluate(() => { document.getElementById('rv-video').currentTime = 2.0; }); await p.waitForTimeout(300);
  const tA = await p.evaluate(() => window.__replay.RP.T);
  await p.click('#rv-play'); await p.waitForTimeout(2500); await p.click('#rv-play');
  const after = await p.evaluate(() => ({ T: window.__replay.RP.T, sel: document.getElementById('tm-lap').value, vt: document.getElementById('rv-video').currentTime }));
  ok(after.T - tA > 1.5 && Math.abs(after.T - (V0 + after.vt)) < 0.08, `playback advanced telemetry by ${(after.T - tA).toFixed(2)} s and stayed in sync`);
  ok(after.sel === String(lap3), 'follow-lap selected the lap being played (L3)');
  const cur = await p.evaluate(() => { const c = document.querySelector('#ch-telemetry > .tm-cursor'); return c && c.style.display === 'block'; });
  ok(cur, 'telemetry chart shows the replay cursor');

  // click-to-seek from the telemetry chart
  const seek = await p.evaluate(() => {
    const R = window.__analysis, l = R.laps[+document.getElementById('tm-lap').value];
    window.__replay.replaySeekToDistance(2000);
    const k = Math.round(2000 / R.G.ds);
    return { want: l.tStart + l.grid.time[k], got: window.__replay.RP.T };
  });
  await p.waitForTimeout(400);
  const vtNow = await p.evaluate(() => document.getElementById('rv-video').currentTime);
  ok(Math.abs(seek.got - seek.want) < 0.02 && Math.abs(V0 + vtNow - seek.want) < 0.08, `chart click at 2000 m seeks video to ${vtNow.toFixed(2)} s (session ${seek.want.toFixed(2)} s)`);

  // second sync point (start of lap 4) → drift-corrected, rate ≈ 1
  const lap4 = await p.evaluate(() => window.__analysis.laps.find(l => l.lapNo === 4).index);
  const l4s = await p.evaluate(i => window.__analysis.laps[i].tStart, lap4);
  await p.evaluate(t => { document.getElementById('rv-video').currentTime = t; }, l4s - V0); await p.waitForTimeout(300);
  await p.selectOption('#rv-synclap', String(lap4)); await p.click('#rv-setsync'); await p.waitForTimeout(200);
  const two = await p.evaluate(() => ({ n: window.__replay.RP.sync.length, pill: document.getElementById('rv-syncpill').textContent, m: window.__replay.v2s(60) }));
  ok(two.n === 2 && /drift/.test(two.pill) && Math.abs(two.m - (V0 + 60)) < 0.08, `two-point sync: ${two.pill}, video 60 s → ${two.m.toFixed(2)} s (truth ${(V0 + 60).toFixed(2)})`);

  // nudge shifts mapping; persistence of sync after reload
  await p.click('[data-nudge="0.1"]'); const nud = await p.evaluate(() => window.__replay.v2s(60));
  ok(Math.abs(nud - two.m - 0.1) < 1e-6, 'nudge +0.1 s shifts the mapping by exactly 0.1 s');
  await p.click('[data-nudge="-0.1"]');

  // .rpy file → explanation, not an error
  if (rpy) {
    const fc2 = p.waitForEvent('filechooser'); await p.click('#rv-addvideo'); await (await fc2).setFiles(rpy);
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.getElementById('modal').classList.contains('on') && /can't play in a browser/.test(document.getElementById('modal-body').textContent)), '.rpy file shows how to export a video instead of failing');
    await p.click('#modal-close');
  }
  // telemetry-only playback
  await p.click('#rv-close');
  await p.reload(); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.click('#btn-replay'); await p.waitForTimeout(200);
  const t0 = await p.evaluate(() => window.__replay.RP.T);
  await p.click('#rv-play'); await p.waitForTimeout(1500); await p.click('#rv-play');
  const t1 = await p.evaluate(() => window.__replay.RP.T);
  ok(t1 - t0 > 1.0 && t1 - t0 < 2.2, `telemetry-only playback advances in real time (${(t1 - t0).toFixed(2)} s in 1.5 s)`);
  ok(await p.evaluate(() => document.getElementById('rv-syncpill').textContent === 'telemetry only'), 'status shows "telemetry only" without a video');
  await p.locator('#dock').screenshot({ path: '/tmp/claude-0/shots/dock_tel.png' });
  const ovf = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(ovf <= 0, 'no horizontal overflow with the panel open');
  await p.screenshot({ path: '/tmp/claude-0/shots/dock_full.png' });

  // IBT load asks for a replay video
  if (ibtPage) {
    const q = await mk();
    await q.goto('file://' + path.resolve(ibtPage)); await q.waitForFunction(() => window.__dashboardReady, null, { timeout: 120000 });
    await q.waitForTimeout(300);
    ok(await q.evaluate(() => document.getElementById('modal').classList.contains('on') && /Add a replay video\?/.test(document.getElementById('modal-body').textContent)), 'loading an .ibt asks whether to add a replay video');
    await q.screenshot({ path: '/tmp/claude-0/shots/ibt_prompt.png' });
    const fc3 = q.waitForEvent('filechooser'); await q.click('#rp-pick'); await (await fc3).setFiles(video);
    await q.waitForFunction(() => { const v = document.getElementById('rv-video'); return v.readyState >= 1; }, null, { timeout: 20000 });
    ok(await q.isVisible('#dock') && await q.evaluate(() => !!window.__replay.RP.video), '"Choose replay video…" opens the panel with the chosen video');
  }
  ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL REPLAY CHECKS PASSED');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
