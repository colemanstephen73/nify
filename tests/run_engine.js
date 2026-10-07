// Node harness: loads the engine modules in pipeline order and analyses TSV files.
const fs = require('fs');
const path = require('path');
const ORDER = ['stats', 'ibt', 'ingest', 'laps', 'track', 'features', 'mistakes', 'scoring', 'insights', 'analyze'];
function loadEngine() {
  delete globalThis.TelemetryEngine;
  for (const m of ORDER) require(path.join(__dirname, '..', 'src', 'engine', m + '.js'));
  return globalThis.TelemetryEngine;
}
module.exports = { loadEngine, ORDER };
if (require.main === module) {
  const E = loadEngine();
  const files = process.argv.slice(2).map(p => /\.ibt$/i.test(p) ? { name: path.basename(p), buffer: new Uint8Array(fs.readFileSync(p)).buffer } : { name: path.basename(p), text: fs.readFileSync(p, 'utf8') });
  const R = E.analyze(files);
  const fl = E.insights.fmtLap;
  console.log('elapsed', R.elapsedMs, 'ms');
  console.log('DQ', JSON.stringify({ rows: R.dqReport.rows, used: R.dqReport.usedRows, laps: R.dqReport.laps, complete: R.dqReport.completeLaps, hz: R.dqReport.sampling.hz.toFixed(1), L: R.G.L.toFixed(1) }));
  console.log('issues:\n  ' + R.dqReport.issues.join('\n  '));
  console.log('track notes:', R.dqReport.trackNotes.join(' | '));
  console.log('corners:', R.corners.map(c => `${c.id}${c.dir}@${c.dist.apex.toFixed(0)} b${Number.isFinite(c.dist.brake) ? c.dist.brake.toFixed(0) : '-'} [${c.dist.start.toFixed(0)}-${c.dist.end.toFixed(0)}]`).join('  '));
  console.log('segs:', R.segs.map(s => `${s.id}:${s.d0.toFixed(0)}-${s.d1.toFixed(0)}`).join(' '));
  for (const l of R.laps) {
    const inc = R.incidents.filter(i => i.lap === l.index).map(i => `${i.cornerId}:${i.type}[L${i.level},${i.confidence[0]},${i.loss.toFixed(2)}]`).join(' ');
    console.log(l.label.padEnd(5), (Number.isFinite(l.lapTime) ? fl(l.lapTime) : '   —   ').padEnd(9), l.status.padEnd(20), 'MS', Number.isFinite(l.mistakeScore) ? l.mistakeScore.toFixed(0).padStart(3) : '  -', 'CS', Number.isFinite(l.consistencyScore) ? l.consistencyScore.toFixed(0).padStart(3) : '  -', inc);
  }
  const S = R.sessionStats;
  console.log('best', fl(S.best), 'medClean', fl(S.medianClean), 'theo', fl(R.theo.total), 'pot', R.theo.potential.toFixed(3), 'sectorTheo', fl(R.theo.sectorTotal));
  console.log('consistency', JSON.stringify(Object.fromEntries(Object.entries(S.consistency).filter(([k]) => k !== 'weights').map(([k, v]) => [k, +v.toFixed(1)]))));
  console.log('rates', JSON.stringify(S.rates), 'budget', JSON.stringify(Object.fromEntries(Object.entries(S.budget).map(([k, v]) => [k, +v.toFixed(3)]))));
  for (const c of R.cornerStats.list) console.log(c.id.padEnd(4), 'best', c.best.toFixed(3), R.laps[c.bestLap].label, 'med', c.median.toFixed(3), 'rep', c.repeatGap.toFixed(3), 'cons', c.consistency.toFixed(0), 'util', Number.isFinite(c.util) ? c.util.toFixed(3) : '-', 'pg', Number.isFinite(c.paceGap) ? c.paceGap.toFixed(3) : '-', c.paceClass, c.consClass, c.priority, '| why:', c.why.map(w => w.text).join('; '));
  console.log('\nINSIGHTS'); R.insights.forEach(i => console.log('-', i.title, '::', i.text));
  console.log('\nCOACHING'); R.coaching.forEach(c => console.log('-', c.title, '|', c.problem, '|', c.evidence, '| impact', c.impact.toFixed(3), '|', c.objective));
}
