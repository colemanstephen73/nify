/* ============================================================================
 * Stage 1-2: Data ingestion + validation/cleaning
 *   parseDelimited  -> structure detection (delimiter, header, units row,
 *                      malformed rows, missing values) on the raw text
 *   detectColumns   -> numeric vs categorical typing, semantic role mapping,
 *                      unit detection/normalisation
 *   buildSamples    -> merged, session-aware, time-ordered columnar table with
 *                      duplicate-timestamp handling and sampling statistics
 * Raw text lines are preserved so any sample can be traced back to its source.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};
  const St = NS.stats;

  const MISSING = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '-', '--', '#n/a', '?', 'undefined', 'inf', '-inf']);

  function splitLines(text) {
    return text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  }

  function detectDelimiter(lines) {
    const cands = ['\t', ',', ';', '|'];
    let best = '\t', bestScore = -1;
    const sample = lines.filter(l => l.trim() && !/^\s*#/.test(l)).slice(0, 60);
    for (const d of cands) {
      const counts = sample.map(l => l.split(d).length - 1);
      const nz = counts.filter(c => c > 0);
      if (!nz.length) continue;
      const mode = St.mode(nz);
      const agree = counts.filter(c => c === mode).length / counts.length;
      const score = agree * Math.log(1 + mode) * (d === '\t' ? 1.15 : 1); // TSV is the expected format
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function looksNumeric(tok) {
    if (tok === undefined) return false;
    const t = tok.trim();
    if (!t) return false;
    return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) || /^[-+]?\d+,\d+$/.test(t) ||
      /^\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?$/.test(t);
  }

  /** Parse raw delimited text into a header + string rows, recording every defect. */
  function parseDelimited(text, sourceName) {
    const lines = splitLines(text);
    const delimiter = detectDelimiter(lines);
    const comments = [];
    const meta = [];
    // header search: first row whose field count matches the dominant row width
    const widths = [];
    for (let i = 0; i < Math.min(lines.length, 400); i++) {
      const l = lines[i];
      if (!l.trim() || /^\s*#/.test(l)) continue;
      widths.push(l.split(delimiter).length);
    }
    const dominant = St.mode(widths);
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 400); i++) {
      const l = lines[i];
      if (!l.trim()) continue;
      if (/^\s*#/.test(l)) { comments.push({ line: i + 1, text: l }); continue; }
      const f = l.split(delimiter);
      if (f.length !== dominant) { meta.push({ line: i + 1, text: l }); continue; }
      const numericShare = f.filter(looksNumeric).length / f.length;
      if (numericShare < 0.5) { headerIdx = i; break; }
      // numeric row first: no header present
      headerIdx = -2; break;
    }
    let names, unitsRow = null, dataStart;
    if (headerIdx >= 0) {
      names = lines[headerIdx].split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));
      dataStart = headerIdx + 1;
      // optional units row (e.g. MoTeC / AiM exports)
      for (let j = dataStart; j < Math.min(lines.length, dataStart + 5); j++) {
        const l = lines[j];
        if (!l.trim() || /^\s*#/.test(l)) continue;
        const f = l.split(delimiter);
        if (f.length === names.length && f.filter(looksNumeric).length / f.length < 0.3) {
          unitsRow = f.map(s => s.trim().replace(/^"|"$/g, ''));
          dataStart = j + 1;
        }
        break;
      }
    } else {
      names = Array.from({ length: dominant }, (_, i) => `col${i + 1}`);
      dataStart = 0;
    }
    const ncol = names.length;
    const rows = [];
    const rowLine = [];
    const malformed = [];
    let blank = 0;
    for (let i = dataStart; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) { blank++; continue; }
      if (/^\s*#/.test(l)) { comments.push({ line: i + 1, text: l }); continue; }
      let f = l.split(delimiter);
      if (f.length > ncol && f.slice(ncol).every(x => !x.trim())) f = f.slice(0, ncol);
      if (f.length !== ncol) {
        malformed.push({ line: i + 1, fields: f.length, expected: ncol, text: l.length > 160 ? l.slice(0, 160) + '…' : l });
        continue;
      }
      // a repeated header line inside the data block
      if (headerIdx >= 0 && f[0].trim() === names[0] && f.filter(looksNumeric).length === 0) {
        malformed.push({ line: i + 1, fields: f.length, expected: ncol, text: '(repeated header)' });
        continue;
      }
      rows.push(f);
      rowLine.push(i + 1);
    }
    return {
      source: sourceName, delimiter, headerFound: headerIdx >= 0, headerLine: headerIdx + 1,
      names, unitsRow, rows, rowLine, malformed, comments, meta, blankLines: blank, totalLines: lines.length,
      rawLines: lines,
    };
  }

  // --------------------------------------------------------------------------
  // Column typing and semantic role detection
  // --------------------------------------------------------------------------
  function splitNameUnit(name, unitsRowVal) {
    let unit = '';
    let base = name;
    const m = name.match(/^(.*?)[\s_]*[[(]([^\])]*)[\])]\s*$/);
    if (m) { base = m[1]; unit = m[2]; }
    if (!unit && unitsRowVal) unit = unitsRowVal;
    return { base: base.trim(), unit: unit.trim() };
  }

  function norm(s) { return s.toLowerCase().replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  // order matters: first match wins for a role; a column can only take one role
  const ROLE_PATTERNS = [
    ['lapTime', /^(lap ?time|laptime|last ?lap( time)?|lap duration)$/],
    ['lap', /^(lap|laps|lap ?(number|no|num|nr|#|count|index|id)|lapnumber|lapcount|current lap|lap n)$/],
    ['session', /^(session|session ?id|run|run ?id|outing|stint|file)$/],
    ['timestamp', /^(timestamp|date ?time|utc|utc ?time|clock|time ?of ?day|gps ?time|unix ?time|epoch)$/],
    ['time', /^(time|t|elapsed|elapsed ?time|session ?time|time ?s|time ?sec|time ?ms|running ?time|sample ?time|log ?time)$/],
    ['lapDistance', /^(lap ?dist(ance)?|distance ?lap|dist ?lap|lapdist|track ?pos(ition)?|s lap)$/],
    ['distance', /^(dist|distance|odometer|odo|total ?distance|cum ?distance|distance ?travelled|s)$/],
    ['speed', /^(speed|v|vel|velocity|vcar|v car|ground ?speed|gps ?speed|vehicle ?speed|car ?speed|speed ?kph|speed ?kmh|speed ?mph|kph|mph|corr ?speed)$/],
    ['throttle', /^(throttle|thr|tps|throttle ?pos(ition)?|throttle ?pedal|pedal ?pos|accel(erator)? ?pedal|gas|ath|ppos|aps|throttle ?%)$/],
    ['brake', /^(brake|brk|brake ?press(ure)?|brake ?pedal|brake ?pos(ition)?|pbrake|p brake|brake ?f|brake ?front|bps|brake ?%)$/],
    ['steering', /^(steer|steering|steering ?angle|steer ?angle|swa|steering ?wheel ?angle|wheel ?angle)$/],
    ['gear', /^(gear|ngear|n gear|gear ?pos(ition)?|current ?gear)$/],
    ['rpm', /^(rpm|engine ?rpm|engine ?speed|nmot|revs|n mot)$/],
    ['latG', /^(lat ?acc(el(eration)?)?|lateral ?acc(el(eration)?)?|lateral ?g|lat ?g|g ?lat|ay|acc ?y|accel ?y|g y|gy|a y|lateral)$/],
    ['lonG', /^(lon ?acc(el(eration)?)?|long ?acc(el(eration)?)?|longitudinal ?acc(el(eration)?)?|longitudinal ?g|long ?g|lon ?g|g ?long|g ?lon|ax|acc ?x|accel ?x|g x|gx|a x|inline ?acc|longitudinal)$/],
    ['gpsLat', /^(lat|latitude|gps ?lat(itude)?|pos ?lat)$/],
    ['gpsLon', /^(lon|lng|long|longitude|gps ?lon(gitude)?|gps ?long|pos ?lon)$/],
    ['x', /^(x|pos ?x|posx|position ?x|world ?x|car ?x|coord ?x|x ?pos(ition)?)$/],
    ['y', /^(y|pos ?y|posy|position ?y|world ?y|car ?y|coord ?y|y ?pos(ition)?)$/],
    ['sector', /^(sector|sector ?(number|no|idx|index|id)|split)$/],
    ['corner', /^(corner|turn|corner ?(id|name|number)|turn ?(id|name|number))$/],
    ['trackLimit', /^(track ?limits?|off ?track|offtrack|track ?limit ?(flag|violation)|tl ?flag|out ?of ?bounds|lap ?invalid|invalid|wheels ?off|cut)$/],
    ['position', /^(race ?position|position|pos|place|p)$/],
    ['tyre', /tyre|tire/],
    ['fuel', /fuel/],
  ];

  function parseClock(tok) {
    // mm:ss.sss or hh:mm:ss.sss -> seconds
    const p = tok.trim().replace(',', '.').split(':').map(Number);
    if (p.some(Number.isNaN)) return NaN;
    return p.reduce((acc, v) => acc * 60 + v, 0);
  }

  function parseCell(tok, decimalComma) {
    if (tok === undefined) return { v: NaN, missing: true };
    let t = tok.trim().replace(/^"|"$/g, '');
    if (MISSING.has(t.toLowerCase())) return { v: NaN, missing: true };
    if (decimalComma) t = t.replace(',', '.');
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return { v: +t, missing: false };
    if (/^\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?$/.test(t)) return { v: parseClock(t), missing: false, clock: true };
    if (/^(true|yes|on)$/i.test(t)) return { v: 1, missing: false, bool: true };
    if (/^(false|no|off)$/i.test(t)) return { v: 0, missing: false, bool: true };
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(t)) {
      const ms = Date.parse(t.replace(' ', 'T'));
      if (!Number.isNaN(ms)) return { v: ms / 1000, missing: false, iso: true };
    }
    return { v: NaN, missing: false, text: t };
  }

  /** Type every column, detect its semantic role and normalise its unit. */
  function detectColumns(parsed) {
    const { names, unitsRow, rows, delimiter } = parsed;
    const decimalComma = delimiter === ';' &&
      rows.slice(0, 50).some(r => r.some(c => /^[-+]?\d+,\d+$/.test(c.trim())));
    const cols = names.map((name, ci) => {
      const { base, unit } = splitNameUnit(name, unitsRow ? unitsRow[ci] : '');
      const values = new Float64Array(rows.length);
      const text = [];
      let missing = 0, numeric = 0, nonNumeric = 0, clock = 0, iso = 0;
      for (let r = 0; r < rows.length; r++) {
        const p = parseCell(rows[r][ci], decimalComma);
        values[r] = p.v;
        if (p.missing) missing++;
        else if (Number.isNaN(p.v)) { nonNumeric++; if (text.length < 2000) text.push(p.text); }
        else { numeric++; if (p.clock) clock++; if (p.iso) iso++; }
      }
      const present = rows.length - missing;
      const isNumeric = present > 0 && numeric / present >= 0.9;
      // non-numeric tokens in an otherwise numeric column become missing (counted)
      return {
        index: ci, name, base, unit, key: norm(base), values, missing, nonNumeric,
        type: isNumeric ? 'numeric' : (present ? 'categorical' : 'empty'),
        categories: isNumeric ? null : Array.from(new Set(text)).slice(0, 50),
        rawStrings: isNumeric ? null : rows.map(r => (r[ci] || '').trim()),
        clockFormat: clock > numeric * 0.5, isoFormat: iso > numeric * 0.5, role: null,
      };
    });
    // role assignment
    const roles = {};
    for (const [role, re] of ROLE_PATTERNS) {
      for (const c of cols) {
        if (c.role || roles[role]) continue;
        const k = c.key.replace(/\b(m|s|ms|kmh|kph|deg|bar|psi|pct|g)$/, '').trim();
        if (re.test(c.key) || re.test(k)) {
          if (['session', 'corner'].includes(role) || c.type === 'numeric' || (role === 'trackLimit' && c.type === 'categorical')) {
            c.role = role; roles[role] = c;
          }
        }
      }
    }
    // looser fallback matching for core channels
    const loose = [
      ['speed', /speed|velocity|kph|km ?h|mph/, /wheel|whl|fl|fr|rl|rr|shaft|engine|fan|wind/],
      ['throttle', /throttle|tps|accel.*pedal|pedal.*accel/, /target|map/],
      ['brake', /brake/, /temp|bias|balance|wear|disc|bal/],
      ['steering', /steer/, /rate|torque|ratio/],
      ['rpm', /rpm|engine speed/, /target|limit/],
      ['latG', /lat.*(acc|g\b)|lateral/, /gps/],
      ['lonG', /(lon|long).*(acc|g\b)|longitudinal/, /gps|itude/],
      ['gear', /gear/, /ratio|box temp/],
      ['time', /\btime\b/, /lap ?time|best|delta|predict|split|sector/],
      ['distance', /dist/, /delta|to /],
    ];
    for (const [role, re, excl] of loose) {
      if (roles[role]) continue;
      const c = cols.find(c => !c.role && c.type === 'numeric' && re.test(c.key) && !excl.test(c.key));
      if (c) { c.role = role; roles[role] = c; }
    }
    return { cols, roles, decimalComma };
  }

  // --------------------------------------------------------------------------
  // Unit normalisation helpers (internal units: s, m, m/s, %, g, deg)
  // --------------------------------------------------------------------------
  function unitInfo(col) { return (col && col.unit || '').toLowerCase().replace(/\s/g, ''); }

  function normaliseTime(col, notes) {
    const v = col.values;
    const u = unitInfo(col);
    const fin = St.finite(v);
    let scale = 1, absolute = false;
    if (/^ms|msec|millis/.test(u) || /\bms\b/.test(col.key)) scale = 0.001;
    else if (/^us|µs|micro/.test(u)) scale = 1e-6;
    else if (!u && fin.length > 10) {
      const dts = [];
      for (let i = 1; i < Math.min(v.length, 2000); i++) { const d = v[i] - v[i - 1]; if (d > 0) dts.push(d); }
      const md = St.median(dts);
      if (md >= 4 && md <= 2000 && St.max(fin) > 1e4) { scale = 0.001; notes.push(`Time column "${col.name}" interpreted as milliseconds (median step ${md.toFixed(1)}).`); }
    }
    const out = new Float64Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] * scale;
    const t0 = St.min(St.finite(out));
    if (col.isoFormat || t0 > 1e8) absolute = true;
    return { values: out, absolute, scale };
  }

  function speedFactorToMs(col, distCol, timeVals, notes) {
    const u = unitInfo(col);
    if (/km\/?h|kph|kmh/.test(u) || /kph|kmh|km h/.test(col.key)) return { f: 1 / 3.6, unit: 'km/h', how: 'header unit' };
    if (/mph/.test(u) || /mph/.test(col.key)) return { f: 0.44704, unit: 'mph', how: 'header unit' };
    if (/m\/?s/.test(u)) return { f: 1, unit: 'm/s', how: 'header unit' };
    // infer from distance/time consistency
    if (distCol && timeVals) {
      const d = distCol.values, v = col.values, ratios = [];
      for (let i = 1; i < d.length; i += 3) {
        const dt = timeVals[i] - timeVals[i - 1], dd = d[i] - d[i - 1];
        if (dt > 0 && dt < 1 && dd > 0 && v[i] > 5) ratios.push((dd / dt) / v[i]);
      }
      if (ratios.length > 50) {
        const r = St.median(ratios);
        const opts = [[1, 'm/s'], [1 / 3.6, 'km/h'], [0.44704, 'mph']];
        let best = opts[0];
        for (const o of opts) if (Math.abs(Math.log(r / o[0])) < Math.abs(Math.log(r / best[0]))) best = o;
        notes.push(`Speed unit inferred as ${best[1]} from distance/time consistency (ratio ${r.toFixed(3)}).`);
        return { f: best[0], unit: best[1], how: 'distance/time consistency' };
      }
    }
    const p95 = St.quantile(St.finite(col.values), 0.95);
    const g = p95 > 90 ? [1 / 3.6, 'km/h'] : [1, 'm/s'];
    notes.push(`Speed unit assumed ${g[1]} from magnitude (p95 = ${p95.toFixed(1)}).`);
    return { f: g[0], unit: g[1], how: 'magnitude heuristic' };
  }

  function pctScale(col) {
    const p99 = St.quantile(St.finite(col.values).map(Math.abs), 0.99);
    return p99 <= 1.05 ? 100 : 1;
  }

  function gScale(col) {
    const u = unitInfo(col);
    if (/m\/?s(2|²|\^2)/.test(u)) return 1 / 9.80665;
    const p99 = St.quantile(St.finite(col.values).map(Math.abs), 0.995);
    return p99 > 6 ? 1 / 9.80665 : 1;
  }

  // --------------------------------------------------------------------------
  // Merge all files into one session-aware, time-ordered sample table
  // --------------------------------------------------------------------------
  const CHANNELS = ['speed', 'throttle', 'brake', 'steering', 'gear', 'rpm', 'latG', 'lonG'];

  function buildSamples(files) {
    const notes = [];
    const per = [];
    let sessionCounter = 0;
    for (const f of files) {
      const parsed = parseDelimited(f.text, f.name);
      const det = detectColumns(parsed);
      per.push({ parsed, det });
    }
    // union of roles; each file is mapped independently
    const avail = {};
    const out = { session: [], fileIdx: [], line: [], lap: [], t: [], dist: [], x: [], y: [], sector: [], trackLimit: [], corner: [], lapTimeCol: [] };
    for (const c of CHANNELS) out[c] = [];
    const channelUnits = {};
    const fileReports = [];
    per.forEach(({ parsed, det }, fi) => {
      const R = det.roles;
      const n = parsed.rows.length;
      const fnotes = [];
      // ---- time
      let tv = null, timeSource = 'none', absolute = false;
      const tcol = R.time || R.timestamp;
      if (tcol) {
        const nt = normaliseTime(tcol, fnotes);
        tv = nt.values; absolute = nt.absolute; timeSource = tcol.name;
      }
      // ---- distance
      const dcol = R.lapDistance || R.distance;
      let dv = null, distUnitF = 1;
      if (dcol) {
        const u = unitInfo(dcol);
        if (/^km$/.test(u)) distUnitF = 1000;
        else if (/^mi/.test(u)) distUnitF = 1609.34;
        else if (/^ft/.test(u)) distUnitF = 0.3048;
        dv = Float64Array.from(dcol.values, x => x * distUnitF);
      }
      // ---- speed (internally m/s)
      let sp = null;
      if (R.speed) {
        const sf = speedFactorToMs(R.speed, dcol ? { values: dv } : null, tv, fnotes);
        sp = Float64Array.from(R.speed.values, x => x * sf.f);
        channelUnits.speedSource = sf.unit + ' (' + sf.how + ')';
      }
      // time derived from distance / speed when missing
      if (!tv && dv && sp) {
        tv = new Float64Array(n);
        for (let i = 1; i < n; i++) {
          const dd = dv[i] - dv[i - 1];
          const vm = Math.max(1, (sp[i] + sp[i - 1]) / 2);
          tv[i] = tv[i - 1] + (dd > 0 && dd < 200 ? dd / vm : 0.05);
        }
        timeSource = 'derived (distance ÷ speed)';
        fnotes.push('No time channel: time derived by integrating distance / speed.');
      }
      // ---- positions
      let xv = null, yv = null, posSource = null;
      if (R.x && R.y) { xv = R.x.values; yv = R.y.values; posSource = 'X/Y'; }
      else if (R.gpsLat && R.gpsLon) {
        const la = St.finite(R.gpsLat.values), lo = St.finite(R.gpsLon.values);
        if (la.length && Math.abs(St.median(la)) <= 90 && Math.abs(St.median(lo)) <= 180) {
          const lat0 = St.median(la) * Math.PI / 180, lon0 = St.median(lo);
          const la0 = St.median(la);
          xv = Float64Array.from(R.gpsLon.values, v => (v - lon0) * Math.PI / 180 * 6371000 * Math.cos(lat0));
          yv = Float64Array.from(R.gpsLat.values, v => (v - la0) * Math.PI / 180 * 6371000);
          posSource = 'GPS lat/lon (equirectangular projection)';
        }
      }
      if (posSource) avail.position = posSource;
      if (timeSource !== 'none') avail.time = avail.time || timeSource;
      if (dv) avail.distance = dcol.name;
      // ---- other channels
      const chVals = {};
      if (sp) chVals.speed = sp;
      if (R.throttle) { const s = pctScale(R.throttle); chVals.throttle = Float64Array.from(R.throttle.values, v => v * s); channelUnits.throttle = '%'; }
      if (R.brake) {
        const s = pctScale(R.brake);
        chVals.brake = Float64Array.from(R.brake.values, v => v * s);
        const u = R.brake.unit;
        channelUnits.brake = s === 100 ? '%' : (u || (St.quantile(St.finite(R.brake.values), 0.99) > 100.5 ? 'raw' : '%'));
      }
      if (R.steering) {
        const u = unitInfo(R.steering);
        const s = /rad/.test(u) ? 180 / Math.PI : 1;
        chVals.steering = Float64Array.from(R.steering.values, v => v * s); channelUnits.steering = 'deg';
      }
      if (R.gear) chVals.gear = R.gear.values;
      if (R.rpm) chVals.rpm = R.rpm.values;
      if (R.latG) { const s = gScale(R.latG); chVals.latG = Float64Array.from(R.latG.values, v => v * s); }
      if (R.lonG) { const s = gScale(R.lonG); chVals.lonG = Float64Array.from(R.lonG.values, v => v * s); }
      for (const c of CHANNELS) if (chVals[c]) avail[c] = (det.roles[c] || {}).name || c;
      // ---- session ids
      let sessIds = null;
      if (R.session) {
        const map = new Map();
        sessIds = new Int32Array(n);
        const src = R.session.type === 'numeric' ? Array.from(R.session.values, String) : R.session.rawStrings;
        for (let i = 0; i < n; i++) {
          const k = src[i];
          if (!map.has(k)) map.set(k, sessionCounter + map.size);
          sessIds[i] = map.get(k);
        }
        avail.session = R.session.name;
      }
      // time resets inside a file (in original order) -> new session
      const sessionBase = sessionCounter;
      let localSess = 0;
      let maxSess = sessionBase;
      for (let i = 0; i < n; i++) {
        if (!sessIds && tv && i > 0 && tv[i] < tv[i - 1] - 5 && !(dv && false)) {
          localSess++;
          fnotes.push(`Time reset at source line ${parsed.rowLine[i]} → treated as a new session.`);
        }
        const sid = sessIds ? sessIds[i] : sessionBase + localSess;
        maxSess = Math.max(maxSess, sid);
        out.session.push(sid);
        out.fileIdx.push(fi);
        out.line.push(parsed.rowLine[i]);
        out.lap.push(R.lap ? R.lap.values[i] : NaN);
        out.t.push(tv ? tv[i] : NaN);
        out.dist.push(dv ? dv[i] : NaN);
        out.x.push(xv ? xv[i] : NaN);
        out.y.push(yv ? yv[i] : NaN);
        out.sector.push(R.sector ? R.sector.values[i] : NaN);
        let tl = NaN;
        if (R.trackLimit) {
          tl = R.trackLimit.type === 'numeric' ? R.trackLimit.values[i]
            : (/^(1|true|yes|y|off|invalid|out|x)$/i.test(R.trackLimit.rawStrings[i]) ? 1 : (R.trackLimit.rawStrings[i] ? 0 : NaN));
        }
        out.trackLimit.push(tl);
        out.corner.push(R.corner ? (R.corner.rawStrings ? R.corner.rawStrings[i] : String(R.corner.values[i])) : '');
        out.lapTimeCol.push(R.lapTime ? R.lapTime.values[i] : NaN);
        for (const c of CHANNELS) out[c].push(chVals[c] ? chVals[c][i] : NaN);
      }
      sessionCounter = maxSess + 1;
      if (R.lap) avail.lap = R.lap.name;
      if (R.sector) avail.sector = R.sector.name;
      if (R.trackLimit) avail.trackLimit = R.trackLimit.name;
      if (R.lapTime) avail.lapTime = R.lapTime.name;
      if (R.corner) avail.corner = R.corner.name;
      ['tyre', 'fuel', 'position'].forEach(k => { if (R[k]) avail[k] = R[k].name; });
      fileReports.push({
        name: parsed.source, delimiter: parsed.delimiter === '\t' ? 'TAB' : parsed.delimiter,
        headerFound: parsed.headerFound, headerLine: parsed.headerLine, unitsRow: !!parsed.unitsRow,
        rows: parsed.rows.length, columns: parsed.names.length, malformed: parsed.malformed,
        comments: parsed.comments.length, metaLines: parsed.meta.length, blankLines: parsed.blankLines,
        timeSource, timeAbsolute: absolute, decimalComma: det.decimalComma, notes: fnotes,
        columnInfo: det.cols.map(c => ({
          name: c.name, unit: c.unit, type: c.type, role: c.role, missing: c.missing, nonNumeric: c.nonNumeric,
          missingPct: parsed.rows.length ? 100 * (c.missing + (c.type === 'numeric' ? c.nonNumeric : 0)) / parsed.rows.length : 0,
          categories: c.categories ? c.categories.slice(0, 8) : null,
        })),
      });
      notes.push(...fnotes.map(s => `[${parsed.source}] ${s}`));
    });

    // ---- sort by session then time (stable), keep original order for reporting
    const N = out.t.length;
    const order = Array.from({ length: N }, (_, i) => i);
    const hasTime = out.t.some(v => Number.isFinite(v));
    let outOfOrder = 0;
    for (let i = 1; i < N; i++) if (out.session[i] === out.session[i - 1] && out.t[i] < out.t[i - 1]) outOfOrder++;
    if (hasTime) order.sort((a, b) => (out.session[a] - out.session[b]) || ((out.t[a] - out.t[b]) || 0) || (a - b));
    const T = {};
    for (const k of Object.keys(out)) {
      const src = out[k];
      if (k === 'corner') { T[k] = order.map(i => src[i]); continue; }
      const arr = new Float64Array(N);
      for (let j = 0; j < N; j++) arr[j] = src[order[j]];
      T[k] = arr;
    }
    // ---- duplicate timestamps
    const keep = new Uint8Array(N).fill(1);
    let exactDup = 0, conflictDup = 0, missingTime = 0;
    for (let i = 0; i < N; i++) if (!Number.isFinite(T.t[i])) { keep[i] = 0; missingTime++; }
    for (let i = 1; i < N; i++) {
      if (!keep[i]) continue;
      let j = i - 1; while (j >= 0 && !keep[j]) j--;
      if (j < 0) continue;
      if (T.session[i] === T.session[j] && Math.abs(T.t[i] - T.t[j]) < 1e-6) {
        let same = true;
        for (const c of CHANNELS) { const a = T[c][i], b = T[c][j]; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)))) { same = false; break; } }
        if (same) exactDup++; else conflictDup++;
        keep[i] = 0; // keep the first occurrence; later one is preserved in raw data only
      }
    }
    const idx = [];
    for (let i = 0; i < N; i++) if (keep[i]) idx.push(i);
    const C = {};
    for (const k of Object.keys(T)) C[k] = k === 'corner' ? idx.map(i => T[k][i]) : Float64Array.from(idx, i => T[k][i]);
    C.n = idx.length;
    // ---- sampling statistics
    const dts = [];
    const gaps = [];
    for (let i = 1; i < C.n; i++) {
      if (C.session[i] !== C.session[i - 1]) continue;
      const d = C.t[i] - C.t[i - 1];
      if (d > 0) dts.push(d);
    }
    const mdt = dts.length ? St.median(dts) : NaN;
    for (let i = 1; i < C.n; i++) {
      if (C.session[i] !== C.session[i - 1]) continue;
      const d = C.t[i] - C.t[i - 1];
      if (d > Math.max(5 * mdt, 0.25)) gaps.push({ at: C.t[i - 1], dur: d, line: C.line[i], lap: C.lap[i] });
    }
    // missing data per available channel
    const missingPct = {};
    for (const c of CHANNELS.concat(['dist', 'x', 'y', 'lap'])) {
      let m = 0, present = false;
      for (let i = 0; i < C.n; i++) { if (Number.isNaN(C[c][i])) m++; else present = true; }
      if (present) missingPct[c] = 100 * m / C.n;
    }
    // fill isolated missing channel values by linear interpolation (raw kept in source)
    let filled = 0;
    for (const c of CHANNELS.concat(['dist', 'x', 'y'])) {
      if (!(c in missingPct) || missingPct[c] === 0) continue;
      filled += St.fillGapsLinear(C[c], C.session, c === 'gear');
    }
    // lap column: forward-fill missing lap ids
    if ('lap' in missingPct) for (let i = 1; i < C.n; i++) if (Number.isNaN(C.lap[i]) && C.session[i] === C.session[i - 1]) C.lap[i] = C.lap[i - 1];

    const sessions = Array.from(new Set(Array.from(C.session))).sort((a, b) => a - b);
    return {
      table: C, avail, channelUnits, notes, files: fileReports, sessions,
      sampling: {
        medianDt: mdt, hz: 1 / mdt, minDt: dts.length ? St.min(dts) : NaN, maxDt: dts.length ? St.max(dts) : NaN,
        p05: St.quantile(dts, 0.05), p95: St.quantile(dts, 0.95), jitterPct: dts.length ? 100 * St.mad(dts) * 1.4826 / mdt : NaN,
        gaps, inconsistent: dts.length ? (St.quantile(dts, 0.95) / St.quantile(dts, 0.05) > 1.5) : false,
      },
      dq: { inputRows: N, usedRows: C.n, exactDuplicates: exactDup, conflictingDuplicates: conflictDup, missingTime, outOfOrder, filledValues: filled, missingPct },
    };
  }

  NS.ingest = { parseDelimited, detectColumns, buildSamples, CHANNELS };
})(typeof window !== 'undefined' ? window : globalThis);
