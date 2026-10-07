/* ============================================================================
 * Stage 11: Engineering insights + coaching recommendations.
 * Every statement is generated from computed numbers; nothing is hard-coded.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  const DIFF_METRICS = {
    brakePoint: { label: 'brake point', unit: 'm', d: 0, better: 'later' },
    brakeRelease: { label: 'brake release point', unit: 'm', d: 0, better: 'later' },
    entrySpeed: { label: 'turn-in speed', unit: 'km/h', d: 1, better: 'higher' },
    minSpeed: { label: 'minimum speed', unit: 'km/h', d: 1, better: 'higher' },
    pickup: { label: 'throttle pickup point', unit: 'm', d: 0, better: 'earlier' },
    exitSpeed: { label: 'exit speed', unit: 'km/h', d: 1, better: 'higher' },
  };

  /** Which telemetry metric best explains lap-to-lap segment-time variation at a corner. */
  function differentiator(model, ci) {
    const { laps, features, incidents } = model;
    const rows = laps.filter(l => l.analysable && !incidents.some(i => i.lap === l.index && i.corner === ci && i.offTrack))
      .map(l => features.get(l.index).corners[ci]);
    const t = rows.map(r => r.segTime);
    let best = null;
    for (const k of Object.keys(DIFF_METRICS)) {
      const x = rows.map(r => r[k]);
      const { rho, n } = St.spearman(x, t);
      if (!(n >= 8) || !Number.isFinite(rho)) continue;
      const lr = St.linreg(x, t);
      const iqr = St.iqr(x);
      const eff = Math.abs(lr.slope * iqr);
      const cand = { metric: k, ...DIFF_METRICS[k], rho, n, iqr, q25: St.quantile(x, 0.25), q75: St.quantile(x, 0.75), slope: lr.slope, effect: eff, median: St.median(x) };
      if (!best || Math.abs(rho) > Math.abs(best.rho)) best = cand;
    }
    return best && Math.abs(best.rho) >= 0.45 ? best : null;
  }

  const f3 = v => v.toFixed(3);
  const f2 = v => v.toFixed(2);
  const lapTxt = (model, i) => i === null || i === undefined ? '—' : model.laps[i].label;

  function generate(model) {
    const { cornerStats, sessionStats: S, theo, laps, incidents } = model;
    const CL = cornerStats.list;
    const out = [];
    if (!CL.length || !Number.isFinite(S.best)) {
      out.push({ kind: 'data', title: 'Insufficient data for corner-level insights', text: 'At least three complete, analysable laps with a detectable corner model are required.' });
      return { insights: out, coaching: [], diffs: [] };
    }
    const diffs = CL.map(c => differentiator(model, c.index));
    const B = S.budget;
    // 1. Pace vs consistency diagnosis
    const repShare = B.inconsistencyPerLap > 0 ? B.repeatability / B.inconsistencyPerLap : NaN;
    out.push({
      kind: 'diagnosis', title: 'Consistency diagnosis',
      text: `Best lap ${fmtLap(S.best)} is ${f3(B.potential)} s off the theoretical best (${fmtLap(B.theoretical)}). The median clean lap is a further ${f3(B.repeatability)} s slower than the best lap, so a typical clean lap leaves ≈${f2(B.inconsistencyPerLap)} s on the table versus the driver's own best execution` +
        (Number.isFinite(B.lostPerLap) && B.lostPerLap > 0.005 ? `; flagged mistakes cost a further ${f2(B.lostPerLap)} s per lap on average.` : '.') +
        (Number.isFinite(repShare) ? ` ${repShare > 0.5 ? 'Most of this is lap-to-lap repeatability rather than a single-lap ceiling.' : 'Most of this is the gap between the best lap and the best-of-every-segment ceiling.'}` : ''),
      value: B.inconsistencyPerLap,
    });
    // 2. Primary weakness: largest repeatability gap
    const byRep = CL.slice().sort((a, b) => b.repeatGap - a.repeatGap);
    const w = byRep[0];
    const dw = diffs[w.index];
    out.push({
      kind: 'weakness', corner: w.index, title: `Primary weakness — ${w.id} ${dw ? dw.label + ' consistency' : 'repeatability'}`,
      text: `The driver loses a median ${f3(w.repeatGap)} s at ${w.id} versus their best execution (${f3(w.best)} s on ${lapTxt(model, w.bestLap)}; IQR ${f3(w.iqr)} s).` +
        (dw ? ` The strongest differentiator is ${dw.label} (Spearman ρ = ${dw.rho.toFixed(2)} with segment time, n = ${dw.n}), which varies by ${dw.iqr.toFixed(dw.d)} ${dw.unit} between the 25th and 75th percentile — worth ≈${f3(dw.effect)} s by linear fit.` : ' No single channel explains the variation (no metric with |ρ| ≥ 0.45), suggesting a combination of small differences.'),
      value: w.repeatGap,
    });
    // 3. Strongest corner: smallest spread
    const byIqr = CL.slice().sort((a, b) => b.consistency - a.consistency);
    const s = byIqr[0];
    out.push({
      kind: 'strength', corner: s.index, title: `Strongest corner — ${s.id}`,
      text: `${s.id} has the highest corner consistency score (${s.consistency.toFixed(0)}/100) with a ${f3(s.iqr)} s interquartile range and a ${f3(s.repeatGap)} s median gap to best.` +
        (Number.isFinite(s.dispersion.brakePoint) ? (s.dispersion.brakePoint < model.G.ds ? ` Brake point is repeatable to within the ${model.G.ds} m analysis grid.` : ` Brake point varies by only ${s.dispersion.brakePoint.toFixed(1)} m (robust σ).`) : ''),
      value: s.consistency,
    });
    // 4. Largest theoretical opportunity
    const dec = theo.decomposition.filter(d => d.seg !== undefined).slice().sort((a, b) => b.gain - a.gain);
    if (dec.length && dec[0].gain > 0.005) {
      const d = dec[0];
      const seg = model.segs[d.seg];
      const c = seg.corner !== null ? CL[seg.corner] : null;
      let why = '';
      if (c && c.why.length) why = ` On ${lapTxt(model, d.bestLapIdx)}: ${c.why.filter(x => x.good).slice(0, 3).map(x => x.text.toLowerCase()).join(', ') || c.why.slice(0, 2).map(x => x.text.toLowerCase()).join(', ')}.`;
      out.push({
        kind: 'opportunity', corner: seg.corner, title: `Largest single-lap opportunity — ${seg.id}`,
        text: `The best lap gives away ${f3(d.gain)} s in ${seg.label} compared with the driver's best segment (${f3(d.best)} s, ${lapTxt(model, d.bestLapIdx)}).${why}`,
        value: d.gain,
      });
    }
    // 5. Pace-limited corners
    const paceWeak = CL.filter(c => c.paceClass === 'Weak' || c.paceClass === 'Moderate').sort((a, b) => b.paceGap - a.paceGap);
    if (paceWeak.length && Number.isFinite(paceWeak[0].util)) {
      const p = paceWeak[0];
      out.push({
        kind: 'pace', corner: p.index, title: `Pace-limited — ${p.id}`,
        text: `${p.id} is ${p.consClass === 'Strong' ? 'consistent, but' : p.consClass === 'Moderate' ? 'moderately consistent, and' : 'also inconsistent, and'} even the driver's best laps use only ${(100 * p.util).toFixed(0)}% of the lateral grip they demonstrate elsewhere at similar apex speed (${model.cornerStats.envelope.at(p.vApex).toFixed(2)} g envelope at ${p.vApex.toFixed(0)} km/h). Estimated pace gap ≈${f3(p.paceGap)} s per lap (inferred benchmark).`,
        value: p.paceGap,
      });
    }
    // 5b. Racing line (GPS): strongest line-vs-time relationship across corners
    const lineC = CL.filter(c => c.line && c.line.finding.strong).sort((a, b) => b.line.metrics[b.line.finding.metric].effect - a.line.metrics[a.line.finding.metric].effect);
    if (lineC.length) {
      const c = lineC[0];
      out.push({ kind: 'opportunity', corner: c.index, title: `Racing line — ${c.id}`, text: c.line.finding.text, value: c.line.metrics[c.line.finding.metric].effect });
    } else if (CL.some(c => c.line)) {
      const sp = CL.filter(c => c.line).sort((a, b) => b.line.spreadApex - a.line.spreadApex)[0];
      out.push({ kind: 'diagnosis', corner: sp.index, title: 'Racing line — not the main differentiator', text: `Across all corners, no racing-line measure from GPS correlates significantly with corner time (Spearman, corrected for 7 measures per corner), so time differences come from braking, speed and throttle rather than line choice. The least repeatable line is at ${sp.id} (apex placement ±${sp.line.spreadApex.toFixed(1)} m).` });
    }
    // 6. Mistake hotspot
    const sig = incidents.filter(i => i.level >= 2);
    if (sig.length) {
      const byC = new Map(); sig.forEach(i => byC.set(i.corner, (byC.get(i.corner) || []).concat(i)));
      const [hc, list] = Array.from(byC.entries()).sort((a, b) => b[1].length - a[1].length || b[1].reduce((s, i) => s + i.loss, 0) - a[1].reduce((s, i) => s + i.loss, 0))[0];
      const total = list.reduce((s, i) => s + i.loss, 0);
      out.push({
        kind: 'mistakes', corner: hc, title: `Mistake hotspot — ${CL[hc].id}`,
        text: `${list.length} significant-or-worse incident${list.length > 1 ? 's' : ''} at ${CL[hc].id} (${list.map(i => `${laps[i.lap].label} ${i.type.toLowerCase()}`).join('; ')}), costing ${f2(total)} s in total. Session-wide: ${sig.length} incidents at level ≥ 2 across ${S.counts.analysable} analysable laps.`,
        value: total,
      });
    }
    // 7. Off-tracks
    const offs = incidents.filter(i => i.offTrack);
    if (offs.length) {
      out.push({
        kind: 'mistakes', corner: offs[0].corner, lap: offs[0].lap, title: `${offs.length} off-track excursion${offs.length > 1 ? 's' : ''}`,
        text: offs.map(i => `${laps[i.lap].label} at ${CL[i.corner].id} (${i.evidence[0].text.split(' (')[0].toLowerCase()}, ${f2(i.loss)} s lost, ${i.confidence.toLowerCase()} confidence)`).join('; ') + '. These laps are excluded from clean pace and their affected segments from the theoretical best.',
      });
    }
    // 8. Session trend
    if (S.trend && Number.isFinite(S.trend.slope)) {
      const per10 = S.trend.slope * 10;
      const h = S.halfStats;
      out.push({
        kind: 'trend', title: `Session evolution — ${Math.abs(per10) < 0.05 ? 'stable pace' : per10 < 0 ? 'improving' : 'fading'}`,
        text: `Clean-lap trend ${per10 >= 0 ? '+' : ''}${f3(per10)} s per 10 laps (Theil–Sen, robust)${S.stints.filter(t => t.clean >= 3).length > 1 ? ' — by stint: ' + S.stints.filter(t => t.clean >= 3).map((t, j) => `stint ${j + 1} best ${fmtLap(t.best)} / median ${fmtLap(t.median)}${Number.isFinite(t.trend) ? ` (${t.trend * 10 >= 0 ? '+' : ''}${f3(t.trend * 10)} s/10 laps)` : ''}`).join(', ') : ''}. First half: median clean ${fmtLap(h[0].medianClean)}, ${f2(h[0].mistakeRate)} significant incidents/lap; second half: ${fmtLap(h[1].medianClean)}, ${f2(h[1].mistakeRate)}/lap.`,
        value: per10,
      });
    }
    // ---------------- coaching ----------------
    const coaching = [];
    const ranked = CL.slice().sort((a, b) => b.opportunity - a.opportunity);
    for (const c of ranked) {
      if (coaching.length >= 5) break;
      if (!(c.opportunity >= 0.015)) continue;
      const d = diffs[c.index];
      let title, problem, evidence, objective;
      const impact = c.opportunity;
      if (c.offTracks >= 1) {
        const offList = incidents.filter(i => i.corner === c.index && i.offTrack);
        title = `${c.id} — Exit control / track limits`;
        problem = `${c.offTracks} off-track excursion${c.offTracks > 1 ? 's' : ''} at ${c.id}.`;
        evidence = `${offList.map(i => laps[i.lap].label).join(', ')}; ${f2(offList.reduce((s, i) => s + i.loss, 0))} s lost in total. ${c.why.length ? 'Best execution: ' + c.why.slice(0, 2).map(x => x.text.toLowerCase()).join(', ') + '.' : ''}`;
        objective = `Reduce entry commitment by a small margin until the exit is repeatable; target the best-lap exit speed (${Number.isFinite(c.bestExit.v) ? c.bestExit.v.toFixed(0) : '—'} km/h) without running wide.`;
      } else if (d && d.metric === 'brakePoint') {
        title = `${c.id} — Stabilise the braking reference`;
        problem = `Brake point is inconsistent and drives segment time.`;
        evidence = `Brake point P25–P75 spans ${d.q25.toFixed(0)}–${d.q75.toFixed(0)} m (${d.iqr.toFixed(0)} m); ρ = ${d.rho.toFixed(2)} with segment time; median gap to best ${f3(c.repeatGap)} s.`;
        objective = `Commit to one repeatable brake marker around ${c.typicalBrake.toFixed(0)} m before attempting a later point (best clean: ${Number.isFinite(c.latestBrake.v) ? c.latestBrake.v.toFixed(0) : '—'} m).`;
      } else if (d && d.metric === 'brakeRelease') {
        title = `${c.id} — Stabilise brake release`;
        problem = `Brake release point varies lap to lap.`;
        evidence = `Release P25–P75 spans ${d.iqr.toFixed(0)} m; ρ = ${d.rho.toFixed(2)} with segment time; ≈${f3(d.effect)} s effect across the IQR.`;
        objective = `Target a repeatable release point; trail off progressively to the apex rather than releasing early.`;
      } else if (d && d.metric === 'pickup') {
        title = `${c.id} — Earlier, committed throttle pickup`;
        problem = `Throttle pickup point varies and costs exit speed.`;
        evidence = `Pickup P25–P75 spans ${d.iqr.toFixed(0)} m (ρ = ${d.rho.toFixed(2)}); best clean pickup at ${Number.isFinite(c.bestPickup.v) ? c.bestPickup.v.toFixed(0) : '—'} m vs median ${Number.isFinite(c.typicalPickup) ? c.typicalPickup.toFixed(0) : '—'} m.`;
        objective = `Rotate the car earlier so throttle can be applied at a consistent point; aim for the ${lapTxt(model, c.bestPickup.lap)} pickup reference.`;
      } else if (d && (d.metric === 'minSpeed' || d.metric === 'entrySpeed')) {
        title = `${c.id} — Carry more ${d.metric === 'minSpeed' ? 'minimum' : 'entry'} speed`;
        problem = `${d.label[0].toUpperCase() + d.label.slice(1)} varies and is the main driver of segment time.`;
        evidence = `${d.label} P25–P75 ${d.q25.toFixed(1)}–${d.q75.toFixed(1)} km/h (ρ = ${d.rho.toFixed(2)}); best clean ${d.metric === 'minSpeed' ? c.bestMin.v.toFixed(1) : c.bestEntry.v.toFixed(1)} km/h.`;
        objective = `Target the best-lap ${d.label} consistently; work on brake release to let the car roll more speed to the apex.`;
      } else if (d && d.metric === 'exitSpeed') {
        title = `${c.id} — Prioritise exit speed`;
        problem = `Exit speed varies and carries down the following straight.`;
        evidence = `Exit speed P25–P75 ${d.q25.toFixed(1)}–${d.q75.toFixed(1)} km/h (ρ = ${d.rho.toFixed(2)}); best ${c.bestExit.v.toFixed(1)} km/h.`;
        objective = `Sacrifice a little entry speed if needed to straighten the exit and reach full throttle earlier.`;
      } else if (c.line && c.line.finding.strong && c.line.metrics[c.line.finding.metric].effect >= Math.max(0.02, d ? d.effect * 0.8 : 0)) {
        const lm = c.line.metrics[c.line.finding.metric];
        const better = lm.rho < 0 ? lm.higher : lm.lower;
        title = `${c.id} — Racing line: ${lm.label}`;
        problem = `Line choice through ${c.id} varies, and the faster laps share a pattern.`;
        evidence = c.line.finding.text;
        objective = `Aim for ${better}; use the best lap's line (${lm.label} ${Number.isFinite(lm.best) ? lm.best.toFixed(lm.d) + ' ' + lm.unit : '—'} vs median ${lm.med.toFixed(lm.d)} ${lm.unit}) as the reference.`;
      } else if (c.paceClass === 'Weak' || (c.paceClass === 'Moderate' && c.consClass === 'Strong')) {
        title = `${c.id} — Explore more cornering speed`;
        problem = `Consistent but under-driven: grip utilisation ${(100 * c.util).toFixed(0)}% of the session envelope.`;
        evidence = `Best minimum speed ${c.bestMin.v.toFixed(1)} km/h; estimated pace gap ${f3(c.paceGap)} s (inferred benchmark).`;
        objective = `Build minimum speed in small steps (1–2 km/h per run) while keeping the current repeatability.`;
      } else {
        const disp = c.dispersion;
        title = `${c.id} — Reduce lap-to-lap variation`;
        problem = `Segment time spread (IQR ${f3(c.iqr)} s) without a single dominant cause.`;
        evidence = `Robust σ: brake point ${fmtN(disp.brakePoint, 1)} m, min speed ${fmtN(disp.minSpeed, 1)} km/h, pickup ${fmtN(disp.pickup, 1)} m.`;
        objective = `Fix references (brake marker, turn-in point) and repeat the ${lapTxt(model, c.bestLap)} execution.`;
      }
      coaching.push({ corner: c.index, id: c.id, title, problem, evidence, impact, objective, priority: c.priority });
    }
    return { insights: out, coaching, diffs };
  }

  function fmtN(v, d) { return Number.isFinite(v) ? v.toFixed(d) : '—'; }
  function fmtLap(t) {
    if (!Number.isFinite(t)) return '—';
    const m = Math.floor(t / 60); const s = t - 60 * m;
    return m ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
  }

  NS.insights = { generate, differentiator, fmtLap };
})(typeof window !== 'undefined' ? window : globalThis);
