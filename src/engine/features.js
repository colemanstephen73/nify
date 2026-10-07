/* ============================================================================
 * Stage 5: Feature extraction — per lap, per segment and per corner metrics
 *          measured on the distance-aligned grid.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  /** Cross-track deviation of a lap's X/Y from the reference line (m) at each grid point. */
  function lateralDeviation(lap, ref, G) {
    const N = G.N, out = new Float32Array(N).fill(NaN);
    if (!lap.grid.x || !ref.x) return out;
    const W = Math.max(4, Math.round(30 / G.ds));
    for (let k = 0; k < N; k++) {
      const px = lap.grid.x[k], py = lap.grid.y[k];
      if (!Number.isFinite(px)) continue;
      let best = Infinity;
      for (let j = Math.max(0, k - W); j < Math.min(N - 1, k + W); j++) {
        const ax = ref.x[j], ay = ref.y[j], bx = ref.x[j + 1], by = ref.y[j + 1];
        const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
        let t = L2 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
        if (d < best) best = d;
      }
      out[k] = best;
    }
    return out;
  }

  function extrema(sig, lo, hi, minAmp) {
    // alternating extrema with hysteresis minAmp
    const ex = [];
    let dir = 0, lastV = sig[lo], lastK = lo;
    for (let k = lo + 1; k <= hi; k++) {
      const v = sig[k];
      if (!Number.isFinite(v)) continue;
      if (dir >= 0) {
        if (v > lastV) { lastV = v; lastK = k; }
        else if (lastV - v > minAmp) { ex.push({ k: lastK, v: lastV, type: 'max' }); dir = -1; lastV = v; lastK = k; }
      }
      if (dir < 0) {
        if (v < lastV) { lastV = v; lastK = k; }
        else if (v - lastV > minAmp) { ex.push({ k: lastK, v: lastV, type: 'min' }); dir = 1; lastV = v; lastK = k; }
      }
    }
    return ex;
  }

  function extract(model) {
    const { laps, G, corners, segs, ref, avail, brakeThr } = model;
    const ds = G.ds, N = G.N;
    const m = x => Math.round(x / ds);
    const has = k => !!avail[k];
    const out = new Map();
    for (const lap of laps) {
      if (!lap.analysable) continue;
      const g = lap.grid;
      const T = g.time;
      const dev = lap.dev;
      const segT = segs.map(s => T[s.i1] - T[s.i0]);
      const cf = corners.map((c, ci) => {
        const s = segs[c.segment];
        const f = { segTime: segT[c.segment], cornerTime: T[c.end] - T[c.start] };
        const lo = s.i0, hi = s.i1;
        const nextStart = ci + 1 < corners.length ? corners[ci + 1].start : N - 1;
        // apex (lap's own minimum speed near the reference apex)
        const aLo = Math.max(lo, c.i0 - m(30)), aHi = Math.min(hi, c.i1 + m(30));
        let apex = c.apex;
        if (has('speed')) {
          apex = St.argmin(g.speed, aLo, aHi); f.minSpeed = g.speed[apex];
          // apex location = centre of the contiguous region within 1 km/h of the minimum (stable on flat-speed sweepers)
          let a0 = apex, a1 = apex;
          while (a0 > aLo && g.speed[a0 - 1] <= f.minSpeed + 1) a0--;
          while (a1 < aHi && g.speed[a1 + 1] <= f.minSpeed + 1) a1++;
          f.apexDist = 0.5 * (a0 + a1) * ds;
          f.speedAtRefApex = g.speed[c.apex]; f.entrySpeed = g.speed[c.i0]; f.exitSpeed = g.speed[Math.min(c.exit, hi)]; f.vMaxBefore = St.max(g.speed.slice(lo, Math.max(lo + 1, c.start + 1))); }
        f.apexIdx = apex;
        f.timeToApex = T[apex] - T[lo];
        // braking
        const bHi = Math.min(apex + m(20), hi);
        if (has('brake')) {
          let bp = -1;
          for (let k = lo; k <= bHi; k++) if (g.brake[k] > brakeThr) { bp = k; break; }
          if (bp >= 0) {
            f.brakePoint = bp * ds; f.brakeIdx = bp;
            f.brakePeak = St.max(g.brake.slice(bp, Math.max(bp + 1, apex + 1)));
            // separate brake applications (release below half threshold for >= 6 m)
            let events = 0, on = false, offRun = 0;
            for (let k = lo; k <= bHi; k++) {
              const b = g.brake[k];
              if (!on && b > brakeThr) { on = true; events++; offRun = 0; }
              else if (on && b < 0.5 * brakeThr) { offRun++; if (offRun * ds >= 6) on = false; }
              else if (on) offRun = 0;
            }
            f.brakeEvents = events;
            // brake release: last point above threshold before apex+20 m
            let rel = bp; for (let k = bp; k <= bHi; k++) if (g.brake[k] > brakeThr) rel = k;
            f.brakeRelease = rel * ds;
          } else { f.brakeEvents = 0; }
          if (has('lonG') && Number.isFinite(f.brakeIdx)) f.peakDecel = -St.min(g.lonG.slice(f.brakeIdx, Math.max(f.brakeIdx + 1, apex + 1)));
        } else if (has('lonG')) {
          let bp = -1; for (let k = lo; k <= bHi; k++) if (g.lonG[k] < -0.3) { bp = k; break; }
          if (bp >= 0) { f.brakePoint = bp * ds; f.brakeIdx = bp; f.peakDecel = -St.min(g.lonG.slice(bp, Math.max(bp + 1, apex + 1))); }
        }
        // throttle
        if (has('throttle')) {
          const tLo = Math.max(lo, Number.isFinite(f.brakeIdx) ? f.brakeIdx : c.i0);
          let minThr = Infinity; for (let k = tLo; k <= Math.min(apex, hi); k++) minThr = Math.min(minThr, g.throttle[k]);
          f.minThrottle = minThr;
          if (minThr < 25) {
            let pk = -1;
            for (let k = Math.max(lo, apex - m(15)); k <= hi; k++) if (g.throttle[k] >= 25 && (g.throttle[Math.min(hi, k + 3)] >= 20)) { pk = k; break; }
            if (pk >= 0) {
              f.pickup = pk * ds; f.pickupIdx = pk;
              f.pickupTimeAfterApex = T[pk] - T[apex];
              let ft = -1; for (let k = pk; k <= hi; k++) if (g.throttle[k] >= 95) { ft = k; break; }
              if (ft >= 0) f.fullThrottle = ft * ds;
              // lifts on exit
              const wHi = Math.min(hi, nextStart - m(20));
              let peak = 0, lifts = 0, inLift = false, worstDip = 0;
              for (let k = pk; k <= wHi; k++) {
                const v = g.throttle[k];
                if (!inLift) {
                  peak = Math.max(peak, v);
                  if (peak >= 60 && v < peak - 25) { inLift = true; lifts++; worstDip = Math.max(worstDip, peak - v); }
                } else {
                  worstDip = Math.max(worstDip, peak - v);
                  if (v >= peak - 10) { inLift = false; peak = v; }
                }
              }
              f.throttleLifts = lifts; f.liftDepth = worstDip;
            }
          } else { f.flat = true; f.throttleLifts = 0; }
        }
        // steering corrections
        if (has('steering')) {
          const sLo = Math.max(lo, c.i0 - m(20)), sHi = Math.min(hi, c.exit);
          const sm = St.smooth(g.steering.slice(sLo, sHi + 1), 3);
          const peak = St.max(Array.from(sm).map(Math.abs));
          const ex = extrema(sm, 0, sm.length - 1, Math.max(4, 0.18 * peak));
          f.steerReversals = Math.max(0, ex.length - 1);
          f.steerPeak = peak;
        }
        if (has('latG')) {
          let pk = 0; const sm = St.smooth(g.latG.slice(c.i0, c.i1 + 1), 5);
          for (const v of sm) pk = Math.max(pk, Math.abs(v));
          f.latPeak = pk;
        }
        if (dev && Number.isFinite(dev[lo])) {
          let mx = 0, at = lo; for (let k = lo; k <= hi; k++) if (dev[k] > mx) { mx = dev[k]; at = k; }
          f.maxDev = mx; f.maxDevIdx = at;
        }
        if (g.trackLimit) {
          let v = 0, at = -1; for (let k = lo; k <= hi; k++) if (g.trackLimit[k] >= 0.5) { v = 1; at = k; break; }
          f.trackLimit = v; f.trackLimitIdx = at;
        }
        if (g.gear) f.minGear = St.min(Array.from(g.gear.slice(aLo, aHi + 1)).filter(Number.isFinite));
        return f;
      });
      out.set(lap.index, { segTimes: segT, corners: cf });
    }
    return out;
  }

  NS.features = { extract, lateralDeviation };
})(typeof window !== 'undefined' ? window : globalThis);
