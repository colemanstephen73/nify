/* ============================================================================
 * Stage 4: Track model — reference traces, curvature, corner detection,
 *          brake/apex/exit points, non-overlapping timing segments, sectors.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  /** Per-grid-point median across reference laps. */
  function medianTrace(laps, key, N) {
    const out = new Float64Array(N);
    const buf = [];
    for (let k = 0; k < N; k++) {
      buf.length = 0;
      for (const l of laps) { const v = l.grid[key] ? l.grid[key][k] : NaN; if (Number.isFinite(v)) buf.push(v); }
      out[k] = buf.length ? St.median(buf) : NaN;
    }
    return out;
  }

  function buildReference(laps, G, avail) {
    const ref = {};
    const keys = ['speed', 'throttle', 'brake', 'steering', 'latG', 'lonG', 'gear', 'rpm', 'x', 'y', 'time'];
    for (const k of keys) if (laps.some(l => l.grid[k])) ref[k] = medianTrace(laps, k, G.N);
    // speed spread (consistency along the lap)
    if (ref.speed) {
      ref.speedSpread = new Float64Array(G.N);
      for (let k = 0; k < G.N; k++) {
        const v = laps.map(l => l.grid.speed[k]).filter(Number.isFinite);
        ref.speedSpread[k] = v.length > 3 ? 1.4826 * St.mad(v) : NaN;
      }
    }
    return ref;
  }

  /** Signed curvature (1/m, left positive) from the best available source. */
  function curvature(ref, G, avail) {
    const N = G.N, ds = G.ds;
    if (ref.x && ref.y && St.finite(ref.x).length > N * 0.9) {
      // smooth positions (~20 m), then heading over a ±8 m chord and curvature over a ±8 m baseline
      const w = Math.max(3, Math.round(20 / ds));
      const xs = St.smoothCircular(ref.x, w), ys = St.smoothCircular(ref.y, w);
      const hc = Math.max(1, Math.round(8 / ds));
      const h = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const a = (k - hc + N) % N, b = (k + hc) % N;
        h[k] = Math.atan2(ys[b] - ys[a], xs[b] - xs[a]);
      }
      const kap = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        let d = h[(k + hc) % N] - h[(k - hc + N) % N];
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        kap[k] = d / (2 * hc * ds);
      }
      return { k: St.smoothCircular(kap, Math.max(3, Math.round(20 / ds))), source: 'geometric curvature of the median X/Y trajectory', signReliable: true, thr: 1 / 350 };
    }
    if (ref.latG && ref.speed) {
      const kap = new Float64Array(N);
      for (let k = 0; k < N; k++) { const v = Math.max(ref.speed[k] / 3.6, 8); kap[k] = ref.latG[k] * 9.80665 / (v * v); }
      return { k: St.smoothCircular(kap, Math.max(3, Math.round(16 / ds))), source: 'lateral acceleration ÷ speed² (median lap)', signReliable: false, thr: 1 / 350 };
    }
    if (ref.steering) {
      const s = St.smoothCircular(ref.steering, Math.max(3, Math.round(16 / ds)));
      const p98 = St.quantile(Array.from(s).map(Math.abs), 0.98);
      return { k: s, source: 'steering angle (median lap, relative threshold)', signReliable: false, thr: 0.12 * p98, proxy: true };
    }
    return null;
  }

  /** Detect corners. Returns ordered corner objects with stable T-numbers. */
  function detectCorners(ref, G, avail, explicitCorners) {
    const N = G.N, ds = G.ds;
    const sp = ref.speed;
    const curv = curvature(ref, G, avail);
    const notes = [];
    let raw = [];
    let kinks = 0;
    if (explicitCorners && explicitCorners.length) {
      raw = explicitCorners.map(c => ({ i0: c.i0, i1: c.i1, sign: 0, name: c.name, source: 'explicit' }));
      notes.push('Corner positions taken from the corner/turn channel in the data.');
    } else if (curv) {
      const a = Array.from(curv.k, Math.abs);
      let runs = [];
      let cur = null;
      for (let k = 0; k < N; k++) {
        const on = a[k] > curv.thr;
        const sg = Math.sign(curv.k[k]);
        if (on && cur && sg === cur.sign) cur.i1 = k;
        else if (on) { if (cur) runs.push(cur); cur = { i0: k, i1: k, sign: sg }; }
        else if (cur) { runs.push(cur); cur = null; }
      }
      if (cur) runs.push(cur);
      const angOf = r => { let ang = 0; for (let k = r.i0; k <= r.i1; k++) ang += a[k] * ds; return curv.proxy ? (r.i1 - r.i0) * ds : ang * 180 / Math.PI; };
      // 1) drop noise fragments, 2) merge same-sign runs separated by short gaps (double apex / fragmentation)
      runs = runs.filter(r => angOf(r) >= (curv.proxy ? 6 : 5) || (r.i1 - r.i0) * ds >= 15);
      const merged = [];
      for (const r of runs) {
        const p = merged[merged.length - 1];
        let join = p && p.sign === r.sign && (r.i0 - p.i1) * ds < 40;
        if (!join && p && p.sign === r.sign && (r.i0 - p.i1) * ds < 120) {
          // long sweeper whose curvature eases but never changes direction → one corner
          let ok = true; for (let k = p.i1; k <= r.i0; k++) if (curv.k[k] * r.sign < 0.1 * curv.thr) { ok = false; break; }
          join = ok;
        }
        if (join) p.i1 = r.i1; else merged.push({ ...r });
      }
      // 3) keep real corners: enough heading change, or a genuine local speed minimum
      const W = Math.round(150 / ds);
      for (const r of merged) {
        const angDeg = curv.proxy ? NaN : angOf(r);
        const len = (r.i1 - r.i0) * ds;
        let prom = 0;
        if (sp) {
          const lo = Math.max(0, r.i0 - Math.round(20 / ds)), hi = Math.min(N - 1, r.i1 + Math.round(20 / ds));
          const km = St.argmin(sp, lo, hi);
          const before = St.max(sp.slice(Math.max(0, km - W), km + 1)), after = St.max(sp.slice(km, Math.min(N, km + W)));
          prom = Math.min(before, after) - sp[km];
          r.speedDrop = before - sp[km];
        }
        r.angleDeg = angDeg;
        const keep = curv.proxy ? (len >= 15 && prom >= 5) || prom >= 8 : ((angDeg >= 20 && len >= 12) || (angDeg >= 10 && prom >= 8));
        if (keep) raw.push({ ...r, source: 'curvature' }); else kinks++;
      }
      notes.push(`Corners inferred from ${curv.source}; threshold ${curv.proxy ? 'relative' : 'radius < ' + Math.round(1 / curv.thr) + ' m'}, min 20° heading change (or ≥10° with a ≥8 km/h local speed minimum); same-direction fragments < 40 m apart (or < 120 m without curvature reversal) merged.`);
      if (kinks) notes.push(`${kinks} minor kink(s) ignored (insufficient heading change and speed drop).`);
    }
    // speed-minimum fallback / supplement
    if (sp) {
      const w = Math.round(60 / ds);
      for (let k = w; k < N - w; k++) {
        if (sp[k] !== St.min(sp.slice(k - w, k + w + 1))) continue;
        const lo = Math.max(0, k - Math.round(300 / ds));
        const prom = St.max(sp.slice(lo, k)) - sp[k];
        if (prom < 15) continue;
        if (raw.some(r => k >= r.i0 - Math.round(40 / ds) && k <= r.i1 + Math.round(40 / ds))) continue;
        raw.push({ i0: k - Math.round(25 / ds), i1: k + Math.round(25 / ds), sign: 0, source: 'speed minimum', speedDrop: prom });
        notes.push(`Corner added at ${Math.round(k * ds)} m from a ${prom.toFixed(0)} km/h speed minimum without matching curvature.`);
      }
    }
    raw.sort((a, b) => a.i0 - b.i0);
    // --- characterise each corner on the median lap
    const bThr = ref.brake ? Math.max(0.06 * St.quantile(Array.from(ref.brake), 0.99), 1) : NaN;
    const corners = raw.map((r, ci) => {
      const prev = raw[ci - 1];
      const searchLo = Math.max(0, r.i0 - Math.round(20 / ds)), searchHi = Math.min(N - 1, r.i1 + Math.round(20 / ds));
      const apex = sp ? St.argmin(sp, searchLo, searchHi) : Math.round((r.i0 + r.i1) / 2);
      const lowerBound = prev ? Math.round((prev.i1 + r.i0) / 2) : Math.max(0, r.i0 - Math.round(400 / ds));
      let brake = NaN, brakeSource = null;
      if (ref.brake) {
        let j = apex;
        while (j > lowerBound && !(ref.brake[j] > bThr)) j--;
        if (j > lowerBound && (apex - j) * ds < 260) {
          while (j > lowerBound && ref.brake[j - 1] > bThr) j--;
          brake = j; brakeSource = 'brake channel';
        }
      } else if (ref.lonG) {
        let j = apex;
        while (j > lowerBound && !(ref.lonG[j] < -0.3)) j--;
        if (j > lowerBound && (apex - j) * ds < 260) { while (j > lowerBound && ref.lonG[j - 1] < -0.3) j--; brake = j; brakeSource = 'longitudinal deceleration'; }
      } else if (sp) {
        const j = St.argmax(sp, lowerBound, apex);
        if (sp[j] - sp[apex] > 8) { brake = j; brakeSource = 'speed peak before corner'; }
      }
      let exit = Math.min(N - 1, r.i1 + Math.round(30 / ds));
      if (ref.throttle) {
        let j = apex; const lim = Math.min(N - 1, r.i1 + Math.round(250 / ds));
        while (j < lim && !(ref.throttle[j] >= 90)) j++;
        if (j < lim) exit = Math.max(Math.min(exit, j + Math.round(10 / ds)), Math.min(j, N - 1));
      }
      const start = Number.isFinite(brake) ? Math.min(brake, r.i0) : r.i0;
      const end = Math.max(exit, r.i1);
      return {
        i0: r.i0, i1: r.i1, start, end, apex, brake, brakeSource, exit, sign: r.sign,
        dir: curv && curv.signReliable ? (r.sign > 0 ? 'L' : 'R') : (r.sign ? (r.sign > 0 ? 'L?' : 'R?') : ''),
        angleDeg: r.angleDeg, speedDrop: r.speedDrop, source: r.source, explicitName: r.name,
      };
    });
    // ensure strictly ordered, non-overlapping characteristic windows
    for (let i = 1; i < corners.length; i++) {
      const p = corners[i - 1], c = corners[i];
      if (c.start <= p.end) { const mid = Math.round((p.apex + c.apex) / 2); p.end = Math.min(p.end, mid); c.start = Math.max(c.start, mid + 1); if (c.brake < c.start) c.brake = c.start; }
    }
    corners.forEach((c, i) => {
      c.id = c.explicitName || `T${i + 1}`;
      c.index = i;
      const d = k => Number.isFinite(k) ? k * ds : NaN;
      c.dist = { turnIn: d(c.i0), curveEnd: d(c.i1), start: d(c.start), brake: d(c.brake), apex: d(c.apex), exit: d(c.exit), end: d(c.end) };
      c.minSpeedRef = sp ? sp[c.apex] : NaN;
      c.entrySpeedRef = sp ? sp[c.i0] : NaN;
      c.lengthM = (c.end - c.start) * ds;
    });
    return { corners, curv, notes, kinks, inferred: !(explicitCorners && explicitCorners.length) };
  }

  /** Non-overlapping timing segments covering the whole lap: SF → T1 … TN → line. */
  function buildSegments(corners, ref, G) {
    const N = G.N, ds = G.ds, sp = ref.speed;
    const bnd = [];
    corners.forEach((c, i) => {
      const prevExit = i === 0 ? 0 : Math.max(corners[i - 1].exit, corners[i - 1].apex + 1, bnd[i - 1] + 2);
      const room = c.start - prevExit;
      // place the boundary on the straight, well ahead of the typical brake point, so an early
      // brake application still falls inside this corner's segment (speed there is high and stable)
      let b = c.start - Math.min(Math.round(100 / ds), Math.round(0.5 * room));
      if (room < Math.round(20 / ds)) b = Math.round((prevExit + c.start) / 2);
      b = Math.max(i === 0 ? 0 : bnd[i - 1] + 2, Math.min(b, c.start - 1));
      bnd.push(b);
    });
    const segs = [];
    if (corners.length && bnd[0] * ds > 40) segs.push({ id: 'SF', label: 'S/F → ' + corners[0].id, corner: null, i0: 0, i1: bnd[0] });
    else if (corners.length) bnd[0] = 0;
    corners.forEach((c, i) => {
      const i1 = i + 1 < corners.length ? bnd[i + 1] : N - 1;
      segs.push({ id: c.id, label: c.id, corner: c.index, i0: bnd[i], i1 });
      c.segment = segs.length - 1;
    });
    if (!corners.length) {
      const k = 6, step = Math.floor((N - 1) / k);
      for (let j = 0; j < k; j++) segs.push({ id: `D${j + 1}`, label: `Segment ${j + 1}`, corner: null, i0: j * step, i1: j === k - 1 ? N - 1 : (j + 1) * step });
    }
    segs.forEach((s, j) => { s.index = j; s.d0 = s.i0 * ds; s.d1 = Math.min(s.i1 * ds, G.grid[N - 1]); });
    return segs;
  }

  /** Sectors: from a sector channel when present, otherwise 3 inferred sectors snapped to segment boundaries. */
  function buildSectors(laps, segs, G, I) {
    const N = G.N, ds = G.ds;
    const meta = (I.meta || []).find(m => m.sectorsPct && m.sectorsPct.length >= 2);
    if (meta) {
      const starts = meta.sectorsPct.filter(p => p > 0 && p < 1).sort((a, b) => a - b);
      const edges = [0, ...starts.map(p => Math.round(p * (N - 1))), N - 1];
      return { source: 'iRacing session info (SplitTimeInfo)', inferred: false, list: edges.slice(0, -1).map((e, j) => ({ id: `S${j + 1}`, i0: e, i1: edges[j + 1], d0: e * ds, d1: Math.min(edges[j + 1] * ds, G.grid[N - 1]), segments: segs.filter(s => s.i0 >= e && s.i1 <= edges[j + 1]).map(s => s.index) })) };
    }
    if (I.avail.sector) {
      const C = I.table;
      const changes = [];
      for (const l of laps) {
        const pts = [];
        for (let k = 1; k < N; k++) {
          const a = l.grid.rawIdx[k - 1], b = l.grid.rawIdx[k];
          if (C.sector[a] !== C.sector[b] && Number.isFinite(C.sector[a]) && Number.isFinite(C.sector[b])) pts.push(k);
        }
        changes.push(pts);
      }
      const nb = St.mode(changes.map(p => p.length));
      if (nb >= 1 && nb <= 8) {
        const use = changes.filter(p => p.length === nb);
        const b = Array.from({ length: nb }, (_, j) => Math.round(St.median(use.map(p => p[j]))));
        const edges = [0, ...b, N - 1];
        return { source: `sector channel "${I.avail.sector}"`, inferred: false, list: edges.slice(0, -1).map((e, j) => ({ id: `S${j + 1}`, i0: e, i1: edges[j + 1], d0: e * ds, d1: edges[j + 1] * ds, segments: segs.filter(s => s.i0 >= e && s.i1 <= edges[j + 1]).map(s => s.index) })) };
      }
    }
    const L = G.grid[N - 1];
    const cands = segs.slice(1).map(s => s.i0);
    const pick = target => cands.length ? cands.reduce((a, b) => Math.abs(b * ds - target) < Math.abs(a * ds - target) ? b : a) : Math.round(target / ds);
    let b1 = pick(L / 3), b2 = pick(2 * L / 3);
    if (b2 <= b1) b2 = Math.round(2 * L / 3 / ds);
    const edges = [0, b1, b2, N - 1];
    return {
      source: 'inferred (≈ equal thirds, snapped to segment boundaries)', inferred: true,
      list: [0, 1, 2].map(j => ({ id: `S${j + 1}`, i0: edges[j], i1: edges[j + 1], d0: edges[j] * ds, d1: edges[j + 1] * ds, segments: segs.filter(s => s.i0 >= edges[j] && s.i1 <= edges[j + 1]).map(s => s.index) })),
    };
  }

  function explicitCornerRanges(laps, G, I) {
    if (!I.avail.corner) return null;
    const C = I.table;
    const map = new Map();
    for (const l of laps) {
      for (let k = 0; k < G.N; k++) {
        const name = C.corner[l.grid.rawIdx[k]];
        if (!name || name === '0' || name === 'NaN') continue;
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(k);
      }
    }
    const out = [];
    for (const [name, ks] of map) out.push({ name: /^\d+$/.test(name) ? `T${name}` : name, i0: Math.round(St.quantile(ks, 0.05)), i1: Math.round(St.quantile(ks, 0.95)) });
    return out.sort((a, b) => a.i0 - b.i0);
  }

  NS.track = { buildReference, detectCorners, buildSegments, buildSectors, explicitCornerRanges, medianTrace };
})(typeof window !== 'undefined' ? window : globalThis);
