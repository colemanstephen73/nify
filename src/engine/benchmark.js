/* ============================================================================
 * Benchmark: compare the main session with a reference session (the target).
 * The reference is analysed on the MAIN session's distance grid, corners,
 * segments, sectors and racing-line frame, so every comparison is like-for-like.
 *
 * Scores (reference = 100):
 *   pace         100 − 1000·(you − ref)/ref     → 1 point per 0.1% of time; >100 = faster than the reference
 *   consistency  100 · spread_ref / spread_you  → half the reference's repeatability = 50
 *   both clamped to [0, 150]
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const paceScore = (you, ref) => (Number.isFinite(you) && Number.isFinite(ref) && ref > 0) ? clamp(100 - 1000 * (you - ref) / ref, 0, 150) : NaN;
  const consScore = (you, ref) => {
    if (!Number.isFinite(you) || !Number.isFinite(ref)) return NaN;
    if (you <= 1e-9) return ref <= 1e-9 ? 100 : 150;
    return clamp(100 * ref / you, 0, 150);
  };
  const mean = a => { const f = a.filter(Number.isFinite); return f.length ? f.reduce((s, v) => s + v, 0) / f.length : NaN; };
  const wmean = parts => { const p = parts.filter(([w, v]) => Number.isFinite(v)); const W = p.reduce((s, [w]) => s + w, 0); return W ? p.reduce((s, [w, v]) => s + w * v, 0) / W : NaN; };

  /** Analyse reference files on the main session's track model. Throws on an incompatible session. */
  function analyzeReference(main, files) {
    const ref = NS.analyze(files, {
      prepare: { grid: { L: main.G.L, ds: main.G.ds }, gpsOrigin: main.I.gpsOrigin },
      trackModel: { corners: main.corners, segs: main.segs, sectors: main.sectors },
      lineRef: main.ref,
    });
    const n = ref.sessionStats ? ref.sessionStats.counts.usable : 0;
    if (!ref.sessionStats || !ref.theo || n < 3) throw new Error(`The reference has ${n} usable lap(s); at least 3 complete laps are needed for a benchmark.`);
    return ref;
  }

  const lapSpread = SS => 0.5 * (1.4826 * SS.lapTimeStats.mad) + 0.5 * SS.lapTimeStats.std;

  function compare(main, ref) {
    const D = main.sessionStats, R = ref.sessionStats;
    const warnings = [];
    const mt = main.trackMeta, rt = ref.trackMeta;
    if (mt && rt && mt.track && rt.track && mt.track !== rt.track) warnings.push(`Track names differ: "${mt.track}" vs reference "${rt.track}".`);
    if (mt && rt && mt.car && rt.car && mt.car !== rt.car) warnings.push(`Different cars: ${mt.car} vs reference ${rt.car} — pace differences include the car.`);
    const sameFrame = !!(main.avail.position && ref.avail.position && main.avail.position.split(' ')[0] === ref.avail.position.split(' ')[0]);
    if (main.avail.position && !sameFrame) warnings.push('Position channels differ (GPS vs X/Y), so racing-line comparisons with the reference are disabled.');
    const mk = (you, r, kind) => ({ you, ref: r, gap: you - r, gapPct: 100 * (you - r) / r, score: kind === 'pace' ? paceScore(you, r) : consScore(you, r) });

    // ---------------- pace
    const pace = { best: mk(D.best, R.best, 'pace'), race: mk(D.medianClean, R.medianClean, 'pace'), theoretical: mk(main.theo.total, ref.theo.total, 'pace') };
    pace.score = mean([pace.best.score, pace.race.score]);

    // ---------------- per corner
    const corners = main.corners.map((c, ci) => {
      const dc = main.cornerStats.list[ci], rc = ref.cornerStats.list[ci];
      const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b)) ? a - b : NaN;
      const o = {
        index: ci, id: c.id, dir: c.dir,
        median: mk(dc.median, rc.median, 'pace'), best: mk(dc.best, rc.best, 'pace'),
        dEntry: d(dc.typicalEntry, rc.typicalEntry), dMin: d(dc.typicalMin, rc.typicalMin), dExit: d(dc.typicalExit, rc.typicalExit),
        dBrake: d(dc.typicalBrake, rc.typicalBrake), dPickup: d(dc.typicalPickup, rc.typicalPickup),
        refBestLap: rc.bestLap,
      };
      if (sameFrame && dc.line && rc.line) {
        o.dLineApex = d(dc.line.metrics.lineApex.med, rc.line.metrics.lineApex.med);
        o.dLineExit = d(dc.line.metrics.lineExit.med, rc.line.metrics.lineExit.med);
        o.dPath = d(dc.line.metrics.pathDelta.med, rc.line.metrics.pathDelta.med);
        o.dRadius = d(dc.line.metrics.minRadius.med, rc.line.metrics.minRadius.med);
      }
      // consistency vs reference per element (line, entry, min, exit) and corner time
      const cons = {};
      for (const k of ['line', 'entry', 'min', 'exit']) {
        const a = dc.exec && dc.exec.parts[k], b = rc.exec && rc.exec.parts[k];
        if (!a || !b || (k === 'line' && !sameFrame)) continue;
        cons[k] = { you: a.unit === 'm' ? a.sd : a.sdRel, ref: b.unit === 'm' ? b.sd : b.sdRel, unit: a.unit, label: a.label, youAbs: a.sd, refAbs: b.sd };
        cons[k].score = consScore(cons[k].you, cons[k].ref);
      }
      o.cons = cons;
      o.consTime = consScore(dc.dispersion.segTime, rc.dispersion.segTime);
      o.consScore = mean(Object.values(cons).map(x => x.score));
      // biggest technical deficit vs the reference (normalised by measurement floors), for the "main difference" text
      const cand = [
        ['min', -o.dMin / 1.0, `${o.dMin > 0 ? '+' : '−'}${Math.abs(o.dMin).toFixed(1)} km/h minimum speed`],
        ['exit', -o.dExit / 1.5, `${o.dExit > 0 ? '+' : '−'}${Math.abs(o.dExit).toFixed(1)} km/h exit speed`],
        ['entry', -o.dEntry / 1.5, `${o.dEntry > 0 ? '+' : '−'}${Math.abs(o.dEntry).toFixed(1)} km/h turn-in speed`],
        ['brake', -o.dBrake / 3, `brakes ${Math.abs(o.dBrake).toFixed(0)} m ${o.dBrake < 0 ? 'earlier' : 'later'}`],
        ['pickup', o.dPickup / 4, `throttle ${Math.abs(o.dPickup).toFixed(0)} m ${o.dPickup > 0 ? 'later' : 'earlier'}`],
      ].filter(x => Number.isFinite(x[1]) && x[1] > 1);
      cand.sort((a, b) => b[1] - a[1]);
      o.causes = cand.slice(0, 3).map(x => ({ k: x[0], text: x[2] }));
      return o;
    });

    // ---------------- sectors (median sector time over analysable laps)
    const secMed = (M, sec) => St.median(M.laps.filter(l => l.analysable).map(l => l.grid.time[sec.i1] - l.grid.time[sec.i0]));
    const secBest = (M, sec) => St.min(M.laps.filter(l => l.analysable).map(l => l.grid.time[sec.i1] - l.grid.time[sec.i0]));
    const sectors = main.sectors.list.map(sec => ({ id: sec.id, median: mk(secMed(main, sec), secMed(ref, sec), 'pace'), best: mk(secBest(main, sec), secBest(ref, sec), 'pace') }));

    // ---------------- consistency vs reference
    const cons = {
      lapTime: mk(lapSpread(D), lapSpread(R), 'cons'),
      cornerTime: { you: St.median(main.cornerStats.list.map(c => c.dispersion.segTime)), ref: St.median(ref.cornerStats.list.map(c => c.dispersion.segTime)), score: mean(corners.map(c => c.consTime)) },
      lineSpeed: { score: mean(corners.map(c => c.consScore)) },
      mistakes: { you: D.budget.lostPerLap, ref: R.budget.lostPerLap, score: consScore(D.budget.lostPerLap + 0.05, R.budget.lostPerLap + 0.05) },
      repeat: { you: D.budget.repeatability, ref: R.budget.repeatability, score: consScore(D.budget.repeatability + 0.05, R.budget.repeatability + 0.05) },
    };
    const elems = {};
    for (const k of ['line', 'entry', 'min', 'exit']) {
      const v = corners.map(c => c.cons[k] && c.cons[k].score).filter(Number.isFinite);
      if (v.length) elems[k] = { label: corners.find(c => c.cons[k]).cons[k].label, score: mean(v) };
    }
    cons.elements = elems;
    cons.score = wmean([[0.35, cons.lapTime.score], [0.15, cons.cornerTime.score], [0.15, cons.lineSpeed.score], [0.25, cons.mistakes.score], [0.10, cons.repeat.score]]);
    const overall = mean([pace.score, cons.score]);

    // ---------------- insights & coaching
    const insights = [], coaching = [];
    const f3 = v => v.toFixed(3), fl = NS.insights.fmtLap;
    insights.push({ kind: 'diagnosis', title: `Benchmark — pace ${pace.score.toFixed(0)}, consistency ${cons.score.toFixed(0)} (reference = 100)`,
      text: `Best lap ${fl(D.best)} is ${f3(pace.best.gap)} s (${pace.best.gapPct.toFixed(2)}%) off the reference best ${fl(R.best)}; race pace (median clean lap) is ${f3(pace.race.gap)} s off (${fl(D.medianClean)} vs ${fl(R.medianClean)}). Lap-to-lap spread is ${(lapSpread(D)).toFixed(3)} s vs the reference's ${(lapSpread(R)).toFixed(3)} s, and mistakes cost ${D.budget.lostPerLap.toFixed(2)} s/lap vs ${R.budget.lostPerLap.toFixed(2)} s/lap.` });
    const byLoss = corners.filter(c => Number.isFinite(c.median.gap)).slice().sort((a, b) => b.median.gap - a.median.gap);
    const top = byLoss.filter(c => c.median.gap > 0.01).slice(0, 3);
    if (top.length) insights.push({ kind: 'weakness', corner: top[0].index, title: `Biggest losses to the benchmark — ${top.map(c => c.id).join(', ')}`,
      text: top.map(c => `${c.id} ${f3(c.median.gap)} s per lap (median)${c.causes.length ? ': ' + c.causes.map(x => x.text).join(', ') : ''}`).join('; ') + `. Together ${f3(top.reduce((s, c) => s + c.median.gap, 0))} s of the ${f3(pace.race.gap)} s race-pace gap.` });
    const bestC = byLoss[byLoss.length - 1];
    if (bestC) insights.push({ kind: 'strength', corner: bestC.index, title: `Closest to the benchmark — ${bestC.id}`,
      text: `${bestC.id} is ${bestC.median.gap <= 0 ? f3(-bestC.median.gap) + ' s faster than' : 'only ' + f3(bestC.median.gap) + ' s slower than'} the reference (median), pace score ${bestC.median.score.toFixed(0)}.` });
    const ek = Object.keys(elems).sort((a, b) => elems[a].score - elems[b].score)[0];
    if (ek) {
      const wc = corners.filter(c => c.cons[ek]).sort((a, b) => a.cons[ek].score - b.cons[ek].score)[0];
      insights.push({ kind: 'diagnosis', corner: wc.index, title: `Consistency vs benchmark — weakest: ${elems[ek].label.toLowerCase()}`,
        text: `${Object.values(elems).map(e => `${e.label} ${e.score.toFixed(0)}`).join(' · ')} (reference = 100). Worst at ${wc.id}: ${wc.cons[ek].unit === 'm' ? `±${wc.cons[ek].youAbs.toFixed(2)} m vs ±${wc.cons[ek].refAbs.toFixed(2)} m` : `±${wc.cons[ek].youAbs.toFixed(1)} km/h vs ±${wc.cons[ek].refAbs.toFixed(1)} km/h`} for the reference.` });
    }
    top.forEach(c => {
      const cause = c.causes[0];
      const obj = !cause ? `Study the reference lap through ${c.id} in the telemetry explorer (benchmark trace) — the loss is spread over the whole corner.`
        : cause.k === 'min' ? `Carry the reference minimum speed (${Math.abs(c.dMin).toFixed(1)} km/h more): release the brake earlier and more progressively.`
        : cause.k === 'exit' ? `Match the reference exit speed (${Math.abs(c.dExit).toFixed(1)} km/h more): earlier, fuller throttle and a straighter exit.`
        : cause.k === 'entry' ? `Match the reference turn-in speed (${Math.abs(c.dEntry).toFixed(1)} km/h more).`
        : cause.k === 'brake' ? `Brake ${Math.abs(c.dBrake).toFixed(0)} m later, at the reference braking point, once the current point is repeatable.`
        : `Pick up the throttle ${Math.abs(c.dPickup).toFixed(0)} m earlier, at the reference point.`;
      coaching.push({ corner: c.index, id: c.id, title: `${c.id} — close the gap to the benchmark`, problem: `${f3(c.median.gap)} s per lap slower than the reference (median), pace score ${c.median.score.toFixed(0)}.`,
        evidence: c.causes.length ? `Versus the reference: ${c.causes.map(x => x.text).join(', ')}.` : 'No single metric stands out.', impact: c.median.gap, objective: obj, priority: c.median.gap > 0.15 ? 'High' : 'Medium', bench: true });
    });

    return {
      name: ref.dqReport.files.map(f => f.name).join(', '), meta: ref.trackMeta, warnings, sameFrame,
      pace, cons, overall, corners, sectors, insights, coaching,
      laps: { you: D.counts.analysable, ref: R.counts.analysable },
      traces: { best: ref.laps[R.bestLap].grid, bestLabel: ref.laps[R.bestLap].label, bestTime: R.best, theo: ref.theo.trace, theoTime: ref.theo.total, median: ref.ref },
    };
  }

  NS.benchmark = { analyzeReference, compare, paceScore, consScore };
})(typeof window !== 'undefined' ? window : globalThis);
