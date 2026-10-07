/* ============================================================================
 * Robust statistics helpers shared by every analysis stage.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};

  const finite = a => { const o = []; for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i])) o.push(a[i]); return o; };
  const sorted = a => finite(a).sort((x, y) => x - y);
  function quantile(a, q) {
    const s = sorted(a);
    if (!s.length) return NaN;
    const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return s[lo] + (s[hi] - s[lo]) * (p - lo);
  }
  const median = a => quantile(a, 0.5);
  function mean(a) { const f = finite(a); return f.length ? f.reduce((s, v) => s + v, 0) / f.length : NaN; }
  function std(a) {
    const f = finite(a); if (f.length < 2) return NaN;
    const m = mean(f); return Math.sqrt(f.reduce((s, v) => s + (v - m) ** 2, 0) / (f.length - 1));
  }
  function mad(a) { const m = median(a); return median(finite(a).map(v => Math.abs(v - m))); }
  const iqr = a => quantile(a, 0.75) - quantile(a, 0.25);
  function min(a) { let m = Infinity; for (const v of a) if (v < m) m = v; return m; }
  function max(a) { let m = -Infinity; for (const v of a) if (v > m) m = v; return m; }
  function argmin(a, lo = 0, hi = a.length - 1) { let b = -1, m = Infinity; for (let i = lo; i <= hi; i++) if (a[i] < m) { m = a[i]; b = i; } return b; }
  function argmax(a, lo = 0, hi = a.length - 1) { let b = -1, m = -Infinity; for (let i = lo; i <= hi; i++) if (a[i] > m) { m = a[i]; b = i; } return b; }
  function mode(a) {
    const c = new Map(); let best = a[0], bc = 0;
    for (const v of a) { const k = (c.get(v) || 0) + 1; c.set(v, k); if (k > bc) { bc = k; best = v; } }
    return best;
  }
  /** Robust scale: 1.4826*MAD with a floor so near-identical data cannot create huge z-scores. */
  function robustScale(a, floor = 0) { const s = 1.4826 * mad(a); return Math.max(Number.isFinite(s) ? s : 0, floor); }
  function rank(a) {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const rr = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rr; i = j + 1;
    }
    return r;
  }
  function pearson(x, y) {
    const n = x.length; if (n < 3) return NaN;
    const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
  }
  function spearman(x, y) {
    const px = [], py = [];
    for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { px.push(x[i]); py.push(y[i]); }
    if (px.length < 5) return { rho: NaN, n: px.length };
    return { rho: pearson(rank(px), rank(py)), n: px.length };
  }
  function linreg(x, y) {
    const px = [], py = [];
    for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { px.push(x[i]); py.push(y[i]); }
    const n = px.length; if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN, n };
    const mx = mean(px), my = mean(py); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (px[i] - mx) * (py[i] - my); sxx += (px[i] - mx) ** 2; syy += (py[i] - my) ** 2; }
    const slope = sxx ? sxy / sxx : NaN;
    return { slope, intercept: my - slope * mx, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : NaN, n };
  }
  /** Theil-Sen slope: robust trend estimate. */
  function theilSen(x, y) {
    const sl = [];
    for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++)
      if (x[j] !== x[i] && Number.isFinite(y[i]) && Number.isFinite(y[j])) sl.push((y[j] - y[i]) / (x[j] - x[i]));
    const slope = median(sl);
    const intercept = median(x.map((xi, i) => y[i] - slope * xi));
    return { slope, intercept, n: x.length };
  }
  /** Moving average with edge shrinking, NaN aware. */
  function smooth(a, w) {
    const n = a.length, o = new Float64Array(n), h = Math.max(0, Math.floor(w / 2));
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) if (Number.isFinite(a[j])) { s += a[j]; c++; }
      o[i] = c ? s / c : NaN;
    }
    return o;
  }
  /** Circular moving average (closed lap signals). */
  function smoothCircular(a, w) {
    const n = a.length, o = new Float64Array(n), h = Math.max(0, Math.floor(w / 2));
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = i - h; j <= i + h; j++) { const v = a[((j % n) + n) % n]; if (Number.isFinite(v)) { s += v; c++; } }
      o[i] = c ? s / c : NaN;
    }
    return o;
  }
  /** Linear interpolation of y(x) at query points xq. x must be ascending. */
  function interp(xq, x, y, step) {
    const out = new Float64Array(xq.length);
    let j = 0;
    for (let i = 0; i < xq.length; i++) {
      const q = xq[i];
      if (q < x[0] || q > x[x.length - 1] || x.length < 2) { out[i] = NaN; continue; }
      while (j < x.length - 2 && x[j + 1] < q) j++;
      const x0 = x[j], x1 = x[j + 1];
      if (step) { out[i] = q >= x1 ? y[j + 1] : y[j]; continue; }
      out[i] = x1 === x0 ? y[j] : y[j] + (y[j + 1] - y[j]) * (q - x0) / (x1 - x0);
    }
    return out;
  }
  /** Fill NaN runs inside a session by linear interpolation (step for discrete channels). */
  function fillGapsLinear(a, session, step) {
    let filled = 0;
    const n = a.length;
    let i = 0;
    while (i < n) {
      if (!Number.isNaN(a[i])) { i++; continue; }
      let j = i; while (j < n && Number.isNaN(a[j])) j++;
      const L = i - 1, R = j;
      if (L >= 0 && R < n && session[L] === session[R] && j - i <= 50) {
        for (let k = i; k < j; k++) { a[k] = step ? a[L] : a[L] + (a[R] - a[L]) * (k - L) / (R - L); filled++; }
      }
      i = j;
    }
    return filled;
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  NS.stats = { finite, quantile, median, mean, std, mad, iqr, min, max, argmin, argmax, mode, robustScale, spearman, pearson, linreg, theilSen, smooth, smoothCircular, interp, fillGapsLinear, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
