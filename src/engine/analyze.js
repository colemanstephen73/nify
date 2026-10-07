/* ============================================================================
 * Pipeline orchestrator:
 *   RAW TSV → ingest → clean → laps → track/corners → features → mistakes →
 *   lap scoring → corner analysis → theoretical best → consistency → insights
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  function analyze(files) {
    const t0 = Date.now();
    const I = NS.ingest.buildSamples(files);
    const lapInfo = NS.laps.detectLaps(I);
    const G = NS.laps.resampleLaps(I, lapInfo);
    G.grid = G.grid; G.L = lapInfo.L;
    const laps = lapInfo.laps;
    const unavailable = [];
    // analysable = complete, no severe data problem, enough samples
    laps.forEach(l => { l.analysable = l.complete && !l.dqSevere && I.avail.time !== undefined; });
    const ana = laps.filter(l => l.analysable);
    // Reference model from analysable laps (robust median; mistakes do not dominate)
    const ref = NS.track.buildReference(ana.length ? ana : laps.filter(l => l.complete), G, I.avail);
    const explicit = NS.track.explicitCornerRanges(ana, G, I);
    const trackModel = ana.length >= 2 ? NS.track.detectCorners(ref, G, I.avail, explicit) : { corners: [], notes: ['Fewer than two analysable laps — corner model unavailable.'], inferred: true };
    const corners = trackModel.corners;
    const segs = NS.track.buildSegments(corners, ref, G);
    const sectors = NS.track.buildSectors(ana, segs, G, I);
    // lateral deviation (needs reference line)
    if (I.avail.position) for (const l of laps) if (l.complete) l.dev = NS.features.lateralDeviation(l, ref, G);
    const brakeThr = I.avail.brake ? Math.max(0.06 * St.quantile(St.finite(Array.from(ref.brake || [])), 0.99), 1) : NaN;
    const model = { I, laps, G, ref, corners, segs, sectors, avail: I.avail, brakeThr };
    model.features = NS.features.extract(model);
    const det = ana.length >= 3 ? NS.mistakes.detect(model) : { incidents: [], base: corners.map(() => ({})), devThr: NaN };
    model.incidents = det.incidents; model.base = det.base; model.devThr = det.devThr;
    NS.scoring.scoreLaps(model);
    model.theo = ana.length ? NS.scoring.theoretical(model) : null;
    model.cornerStats = NS.scoring.corners(model);
    model.sessionStats = ana.length ? NS.scoring.session(model) : null;
    const ins = model.sessionStats ? NS.insights.generate(model) : { insights: [], coaching: [], diffs: [] };
    model.insights = ins.insights; model.coaching = ins.coaching; model.diffs = ins.diffs;

    // availability report
    const need = {
      speed: 'Speed traces, apex/min-speed metrics, track speed colouring',
      throttle: 'Throttle pickup, exit hesitation and lift detection',
      brake: 'Brake point / pressure / multiple-application detection (falls back to longitudinal g)',
      steering: 'Steering-correction detection',
      gear: 'Gear trace', rpm: 'RPM trace',
      latG: 'Grip-utilisation pace benchmark (falls back to curvature × speed² if X/Y available)',
      lonG: 'Deceleration-based lock-up signature',
      position: 'Track map and X/Y off-track detection (distance-based track strip used instead)',
      trackLimit: 'Explicit track-limit validation (heuristic off-track detection used instead)',
      sector: 'Official sectors (3 inferred sectors used instead)',
      corner: 'Explicit corner metadata (corners inferred from telemetry instead)',
      lap: 'Explicit lap counter (laps inferred from distance resets / trajectory)',
    };
    for (const [k, v] of Object.entries(need)) if (!I.avail[k]) unavailable.push({ channel: k, impact: v });

    // data quality report
    const totalMalformed = I.files.reduce((s, f) => s + f.malformed.length, 0);
    const lt = laps.filter(l => l.complete).map(l => l.lapTime);
    const issues = [];
    if (totalMalformed) issues.push(`${totalMalformed} malformed row(s) skipped (preserved in the raw-data report).`);
    if (I.dq.exactDuplicates) issues.push(`${I.dq.exactDuplicates} exact duplicate timestamp row(s) removed.`);
    if (I.dq.conflictingDuplicates) issues.push(`${I.dq.conflictingDuplicates} duplicate timestamp(s) with conflicting values — first occurrence kept.`);
    if (I.dq.missingTime) issues.push(`${I.dq.missingTime} row(s) without a usable timestamp.`);
    if (I.dq.outOfOrder) issues.push(`${I.dq.outOfOrder} out-of-order timestamp(s) re-sorted.`);
    if (I.sampling.gaps.length) issues.push(`${I.sampling.gaps.length} logging gap(s) > ${Math.max(5 * I.sampling.medianDt, 0.25).toFixed(2)} s (largest ${St.max(I.sampling.gaps.map(g => g.dur)).toFixed(2)} s).`);
    if (I.sampling.inconsistent) issues.push('Sampling interval varies by more than 50% between P5 and P95.');
    laps.filter(l => !l.complete).forEach(l => issues.push(`${l.label}: incomplete — ${l.partialReason}.`));
    laps.filter(l => l.dq.length).forEach(l => l.dq.forEach(d => issues.push(`${l.label}: ${d.text}.`)));
    if (I.dq.filledValues) issues.push(`${I.dq.filledValues} isolated missing channel value(s) linearly interpolated for analysis (raw values untouched).`);
    I.notes.forEach(n => issues.push(n));
    const missingAll = Object.values(I.dq.missingPct);
    model.dqReport = {
      rows: I.dq.inputRows + totalMalformed, parsedRows: I.dq.inputRows, usedRows: I.dq.usedRows, columns: I.files.reduce((s, f) => s + f.columns, 0),
      files: I.files, laps: laps.length, completeLaps: laps.filter(l => l.complete).length, analysableLaps: ana.length,
      sessions: I.sessions.length, sampling: I.sampling, missingPct: I.dq.missingPct, missingOverall: missingAll.length ? St.mean(missingAll) : 0,
      lapTimeRange: lt.length ? [St.min(lt), St.max(lt)] : null, channels: I.avail, units: I.channelUnits, issues, unavailable,
      lapMethod: lapInfo.method, trackNotes: trackModel.notes, timeAbsolute: I.files.some(f => f.timeAbsolute),
      cornerSource: trackModel.inferred ? 'inferred' : 'explicit', curvatureSource: trackModel.curv ? trackModel.curv.source : (corners.length ? 'speed minima' : 'none'),
      devThr: det.devThr, brakeThr, gridStep: G.ds, lapLength: G.L,
    };
    model.elapsedMs = Date.now() - t0;
    model.version = '1.0.0';
    return model;
  }

  NS.analyze = analyze;
})(typeof window !== 'undefined' ? window : globalThis);
