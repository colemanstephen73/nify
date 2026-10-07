/* ============================================================================
 * Stage 6: Mistake / off-track detection.
 * Every metric is compared with the driver's OWN distribution at that corner
 * (median + robust scale with physical floors), never a universal threshold.
 * Severity hierarchy:
 *   L0 normal variation (not recorded) · L1 minor imperfection ·
 *   L2 significant mistake · L3 major mistake · L4 compromised / off-track
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  // metric definitions: robust-scale floor, unit, evidence group
  const METRICS = {
    segTime: { floor: m => Math.max(0.02, 0.003 * m), unit: 's', group: 'time', label: 'Segment time' },
    brakePoint: { floor: () => 3, unit: 'm', group: 'brake', label: 'Brake point' },
    brakePeak: { floor: m => Math.max(1, 0.05 * m), unit: '', group: 'brake', label: 'Peak brake' },
    peakDecel: { floor: () => 0.05, unit: 'g', group: 'brake', label: 'Peak deceleration' },
    entrySpeed: { floor: () => 1.5, unit: 'km/h', group: 'speed', label: 'Turn-in speed' },
    minSpeed: { floor: () => 1.0, unit: 'km/h', group: 'speed', label: 'Minimum speed' },
    apexDist: { floor: () => 4, unit: 'm', group: 'line', label: 'Apex position' },
    pickup: { floor: () => 4, unit: 'm', group: 'throttle', label: 'Throttle pickup' },
    exitSpeed: { floor: () => 1.5, unit: 'km/h', group: 'speed', label: 'Exit speed' },
    latPeak: { floor: () => 0.04, unit: 'g', group: 'speed', label: 'Peak lateral g' },
    brakeRelease: { floor: () => 4, unit: 'm', group: 'brake', label: 'Brake release' },
  };

  /** Per-corner baseline distributions over analysable laps. */
  function baselines(features, laps, corners) {
    const base = corners.map(() => ({}));
    const ids = laps.filter(l => l.analysable).map(l => l.index);
    corners.forEach((c, ci) => {
      for (const key of Object.keys(METRICS).concat(['steerReversals', 'throttleLifts', 'brakeEvents', 'maxDev'])) {
        const vals = ids.map(id => features.get(id).corners[ci][key]).filter(Number.isFinite);
        if (vals.length < 3) continue;
        const med = St.median(vals);
        const def = METRICS[key];
        // apex position on long constant-radius corners is ill-defined → floor scales with arc length
        const floor = key === 'apexDist' ? Math.max(4, 0.15 * c.dist.curveEnd - 0.15 * c.dist.turnIn) : (def ? def.floor(Math.abs(med)) : 0);
        base[ci][key] = { med, scale: def ? St.robustScale(vals, floor) : NaN, n: vals.length, q25: St.quantile(vals, 0.25), q75: St.quantile(vals, 0.75) };
      }
    });
    return base;
  }

  function fmt(v, d = 1) { return (v > 0 ? '+' : '') + v.toFixed(d); }

  function detect(model) {
    const { laps, corners, features, G, avail, ref } = model;
    const base = baselines(features, laps, corners);
    // off-track threshold from X/Y deviation distribution
    let devThr = NaN, devP99 = NaN;
    if (avail.position) {
      const all = [];
      for (const l of laps) if (l.analysable && l.dev) for (let k = 0; k < l.dev.length; k += 2) if (Number.isFinite(l.dev[k])) all.push(l.dev[k]);
      devP99 = St.quantile(all, 0.99);
      devThr = Math.max(5, 2.5 * devP99);
    }
    const Z = 3.0;
    const incidents = [];
    for (const lap of laps) {
      if (!lap.analysable) continue;
      const F = features.get(lap.index);
      corners.forEach((c, ci) => {
        const f = F.corners[ci], b = base[ci];
        const z = k => (b[k] && Number.isFinite(f[k])) ? (f[k] - b[k].med) / b[k].scale : NaN;
        const ev = [];
        const tags = new Set();
        const add = (tag, group, z, text, metric) => { ev.push({ tag, group, z, text, metric }); tags.add(tag); };
        const loss = b.segTime ? f.segTime - b.segTime.med : 0;
        const lossZ = b.segTime ? loss / b.segTime.scale : 0;
        // off-track
        let off = null;
        if (f.trackLimit) {
          const iracing = /PlayerTrackSurface/.test(avail.trackLimit);
          off = { how: 'channel', conf: 'High', label: iracing ? 'Off-track' : 'Track-limit violation' };
          add('offtrack', 'track', 9, iracing ? `iRacing track surface reported OffTrack at ${(f.trackLimitIdx * G.ds).toFixed(0)} m` : `Track-limit channel "${avail.trackLimit}" active at ${(f.trackLimitIdx * G.ds).toFixed(0)} m`, 'trackLimit');
        }
        else if (Number.isFinite(devThr) && f.maxDev > devThr) {
          const strong = f.maxDev > 1.5 * devThr || loss > 0.2;
          off = { how: 'xy', conf: strong ? 'High' : 'Medium' };
          add('offtrack', 'line', f.maxDev / (devP99 || 1), `Trajectory ${f.maxDev.toFixed(1)} m from the reference line at ${(f.maxDevIdx * G.ds).toFixed(0)} m (off-track threshold ${devThr.toFixed(1)} m)`, 'maxDev');
        }
        // braking
        const zbp = z('brakePoint');
        if (zbp <= -Z) add('earlyBrake', 'brake', zbp, `Brake applied ${Math.abs(f.brakePoint - b.brakePoint.med).toFixed(0)} m earlier than session median (${b.brakePoint.med.toFixed(0)} m)`, 'brakePoint');
        if (zbp >= Z) add('lateBrake', 'brake', zbp, `Brake applied ${(f.brakePoint - b.brakePoint.med).toFixed(0)} m later than session median (${b.brakePoint.med.toFixed(0)} m)`, 'brakePoint');
        const zpk = z('brakePeak');
        let lockSig = false;
        if (zpk >= Z && f.brakePeak > 1.1 * b.brakePeak.med) {
          // pressure rose far more than deceleration did → braking beyond the tyre's limit
          const pr = f.brakePeak / b.brakePeak.med - 1;
          const dr = (b.peakDecel && Number.isFinite(f.peakDecel)) ? f.peakDecel / b.peakDecel.med - 1 : NaN;
          lockSig = Number.isFinite(dr) ? (pr > 0.25 && dr < 0.4 * pr) : false;
          const decTxt = Number.isFinite(f.peakDecel) && b.peakDecel ? `${(100 * (f.peakDecel / b.peakDecel.med - 1)).toFixed(0)}%` : 'marginally';
          add(lockSig ? 'lockup' : 'hardBrake', 'brake', zpk, `Peak brake ${f.brakePeak.toFixed(0)} vs typical ${b.brakePeak.med.toFixed(0)} (+${(100 * (f.brakePeak / b.brakePeak.med - 1)).toFixed(0)}%)` + (lockSig ? ` while deceleration rose only ${decTxt} (lock-up-like signature)` : ''), 'brakePeak');
        }
        if (b.brakeEvents && f.brakeEvents > Math.max(1, Math.round(b.brakeEvents.med))) add('multiBrake', 'brake', 4, `${f.brakeEvents} separate brake applications (typically ${Math.round(b.brakeEvents.med)})`, 'brakeEvents');
        // entry / apex
        const zen = z('entrySpeed');
        if (Math.abs(zen) >= Z) add(zen > 0 ? 'fastEntry' : 'slowEntry', 'speed', zen, `Turn-in speed ${fmt(f.entrySpeed - b.entrySpeed.med)} km/h vs median`, 'entrySpeed');
        const zmin = z('minSpeed');
        if (zmin <= -Z) add('lowMin', 'speed', zmin, `Minimum speed ${fmt(f.minSpeed - b.minSpeed.med)} km/h vs median (${b.minSpeed.med.toFixed(1)} km/h)`, 'minSpeed');
        const zap = z('apexDist');
        if (Math.abs(zap) >= Z && f.speedAtRefApex - f.minSpeed >= 2) add('apexShift', 'line', zap, `Apex (min speed) ${Math.abs(f.apexDist - b.apexDist.med).toFixed(0)} m ${zap > 0 ? 'later' : 'earlier'} than usual`, 'apexDist');
        if (b.steerReversals && f.steerReversals - b.steerReversals.med >= 2) add('steerCorr', 'steering', 3 + f.steerReversals - b.steerReversals.med, `${f.steerReversals} steering reversals (typically ${b.steerReversals.med.toFixed(0)})`, 'steerReversals');
        // exit
        const zpu = z('pickup');
        if (zpu >= Z) add('lateThrottle', 'throttle', zpu, `Throttle pickup ${(f.pickup - b.pickup.med).toFixed(0)} m later than median${Number.isFinite(f.minSpeed) ? ` (≈${((f.pickup - b.pickup.med) / Math.max(5, f.minSpeed / 3.6)).toFixed(2)} s)` : ''}`, 'pickup');
        if (b.throttleLifts !== undefined && f.throttleLifts > Math.round((b.throttleLifts || {}).med || 0) && f.liftDepth >= 25) add('lift', 'throttle', 4, `Throttle lift of ${f.liftDepth.toFixed(0)}% on exit`, 'throttleLifts');
        const zex = z('exitSpeed');
        if (zex <= -Z) add('poorExit', 'speed', zex, `Exit speed ${fmt(f.exitSpeed - b.exitSpeed.med)} km/h vs median (${b.exitSpeed.med.toFixed(1)} km/h)`, 'exitSpeed');
        // spin / major incident signature
        const spin = b.minSpeed && f.minSpeed < 0.6 * b.minSpeed.med;
        if (spin) add('spin', 'speed', 9, `Minimum speed ${f.minSpeed.toFixed(0)} km/h is ${(100 * f.minSpeed / b.minSpeed.med).toFixed(0)}% of typical — spin / major incident signature`, 'minSpeed');

        const lossSig = Math.max(0.05, 2 * (b.segTime ? b.segTime.scale : 0.02));
        const lossMajor = Math.max(0.30, 5 * (b.segTime ? b.segTime.scale : 0.02));
        if (!ev.length) {
          if (lossZ >= 4 && loss >= Math.max(0.15, lossSig)) add('unexplained', 'time', lossZ, `Segment ${loss.toFixed(2)} s slower than median with no single abnormal channel`, 'segTime');
          else return;
        }
        const countBased = ev.some(e => ['multiBrake', 'lift', 'steerCorr'].includes(e.tag));
        // L0 filter: no measurable loss and only marginal deviations → normal variation
        if (!off && !spin && loss <= Math.max(0.02, 0.5 * (b.segTime ? b.segTime.scale : 0.02)) && !countBased && Math.max(...ev.map(e => Math.abs(e.z))) < 5) return;
        if (!off && !spin && loss <= 0 && !countBased) return; // deviation that did not cost time (e.g. a later brake that worked)
        const groups = new Set(ev.filter(e => e.tag !== 'unexplained').map(e => e.group));
        let level;
        if (off) level = (off.how === 'channel' || loss >= 0.5) ? 4 : 3;
        else if (spin) level = 4;
        else if (loss >= lossMajor) level = 3;
        else if (loss >= lossSig) level = (groups.size >= 3 ? 3 : 2);
        else level = 1;
        let conf;
        if (off) conf = off.conf;
        else if (tags.has('unexplained')) conf = 'Low';
        else if (groups.size >= 2 && lossZ >= 2) conf = 'High';
        else if ((Math.max(...ev.map(e => Math.abs(e.z))) >= 4 && lossZ >= 1.5) || groups.size >= 2) conf = 'Medium';
        else conf = 'Low';
        const type = primaryType(tags, off);
        incidents.push({
          id: incidents.length, lap: lap.index, lapLabel: lap.label, corner: ci, cornerId: c.id, type: type.name, phase: type.phase,
          level, confidence: conf, loss: Math.max(0, loss), lossZ, evidence: ev.sort((a, b2) => Math.abs(b2.z) - Math.abs(a.z)),
          offTrack: !!off, offHow: off ? off.how : null, dist: (f.maxDevIdx && off ? f.maxDevIdx * G.ds : c.dist.apex),
          tags: Array.from(tags),
        });
      });
    }
    return { incidents, base, devThr, devP99 };
  }

  function primaryType(t, off) {
    if (off) return { name: off.label || 'Off-track', phase: 'Off-track' };
    if (t.has('spin')) return { name: 'Spin / major incident', phase: 'Apex' };
    if (t.has('lockup') && (t.has('lowMin') || t.has('apexShift') || t.has('lateBrake') || t.has('poorExit'))) return { name: 'Lock-up / overshoot', phase: 'Braking' };
    if (t.has('lateBrake') && (t.has('lowMin') || t.has('apexShift'))) return { name: 'Late braking / overshoot', phase: 'Braking' };
    if (t.has('earlyBrake')) return { name: 'Early braking', phase: 'Braking' };
    if (t.has('multiBrake')) return { name: 'Multiple brake applications', phase: 'Braking' };
    if (t.has('lockup')) return { name: 'Lock-up-like braking', phase: 'Braking' };
    if (t.has('lateThrottle')) return { name: 'Delayed throttle', phase: 'Exit' };
    if (t.has('lift')) return { name: 'Throttle lift on exit', phase: 'Exit' };
    if (t.has('steerCorr')) return { name: 'Steering corrections', phase: 'Apex' };
    if (t.has('lowMin')) return { name: 'Low minimum speed', phase: 'Apex' };
    if (t.has('poorExit')) return { name: 'Poor exit', phase: 'Exit' };
    if (t.has('fastEntry') || t.has('slowEntry')) return { name: t.has('fastEntry') ? 'Excess entry speed' : 'Low entry speed', phase: 'Entry' };
    if (t.has('apexShift')) return { name: 'Apex position deviation', phase: 'Apex' };
    if (t.has('hardBrake')) return { name: 'Excessive brake pressure', phase: 'Braking' };
    if (t.has('lateBrake')) return { name: 'Late braking', phase: 'Braking' };
    return { name: 'Unexplained time loss', phase: 'Segment' };
  }

  NS.mistakes = { detect, baselines, METRICS };
})(typeof window !== 'undefined' ? window : globalThis);
