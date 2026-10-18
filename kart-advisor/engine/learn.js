// Learn from the session log: which changes came before faster laps at a track.
// Evidence only. It never alters a recommendation (PLAN.md D4); the crew decides.
//
// Session shape: { id, date, track, configuration, surface, trackTempF, densityAltitudeFt,
//   ran: { field: value }, bestLap, laps: [..], engineGood: bool, feel: '...' }

export const LOGGED_FIELDS = ['front_tire_pressure', 'rear_tire_pressure', 'front_track_width', 'rear_track_width', 'rear_hub_length', 'ballast_lb', 'ballast_height', 'seat_fore_aft', 'axle_sprocket', 'main_jet'];
const MAX_TEMP_DIFF_F = 15;   // conditions this far apart aren't comparable

export const bestLap = s => s.bestLap ?? (s.laps?.length ? Math.min(...s.laps.filter(Number.isFinite)) : null);

function comparable(a, b) {
  if (a.track !== b.track || (a.configuration || 'main') !== (b.configuration || 'main')) return 'different track or layout';
  if ((a.surface || 'dry') !== (b.surface || 'dry')) return 'different surface';
  if (a.trackTempF != null && b.trackTempF != null && Math.abs(a.trackTempF - b.trackTempF) > MAX_TEMP_DIFF_F) return `track temperature differs by more than ${MAX_TEMP_DIFF_F} °F`;
  if (bestLap(a) == null || bestLap(b) == null) return 'missing lap time';
  return null;
}

export function learn(sessions, track) {
  const list = sessions.filter(s => !track || s.track === track).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const stats = new Map();
  const skipped = [];
  let used = 0;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    const why = comparable(a, b);
    if (why) { skipped.push({ from: a.id, to: b.id, why }); continue; }
    const changes = LOGGED_FIELDS.filter(f => a.ran?.[f] != null && b.ran?.[f] != null && a.ran[f] !== b.ran[f])
      .map(f => ({ field: f, direction: typeof b.ran[f] === 'number' ? (b.ran[f] > a.ran[f] ? 'up' : 'down') : `${a.ran[f]}→${b.ran[f]}` }));
    if (!changes.length) continue;
    used++;
    const delta = bestLap(b) - bestLap(a);            // negative = faster
    for (const c of changes) {
      const key = `${c.field}:${c.direction}`;
      const st = stats.get(key) || { field: c.field, direction: c.direction, n: 0, faster: 0, slower: 0, sum: 0, alone: 0 };
      st.n++; st.sum += delta; if (delta < 0) st.faster++; else if (delta > 0) st.slower++;
      if (changes.length === 1) st.alone++;
      stats.set(key, st);
    }
  }
  const changes = [...stats.values()].map(s => ({
    field: s.field, direction: s.direction, n: s.n, faster: s.faster, slower: s.slower,
    meanDeltaS: Math.round((s.sum / s.n) * 1000) / 1000,
    alone: s.alone,
    strength: s.n >= 3 && s.alone >= 2 ? 'pattern' : 'anecdotal',
    text: `${s.field.replace(/_/g, ' ')} ${s.direction}: faster ${s.faster} of ${s.n} times (avg ${s.sum / s.n < 0 ? '' : '+'}${(s.sum / s.n).toFixed(3)} s)${s.alone < s.n ? `, ${s.n - s.alone} with other changes at the same time` : ''}`,
  })).sort((x, y) => x.meanDeltaS - y.meanDeltaS);

  const ref = list.slice().reverse().find(s => s.engineGood && s.ran?.main_jet != null && s.densityAltitudeFt != null);
  return {
    changes, pairsUsed: used, skipped,
    jetReference: ref ? { jet: ref.ran.main_jet, densityAltitudeFt: ref.densityAltitudeFt, from: ref.id, date: ref.date } : null,
  };
}
