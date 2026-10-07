/* ============================================================================
 * iRacing .ibt telemetry reader (binary, little-endian; irsdk disk format).
 *
 *   irsdk_header (112 B) | irsdk_diskSubHeader (32 B) | var headers (144 B each)
 *   | session-info YAML | fixed-size sample records (bufLen B each)
 *
 * Produces the same {parsed, det} structure the TSV path produces, so the rest
 * of the pipeline is unchanged. Only the channels the analysis uses are decoded
 * (a long session has 200+ channels × 60 Hz); every channel name is still listed
 * in the data-quality report.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = root.TelemetryEngine = root.TelemetryEngine || {};

  const TYPE_SIZE = [1, 1, 4, 4, 4, 8]; // char, bool, int, bitField, float, double
  const TRK_OFF_TRACK = 0, TRK_IN_PIT_STALL = 1, TRK_APPROACHING_PITS = 2;

  // iRacing channel → pipeline role
  const ROLE_MAP = {
    SessionTime: 'time', SessionNum: 'session', Lap: 'lap', LapDist: 'lapDistance',
    Speed: 'speed', Throttle: 'throttle', Brake: 'brake', SteeringWheelAngle: 'steering',
    Gear: 'gear', RPM: 'rpm', LatAccel: 'latG', LongAccel: 'lonG', Lat: 'gpsLat', Lon: 'gpsLon',
    LapLastLapTime: 'lapTime', FuelLevel: 'fuel', OnPitRoad: 'pit',
  };
  const EXTRA = ['IsOnTrack', 'PlayerTrackSurface', 'PlayerCarMyIncidentCount', 'LapDistPct'];

  function isIBT(buf) {
    if (!buf || buf.byteLength < 144) return false;
    const dv = new DataView(buf);
    const ver = dv.getInt32(0, true), tick = dv.getInt32(8, true), nv = dv.getInt32(24, true);
    const vho = dv.getInt32(28, true), bufLen = dv.getInt32(36, true);
    return ver >= 1 && ver <= 4 && tick > 0 && tick <= 1000 && nv > 0 && nv < 10000 && vho >= 112 && vho + nv * 144 <= buf.byteLength && bufLen > 0;
  }

  function cstr(bytes, off, len) {
    let s = '';
    for (let i = 0; i < len; i++) { const c = bytes[off + i]; if (!c) break; s += String.fromCharCode(c); }
    return s;
  }

  /** Minimal extraction from the session-info YAML (no YAML library needed). */
  function sessionMeta(yaml) {
    const m = (re) => { const r = yaml.match(re); return r ? r[1].trim() : null; };
    const meta = {
      track: m(/TrackDisplayName:\s*(.*)/) || m(/TrackName:\s*(.*)/),
      trackConfig: m(/TrackConfigName:\s*(.*)/),
      trackLengthKm: parseFloat(m(/TrackLength:\s*([\d.]+)\s*km/) || 'NaN'),
      sectorsPct: [],
      car: null, driver: null, sessionTypes: [],
    };
    const sec = yaml.split('SplitTimeInfo:')[1];
    if (sec) {
      const block = sec.split(/\n\S/)[0];
      let r; const re = /SectorStartPct:\s*([\d.]+)/g;
      while ((r = re.exec(block))) meta.sectorsPct.push(parseFloat(r[1]));
    }
    const carIdx = m(/DriverCarIdx:\s*(\d+)/);
    if (carIdx !== null) {
      const drivers = yaml.split(/\n\s*-\s*CarIdx:\s*/).slice(1);
      const me = drivers.find(d => d.split('\n')[0].trim() === carIdx);
      if (me) {
        const g = re => { const r = me.match(re); return r ? r[1].trim() : null; };
        meta.driver = g(/UserName:\s*(.*)/);
        meta.car = g(/CarScreenName:\s*(.*)/);
      }
    }
    let r; const st = /SessionType:\s*(.*)/g;
    while ((r = st.exec(yaml))) meta.sessionTypes.push(r[1].trim());
    return meta;
  }

  function parse(buf, sourceName) {
    if (!isIBT(buf)) throw new Error(`${sourceName}: not a valid iRacing .ibt file (header check failed)`);
    const dv = new DataView(buf);
    const bytes = new Uint8Array(buf);
    const H = {
      ver: dv.getInt32(0, true), tickRate: dv.getInt32(8, true),
      sessionInfoLen: dv.getInt32(16, true), sessionInfoOffset: dv.getInt32(20, true),
      numVars: dv.getInt32(24, true), varHeaderOffset: dv.getInt32(28, true),
      numBuf: dv.getInt32(32, true), bufLen: dv.getInt32(36, true),
      bufOffset: dv.getInt32(48 + 4, true), // varBuf[0].bufOffset
    };
    const sub = {
      startDate: Number(dv.getBigInt64(112, true)), startTime: dv.getFloat64(120, true), endTime: dv.getFloat64(128, true),
      lapCount: dv.getInt32(136, true), recordCount: dv.getInt32(140, true),
    };
    const vars = [];
    for (let i = 0; i < H.numVars; i++) {
      const o = H.varHeaderOffset + i * 144;
      vars.push({
        type: dv.getInt32(o, true), offset: dv.getInt32(o + 4, true), count: dv.getInt32(o + 8, true),
        name: cstr(bytes, o + 16, 32), desc: cstr(bytes, o + 48, 64), unit: cstr(bytes, o + 112, 32),
      });
    }
    let yaml = '';
    if (H.sessionInfoLen > 0 && H.sessionInfoOffset + H.sessionInfoLen <= buf.byteLength) {
      yaml = new TextDecoder('latin1').decode(bytes.subarray(H.sessionInfoOffset, H.sessionInfoOffset + H.sessionInfoLen)).replace(/\0+$/, '');
    }
    const fitRecords = Math.floor((buf.byteLength - H.bufOffset) / H.bufLen);
    const notes = [];
    let nRec = sub.recordCount > 0 ? Math.min(sub.recordCount, fitRecords) : fitRecords;
    if (sub.recordCount <= 0) notes.push(`Record count missing in header (file not closed cleanly?) — ${fitRecords} records inferred from file size.`);
    else if (sub.recordCount > fitRecords) notes.push(`Header declares ${sub.recordCount} records but the file holds ${fitRecords} — file truncated; using ${fitRecords}.`);
    const byName = new Map(vars.map(v => [v.name, v]));
    const read = (v, rec) => {
      const o = H.bufOffset + rec * H.bufLen + v.offset;
      switch (v.type) {
        case 0: case 1: return bytes[o];
        case 2: case 3: return dv.getInt32(o, true);
        case 4: return dv.getFloat32(o, true);
        case 5: return dv.getFloat64(o, true);
        default: return NaN;
      }
    };
    // keep only records where the player's car is on track (garage / replay frames excluded)
    const onTrack = byName.get('IsOnTrack');
    const keep = [];
    let dropped = 0;
    for (let r = 0; r < nRec; r++) {
      if (onTrack && onTrack.count >= 1 && !read(onTrack, r)) { dropped++; continue; }
      keep.push(r);
    }
    if (dropped) notes.push(`${dropped} record(s) with IsOnTrack = false (garage / not driving) excluded.`);
    const n = keep.length;
    const wanted = Object.keys(ROLE_MAP).concat(EXTRA).filter(k => byName.has(k) && byName.get(k).count >= 1);
    const cols = [];
    const roles = {};
    const col = (name, unit, values, role) => {
      const c = { index: cols.length, name, base: name, unit, key: name.toLowerCase(), values, missing: 0, nonNumeric: 0, type: 'numeric', categories: null, rawStrings: null, clockFormat: false, isoFormat: false, role: role || null };
      for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) c.missing++;
      cols.push(c); if (role) roles[role] = c;
      return c;
    };
    const decoded = {};
    for (const name of wanted) {
      const v = byName.get(name);
      const a = new Float64Array(n);
      for (let i = 0; i < n; i++) a[i] = read(v, keep[i]);
      decoded[name] = a;
    }
    // LapDist is -1 / garbage while not in world; LapLastLapTime is -1 when no valid lap
    if (decoded.LapDist) for (let i = 0; i < n; i++) if (decoded.LapDist[i] < 0) decoded.LapDist[i] = NaN;
    if (decoded.LapLastLapTime) for (let i = 0; i < n; i++) if (!(decoded.LapLastLapTime[i] > 0)) decoded.LapLastLapTime[i] = NaN;
    for (const name of wanted) {
      if (EXTRA.includes(name)) continue;
      const v = byName.get(name);
      col(name, v.unit, decoded[name], ROLE_MAP[name]);
    }
    if (decoded.PlayerTrackSurface) {
      const s = decoded.PlayerTrackSurface, off = new Float64Array(n), pit = new Float64Array(n);
      for (let i = 0; i < n; i++) { off[i] = s[i] === TRK_OFF_TRACK ? 1 : 0; pit[i] = (s[i] === TRK_IN_PIT_STALL || s[i] === TRK_APPROACHING_PITS) ? 1 : 0; }
      col('OffTrack (PlayerTrackSurface)', '', off, 'trackLimit');
      if (decoded.OnPitRoad) for (let i = 0; i < n; i++) roles.pit.values[i] = Math.max(roles.pit.values[i], pit[i]);
      else col('InPits (PlayerTrackSurface)', '', pit, 'pit');
    }
    if (decoded.PlayerCarMyIncidentCount) col('PlayerCarMyIncidentCount', 'x', decoded.PlayerCarMyIncidentCount, 'incidents');
    const meta = sessionMeta(yaml);
    meta.tickRate = H.tickRate; meta.ibtVersion = H.ver; meta.records = nRec; meta.channelsInFile = vars.length;
    meta.allChannels = vars.map(v => v.name + (v.count > 1 ? `[${v.count}]` : ''));
    meta.unusedChannels = vars.filter(v => !wanted.includes(v.name)).length;
    if (sub.startDate > 0) meta.sessionDate = new Date(sub.startDate * 1000).toISOString().slice(0, 10);
    const missingCore = ['SessionTime', 'Lap', 'LapDist', 'Speed'].filter(k => !byName.has(k));
    if (missingCore.length) notes.push(`Core iRacing channel(s) missing: ${missingCore.join(', ')}.`);
    const rowLine = new Int32Array(n);
    for (let i = 0; i < n; i++) rowLine[i] = keep[i] + 1;
    const parsed = {
      source: sourceName, delimiter: 'iRacing IBT', headerFound: true, headerLine: 0, names: cols.map(c => c.name), unitsRow: null,
      rows: { length: n }, rowLine, malformed: [], comments: [], meta: [], blankLines: 0, totalLines: nRec, rawLines: null,
      format: 'ibt', ibtNotes: notes, ibtMeta: meta,
    };
    return { parsed, det: { cols, roles, decimalComma: false } };
  }

  /** base64 → ArrayBuffer (for .ibt files embedded in a built dashboard). */
  function fromBase64(b64) {
    const bin = atob(b64.replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  NS.ibt = { isIBT, parse, sessionMeta, fromBase64 };
})(typeof window !== 'undefined' ? window : globalThis);
