/* ============================================================================
 * Stages 7-10: Lap scoring, corner analysis, theoretical best,
 *              consistency, pace vs consistency diagnosis, session evolution.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  const LEVEL_POINTS = [0, 6, 18, 35, 55];
  const CONF_W = { High: 1, Medium: 0.75, Low: 0.4 };
  const STATUS_ORDER = ['Excluded', 'Incomplete', 'Data-quality issue', 'Invalid', 'Off-track', 'Major mistake', 'Significant mistake', 'Minor mistake', 'Valid'];

  // --------------------------------------------------------------------------
  // Lap scoring
  // --------------------------------------------------------------------------
  function scoreLaps(model) {
    const { laps, incidents, features, base, corners } = model;
    for (const lap of laps) {
      const inc = incidents.filter(i => i.lap === lap.index);
      lap.incidents = inc.map(i => i.id);
      const counted = inc.filter(i => i.confidence !== 'Low' || i.level >= 2);
      lap.mistakes = counted.filter(i => !i.offTrack).length;
      lap.majorMistakes = counted.filter(i => i.level >= 3 && !i.offTrack).length;
      lap.offTracks = inc.filter(i => i.offTrack).length;
      lap.maxLevel = inc.reduce((m, i) => Math.max(m, i.level), 0);
      lap.trackLimitViolation = inc.some(i => i.offHow === 'channel');
      // mistake score: event points (confidence weighted) + accumulated deviation, saturating 0-100
      let raw = 0;
      for (const i of inc) raw += (LEVEL_POINTS[i.level] + (i.offTrack ? 20 : 0) + 30 * Math.min(i.loss, 1.5)) * CONF_W[i.confidence];
      let dev = 0;
      if (lap.analysable) {
        const F = features.get(lap.index);
        corners.forEach((c, ci) => {
          let d = 0;
          for (const k of ['segTime', 'brakePoint', 'minSpeed', 'pickup', 'exitSpeed']) {
            const b = base[ci][k]; const v = F.corners[ci][k];
            if (b && Number.isFinite(v)) d += Math.max(0, Math.abs((v - b.med) / b.scale) - 2);
          }
          dev += Math.min(6, d);
        });
      }
      raw += dev;
      lap.mistakeScore = lap.analysable ? 100 * (1 - Math.exp(-raw / 60)) : NaN;
      lap.deviationPoints = dev;
      // per-lap consistency (closeness to the driver's own typical execution)
      if (lap.analysable) {
        const F = features.get(lap.index);
        const zs = [], ms = [];
        corners.forEach((c, ci) => {
          const b = base[ci];
          if (b.segTime) zs.push(Math.min(6, Math.abs(F.corners[ci].segTime - b.segTime.med) / b.segTime.scale));
          for (const k of ['brakePoint', 'minSpeed', 'pickup', 'exitSpeed']) {
            const v = F.corners[ci][k];
            if (b[k] && Number.isFinite(v)) ms.push(Math.min(6, Math.abs(v - b[k].med) / b[k].scale));
          }
        });
        const mz = 0.6 * St.mean(zs) + 0.4 * (ms.length ? St.mean(ms) : St.mean(zs));
        lap.consistencyScore = 100 * Math.exp(-Math.max(0, mz - 0.5) / 1.5);
        lap.meanAbsZ = mz;
      } else lap.consistencyScore = NaN;
      const sigLoss = inc.filter(i => i.level >= 2).reduce((s, i) => s + i.loss, 0);
      lap.timeLost = sigLoss;
      lap.estCleanTime = lap.complete ? lap.lapTime - sigLoss : NaN;
      const worst = inc.slice().sort((a, b) => b.loss - a.loss)[0];
      lap.largestEvent = worst ? worst.id : null;
      // status hierarchy: validity first, then execution
      let status;
      if (lap.excluded) status = 'Excluded';
      else if (!lap.complete) status = 'Incomplete';
      else if (lap.dqSevere) status = 'Data-quality issue';
      else if (lap.trackLimitViolation) status = 'Invalid';
      else if (lap.offTracks) status = 'Off-track';
      else if (lap.maxLevel >= 3) status = 'Major mistake';
      else if (lap.maxLevel === 2) status = 'Significant mistake';
      else if (lap.maxLevel === 1 && counted.length) status = 'Minor mistake';
      else status = 'Valid';
      lap.status = status;
      lap.execLevel = lap.offTracks ? 4 : lap.maxLevel;
      lap.validity = lap.excluded ? 'Excluded by you' : !lap.complete ? 'Incomplete' : lap.dqSevere ? 'Data issue' : lap.trackLimitViolation ? 'Invalid' : 'Valid';
      lap.usableForPace = lap.analysable && !lap.trackLimitViolation && !lap.offTracks;
      lap.clean = lap.usableForPace && lap.maxLevel <= 1;
      lap.color = { Valid: 'clean', 'Minor mistake': 'minor', 'Significant mistake': 'sig', 'Major mistake': 'major', 'Off-track': 'major', Invalid: 'major', 'Data-quality issue': 'na', Incomplete: 'na', Excluded: 'na' }[status];
    }
  }

  // --------------------------------------------------------------------------
  // Theoretical best (non-overlapping segments)
  // --------------------------------------------------------------------------
  function theoretical(model) {
    const { laps, segs, features, incidents, sectors, G } = model;
    const offAt = new Set(incidents.filter(i => i.offTrack).map(i => `${i.lap}:${i.corner}`));
    const elig = laps.filter(l => l.analysable && !l.trackLimitViolation);
    const best = segs.map(s => {
      let bt = Infinity, bl = null;
      for (const l of elig) {
        if (s.corner !== null && offAt.has(`${l.index}:${s.corner}`)) continue;
        const t = features.get(l.index).segTimes[s.index];
        if (t < bt) { bt = t; bl = l.index; }
      }
      return { seg: s.index, time: bt, lap: bl };
    });
    const total = best.reduce((a, b) => a + b.time, 0);
    const pace = laps.filter(l => l.usableForPace);
    const bestLap = pace.slice().sort((a, b) => a.lapTime - b.lapTime)[0] || null;
    const decomposition = bestLap ? segs.map((s, j) => ({ seg: j, id: s.id, bestLapTime: features.get(bestLap.index).segTimes[j], best: best[j].time, gain: features.get(bestLap.index).segTimes[j] - best[j].time, bestLapIdx: best[j].lap })) : [];
    // best sectors (direct sector timing, for comparison)
    const sectorBest = sectors.list.map(sec => {
      let bt = Infinity, bl = null;
      for (const l of elig) {
        if (segs.some(s => s.corner !== null && s.i0 >= sec.i0 && s.i1 <= sec.i1 && offAt.has(`${l.index}:${s.corner}`))) continue;
        const t = l.grid.time[sec.i1] - l.grid.time[sec.i0];
        if (t < bt) { bt = t; bl = l.index; }
      }
      return { id: sec.id, time: bt, lap: bl, bestLapTime: bestLap ? bestLap.grid.time[sec.i1] - bestLap.grid.time[sec.i0] : NaN };
    });
    const sectorTotal = sectorBest.reduce((a, b) => a + b.time, 0);
    // stitched theoretical trace
    const N = G.N; const trace = { time: new Float64Array(N) };
    const chans = Object.keys(laps.find(l => l.analysable)?.grid || {}).filter(k => !['time', 'rawIdx'].includes(k));
    chans.forEach(k => trace[k] = new Float32Array(N).fill(NaN));
    trace.srcLap = new Int32Array(N).fill(-1);
    let offset = 0;
    segs.forEach((s, j) => {
      const lap = laps[best[j].lap];
      if (!lap) return;
      const t0 = lap.grid.time[s.i0];
      for (let k = s.i0; k <= s.i1; k++) {
        trace.time[k] = offset + (lap.grid.time[k] - t0);
        chans.forEach(c => trace[c][k] = lap.grid[c][k]);
        trace.srcLap[k] = lap.index;
      }
      offset += best[j].time;
    });
    return { segments: best, total, bestLap: bestLap ? bestLap.index : null, potential: bestLap ? bestLap.lapTime - total : NaN, decomposition, sectorBest, sectorTotal, trace, distinctLaps: new Set(best.map(b => b.lap)).size };
  }

  // --------------------------------------------------------------------------
  // Corner analysis
  // --------------------------------------------------------------------------
  function corners(model) {
    const { laps, corners: CS, features, incidents, base, avail, G } = model;
    const ana = laps.filter(l => l.analysable);
    const incAt = (li, ci, minLevel) => incidents.some(i => i.lap === li && i.corner === ci && i.level >= minLevel);
    const offAt = (li, ci) => incidents.some(i => i.lap === li && i.corner === ci && i.offTrack);
    // grip envelope for pace benchmark
    const pts = [];
    ana.forEach(l => CS.forEach((c, ci) => { const f = features.get(l.index).corners[ci]; if (Number.isFinite(f.latPeak) && Number.isFinite(f.minSpeed) && !incAt(l.index, ci, 2)) pts.push([f.minSpeed, f.latPeak]); }));
    let env = null;
    if (pts.length > 10) {
      const bins = new Map();
      pts.forEach(([v, a]) => { const b = Math.floor(v / 25); if (!bins.has(b)) bins.set(b, []); bins.get(b).push(a); });
      const bx = [], by = [];
      for (const [b, a] of bins) if (a.length >= 3) { bx.push(b * 25 + 12.5); by.push(St.quantile(a, 0.9)); }
      const lr = bx.length >= 2 ? St.linreg(bx, by) : { slope: 0, intercept: St.quantile(pts.map(p => p[1]), 0.9) };
      const slope = Math.max(0, lr.slope);
      const intercept = bx.length >= 2 ? (lr.slope >= 0 ? lr.intercept : St.median(by)) : lr.intercept;
      env = { slope, intercept, at: v => intercept + slope * v, points: pts, source: 'p90 of peak lateral g per 25 km/h apex-speed band (session envelope)' };
    }
    const out = CS.map((c, ci) => {
      const rows = ana.map(l => ({ lap: l.index, f: features.get(l.index).corners[ci] }));
      const elig = rows.filter(r => !offAt(r.lap, ci) && !laps[r.lap].trackLimitViolation);
      const clean = rows.filter(r => !incAt(r.lap, ci, 2));
      const times = rows.map(r => r.f.segTime);
      const bestRow = elig.slice().sort((a, b) => a.f.segTime - b.f.segTime)[0];
      const worstClean = clean.slice().sort((a, b) => b.f.segTime - a.f.segTime)[0];
      const med = St.median(times);
      const pick = (arr, k, fn) => { const v = arr.map(r => r.f[k]).filter(Number.isFinite); return v.length ? fn(v) : NaN; };
      const bestAt = (k, fn) => { const r = clean.filter(r => Number.isFinite(r.f[k])).sort((a, b) => fn(a.f[k], b.f[k]))[0]; return r ? { v: r.f[k], lap: r.lap } : { v: NaN, lap: null }; };
      const sc = k => { const v = clean.map(r => r.f[k]).filter(Number.isFinite); return v.length >= 4 ? 1.4826 * St.mad(v) : NaN; };
      const disp = { segTime: sc('segTime'), brakePoint: sc('brakePoint'), minSpeed: sc('minSpeed'), pickup: sc('pickup'), exitSpeed: sc('exitSpeed') };
      const terms = [];
      if (Number.isFinite(disp.segTime)) terms.push([0.4, disp.segTime / Math.max(0.03, 0.004 * med)]);
      if (Number.isFinite(disp.brakePoint)) terms.push([0.15, disp.brakePoint / 6]);
      if (Number.isFinite(disp.minSpeed)) terms.push([0.15, disp.minSpeed / 2]);
      if (Number.isFinite(disp.pickup)) terms.push([0.15, disp.pickup / 8]);
      if (Number.isFinite(disp.exitSpeed)) terms.push([0.15, disp.exitSpeed / 2.5]);
      const D = terms.reduce((s, t) => s + t[0] * t[1], 0) / (terms.reduce((s, t) => s + t[0], 0) || 1);
      const consistency = 100 * Math.exp(-0.5 * D);
      const best = bestRow ? bestRow.f.segTime : NaN;
      // why was the best lap best? compare with medians (only claims above noise floors)
      const why = [];
      if (bestRow) {
        const f = bestRow.f, b = base[ci];
        const cmp = (k, unit, d, better, floor, label) => {
          if (!b[k] || !Number.isFinite(f[k])) return;
          const delta = f[k] - b[k].med;
          if (Math.abs(delta) < floor) return;
          why.push({ k, text: `${label} ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(d)} ${unit} vs session median`, good: better(delta), delta });
        };
        cmp('minSpeed', 'km/h', 1, d => d > 0, 1.0, 'Minimum speed');
        cmp('entrySpeed', 'km/h', 1, d => d > 0, 1.5, 'Turn-in speed');
        cmp('exitSpeed', 'km/h', 1, d => d > 0, 1.5, 'Exit speed');
        if (b.brakePoint && Number.isFinite(f.brakePoint)) {
          const delta = f.brakePoint - b.brakePoint.med;
          if (Math.abs(delta) >= 3) why.push({ k: 'brakePoint', text: `Braked ${Math.abs(delta).toFixed(0)} m ${delta > 0 ? 'later' : 'earlier'} than median`, good: delta > 0, delta });
        }
        if (b.pickup && Number.isFinite(f.pickup)) {
          const delta = f.pickup - b.pickup.med;
          const v = Math.max(5, (f.minSpeed || 60) / 3.6);
          if (Math.abs(delta) >= 4) why.push({ k: 'pickup', text: `Throttle opened ${Math.abs(delta).toFixed(0)} m (≈${(Math.abs(delta) / v).toFixed(2)} s) ${delta < 0 ? 'earlier' : 'later'}`, good: delta < 0, delta });
        }
        cmp('latPeak', 'g', 2, d => d > 0, 0.04, 'Peak lateral');
      }
      // pace benchmark: grip utilisation of the driver's best execution
      let util = NaN, paceGap = NaN, vAt = NaN;
      if (env) {
        const lp = clean.map(r => r.f.latPeak).filter(Number.isFinite);
        const ms = clean.map(r => r.f.minSpeed).filter(Number.isFinite);
        if (lp.length) {
          vAt = St.median(ms);
          util = St.quantile(lp, 0.9) / env.at(vAt);
          if (bestRow) {
            const lap = laps[bestRow.lap];
            const tArc = lap.grid.time[c.i1] - lap.grid.time[c.i0];
            paceGap = util < 1 ? tArc * (1 - Math.sqrt(util)) : 0;
          }
        }
      }
      const mist = incidents.filter(i => i.corner === ci);
      return {
        index: ci, id: c.id, dir: c.dir, dist: c.dist, n: rows.length,
        best, bestLap: bestRow ? bestRow.lap : null, median: med, mean: St.mean(times), std: St.std(times), iqr: St.iqr(times),
        q25: St.quantile(times, 0.25), q75: St.quantile(times, 0.75),
        worstClean: worstClean ? worstClean.f.segTime : NaN, worstCleanLap: worstClean ? worstClean.lap : null,
        bestEntry: bestAt('entrySpeed', (a, b) => b - a), bestMin: bestAt('minSpeed', (a, b) => b - a), bestExit: bestAt('exitSpeed', (a, b) => b - a),
        latestBrake: bestAt('brakePoint', (a, b) => b - a), typicalBrake: pick(clean, 'brakePoint', St.median),
        bestPickup: bestAt('pickup', (a, b) => a - b), typicalPickup: pick(clean, 'pickup', St.median),
        typicalMin: pick(clean, 'minSpeed', St.median), typicalExit: pick(clean, 'exitSpeed', St.median), typicalEntry: pick(clean, 'entrySpeed', St.median),
        avgLoss: St.mean(times) - best, repeatGap: med - best, dispersion: disp, consistency, why,
        util, paceGap, vApex: vAt,
        mistakes: mist.length, mistakesSig: mist.filter(i => i.level >= 2).length, mistakeLoss: mist.filter(i => i.level >= 2).reduce((s, i) => s + i.loss, 0),
        offTracks: mist.filter(i => i.offTrack).length,
      };
    });
    // classifications
    const utilMed = St.median(out.map(c => c.util));
    out.forEach(c => {
      // pace: absolute utilisation, or clearly below the driver's own typical utilisation
      c.paceClass = !Number.isFinite(c.util) ? 'n/a' : (c.util < 0.94 || c.util < utilMed - 0.04) ? 'Weak' : (c.util < 0.97 || c.util < utilMed - 0.02) ? 'Moderate' : 'Strong';
      // consistency: repeatability gap relative to segment duration + dispersion score
      const rel = c.repeatGap / c.median;
      c.repeatRel = rel;
      c.consClass = (rel >= 0.0125 || c.consistency < 40) ? 'Weak' : (rel >= 0.007 || c.consistency < 60) ? 'Moderate' : 'Strong';
      const pv = { Strong: 0, Moderate: 1, Weak: 2, 'n/a': 0 }[c.paceClass];
      const cv = { Strong: 0, Moderate: 1, Weak: 2 }[c.consClass];
      const p = pv + 1.5 * cv;
      c.priority = p === 0 ? 'Low' : p <= 2 ? 'Medium' : p <= 3 ? 'High' : 'Critical';
      if (c.offTracks >= 2 && c.priority !== 'Critical') c.priority = 'High';
      c.opportunity = 0.5 * c.repeatGap + (Number.isFinite(c.paceGap) ? c.paceGap : 0) + c.mistakeLoss / Math.max(1, c.n);
    });
    return { list: out, envelope: env };
  }

  // --------------------------------------------------------------------------
  // Session-level consistency, pace, evolution
  // --------------------------------------------------------------------------
  function session(model) {
    const { laps, incidents, cornerStats, theo } = model;
    const ana = laps.filter(l => l.analysable);
    const pace = laps.filter(l => l.usableForPace);
    const clean = laps.filter(l => l.clean);
    const lt = pace.map(l => l.lapTime);
    const ltClean = clean.map(l => l.lapTime);
    const best = lt.length ? St.min(lt) : NaN;
    const med = St.median(lt);
    const cvR = St.robustScale(lt, 0) / med, cvS = St.std(lt) / St.mean(lt);
    const cvBlend = 0.5 * (cvR || 0) + 0.5 * (cvS || 0);
    const ltScore = lt.length >= 3 ? 100 / (1 + Math.pow(cvBlend / 0.006, 1.5)) : NaN;
    const ccScores = cornerStats.list.map(c => c.consistency).filter(Number.isFinite);
    const ccScore = ccScores.length ? St.mean(ccScores) : NaN;
    const nA = Math.max(1, ana.length);
    const inc = incidents.filter(i => laps[i.lap].analysable);
    const counted = inc.filter(i => i.confidence !== 'Low' || i.level >= 2);
    const rate = {
      minor: counted.filter(i => i.level === 1).length / nA,
      sig: counted.filter(i => i.level === 2 && !i.offTrack).length / nA,
      major: counted.filter(i => i.level >= 3 && !i.offTrack).length / nA,
      off: inc.filter(i => i.offTrack).length / nA,
      all: counted.length / nA,
      mistakes: counted.filter(i => !i.offTrack).length / nA,
    };
    const lostPerLap = inc.filter(i => i.level >= 2).reduce((s, i) => s + i.loss, 0) / nA;
    const mfScore = 100 * Math.exp(-(0.1 * rate.minor + 0.5 * rate.sig + 1.0 * rate.major + 1.5 * rate.off + lostPerLap / 0.6));
    const cornerTerm = St.mean(cornerStats.list.map(c => Math.exp(-c.repeatGap / Math.max(0.08, 0.006 * c.median))));
    const medClean = St.median(ltClean.length ? ltClean : lt);
    const lapTerm = Math.exp(-((medClean - best) / best) / 0.004);
    const rpScore = 100 * (0.5 * cornerTerm + 0.5 * lapTerm);
    const parts = [[0.35, ltScore], [0.30, ccScore], [0.25, mfScore], [0.10, rpScore]].filter(p => Number.isFinite(p[1]));
    const overall = parts.reduce((s, p) => s + p[0] * p[1], 0) / (parts.reduce((s, p) => s + p[0], 0) || 1);
    // time budget
    const theoTotal = theo.total;
    const budget = {
      theoretical: theoTotal, best, medianClean: medClean, median: med,
      potential: best - theoTotal, repeatability: medClean - best, mistakes: med - medClean, lostPerLap,
      inconsistencyPerLap: medClean - theoTotal,
    };
    // evolution
    const xs = pace.map(l => l.index), ys = pace.map(l => l.lapTime);
    const xc = clean.map(l => l.index), yc = clean.map(l => l.lapTime);
    const trend = xc.length >= 5 ? St.theilSen(xc, yc) : null;
    const half = Math.floor(ana.length / 2);
    const h1 = ana.slice(0, half), h2 = ana.slice(half);
    const halfStats = [h1, h2].map(h => ({
      laps: h.length, medianClean: St.median(h.filter(l => l.clean).map(l => l.lapTime)),
      mistakeRate: h.length ? incidents.filter(i => h.some(l => l.index === i.lap) && i.level >= 2).length / h.length : NaN,
      meanScore: St.mean(h.map(l => l.mistakeScore)), consistency: St.mean(h.map(l => l.consistencyScore)),
    }));
    const stints = Array.from(new Set(laps.map(l => l.stint))).map(s => {
      const L = laps.filter(l => l.stint === s);
      const c = L.filter(l => l.clean);
      return { stint: s, laps: L.map(l => l.index), clean: c.length, best: c.length ? St.min(c.map(l => l.lapTime)) : NaN, median: St.median(c.map(l => l.lapTime)), trend: c.length >= 5 ? St.theilSen(c.map(l => l.index), c.map(l => l.lapTime)).slope : NaN };
    });
    // rolling consistency (robust spread of last 5 usable laps)
    pace.forEach((l, k) => { const w = pace.slice(Math.max(0, k - 4), k + 1).map(x => x.lapTime); l.rollingSpread = w.length >= 3 ? St.iqr(w) : NaN; l.rollingMedian = St.median(w); });
    return {
      best, bestLap: pace.find(l => l.lapTime === best)?.index ?? null, median: med, medianClean: medClean,
      bestClean: ltClean.length ? St.min(ltClean) : NaN, meanClean: St.mean(ltClean),
      lapTimeStats: { n: lt.length, std: St.std(lt), mad: St.mad(lt), iqr: St.iqr(lt), cvRobust: cvR, cv: cvS, cleanSpread: ltClean.length > 1 ? St.max(ltClean) - St.min(ltClean) : NaN, cleanIqr: St.iqr(ltClean), q25: St.quantile(lt, 0.25), q75: St.quantile(lt, 0.75) },
      consistency: { overall, lapTime: ltScore, corner: ccScore, mistakes: mfScore, repeatability: rpScore, weights: { lapTime: 0.35, corner: 0.30, mistakes: 0.25, repeatability: 0.10 } },
      rates: rate, budget, trend, halfStats, stints,
      counts: { laps: laps.length, complete: laps.filter(l => l.complete).length, analysable: ana.length, usable: pace.length, clean: clean.length, offTracks: inc.filter(i => i.offTrack).length, incidents: inc.length },
    };
  }

  NS.scoring = { scoreLaps, theoretical, corners, session, STATUS_ORDER };
})(typeof window !== 'undefined' ? window : globalThis);
