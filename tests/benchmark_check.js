// Benchmark QA. Engine checks (node) + browser flow.
// node tests/benchmark_check.js <dashboard.html> <main.tsv> <reference.tsv> <main.ibt> <reference.ibt> <other-track.tsv> <too-short.tsv>
const fs = require('fs'), path = require('path');
const { loadEngine } = require('./run_engine.js');
const [, , page_, mainTsv, refTsv, mainIbt, refIbt, otherTrack, tooShort] = process.argv;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t;
const E = loadEngine();
const rd = p => /\.ibt$/i.test(p) ? [{ name: path.basename(p), buffer: new Uint8Array(fs.readFileSync(p)).buffer }] : [{ name: path.basename(p), text: fs.readFileSync(p, 'utf8') }];

console.log('== engine');
const M = E.analyze(rd(mainTsv));
// 1. self-reference = 100 everywhere
const S = E.benchmark.compare(M, E.benchmark.analyzeReference(M, rd(mainTsv)));
ok(near(S.pace.score, 100) && near(S.cons.score, 100) && near(S.overall, 100), `self-reference: pace ${S.pace.score}, consistency ${S.cons.score}, overall ${S.overall}`);
ok(S.corners.every(c => near(c.median.gap, 0) && near(c.median.score, 100) && Object.values(c.cons).every(x => near(x.score, 100))), 'self-reference: every corner Δ = 0, pace 100, consistency 100');
// 2. pro reference: formulas
const RM = E.benchmark.analyzeReference(M, rd(refTsv)), B = E.benchmark.compare(M, RM);
const ps = (y, r) => Math.max(0, Math.min(150, 100 - 1000 * (y - r) / r));
ok(near(B.pace.best.score, ps(M.sessionStats.best, RM.sessionStats.best)) && near(B.pace.race.score, ps(M.sessionStats.medianClean, RM.sessionStats.medianClean)), `pace score = 100 − 1000·gap/ref (best ${B.pace.best.score.toFixed(2)}, race ${B.pace.race.score.toFixed(2)})`);
const spread = SS => 0.5 * 1.4826 * SS.lapTimeStats.mad + 0.5 * SS.lapTimeStats.std;
ok(near(B.cons.lapTime.score, Math.min(150, 100 * spread(RM.sessionStats) / spread(M.sessionStats))), `lap-time consistency = 100·ref spread/your spread (${B.cons.lapTime.score.toFixed(1)})`);
ok(B.corners.every((c, i) => near(c.median.gap, M.cornerStats.list[i].median - RM.cornerStats.list[i].median)), 'corner Δ median = your median − reference median, for every corner');
ok(B.corners.every(c => c.median.gap > 0) && B.pace.best.gap > 0, 'the faster "pro" reference is ahead at every corner');
ok(RM.corners === M.corners && RM.segs === M.segs && RM.G.N === M.G.N && near(RM.G.L, M.G.L), 'reference analysed on the main session\'s corners, segments and grid');
// 3. refusals
try { E.benchmark.analyzeReference(M, rd(otherTrack)); ok(false, 'different track refused'); } catch (e) { ok(/different track/.test(e.message), `different track refused: "${e.message}"`); }
try { E.benchmark.analyzeReference(M, rd(tooShort)); ok(false, 'too-short reference refused'); } catch (e) { ok(/at least 3/.test(e.message), `too-short reference refused: "${e.message}"`); }
// 4. GPS (.ibt) frames share an origin → racing-line comparison valid
const MI = E.analyze(rd(mainIbt)), BI = E.benchmark.compare(MI, E.benchmark.analyzeReference(MI, rd(refIbt)));
const dl = BI.corners.map(c => Math.abs(c.dLineApex)).filter(Number.isFinite);
ok(BI.sameFrame && dl.length === BI.corners.length && Math.max(...dl) < 1.5, `.ibt GPS: shared projection origin, apex-line differences ≤ ${Math.max(...dl).toFixed(2)} m`);
ok(BI.pace.best.gap > 0 && BI.pace.score < 100, `.ibt benchmark pace ${BI.pace.score.toFixed(1)}, consistency ${BI.cons.score.toFixed(1)}`);

(async () => {
  console.log('== browser');
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve(page_)); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  ok(await p.evaluate(() => document.getElementById('benchmark').hidden && document.getElementById('nav-bench').hidden), 'no reference: Benchmark section hidden');
  await p.setInputFiles('#ref-input', refTsv); await p.waitForFunction(() => window.__bench, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const B = window.__bench.cmp, R = window.__analysis, near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
    const tiles = Array.from(document.querySelectorAll('#bench-tiles .btile .v')).map(e => parseFloat(e.textContent));
    const ch = document.getElementById('ch-bench-corners').data;
    const tm = document.getElementById('ch-telemetry').data, sel = R.laps[+document.getElementById('tm-lap').value];
    const dl = tm.find(t => t.name === sel.label && t.hovertemplate && t.hovertemplate.includes(' s<extra>'));
    const sc = document.getElementById('ch-speedcmp').data.some(t => /^Benchmark/.test(t.name || ''));
    return {
      visible: !document.getElementById('benchmark').hidden, tiles, want: [B.overall, B.pace.score, B.cons.score, B.pace.best.score, B.pace.race.score].map(v => Math.round(v)),
      chart: ch[0].y.every((v, i) => near(v, B.corners[i].median.gap)) && ch[1].y.every((v, i) => near(v, B.corners[i].best.gap)),
      rows: document.querySelectorAll('#tbl-bench tbody tr').length === B.corners.length,
      ref: document.getElementById('tm-ref').value, delta: dl && near(dl.y[R.G.N - 1], sel.lapTime - B.traces.best.time[R.G.N - 1]), speed: sc,
      kpi: /vs benchmark/.test(document.querySelector('.kpi .s').textContent), insights: document.querySelectorAll('#insight-list .insight').length > R.insights.length,
      coach: /vs benchmark/.test(document.getElementById('coach-list').textContent),
    };
  });
  ok(r.visible && JSON.stringify(r.tiles) === JSON.stringify(r.want), `tiles show the engine scores ${JSON.stringify(r.tiles)}`);
  ok(r.chart && r.rows, 'corner chart and table match the per-corner gaps');
  ok(r.ref === 'bench-best' && r.delta, 'telemetry reference switches to the benchmark best lap; Δ time ends at lap time − benchmark lap time');
  ok(r.speed && r.kpi && r.insights && r.coach, 'benchmark appears in the speed trace, KPIs, insights and coaching');
  // consistency heatmap vs benchmark
  await p.evaluate(() => document.querySelector('#cons-mode [data-cm="bench"]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const z = document.getElementById('ch-cons-heat').data[0].z, B = window.__bench.cmp; return B.corners.every((c, j) => z[0][j] === null ? !Number.isFinite(c.consScore) : Math.abs(z[0][j] - c.consScore) < 1e-6); }), 'consistency heatmap "vs benchmark" shows reference-relative scores');
  // click a corner bar
  await p.evaluate(() => document.getElementById('ch-bench-corners').emit('plotly_click', { points: [{ customdata: 6 }] })); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('#corner-detail h3').textContent.startsWith(window.__analysis.corners[6].id + ' ') && /vs benchmark/.test(document.getElementById('corner-detail').textContent)), 'clicking a corner bar selects that corner (detail shows the benchmark gap)');
  // lap exclusion recomputes the comparison
  const before = await p.evaluate(() => window.__bench.cmp.pace.best.gap);
  const bestKey = await p.evaluate(() => window.__analysis.laps[window.__analysis.sessionStats.bestLap].key);
  await p.click(`#tbl-laps input.excl[data-key="${bestKey}"]`); await p.waitForFunction(k => window.__analysis.excluded.includes(k), bestKey); await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({ gap: window.__bench.cmp.pace.best.gap, best: window.__analysis.sessionStats.best, ref: window.__bench.cmp.pace.best.ref }));
  ok(after.gap > before && near(after.gap, after.best - after.ref, 1e-9), `excluding your best lap updates the benchmark (best-lap gap ${before.toFixed(3)} → ${after.gap.toFixed(3)} s)`);
  await p.click('#btn-restore-all'); await p.waitForTimeout(600);
  // remove reference
  await p.click('#bench-clear'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.getElementById('benchmark').hidden && !window.__bench && document.getElementById('tm-ref').value === 'theo'), 'Remove reference hides the section and restores the theoretical-best reference');
  // incompatible reference
  await p.setInputFiles('#ref-input', otherTrack); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => document.getElementById('modal').classList.contains('on') && /different track/.test(document.getElementById('modal-body').textContent) && !window.__bench), 'a reference from a different track is refused with an explanation');
  await p.click('#modal-close');
  ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0), 'no horizontal overflow');
  ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL BENCHMARK CHECKS PASSED');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
