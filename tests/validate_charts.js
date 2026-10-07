// Chart validation: every chart must render with data, and plotted values must match
// the computed analysis. Runs before and after excluding laps, and after restoring.
// node tests/validate_charts.js dist/sample_dashboard.html
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const file = process.argv[2];
const plotly = process.argv[3] || require('path').join(__dirname, '..', 'vendor', 'plotly-strict-2.35.2.min.js');
let failures = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) failures++; };

async function validate(p, label) {
  console.log(`\n== ${label}`);
  const r = await p.evaluate(() => {
    const R = window.__analysis, out = {}, near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
    const g = id => document.getElementById(id);
    const charts = ['ch-progress', 'ch-budget', 'ch-dist', 'ch-mtrend', 'ch-ctrend', 'ch-lapseg', 'ch-corner-speed', 'ch-matrix', 'ch-corner-laps', 'ch-corner-diff', 'ch-heat', 'ch-theo', 'ch-telemetry', 'ch-speedcmp', 'ch-map', 'ch-line-map', 'ch-line-offset'];
    out.render = charts.map(id => {
      const el = g(id);
      if (!el) { const selLap = R.laps[+g('tm-lap').value]; return id === 'ch-lapseg' && !selLap.analysable ? [id, true, 'hidden: selected lap is not analysable (by design)'] : [id, false, 'missing element']; }
      const pts = (el.data || []).reduce((s, t) => s + ((t.y && t.y.length) || (t.z && t.z.length) || (t.x && t.x.length) || 0), 0);
      const svg = el.querySelector('.main-svg'); const bb = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
      return [id, !!(el.data && el.data.length && pts > 0 && bb.width > 50 && bb.height > 50), `${(el.data || []).length} traces, ${pts} points, ${Math.round(bb.width)}×${Math.round(bb.height)} px`];
    });
    const SS = R.sessionStats, ana = R.laps.filter(l => l.analysable);
    // progress: lap-time markers
    const pr = g('ch-progress').data.find(t => t.customdata && Array.isArray(t.customdata[0]) && t.customdata[0].length === 5);
    const comp = R.laps.filter(l => l.complete);
    out.progress = pr && pr.y.length === comp.length && comp.every((l, i) => near(pr.y[i], l.lapTime) && pr.x[i] === l.label);
    out.progressExcludedGrey = comp.filter(l => l.excluded).every(l => pr.marker.color[comp.indexOf(l)].toLowerCase() === getComputedStyle(document.documentElement).getPropertyValue('--na').trim().toLowerCase());
    const cats = g('ch-progress').layout.xaxis.categoryarray; out.progressOrder = JSON.stringify(cats) === JSON.stringify(comp.map(l => l.label));
    // budget waterfall
    const B = SS.budget, w = g('ch-budget').data[0];
    out.budget = near(w.y[0], B.theoretical) && near(w.y[1], B.potential) && near(w.y[3], B.repeatability) && near(w.y[5], B.mistakes) && near(B.theoretical + B.potential, B.best, 1e-6);
    // distribution counts = usable laps
    out.dist = g('ch-dist').data.reduce((s, t) => s + t.x.length, 0) === R.laps.filter(l => l.usableForPace).length;
    // trends
    const mt = g('ch-mtrend').data[0], ct = g('ch-ctrend').data[0];
    out.trends = mt.y.length === ana.length && ana.every((l, i) => near(mt.y[i], l.mistakeScore) && near(ct.y[i], l.consistencyScore));
    // heatmap
    const hz = g('ch-heat').data[0];
    out.heat = hz.z.length === ana.length && ana.every((l, i) => R.segs.every((s, j) => near(hz.z[i][j], R.features.get(l.index).segTimes[j] - R.theo.segments[j].time)));
    // theoretical bars sum to potential
    const tb = g('ch-theo').data[0];
    out.theo = near(tb.y.reduce((a, b) => a + b, 0), R.theo.potential, 1e-6) && near(R.theo.segments.reduce((a, b) => a + b.time, 0), R.theo.total);
    out.theoNoExcluded = R.theo.segments.every(s => R.laps[s.lap].analysable);
    // matrix: one point per corner
    out.matrix = g('ch-matrix').data[0].x.length === R.corners.length;
    // corner laps: segment time per analysable lap at the selected corner
    const cl = g('ch-corner-laps').data[0], ci = R.corners.findIndex(c => document.querySelector('#corner-detail h3').textContent.startsWith(c.id + ' '));
    out.cornerLaps = ci >= 0 && cl.y.length === ana.length && ana.every((l, i) => near(cl.y[i], R.features.get(l.index).corners[ci].segTime));
    // lap detail segment bars
    const sel = R.laps[+document.getElementById('tm-lap').value];
    const ls = g('ch-lapseg');
    out.lapseg = !sel.analysable ? !ls : ls.data[0].y.every((v, j) => near(v, R.features.get(sel.index).segTimes[j] - R.theo.segments[j].time));
    // telemetry: selected-lap speed + delta end = lap time - reference end
    const tm = g('ch-telemetry').data;
    const sp = tm.find(t => t.name === sel.label && t.yaxis === 'y');
    out.telemetrySpeed = !!sp && sp.y.length === R.G.N && sp.y.every((v, k) => (Number.isNaN(v) && Number.isNaN(sel.grid.speed[k])) || near(v, sel.grid.speed[k], 1e-3));
    const dl = tm.find(t => t.name === sel.label && t.hovertemplate && t.hovertemplate.includes(' s<extra>'));
    const refSel = document.getElementById('tm-ref').value;
    const refT = refSel === 'theo' ? R.theo.trace.time : refSel === 'median' ? R.ref.time : refSel === 'best' ? R.laps[SS.bestLap].grid.time : R.laps[+refSel.slice(4)].grid.time;
    out.telemetryDelta = !sel.complete || (!!dl && near(dl.y[R.G.N - 1], sel.lapTime - refT[R.G.N - 1], 1e-6));
    out.deltaSign = !sel.complete || (sel.lapTime > refT[R.G.N - 1]) === (dl.y[R.G.N - 1] > 0);
    const sc = g('ch-speedcmp').data.find(t => t.name === 'Δ time');
    out.speedcmpDelta = !sel.complete || (!!sc && near(sc.y[R.G.N - 1], sel.lapTime - refT[R.G.N - 1], 1e-6));
    // map: coloured lap has one point per grid sample
    const mp = g('ch-map').data.find(t => t.marker && Array.isArray(t.marker.color) && t.x.length === R.G.N);
    out.map = !!mp && mp.marker.color.filter(v => v !== null && Number.isFinite(v)).length > R.G.N * 0.9;
    // racing line: offset trace of the best-at-corner lap = signed offset × corner direction; 7 measures in table
    {
      const cs = R.cornerStats.list[ci], c = R.corners[ci], best = R.laps[cs.bestLap];
      const lo = g('ch-line-offset').data.find(t => t.name === best.label);
      const k0 = Math.round(lo.x[0] / R.G.ds);
      out.lineOffset = !!lo && lo.y.every((v, i) => Math.abs(v - best.off[k0 + i] * (c.sign || 1)) < 1e-4);
      out.lineTable = document.querySelectorAll('#line-table tbody tr').length === 7 && !!document.getElementById('line-finding').textContent;
    }
    // KPIs
    const kv = Array.from(document.querySelectorAll('.kpi .v')).map(e => e.textContent);
    const fl = t => { const m = Math.floor(t / 60); return `${m}:${(t - 60 * m).toFixed(3).padStart(6, '0')}`; };
    out.kpi = kv[0] === fl(SS.best) && kv[1] === fl(SS.medianClean) && kv[2] === fl(R.theo.total);
    // lap table: one row per lap, checkbox state = not excluded
    const rows = document.querySelectorAll('#tbl-laps tbody tr');
    out.table = rows.length === R.laps.length && R.laps.filter(l => l.complete && !l.dqSevere).every(l => { const cb = document.querySelector(`#tbl-laps input.excl[data-key="${l.key}"]`); return cb && cb.checked === !l.excluded; });
    out.state = { best: SS.best, bestLap: R.laps[SS.bestLap].label, theo: R.theo.total, analysable: ana.length, excluded: R.excluded.slice() };
    return out;
  });
  r.render.forEach(([id, good, info]) => ok(good, `${id} rendered (${info})`));
  for (const k of ['progress', 'progressOrder', 'progressExcludedGrey', 'budget', 'dist', 'trends', 'heat', 'theo', 'theoNoExcluded', 'matrix', 'cornerLaps', 'lapseg', 'telemetrySpeed', 'telemetryDelta', 'deltaSign', 'speedcmpDelta', 'map', 'lineOffset', 'lineTable', 'kpi', 'table'])
    ok(r[k], `${k} values match the analysis`);
  console.log('  state:', JSON.stringify(r.state));
  return r.state;
}

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('**/plotly*.js', r => r.fulfill({ body: fs.readFileSync(plotly), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve(file)); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  const s0 = await validate(p, 'Initial load');

  // interactions: linked hover → map cursor, chart clicks → selection
  console.log('\n== Interactions');
  await p.evaluate(() => document.getElementById('telemetry').scrollIntoView()); await p.waitForTimeout(400);
  const box = await p.locator('#ch-telemetry .nsewdrag').first().boundingBox();
  await p.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5); await p.waitForTimeout(150);
  await p.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5); await p.waitForTimeout(250);
  const hov = await p.evaluate(() => { const m = document.getElementById('ch-map'); const c = m.data[m._cursorTrace]; return c.x.length === 1; });
  ok(hov, 'telemetry hover moves the track-map cursor');
  const clicks = await p.evaluate(async () => {
    const R = window.__analysis, res = {};
    const heat = document.getElementById('ch-heat'); const ana = R.laps.filter(l => l.analysable);
    heat.emit('plotly_click', { points: [{ customdata: [ana[2].index, 4] }] }); await new Promise(r => setTimeout(r, 300));
    res.heat = document.getElementById('tm-lap').value === String(ana[2].index) && document.querySelector('#corner-detail h3').textContent.startsWith(R.corners[4].id + ' ');
    const pr = document.getElementById('ch-progress'); const t = pr.data.find(t => t.customdata && Array.isArray(t.customdata[0]) && t.customdata[0].length === 5);
    pr.emit('plotly_click', { points: [{ customdata: t.customdata[5] }], event: {} }); await new Promise(r => setTimeout(r, 300));
    res.progress = document.getElementById('tm-lap').value === String(t.customdata[5][0]);
    const mx = document.getElementById('ch-matrix'); mx.emit('plotly_click', { points: [{ customdata: [2] }] }); await new Promise(r => setTimeout(r, 300));
    const xr = document.getElementById('ch-telemetry').layout.xaxis.range;
    res.matrix = document.querySelector('#corner-detail h3').textContent.startsWith(R.corners[2].id + ' ') && xr[0] <= R.corners[2].dist.apex && xr[1] >= R.corners[2].dist.apex;
    return res;
  });
  ok(clicks.heat, 'heatmap cell click selects lap + corner'); ok(clicks.progress, 'lap-progression click selects lap'); ok(clicks.matrix, 'matrix click selects corner and zooms telemetry');
  await validate(p, 'After interactions');

  // exclude the best lap via its checkbox, and another lap via the lap-detail button
  console.log('\n== Exclude best lap (checkbox) + one more lap (button)');
  const bestKey = await p.evaluate(() => { const R = window.__analysis; return R.laps[R.sessionStats.bestLap].key; });
  await p.click(`#tbl-laps input.excl[data-key="${bestKey}"]`);
  await p.waitForFunction(k => window.__analysis.excluded.includes(k), bestKey); await p.waitForTimeout(500);
  const otherIdx = await p.evaluate(() => window.__analysis.laps.find(l => l.analysable && l.offTracks).index);
  await p.selectOption('#tm-lap', String(otherIdx)); await p.waitForTimeout(300);
  await p.click('#btn-excl-lap'); await p.waitForFunction(() => window.__analysis.excluded.length === 2); await p.waitForTimeout(500);
  const s1 = await validate(p, 'After excluding 2 laps');
  ok(s1.analysable === s0.analysable - 2, `analysable laps ${s0.analysable} → ${s1.analysable}`);
  ok(s1.bestLap !== s0.bestLap && s1.best > s0.best, `best lap changed ${s0.bestLap} ${s0.best.toFixed(3)} → ${s1.bestLap} ${s1.best.toFixed(3)}`);
  ok(await p.evaluate(() => document.querySelectorAll('#lap-strip .cell.excl').length === 2 && document.querySelectorAll('#lap-excl [data-restore]').length === 2), 'lap strip and exclusion bar show both excluded laps');
  await p.screenshot({ path: '/tmp/claude-0/shots/excluded.png', fullPage: false, clip: { x: 0, y: 0, width: 1600, height: 1000 } });
  await p.evaluate(() => document.getElementById('laps').scrollIntoView()); await p.waitForTimeout(300);
  await p.locator('#laps').screenshot({ path: '/tmp/claude-0/shots/laps-excluded.png' });

  // persistence across reload
  console.log('\n== Reload keeps exclusions');
  await p.reload(); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 }); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__analysis.excluded.length === 2), 'exclusions restored after reload');

  // guard: cannot go below 3 laps
  console.log('\n== Minimum-laps guard');
  const guard = await p.evaluate(async () => {
    const boxes = Array.from(document.querySelectorAll('#tbl-laps input.excl:checked'));
    for (let i = 0; i < boxes.length; i++) {
      const cb = document.querySelector('#tbl-laps input.excl:checked'); if (!cb) break;
      cb.click(); await new Promise(r => setTimeout(r, 250));
    }
    const R = window.__analysis; return { left: R.laps.filter(l => l.analysable).length, toast: document.getElementById('toast').textContent };
  });
  ok(guard.left === 3 && /At least 3/.test(guard.toast), `stops at 3 analysable laps (left ${guard.left}; "${guard.toast}")`);
  await validate(p, 'With only 3 laps left');

  console.log('\n== Restore all');
  await p.click('#btn-restore-all'); await p.waitForFunction(() => window.__analysis.excluded.length === 0); await p.waitForTimeout(500);
  const s2 = await validate(p, 'After restore');
  ok(Math.abs(s2.best - s0.best) < 1e-9 && Math.abs(s2.theo - s0.theo) < 1e-9 && s2.analysable === s0.analysable, 'restoring returns exactly the original results');

  ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(failures ? `\n${failures} FAILED` : '\nALL CHART CHECKS PASSED');
  await b.close(); process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
