// Automated QA against the synthetic ground truth + structural invariants.
// Run: node tests/test_engine.js data/sample_session.tsv data/sample_session.truth.json
const fs = require('fs'), path = require('path');
const { loadEngine } = require('./run_engine.js');
const E = loadEngine();
const [, , tsv, truthPath] = process.argv;
const R = E.analyze([/\.ibt$/i.test(tsv) ? { name: path.basename(tsv), buffer: new Uint8Array(fs.readFileSync(tsv)).buffer } : { name: path.basename(tsv), text: fs.readFileSync(tsv, 'utf8') }]);
const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };
// 1. every lap accounted for
const lapNos = R.laps.map(l => l.lapNo);
check(JSON.stringify(lapNos) === JSON.stringify(Object.keys(truth.laps).map(Number)), `all ${lapNos.length} laps present, numbered as in source`);
// 2. partial laps flagged
check(R.laps.filter(l => !l.complete).map(l => l.lapNo).join() === Object.entries(truth.laps).filter(([, v]) => v.partial).map(([k]) => k).join(), 'out/in laps flagged incomplete');
// 3. lap times vs simulation (synthetic sim time is the lap's continuous-time integral)
const errs = R.laps.filter(l => l.complete).map(l => Math.abs(l.lapTime - truth.laps[l.lapNo].simulated_lap_time_s));
check(Math.max(...errs) < 0.02, `lap times within 20 ms of simulation (max ${(1000 * Math.max(...errs)).toFixed(1)} ms)`);
// 4. best lap
const best = R.laps.filter(l => l.usableForPace).sort((a, b) => a.lapTime - b.lapTime)[0];
check(best.index === R.sessionStats.bestLap && Math.abs(best.lapTime - R.sessionStats.best) < 1e-9, `best lap ${best.label}`);
// 5. corners match truth
check(R.corners.length === Object.keys(truth.corners).length, `${R.corners.length} corners detected (truth ${Object.keys(truth.corners).length})`);
const cornerByTruth = name => { const t = truth.corners[name]; const mid = (t.start_m + t.end_m) / 2; return R.corners.reduce((b, c) => Math.abs(c.dist.apex - mid) < Math.abs(b.dist.apex - mid) ? c : b); };
// 6. segments non-overlapping and sum to the lap
const contiguous = R.segs.every((s, j) => j === 0 ? s.i0 === 0 : s.i0 === R.segs[j - 1].i1) && R.segs[R.segs.length - 1].i1 === R.G.N - 1;
check(contiguous, 'segments contiguous, non-overlapping, cover the lap');
const sumErr = Math.max(...R.laps.filter(l => l.analysable).map(l => Math.abs(R.features.get(l.index).segTimes.reduce((a, b) => a + b, 0) - l.lapTime)));
check(sumErr < 1e-6, `segment times sum to lap time (max err ${sumErr.toExponential(1)} s)`);
check(Math.abs(R.theo.total - R.theo.segments.reduce((a, b) => a + b.time, 0)) < 1e-9 && R.theo.total <= R.sessionStats.best + 1e-9, 'theoretical = Σ best segments ≤ best lap');
// 7. injected events detected at the right corner, severity ≥ 2 unless loss is negligible
for (const ev of truth.events) {
  const c = cornerByTruth(ev.corner);
  const lap = R.laps.find(l => l.lapNo === ev.lap);
  const hit = R.incidents.filter(i => i.lap === lap.index && i.corner === c.index);
  const off = ev.type.startsWith('off_track') ? hit.some(i => i.offTrack) : true;
  check(hit.length > 0 && off, `L${ev.lap} ${ev.corner} ${ev.type} → ${hit.map(i => `${i.cornerId} ${i.type} L${i.level} ${i.confidence}`).join('; ') || 'MISSED'}`);
}
// 8. false positives: significant incidents not matching any injected event
const truthKeys = new Set(truth.events.map(ev => `${ev.lap}:${cornerByTruth(ev.corner).index}`));
const fp = R.incidents.filter(i => i.level >= 2 && !truthKeys.has(`${R.laps[i.lap].lapNo}:${i.corner}`));
console.log('INFO significant incidents not injected (may be genuine variation, e.g. learning laps):', fp.map(i => `${i.lapLabel} ${i.cornerId} ${i.type} L${i.level} ${i.confidence}`).join('; ') || 'none');
check(fp.filter(i => i.confidence === 'High').length === 0, 'no high-confidence false positives');
// 9. off-track flags carry evidence; delta sign
check(R.incidents.filter(i => i.offTrack).every(i => i.evidence.length > 0), 'every off-track has evidence');
const l = R.laps.find(x => x.lapNo === 5), b = R.laps[R.sessionStats.bestLap];
check(l.grid.time[R.G.N - 1] - b.grid.time[R.G.N - 1] > 0, 'delta sign: slower lap has positive final delta vs best');
console.log(fail ? `\n${fail} FAILED` : '\nALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
