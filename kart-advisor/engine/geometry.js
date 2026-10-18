// Track centreline → per-corner data and a "what the layout demands" summary.
// Input is a closed polyline in metres ([[x, y], ...]) in the direction of travel.
// Helpers convert OSM lat/lon or a traced screenshot (pixels) into metres first.

export const DEFAULTS = {
  step: 1,             // m, resample spacing
  smooth: 3,           // points each side for the moving-average smoother
  span: 4,             // points each side for the circumradius
  cornerRadius: 40,    // m, radius below which the track counts as turning
  mergeGap: 4,         // m, join same-direction pieces separated by less than this
  minAngle: 12,        // deg, ignore bends with less total turn than this
  tightRadius: 10,     // m, below this a corner is "tight"
  fastRadius: 25,      // m, at or above this a corner is "fast"
  kinkAngle: 35,       // deg, a bend turning less than this is a kink
  hairpinAngle: 150,   // deg
  chicaneGap: 12,      // m, opposite-direction corners closer than this form a chicane
  decreasingRatio: 0.65, // exit-half radius / entry-half radius below this = decreasing radius
  latG: 1.0,           // g, assumed kid kart lateral grip for speed estimates (inferred, see data)
};

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function fromLatLon(latlon) {
  const lat0 = latlon.reduce((s, p) => s + p[0], 0) / latlon.length;
  const R = 6371008.8, k = Math.PI / 180;
  const lon0 = latlon[0][1];
  return latlon.map(([lat, lon]) => [(lon - lon0) * k * R * Math.cos(lat0 * k), (lat - latlon[0][0]) * k * R]);
}

// Pixels → metres. Give either metresPerPixel (scale bar) or targetLengthM (published lap length).
// Image y grows downward, so it is flipped to keep left/right turns correct.
export function fromPixels(px, { metresPerPixel, targetLengthM }) {
  const flipped = px.map(([x, y]) => [x, -y]);
  let s = metresPerPixel;
  if (s == null) {
    if (!targetLengthM) throw new Error('need metresPerPixel or targetLengthM');
    s = targetLengthM / perimeter(flipped);
  }
  return flipped.map(([x, y]) => [x * s, y * s]);
}

export function perimeter(pts) {
  let L = 0;
  for (let i = 0; i < pts.length; i++) L += dist(pts[i], pts[(i + 1) % pts.length]);
  return L;
}

function stripClosingPoint(pts) {
  const a = pts[0], b = pts[pts.length - 1];
  return dist(a, b) < 1e-6 ? pts.slice(0, -1) : pts;
}

export function resample(ptsIn, step) {
  const pts = stripClosingPoint(ptsIn);
  const L = perimeter(pts), n = Math.max(8, Math.round(L / step)), ds = L / n;
  const out = [];
  let seg = 0, segStart = 0, segLen = dist(pts[0], pts[1 % pts.length]);
  for (let k = 0; k < n; k++) {
    const s = k * ds;
    while (s > segStart + segLen && seg < pts.length - 1) { segStart += segLen; seg++; segLen = dist(pts[seg], pts[(seg + 1) % pts.length]); }
    const a = pts[seg], b = pts[(seg + 1) % pts.length], t = segLen ? (s - segStart) / segLen : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { pts: out, ds, length: L };
}

function smoothClosed(pts, w) {
  if (!w) return pts;
  const n = pts.length;
  return pts.map((_, i) => {
    let x = 0, y = 0;
    for (let j = -w; j <= w; j++) { const p = pts[(i + j + n) % n]; x += p[0]; y += p[1]; }
    return [x / (2 * w + 1), y / (2 * w + 1)];
  });
}

// Signed curvature (1/m), positive = turning left (counter-clockwise).
function curvatures(pts, span) {
  const n = pts.length;
  return pts.map((b, i) => {
    const a = pts[(i - span + n) % n], c = pts[(i + span) % n];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d = dist(a, b) * dist(b, c) * dist(a, c);
    return d ? (2 * cross) / d : 0;
  });
}

// Heading change across [i0, i1] (indices, may wrap), degrees, signed.
function turnAngle(pts, i0, i1) {
  const n = pts.length;
  let total = 0;
  for (let i = i0; i !== i1; i = (i + 1) % n) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]), h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = h2 - h1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
  }
  return (total * 180) / Math.PI;
}

export function analyzeCentreline(ptsM, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const closureGapM = dist(ptsM[0], ptsM[ptsM.length - 1]);
  const { pts: raw, ds, length } = resample(ptsM, o.step);
  const pts = smoothClosed(raw, o.smooth);
  const k = curvatures(pts, o.span);
  const n = pts.length, thr = 1 / o.cornerRadius;
  const sign = k.map(v => (Math.abs(v) >= thr ? Math.sign(v) : 0));

  // Rotate so index 0 is on a straight (or the weakest-curvature point) to avoid wrap splits.
  let start = sign.findIndex(s => s === 0);
  if (start < 0) start = k.reduce((b, v, i) => (Math.abs(v) < Math.abs(k[b]) ? i : b), 0);

  // Runs of constant non-zero sign.
  let runs = [];
  for (let j = 0; j < n; j++) {
    const i = (start + j) % n, s = sign[i];
    const last = runs[runs.length - 1];
    if (s && last && last.s === s && last.endJ === j - 1) { last.endJ = j; continue; }
    if (s) runs.push({ s, startJ: j, endJ: j });
  }
  // Merge same-direction runs separated by a short gap.
  const gapPts = Math.round(o.mergeGap / ds);
  runs = runs.reduce((acc, r) => {
    const p = acc[acc.length - 1];
    if (p && p.s === r.s && r.startJ - p.endJ - 1 <= gapPts) p.endJ = r.endJ; else acc.push({ ...r });
    return acc;
  }, []);

  const idx = j => (start + j) % n;
  let corners = runs.map(r => {
    // Measure the heading change over a window widened by the smoothing/curvature reach,
    // otherwise gentle bends lose the part of their turn that sits below the threshold.
    const pad = o.span + o.smooth;
    const angle = turnAngle(pts, idx(r.startJ - pad + n), idx(r.endJ + pad + 1));
    let apexJ = r.startJ, kmax = 0, half = Math.floor((r.startJ + r.endJ) / 2), k1 = 0, k2 = 0;
    for (let j = r.startJ; j <= r.endJ; j++) {
      const v = Math.abs(k[idx(j)]);
      if (v > kmax) { kmax = v; apexJ = j; }
      if (j <= half) k1 = Math.max(k1, v); else k2 = Math.max(k2, v);
    }
    return { r, angle, apexJ, minRadius: 1 / kmax, entryRadius: 1 / k1, exitRadius: 1 / (k2 || k1) };
  }).filter(c => Math.abs(c.angle) >= o.minAngle);

  const sOf = j => ((start + j) % n) * ds;          // distance from the polyline's first point
  corners = corners.map((c, i, all) => {
    const prev = all[(i - 1 + all.length) % all.length];
    let straight = (c.r.startJ - prev.r.endJ - 1) * ds;
    if (all.length === 1) straight = (n - (c.r.endJ - c.r.startJ + 1)) * ds;
    if (straight < 0) straight += n * ds;
    const absA = Math.abs(c.angle);
    let type;
    if (absA >= o.hairpinAngle) type = 'hairpin';
    else if (absA < o.kinkAngle) type = 'kink';
    else if (c.minRadius >= o.fastRadius) type = 'sweeper';
    else if (c.exitRadius / c.entryRadius < o.decreasingRatio) type = 'decreasing_radius';
    else type = c.minRadius < o.tightRadius ? 'tight' : 'medium';
    const vMin = Math.sqrt(o.latG * 9.80665 * c.minRadius);
    return {
      number: i + 1,
      direction: c.angle > 0 ? 'left' : 'right',
      turnAngleDeg: Math.round(absA),
      minRadiusM: +c.minRadius.toFixed(1),
      entryM: +sOf(c.r.startJ).toFixed(1),
      apexM: +sOf(c.apexJ).toFixed(1),
      exitM: +sOf(c.r.endJ).toFixed(1),
      lengthM: +((c.r.endJ - c.r.startJ + 1) * ds).toFixed(1),
      precedingStraightM: +straight.toFixed(1),
      type,
      chicane: null,
      estMinSpeedMph: +(vMin * 2.23694).toFixed(1),
    };
  });

  // Chicanes: consecutive opposite-direction corners with a short link.
  let group = 0;
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1], b = corners[i];
    if (a.direction !== b.direction && b.precedingStraightM < o.chicaneGap && a.type !== 'hairpin' && b.type !== 'hairpin') {
      if (!a.chicane) a.chicane = ++group;
      b.chicane = a.chicane;
    }
  }

  const warnings = [];
  // A trace that doesn't come back to its start gets an artificial corner where it is closed.
  if (closureGapM > Math.max(5 * o.step, 0.02 * length)) warnings.push(`centreline is not closed (gap ${closureGapM.toFixed(1)} m): the corner at the join is not real`);
  return { lengthM: +length.toFixed(1), corners, demands: summarizeDemands(corners, length, o), warnings };
}

export function summarizeDemands(corners, lengthM, o = DEFAULTS) {
  const tight = corners.filter(c => c.minRadiusM < o.tightRadius || c.type === 'hairpin');
  const fast = corners.filter(c => c.minRadiusM >= o.fastRadius || c.type === 'kink');
  const cornerDist = corners.reduce((s, c) => s + c.lengthM, 0);
  const longest = corners.reduce((b, c) => (c.precedingStraightM > (b?.precedingStraightM ?? -1) ? c : b), null);
  const n = corners.length || 1;
  // +1 = all tight corners (rewards acceleration / shorter gearing); -1 = all fast (rewards rolling speed).
  const accelVsRolling = +((tight.length - fast.length) / n).toFixed(2);
  return {
    cornerCount: corners.length,
    tightCount: tight.length,
    fastCount: fast.length,
    hairpinCount: corners.filter(c => c.type === 'hairpin').length,
    tightDistanceShare: +(tight.reduce((s, c) => s + c.lengthM, 0) / lengthM).toFixed(2),
    cornerDistanceShare: +(cornerDist / lengthM).toFixed(2),
    longestStraightM: longest ? longest.precedingStraightM : 0,
    longestStraightBeforeCorner: longest ? longest.number : null,
    accelVsRolling,
    character: accelVsRolling > 0.25 ? 'acceleration' : accelVsRolling < -0.25 ? 'rolling_speed' : 'balanced',
  };
}
