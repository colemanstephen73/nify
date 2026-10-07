/* ============================================================================
 * Stage 3: Lap detection, lap timing, completeness, data validity and
 *          distance-domain resampling.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;
  const CH = ['speed', 'throttle', 'brake', 'steering', 'gear', 'rpm', 'latG', 'lonG'];

  /** Split every session into raw lap index ranges. */
  function splitLaps(I) {
    const C = I.table;
    const ranges = [];
    const method = { boundaries: null, distance: null };
    const bySession = new Map();
    for (let i = 0; i < C.n; i++) {
      const s = C.session[i];
      if (!bySession.has(s)) bySession.set(s, []);
      bySession.get(s).push(i);
    }
    const hasLap = I.avail.lap && St.finite(C.lap).length > 0;
    const hasDist = !!I.avail.distance;
    const hasXY = !!I.avail.position;
    // decide boundary method
    if (hasLap) method.boundaries = `lap channel "${I.avail.lap}"`;
    else if (hasDist) {
      let drops = 0;
      for (let i = 1; i < C.n; i++) if (C.session[i] === C.session[i - 1] && C.dist[i] < C.dist[i - 1] - 200) drops++;
      method.boundaries = drops ? 'distance resets' : null;
    }
    if (!method.boundaries && hasXY) method.boundaries = 'start/finish gate inferred from X/Y trajectory';
    if (!method.boundaries) method.boundaries = 'none detected (each session treated as one run)';

    for (const [sess, idx] of bySession) {
      let cuts = [0];
      if (hasLap) {
        for (let k = 1; k < idx.length; k++) if (C.lap[idx[k]] !== C.lap[idx[k - 1]]) cuts.push(k);
      } else if (method.boundaries === 'distance resets') {
        for (let k = 1; k < idx.length; k++) if (C.dist[idx[k]] < C.dist[idx[k - 1]] - 200) cuts.push(k);
      } else if (hasXY) {
        cuts = cuts.concat(xyGateCuts(C, idx));
      }
      cuts.push(idx.length);
      cuts = Array.from(new Set(cuts)).sort((a, b) => a - b);
      for (let c = 0; c < cuts.length - 1; c++) {
        if (cuts[c + 1] - cuts[c] < 3) continue;
        ranges.push({ session: sess, i0: idx[cuts[c]], i1: idx[cuts[c + 1] - 1], lapNo: hasLap ? C.lap[idx[cuts[c]]] : c + 1 });
      }
    }
    return { ranges, method };
  }

  /** Infer S/F crossings from a closed X/Y trajectory: returns cut positions (relative indices). */
  function xyGateCuts(C, idx) {
    // cumulative path length
    const n = idx.length; const cum = new Float64Array(n);
    for (let k = 1; k < n; k++) {
      const a = idx[k - 1], b = idx[k];
      const d = Math.hypot(C.x[b] - C.x[a], C.y[b] - C.y[a]);
      cum[k] = cum[k - 1] + (d < 100 ? d : 0);
    }
    const ref = idx[Math.floor(n * 0.25)];
    const gx = C.x[ref], gy = C.y[ref];
    const cand = [];
    for (let k = 1; k < n - 1; k++) {
      const i = idx[k];
      const d = Math.hypot(C.x[i] - gx, C.y[i] - gy);
      const dp = Math.hypot(C.x[idx[k - 1]] - gx, C.y[idx[k - 1]] - gy);
      const dn = Math.hypot(C.x[idx[k + 1]] - gx, C.y[idx[k + 1]] - gy);
      if (d < 20 && d <= dp && d <= dn) cand.push(k);
    }
    if (cand.length < 2) return [];
    const gapsD = []; for (let j = 1; j < cand.length; j++) gapsD.push(cum[cand[j]] - cum[cand[j - 1]]);
    const lapLen = St.quantile(gapsD, 0.75);
    const cuts = [];
    let last = -Infinity;
    for (const k of cand) if (cum[k] - last > 0.6 * lapLen) { cuts.push(k); last = cum[k]; }
    return cuts;
  }

  function detectLaps(I) {
    const C = I.table;
    const { ranges, method } = splitLaps(I);
    const mdt = I.sampling.medianDt || 0.05;
    const hasDist = !!I.avail.distance;
    const hasSpeed = !!I.avail.speed;
    // --- per-lap distance trace
    let resetMode = false;
    if (hasDist && ranges.length > 1) {
      const firsts = ranges.map(r => C.dist[r.i0]);
      const spans = ranges.map(r => C.dist[r.i1] - C.dist[r.i0]);
      resetMode = St.median(firsts) < 0.5 * St.median(spans);
    }
    method.distance = hasDist ? (resetMode ? `per-lap distance (resets each lap) from "${I.avail.distance}"` : `cumulative distance "${I.avail.distance}" re-zeroed at each lap start`)
      : hasSpeed ? 'integrated from speed × time' : (I.avail.position ? 'integrated path length from X/Y' : 'unavailable');
    const laps = ranges.map((r, k) => {
      const n = r.i1 - r.i0 + 1;
      const d = new Float64Array(n);
      for (let j = 0; j < n; j++) {
        const i = r.i0 + j;
        if (hasDist) d[j] = resetMode ? C.dist[i] : C.dist[i] - C.dist[r.i0];
        else if (j > 0) {
          const dt = C.t[i] - C.t[i - 1];
          let dd;
          if (hasSpeed) dd = 0.5 * (C.speed[i] + C.speed[i - 1]) * dt;
          else dd = Math.hypot(C.x[i] - C.x[i - 1], C.y[i] - C.y[i - 1]);
          d[j] = d[j - 1] + (dt > 0 && dt < 2 ? dd : 0);
        }
      }
      // cumulative mode: offset so the lap starts at half a sample step before the first sample
      if (hasDist && !resetMode && k > 0 && ranges[k - 1].session === r.session && ranges[k - 1].i1 === r.i0 - 1) {
        const half = 0.5 * (C.dist[r.i0] - C.dist[r.i0 - 1]);
        for (let j = 0; j < n; j++) d[j] += half;
      }
      return { ...r, d };
    });
    // --- reference lap length
    const ends = laps.map(l => l.d[l.d.length - 1]);
    const big = St.quantile(ends, 0.9);
    const L = St.median(ends.filter((e, k) => e > 0.9 * big && laps[k].d[0] < 0.05 * big)) || big;
    // --- timing
    const out = laps.map((l, k) => {
      const n = l.d.length;
      const v0 = hasSpeed ? Math.max(C.speed[l.i0], 1) : NaN;
      const v1 = hasSpeed ? Math.max(C.speed[l.i1], 1) : NaN;
      const startsAtLine = l.d[0] <= Math.max(30, 0.015 * L);
      let tStart = C.t[l.i0];
      if (startsAtLine && hasSpeed && l.d[0] > 0) tStart -= l.d[0] / v0;
      return { ...l, n, startsAtLine, tStart, v0, v1, dEnd: l.d[n - 1] };
    });
    const res = [];
    for (let k = 0; k < out.length; k++) {
      const l = out[k];
      const next = out[k + 1];
      const contiguous = next && next.session === l.session && next.i0 === l.i1 + 1 && (C.t[next.i0] - C.t[l.i1]) < Math.max(3 * mdt, 0.5);
      let tEnd, endsAtLine;
      if (contiguous && next.startsAtLine) { tEnd = next.tStart; endsAtLine = true; }
      else if (l.dEnd >= 0.97 * L && hasSpeed) { tEnd = C.t[l.i1] + Math.max(0, L - l.dEnd) / l.v1; endsAtLine = l.dEnd >= 0.985 * L; }
      else { tEnd = C.t[l.i1] + mdt; endsAtLine = false; }
      const lengthEst = endsAtLine ? Math.max(l.dEnd + (hasSpeed ? l.v1 * Math.max(0, tEnd - C.t[l.i1]) : 0), l.dEnd) : l.dEnd;
      // gaps & data quality inside lap
      let maxGap = 0, gapAt = NaN, backSteps = 0;
      for (let i = l.i0 + 1; i <= l.i1; i++) {
        const g = C.t[i] - C.t[i - 1];
        if (g > maxGap) { maxGap = g; gapAt = l.d[i - l.i0]; }
        if (l.d[i - l.i0] < l.d[i - 1 - l.i0] - 5) backSteps++;
      }
      const dq = [];
      let dqSevere = false;
      const gapThr = Math.max(0.3, 8 * mdt);
      if (maxGap > gapThr) {
        const severe = maxGap > 2.0;
        dq.push({ type: 'gap', severe, text: `Logging gap of ${maxGap.toFixed(2)} s at ${gapAt.toFixed(0)} m (${severe ? 'lap excluded from analysis' : 'interpolated'})` });
        if (severe) dqSevere = true;
      }
      if (backSteps > 3) { dq.push({ type: 'distance', severe: true, text: `${backSteps} backwards distance jumps` }); dqSevere = true; }
      const lengthOk = Math.abs(lengthEst - L) / L < 0.04;
      // pit-lane laps (iRacing OnPitRoad / track surface) are in/out laps, never representative
      let pitFirst = -1, pitLast = -1;
      if (C.pit) for (let i = l.i0; i <= l.i1; i++) if (C.pit[i] >= 0.5) { if (pitFirst < 0) pitFirst = i; pitLast = i; }
      const usedPit = pitFirst >= 0;
      const complete = l.startsAtLine && endsAtLine && lengthOk && !usedPit;
      let partialReason = null;
      if (usedPit) partialReason = `used the pit lane (${pitFirst - l.i0 < (l.i1 - l.i0) / 2 ? 'out-lap' : 'in-lap'})`;
      if (partialReason) { /* pit lane */ }
      else if (!l.startsAtLine) partialReason = `starts at ${l.d[0].toFixed(0)} m (not at S/F)`;
      else if (!endsAtLine) partialReason = `ends at ${l.dEnd.toFixed(0)} m of ${L.toFixed(0)} m`;
      else if (!lengthOk) partialReason = `lap length ${lengthEst.toFixed(0)} m deviates ${(100 * (lengthEst - L) / L).toFixed(1)}% from reference`;
      res.push({
        index: k, session: l.session, lapNo: l.lapNo, i0: l.i0, i1: l.i1, d: l.d,
        tStart: l.tStart, tEnd, lapTime: complete ? tEnd - l.tStart : NaN, duration: tEnd - l.tStart,
        startDist: l.d[0], endDist: l.dEnd, lengthEst, complete, partialReason, maxGap, dq, dqSevere,
        samples: l.n, timeSource: 'computed from S/F crossings', usedPit, pitAtStart: usedPit && pitFirst - l.i0 < (l.i1 - l.i0) / 2,
      });
    }
    applyExplicitLapTimes(I, res);
    // stints and labels
    const multi = new Set(res.map(l => l.session)).size > 1;
    let stint = 0;
    res.forEach((l, k) => {
      const prev = res[k - 1];
      if (prev && (prev.session !== l.session || l.tStart - prev.tEnd > 30 || (!prev.complete && prev.endDist < 0.97 * L && l.index > 0 && prev.partialReason && /ends/.test(prev.partialReason)))) stint++;
      l.stint = stint;
      l.label = multi ? `S${l.session + 1}·L${fmtLapNo(l.lapNo)}` : `L${fmtLapNo(l.lapNo)}`;
      l.lapNoText = fmtLapNo(l.lapNo);
    });
    res.forEach((l, k) => {
      l.kind = 'flying';
      if (!l.complete && l.usedPit) l.kind = l.pitAtStart ? 'out' : 'in';
      else if (!l.complete) {
        if (l.startDist > Math.max(30, 0.015 * L)) l.kind = 'out';
        else if (l.endDist < 0.97 * L) l.kind = 'in';
        else l.kind = 'partial';
      }
    });
    return { laps: res, L, method, resetMode };
  }

  function fmtLapNo(n) { return Number.isFinite(n) ? (Math.round(n) === n ? String(n) : n.toFixed(1)) : '?'; }

  /** Use an explicit lap-time channel when it is per-lap constant and consistent with computed timing. */
  function applyExplicitLapTimes(I, laps) {
    if (!I.avail.lapTime) return;
    const C = I.table;
    const vals = laps.map(l => {
      const a = []; for (let i = l.i0; i <= l.i1; i++) if (Number.isFinite(C.lapTimeCol[i])) a.push(Math.round(C.lapTimeCol[i] * 1e4) / 1e4);
      if (!a.length) return NaN;
      const v0 = St.mode(a);
      if (a.filter(x => x === v0).length < 0.8 * a.length) return NaN; // not a per-lap value
      return v0 > 1000 ? v0 / 1000 : v0; // ms
    });
    const errSame = [], errPrev = [];
    laps.forEach((l, k) => {
      if (!l.complete) return;
      if (Number.isFinite(vals[k])) errSame.push(Math.abs(vals[k] - l.lapTime));
      if (Number.isFinite(vals[k + 1]) && laps[k + 1] && laps[k + 1].session === l.session) errPrev.push(Math.abs(vals[k + 1] - l.lapTime));
    });
    const eS = St.median(errSame), eP = St.median(errPrev);
    const shift = (Number.isFinite(eP) && (!Number.isFinite(eS) || eP < eS)) ? 1 : 0;
    const e = shift ? eP : eS;
    if (!(e < 0.25)) return;
    laps.forEach((l, k) => {
      const v = vals[k + shift];
      if (l.complete && Number.isFinite(v) && Math.abs(v - l.lapTime) < 0.5) { l.lapTime = v; l.timeSource = `lap-time channel "${I.avail.lapTime}"`; }
    });
  }

  /** Resample each lap onto a common distance grid (distance-normalised to the reference length). */
  function resampleLaps(I, lapInfo) {
    const C = I.table;
    const { laps, L } = lapInfo;
    const ds = St.clamp(Math.round(L / 2200), 1, 5);
    const N = Math.ceil(L / ds - 1e-9) + 1; // last grid point is exactly the finish line
    const grid = new Float64Array(N); for (let k = 0; k < N; k++) grid[k] = Math.min(k * ds, L);
    const has = {}; CH.forEach(c => has[c] = !!I.avail[c]);
    const hasXY = !!I.avail.position, hasTL = !!I.avail.trackLimit;
    for (const lap of laps) {
      const scale = lap.complete ? L / lap.lengthEst : 1;
      const s = [], t = [], idx = [];
      let last = -Infinity;
      for (let i = lap.i0; i <= lap.i1; i++) {
        const sv = lap.d[i - lap.i0] * scale;
        if (!(sv > last)) continue;
        s.push(sv); t.push(C.t[i] - lap.tStart); idx.push(i); last = sv;
      }
      if (lap.complete) {
        if (s[0] > 0) { s.unshift(0); t.unshift(0); idx.unshift(idx[0]); }
        if (s[s.length - 1] < L) { s.push(L); t.push(lap.lapTime); idx.push(idx[idx.length - 1]); }
      }
      const R = { time: St.interp(grid, s, t) };
      // pin the trace to the lap time (an official lap-time channel can differ from the
      // sampled crossing by up to one sample); rescaling keeps segment times summing to the lap
      if (lap.complete && R.time[N - 1] > 0 && Math.abs(R.time[N - 1] - lap.lapTime) > 1e-9) {
        const f = lap.lapTime / R.time[N - 1];
        for (let k = 0; k < N; k++) R.time[k] *= f;
      }
      const pick = arr => idx.map(i => arr[i]);
      for (const c of CH) if (has[c]) R[c] = St.interp(grid, s, pick(C[c]), c === 'gear');
      if (has.speed) for (let k = 0; k < N; k++) R.speed[k] *= 3.6; // display unit km/h
      if (hasXY) { R.x = St.interp(grid, s, pick(C.x)); R.y = St.interp(grid, s, pick(C.y)); }
      if (hasTL) R.trackLimit = St.interp(grid, s, pick(C.trackLimit), true);
      R.rawIdx = St.interp(grid, s, idx, true);
      // compact storage
      for (const k of Object.keys(R)) R[k] = k === 'time' ? R[k] : Float32Array.from(R[k]);
      lap.grid = R;
      lap.coverage = [s[0], s[s.length - 1]];
      delete lap.d;
    }
    return { grid, ds, N };
  }

  NS.laps = { detectLaps, resampleLaps };
})(typeof window !== 'undefined' ? window : globalThis);
