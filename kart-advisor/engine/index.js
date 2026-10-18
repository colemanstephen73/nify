// Rules-based setup recommendation. recommend(kb, inputs) → setup sheet.
//
// Pipeline (PLAN.md §3): baseline → track demands → conditions → air/jetting → driver → feel → clamp + legality.
// Stages don't edit values directly. They append "moves" (lever ± steps, with reason and sources),
// and fields are computed from baseline + moves at the end, so every value carries its full trace.
import { airState, fToC, inHgToHpa, ftToM, mToFt, densityFromDensityAltitude, ISA } from './air.js';
import { parseFeel, TAGS } from './feel.js';
import { mergeLayers, enforce, checkCurrent, describe } from './legality.js';
import { summarizeDemands } from './geometry.js';

export const CONFIDENCE_ORDER = ['manufacturer', 'sanctioning_body', 'track_official', 'expert_consensus', 'anecdote', 'inferred', 'unknown'];
const USER = 'user:profile';
const HANDLING_LEVERS = ['front_tire_pressure', 'rear_tire_pressure', 'front_track_width', 'rear_track_width', 'rear_hub_length', 'ballast_height', 'seat_fore_aft'];

// "chassis:x" stays as is; a bare id is local to the file it came from.
const ref = (fileKey, ids = []) => ids.map(id => (/^[\w/-]+:/.test(id) ? id : `${fileKey}:${id}`));
const lowest = confs => confs.filter(Boolean).reduce((a, c) => (CONFIDENCE_ORDER.indexOf(c) > CONFIDENCE_ORDER.indexOf(a) ? c : a), 'manufacturer');
const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

export function ruleSetsFor(kb, trackId) {
  const t = kb.tracks[trackId];
  const club = { id: 'club', name: t.rules_name, layers: [t] };
  const sets = [club];
  if (kb.rules.wka) sets.push({ id: 'club+wka', name: `${t.rules_name} + ${kb.rules.wka.name}`, layers: [kb.rules.wka, t] });
  return sets;
}

export function recommend(kb, inputs) {
  const A = kb.advisor, C = kb.chassis;
  const track = kb.tracks[inputs.track];
  if (!track) throw new Error(`unknown track ${inputs.track}`);
  const kart = inputs.kart || {};
  const driver = { experience: 'novice', ...(inputs.driver || {}) };
  const notes = [], verify = [...(track.inferred_items || [])];

  // ---------- rules ----------
  const ruleSet = ruleSetsFor(kb, inputs.track).find(r => r.id === (inputs.ruleSet || 'club')) || ruleSetsFor(kb, inputs.track)[0];
  const merged = mergeLayers(ruleSet.layers.map(l => ({ name: l.rules_name || l.name, fileKey: l.fileKey, limits: l.limits })));

  // ---------- fields ----------
  const fields = {};
  const field = (id, label, units, baseline, baselineSource) => {
    fields[id] = { id, label, units, baseline: baseline ?? null, value: baseline ?? null, delta: 0, steps: [], status: baseline == null ? 'relative' : 'kept', notes: [] };
    if (baseline != null) step(id, 'baseline', baselineSource?.text || 'Your kart profile (what you normally run)', baselineSource?.sources || [USER], baselineSource?.confidence || 'user');
    return fields[id];
  };
  const step = (id, stage, text, sources, confidence, change = null, extra = {}) =>
    fields[id].steps.push({ stage, text, sources, confidence, change, ...extra });

  // ---------- derived state ----------
  const w = inputs.weather || {};
  const elevFt = track.location?.elevation_ft?.value ?? null;
  let air = null;
  if (w.airTempF != null) {
    const pressure = w.pressureInHg != null ? { kind: w.pressureKind || 'station', hpa: inHgToHpa(w.pressureInHg) } : w.pressureHpa != null ? { kind: w.pressureKind || 'station', hpa: w.pressureHpa } : null;
    air = airState({ tempC: fToC(w.airTempF), rhPct: w.rhPct, pressure, elevationM: elevFt != null ? ftToM(elevFt) : null });
    if (!pressure) verify.push(`Pressure not entered: ${air.pressureNote}.`);
  }
  const trackTempF = w.trackTempF ?? w.airTempF ?? null;
  if (w.trackTempF == null && w.airTempF != null) notes.push('Track temperature not entered: using air temperature. A sunny track is usually much hotter. An IR thermometer reading helps.');

  const G = A.grip_model;
  const surface = inputs.surface || 'dry', rubber = inputs.rubber || 'medium', tireAge = inputs.tires?.age || 'scuffed';
  let grip = G.base + (G.surface[surface] ?? 0) + (G.rubber[rubber] ?? 0) + (G.tire_age[tireAge] ?? 0);
  if (trackTempF != null) grip += G.track_temp_f.find(b => trackTempF < b.below)?.add ?? 0;
  grip = round(Math.max(0, Math.min(1, grip)));
  const gripBand = grip < G.low_below ? 'low' : grip >= G.high_at_or_above ? 'high' : 'normal';

  const config = (track.configurations || []).find(c => c.id === inputs.configuration) || track.configurations?.[0];
  const demands = config?.corners?.length ? summarizeDemands(config.corners, config.length_m ?? config.corners.reduce((s, c) => s + c.lengthM + c.precedingStraightM, 0)) : null;

  // ---------- levers & moves ----------
  const moves = [];
  const lever = id => A.levers[id];
  const leverExists = id => {
    const l = lever(id);
    if (!l) return false;
    if (A.not_recommended.includes(id)) return false;
    const ex = l.chassis_ref ? C.adjustments?.[l.chassis_ref]?.exists : true;
    if (ex !== true) return false;
    if (id === 'rear_hub_length') return kart.rearHubMm != null && (kart.hubOptionsMm?.length ?? 0) > 1;
    return true;
  };
  const floor = A.driver.rear_grip_floor[driver.experience] || 'all';
  const reducesRear = (id, steps) => (lever(id).grip_effect?.rear ?? 0) * steps < 0;
  const allowed = (id, steps, stage, tag) => {
    if (!leverExists(id)) return false;
    if (lever(id).novice_allowed === false && driver.experience !== 'experienced') return false;
    if (reducesRear(id, steps) && tag !== 'hop') {
      if (floor === 'all') return false;
      if (floor === 'conditions' && stage === 'conditions') return false;
    }
    // Option levers: stay within what the crew owns.
    if (id === 'rear_hub_length') { const o = [...kart.hubOptionsMm].sort((a, b) => a - b), i = o.indexOf(kart.rearHubMm); return i + steps >= 0 && i + steps < o.length; }
    if (id === 'ballast_height') { const o = lever(id).options, i = o.indexOf(kart.ballastHeight || 'low'); return i + steps >= 0 && i + steps < o.length; }
    return true;
  };
  const move = (id, steps, stage, text, sources, confidence, tag = null) => moves.push({ lever: id, steps, stage, text, sources, confidence, tag });

  // ---------- 1. baseline ----------
  field('front_tire_pressure', lever('front_tire_pressure').label, 'psi', kart.frontPressurePsi);
  field('rear_tire_pressure', lever('rear_tire_pressure').label, 'psi', kart.rearPressurePsi);
  field('front_track_width', lever('front_track_width').label, 'in', kart.frontTrackWidthIn);
  field('rear_track_width', lever('rear_track_width').label, 'in', kart.rearTrackWidthIn);
  field('rear_hub_length', lever('rear_hub_length').label, 'mm', kart.rearHubMm);
  field('seat_fore_aft', lever('seat_fore_aft').label, 'in', kart.seatPositionIn);
  field('ballast_height', lever('ballast_height').label, '', kart.ballastHeight || null);

  // ---------- 2. track demands → gearing ----------
  const gearRule = merged.byField.axle_sprocket;
  const gearKb = A.gearing;
  const gear = field('axle_sprocket', 'Axle sprocket (gear)', 'teeth', kart.axleSprocket ?? null);
  if (kart.axleSprocket == null) {
    gear.baseline = gearKb.baseline.value; gear.value = gear.baseline; gear.status = 'kept';
    step('axle_sprocket', 'baseline', `No gear entered: start from ${gearKb.driver.value}/${gearKb.baseline.value}, WKA's suggested Comer kid kart gear`, ref('advisor', gearKb.baseline.sources), gearKb.baseline.confidence);
  }
  let gearShift = 0;
  if (gearRule?.eq) {
    gear.status = 'fixed_by_rule';
    step('axle_sprocket', 'track', `Spec gear at this track: ${gearRule.eq.value} teeth (${gearRule.eq.layer}). Track layout doesn't change it.`, gearRule.eq.sources, 'track_official');
  } else if (!demands) {
    step('axle_sprocket', 'track', `No corner geometry for ${track.short_name || track.name} yet, so the gear isn't adjusted for the layout`, ref(track.fileKey, config?.sources || []), 'unknown');
  } else if (demands.character === 'balanced') {
    step('axle_sprocket', 'track', `Layout is balanced (${demands.tightCount} tight, ${demands.fastCount} fast of ${demands.cornerCount} corners; longest straight ${Math.round(mToFt(demands.longestStraightM))} ft): no gear change for the track`, ref(track.fileKey, config.sources || []), 'inferred');
  } else {
    gearShift = demands.character === 'acceleration' ? gearKb.demand_shift_teeth.value : -gearKb.demand_shift_teeth.value;
    step('axle_sprocket', 'track', demands.character === 'acceleration'
      ? `Mostly tight corners (${demands.tightCount} of ${demands.cornerCount}): ${gearShift} teeth for acceleration off the corners`
      : `Fast, flowing layout: ${gearShift} teeth for top speed (longest straight ${Math.round(mToFt(demands.longestStraightM))} ft)`,
    [...ref(track.fileKey, config.sources || []), ...ref('advisor', gearKb.demand_shift_teeth.sources)], 'inferred', gearShift);
  }

  // ---------- 3. conditions ----------
  const condReasonGrip = `Grip estimate ${round(grip)} (${surface}, ${rubber} track, ${tireAge} tires${trackTempF != null ? `, track ${Math.round(trackTempF)} °F` : ''})`;
  const Cn = A.conditions;
  if (gripBand === 'low') for (const ch of Cn.low_grip.changes) {
    if (allowed(ch.lever, ch.steps, 'conditions')) move(ch.lever, ch.steps, 'conditions', `${condReasonGrip}: ${Cn.low_grip.reason.toLowerCase()}`, ref('advisor', Cn.low_grip.sources), Cn.low_grip.confidence);
  }
  if (gripBand === 'high') for (const ch of Cn.high_grip.changes) {
    if (Cn.high_grip.experienced_only && driver.experience !== 'experienced') { notes.push(`${condReasonGrip}: high grip. The rear isn't freed up for a ${driver.experience} driver. If the kart hops or feels stuck, report it in "how did it feel".`); continue; }
    if (allowed(ch.lever, ch.steps, 'conditions')) move(ch.lever, ch.steps, 'conditions', `${condReasonGrip}: ${Cn.high_grip.reason.toLowerCase()}`, ref('advisor', Cn.high_grip.sources), Cn.high_grip.confidence);
  }
  if (trackTempF != null) {
    const band = Cn.pressure_by_track_temp_f.bands.find(b => trackTempF < b.below);
    // Not subject to the rear-grip floor: on a cold day more pressure builds tire heat, which adds grip.
    if (band && band.steps) for (const id of ['front_tire_pressure', 'rear_tire_pressure']) {
      if (leverExists(id)) move(id, band.steps, 'conditions', `Track ${Math.round(trackTempF)} °F. ${band.steps > 0 ? Cn.pressure_by_track_temp_f.reason_cold : Cn.pressure_by_track_temp_f.reason_hot}`, ref('advisor', Cn.pressure_by_track_temp_f.sources), Cn.pressure_by_track_temp_f.confidence);
    }
  }
  if (surface === 'wet') notes.push(Cn.wet.note);

  // Tires (rule-driven)
  const tireRule = merged.byField.tire_spec;
  const tireWanted = surface === 'wet' ? (tireRule?.one_of?.value.find(t => /rain/i.test(t)) ?? 'rain tires (if you have them)') : (inputs.tires?.brand || tireRule?.one_of?.value.find(t => !/rain/i.test(t)) || null);
  const tires = field('tire_spec', 'Tires', '', inputs.tires?.brand || null);
  tires.value = tireWanted; tires.status = tireWanted ? 'set' : 'relative';
  if (tireRule?.one_of) step('tire_spec', 'conditions', `${surface === 'wet' ? 'Wet: rain tire' : 'Dry: slick'} per the tire rule (${tireRule.one_of.value.join(' / ')})`, tireRule.one_of.sources, 'track_official');
  else step('tire_spec', 'conditions', `No tire rule for this rule set (${(tireRule?.notes || []).map(n => n.value).join('; ') || 'not found'}).${surface === 'wet' ? ' Use rain tires if you have them.' : ''}`, tireRule?.notes?.[0]?.sources || ref('chassis', ['badger']), tireRule ? 'track_official' : 'unknown');

  // ---------- 4. air density → jetting ----------
  const J = A.jetting;
  const jetsAvail = (kart.jetsOwned?.length ? kart.jetsOwned : J.available.value).slice().sort((a, b) => a - b);
  const jet = field('main_jet', 'Main jet', '#', kart.mainJet ?? null);
  const jetRef = kart.jetReference;
  if (kart.mainJet == null) {
    jet.baseline = J.fallback_jet.value; jet.value = jet.baseline; jet.status = 'kept';
    step('main_jet', 'baseline', `No jet entered: start at #${J.fallback_jet.value}, the richer common choice (a bare SHA 14/12L ships with #57). Read the plug after the first session.`, ref('advisor', J.fallback_jet.sources), J.fallback_jet.confidence);
  }
  if (air && jetRef?.jet != null && jetRef?.densityAltitudeFt != null) {
    const rhoRef = densityFromDensityAltitude(ftToM(jetRef.densityAltitudeFt));
    const target = jetRef.jet * Math.pow(air.rho / rhoRef, J.number_exponent.value);
    const base = Math.floor(target), pick = target - base >= J.round_up_from.value ? base + 1 : base;
    const snapped = jetsAvail.reduce((b, x) => (Math.abs(x - pick) < Math.abs(b - pick) || (Math.abs(x - pick) === Math.abs(b - pick) && x > b) ? x : b), jetsAvail[0]);
    const change = snapped - jet.value;
    jet.status = 'set';
    step('main_jet', 'air', `Density altitude ${Math.round(air.densityAltitudeFt)} ft vs ${Math.round(jetRef.densityAltitudeFt)} ft when #${jetRef.jet} ran right. Air ${air.rho > rhoRef ? 'denser: needs more fuel' : 'thinner: needs less fuel'}. Exact ${target.toFixed(2)} → #${snapped} (rounded toward rich${kart.jetsOwned?.length ? ', from jets you own' : ''})${change === 0 ? ': no change' : ''}.`,
      [...ref('carb', ['engtips', 'longacre', 'ducati_dellorto']), ...ref('advisor', J.round_up_from.sources)], 'inferred', change, { set: snapped });
  } else if (air) {
    step('main_jet', 'air', `Density altitude ${Math.round(air.densityAltitudeFt)} ft today. No reference session yet, so the jet isn't changed for the weather. After a session where the engine runs clean and the plug reads tan, mark it as the jetting reference.`, ref('carb', ['longacre', 'engtips']), 'inferred');
  } else {
    step('main_jet', 'air', 'No weather entered, so jetting not checked against air density', ref('carb', ['longacre']), 'unknown');
  }

  // ---------- 5. driver ----------
  const minW = merged.byField.min_weight_lb?.min;
  const ballast = field('ballast_lb', 'Ballast', 'lb', kart.ballastLb ?? null);
  if (minW) {
    if (kart.weightLb != null && driver.weightLb != null) {
      const margin = A.driver.ballast_margin_lb.value;
      const need = Math.max(0, Math.ceil(minW.value + margin - kart.weightLb - driver.weightLb));
      ballast.value = need; ballast.status = 'set'; ballast.delta = kart.ballastLb != null ? need - kart.ballastLb : null;
      step('ballast_lb', 'driver', `Minimum ${minW.value} lb kart + driver (${minW.layer}). Kart ${kart.weightLb} lb + driver ${driver.weightLb} lb = ${kart.weightLb + driver.weightLb} lb. ${need ? `Add ${need} lb (includes a ${margin} lb margin for fuel burn and scale differences).` : 'Already over the minimum with margin: no ballast needed.'}`,
        [...minW.sources, ...ref('advisor', A.driver.ballast_margin_lb.sources)], 'track_official', ballast.delta);
    } else {
      ballast.status = 'withheld';
      step('ballast_lb', 'driver', `Minimum ${minW.value} lb kart + driver (${minW.layer}). Enter the kart's ready-to-race weight (no driver) and the driver's suited-up weight to work out ballast.`, minW.sources, 'track_official');
    }
  } else {
    step('ballast_lb', 'driver', `No minimum weight in this rule set (${(merged.byField.min_weight_lb?.notes || []).map(n => n.value).join('; ') || 'none found'}). Ballast only if you use it for balance.`, merged.byField.min_weight_lb?.notes?.[0]?.sources || [USER], 'track_official');
  }
  step('ballast_lb', 'driver', 'Mount it low and central: low ballast keeps the kart stable', ref('chassis', ['ballast_guides']), 'expert_consensus');
  if (driver.experience !== 'experienced') notes.push(`${driver.experience[0].toUpperCase() + driver.experience.slice(1)} driver: no change is allowed to take rear grip away below your baseline${floor === 'conditions' ? ' because of the conditions' : ''}. A slightly hooked-up kart is easier to drive than a loose one.`);

  // ---------- 6. feel feedback ----------
  const feel = parseFeel(inputs.feel?.text || '', inputs.feel?.chips || []);
  const F = A.feel;
  const conflictedPhases = new Set(['entry', 'mid', 'exit'].filter(ph => feel.tags.includes(`understeer_${ph}`) && feel.tags.includes(`oversteer_${ph}`)));
  const ordered = F.priority.filter(t => feel.tags.includes(t));
  const next = [];
  const feelUsed = new Set();         // one feel change per lever per session
  let handling = 0;
  const feelSrc = fix => [...ref('advisor', lever(fix.lever).sources), ...ref('advisor', F.sources).filter(s => !s.endsWith(':policy'))];
  for (const tag of ordered) {
    if (!(tag in F.fixes)) continue;
    const phase = tag.split('_')[1];
    if (conflictedPhases.has(phase) && /steer/.test(tag)) continue;
    const options = F.fixes[tag].filter(f => allowed(f.lever, f.steps, 'feel', tag) && !feelUsed.has(f.lever));
    if (!options.length) { next.push({ tag, text: `${TAGS[tag]}: no available change on this kart for a ${driver.experience} driver. Check driver line and seat fit.` }); continue; }
    if (handling >= F.max_handling_changes) { next.push({ tag, text: `${TAGS[tag]}: after this session, try ${describeMove(options[0])}`, lever: options[0].lever }); continue; }
    const fix = options[0];
    move(fix.lever, fix.steps, 'feel', `You reported: ${TAGS[tag].toLowerCase()}. ${describeMove(fix)}: ${fix.steps > 0 ? lever(fix.lever).plus_effect : lever(fix.lever).minus_effect}`, feelSrc(fix), lever(fix.lever).confidence, tag);
    feelUsed.add(fix.lever);
    handling++;
    if (options[1]) next.push({ tag, text: `If still a problem (${TAGS[tag].toLowerCase()}): ${describeMove(options[1])}`, lever: options[1].lever });
  }
  function describeMove(f) {
    const l = lever(f.lever);
    if (f.lever === 'rear_hub_length') return `${f.steps > 0 ? 'longer' : 'shorter'} rear hubs`;
    if (f.lever === 'ballast_height') return `move ballast ${f.steps < 0 ? 'lower' : 'higher'}`;
    return `${f.steps > 0 ? '+' : '−'}${l.step_text} ${l.label.toLowerCase()}`;
  }

  // Carb feel changes (separate budget, lean overrides because it can seize the engine).
  const carbSyms = kb.carb.symptoms || [];
  const sym = tag => carbSyms.find(s => s.tag === tag);
  const carbConflict = feel.tags.includes('rich') && feel.tags.includes('lean');
  if (carbConflict) next.push({ tag: 'rich', text: 'Rich and lean both reported: do a plug chop before changing the jet. Stay on the richer side meanwhile.' });
  else if (feel.tags.includes('lean')) {
    const s = sym('lean_ping');
    step('main_jet', 'feel', `LEAN signs reported: ${s.fix}`, ref('carb', s.sources), s.confidence, 1, { urgent: true });
  } else if (feel.tags.includes('rich')) {
    const s = sym('rich_top_end');
    step('main_jet', 'feel', `Rich signs reported: ${s.fix}`, ref('carb', s.sources), s.confidence, -1);
  } else if (feel.tags.includes('bog')) {
    next.push({ tag: 'bog', text: `Bog: rich or lean? Rich = sluggish and smoky, wet black plug. Lean = hesitates, nearly dies, then surges. ${sym('rich_bog').fix}. Not changing the jet until you know which.` });
  }
  if (feel.tags.includes('tops_out')) {
    if (gear.status === 'fixed_by_rule') next.push({ tag: 'tops_out', text: 'Revs out on the straight, but the gear is fixed by the rules here.' });
    else { gearShift += gearKb.tops_out_teeth.value; step('axle_sprocket', 'feel', `Revs out before the end of the straight: ${gearKb.tops_out_teeth.value} teeth`, ref('advisor', gearKb.tops_out_teeth.sources), 'inferred', gearKb.tops_out_teeth.value); }
  }

  // ---------- 7. resolve moves → values, clamp, legality ----------
  for (const m of moves) {
    const f = fields[m.lever], l = lever(m.lever);
    let change;
    if (l.options) {
      const opts = m.lever === 'rear_hub_length' ? [...kart.hubOptionsMm].sort((a, b) => a - b) : l.options;
      const cur = f.value ?? (m.lever === 'ballast_height' ? 'low' : null);
      const i = opts.indexOf(cur), j = Math.max(0, Math.min(opts.length - 1, i + m.steps));
      change = `${cur} → ${opts[j]}`; f.value = opts[j];
    } else {
      change = round(m.steps * l.step, 2);
      f.delta = round((f.delta || 0) + change, 2);
      if (f.baseline != null) f.value = round(f.baseline + f.delta, 2);
    }
    f.status = f.baseline == null && !l.options ? 'relative' : 'set';
    step(m.lever, m.stage, m.text, m.sources, m.confidence, change, m.tag ? { tag: m.tag } : {});
  }
  for (const id of HANDLING_LEVERS) {
    const f = fields[id];
    if (!f.steps.length) step(id, 'baseline', leverExists(id) ? (f.baseline == null ? 'No change recommended today (add it to your kart profile to track it)' : 'No rule changed this today: keep your baseline') : notAvailableText(id), leverExists(id) ? [USER] : ref('chassis', C.adjustments?.[lever(id).chassis_ref]?.sources || []), leverExists(id) ? 'user' : (C.adjustments?.[lever(id).chassis_ref]?.confidence || 'unknown'));
    if (!leverExists(id) && !f.steps.some(s => s.stage !== 'baseline')) f.status = id === 'rear_hub_length' ? 'withheld' : f.baseline == null ? 'not_adjustable' : f.status;
    if (f.status === 'relative' && f.delta === 0) f.status = 'withheld';
  }
  function notAvailableText(id) {
    if (id === 'rear_hub_length') return 'Hub length changes need your current hub length and the hub lengths you own (kart profile)';
    return `Not confirmed adjustable on this chassis: ${C.adjustments?.[lever(id).chassis_ref]?.notes || 'research found no adjuster'}`;
  }

  // Gear: apply shift, cap, snap to owned sprockets, then rules.
  if (gear.status !== 'fixed_by_rule' && gearShift) {
    const cap = gearKb.max_shift_teeth.value, centre = gearKb.baseline.value;
    let v = gear.baseline + gearShift;
    v = Math.max(centre - cap, Math.min(centre + cap, v));
    if (kart.sprocketsOwned?.length) v = kart.sprocketsOwned.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b));
    if (v !== gear.baseline + gearShift) step('axle_sprocket', 'clamp', `Kept within ±${cap} teeth of ${centre}${kart.sprocketsOwned?.length ? ' and to a sprocket you own' : ''}: ${v}`, ref('advisor', gearKb.max_shift_teeth.sources), 'inferred');
    gear.value = v; gear.delta = v - gear.baseline; gear.status = 'set';
  }
  const driverSprocket = merged.byField.driver_sprocket?.eq?.value ?? kart.driverSprocket ?? gearKb.driver.value;

  // Jet: sum the set/feel steps, keep inside owned/available jets.
  {
    const s = jet.steps.find(x => x.set != null);
    let v = s ? s.set : jet.value;
    const feelStep = jet.steps.find(x => x.stage === 'feel');
    if (feelStep) {
      const idx = jetsAvail.indexOf(v), j = Math.max(0, Math.min(jetsAvail.length - 1, (idx < 0 ? jetsAvail.findIndex(x => x >= v) : idx) + feelStep.change));
      v = jetsAvail[j]; jet.status = 'set';
    }
    jet.delta = v - jet.baseline; jet.value = v;
  }

  // Legality: enforce every output that has a rule.
  const legal = (id, ruleField, value) => {
    const r = merged.byField[ruleField];
    if (!r) return;
    const e = enforce(value, r);
    for (const a of e.adjustedBy) step(id, 'legality', `Changed from ${a.from} to meet the rules: ${a.op} ${Array.isArray(a.value) ? a.value.join('/') : a.value} (${a.layer})`, a.sources, 'track_official');
    if (e.blocked) { fields[id].value = null; fields[id].status = 'blocked'; step(id, 'legality', `BLOCKED: ${e.blocked}`, Object.values(r).flatMap(x => x?.sources || []), 'track_official'); }
    else { fields[id].value = e.value; if (e.adjustedBy.length) fields[id].delta = typeof e.value === 'number' && typeof fields[id].baseline === 'number' ? e.value - fields[id].baseline : fields[id].delta; }
    fields[id].legality = { ok: !e.blocked, rule: describe(r) };
  };
  legal('axle_sprocket', 'axle_sprocket', gear.value);
  legal('main_jet', 'main_jet', jet.value);
  legal('tire_spec', 'tire_spec', tires.value && tireRule?.one_of ? tires.value : null);
  legal('front_tire_pressure', 'tire_pressure_psi', fields.front_tire_pressure.value);
  legal('rear_tire_pressure', 'tire_pressure_psi', fields.rear_tire_pressure.value);

  // ---------- fixed / reference rows ----------
  const gearRow = fields.axle_sprocket;
  gearRow.display = gearRow.value != null ? `${driverSprocket}/${gearRow.value}` : null;
  gearRow.ratio = gearRow.value ? round(gearRow.value / driverSprocket, 2) : null;
  step('axle_sprocket', 'rules', `Clutch drum ${driverSprocket} teeth, #219 chain`, merged.byField.driver_sprocket?.eq?.sources || ref('engine', ['wka_tm_2022_002_pdf']), 'sanctioning_body');

  const carbOther = field('carb_other', 'Other carb settings', '', null);
  carbOther.value = 'None to set'; carbOther.status = 'not_adjustable';
  step('carb_other', 'baseline', `${kb.carb.idle.needle_clip.value}; ${kb.carb.idle.idle_jet_or_mixture_screw.value}. The main jet is the only fuel adjustment.`, ref('carb', kb.carb.idle.needle_clip.sources), kb.carb.idle.needle_clip.confidence);
  step('carb_other', 'baseline', `Float stamped ${kb.carb.float.weight_g.value} g; float level unknown. WKA: carb parts must stay as cast.`, [...ref('carb', kb.carb.float.weight_g.sources), ...ref('carb', ['wka_tm_2022_002'])], 'anecdote');

  const plug = field('spark_plug', 'Spark plug', '', kart.sparkPlug || null);
  const cand = kb.engine.spark_plug.candidates;
  if (kart.sparkPlug) step('spark_plug', 'baseline', `Keep it: no sourced C52 plug spec to change it to. Read it after each session (tan = good).`, ref('carb', ['kartpulse_plug']), 'anecdote');
  else { plug.status = 'withheld'; plug.value = null; step('spark_plug', 'baseline', `C52 plug not published. Plugs allowed for the C50 (inferred to fit): ${cand.value.join(', ')}. Check with your engine builder.`, ref('engine', cand.sources), cand.confidence); }

  const fuel = field('fuel_mix', 'Fuel and oil', '', null);
  const fuelRule = merged.byField.fuel;
  const ratios = kb.engine.fuel_mix.ratio_options;
  const fuelText = fuelRule?.eq ? fuelRule.eq.value : fuelRule?.one_of ? fuelRule.one_of.value.join(' or ') : (kart.fuel || 'open (no fuel rule)');
  const ratio = kart.fuelRatio ? `${kart.fuelRatio}:1` : `${ratios[0].value}:1`;
  fuel.value = `${fuelText}, oil ${ratio}`; fuel.status = kart.fuelRatio ? 'kept' : 'set';
  if (fuelRule && (fuelRule.eq || fuelRule.one_of)) step('fuel_mix', 'rules', `Fuel per rules: ${fuelText}`, (fuelRule.eq || fuelRule.one_of).sources, 'track_official');
  step('fuel_mix', 'baseline', kart.fuelRatio ? `Your ratio ${ratio}. Sources disagree (${ratios.map(r => `${r.value}:1`).join(' vs ')}), so follow your engine builder.` : `${ratio} is US kid kart practice; Comer's own sheet says ${ratios[1].value}:1. Sources conflict, not averaged: follow your engine builder.`, ref('engine', ratios.flatMap(r => r.sources)), ratios[0].confidence);
  if (merged.conflicts.some(c => c.startsWith('fuel'))) fuel.notes.push('The selected rule layers disagree on fuel. Check the event supplement.');

  for (const [id, label] of [['caster', 'Caster'], ['camber', 'Camber'], ['toe', 'Toe'], ['axle', 'Axle']]) {
    const a = C.adjustments?.[id] || {};
    const f = field(id, label, '', null);
    f.status = 'not_adjustable';
    f.value = id === 'caster' && a.baseline != null ? `${a.baseline}° built in (not adjustable as far as known)` : 'Leave as is';
    step(id, 'baseline', id === 'toe' ? 'Tie rods are adjustable, but there is no baseline toe figure. Measure yours and leave it unless it was bent.' : id === 'axle' ? `Axle diameter sources conflict (25 vs 30 mm), and no alternative stiffness kid kart axles were found. ${a.notes || ''}` : `Not confirmed adjustable on this chassis. ${a.notes || ''}`.trim(),
      ref('chassis', a.sources?.length ? a.sources : ['topkart_usa_kidkart_old']), a.confidence || 'unknown');
  }

  // ---------- confidence, legality summary ----------
  for (const f of Object.values(fields)) {
    const confs = f.steps.filter(s => s.confidence !== 'user').map(s => s.confidence);
    f.confidence = confs.length ? lowest(confs) : 'user';
    f.reason = f.steps.filter(s => s.stage !== 'baseline' || f.steps.length === 1).map(s => s.text).join(' ') || f.steps[0]?.text;
  }
  const totalWeight = kart.weightLb != null && driver.weightLb != null ? kart.weightLb + driver.weightLb + (fields.ballast_lb.value || 0) : null;
  const current = {
    engine_model: kart.engine || null, main_jet: kart.mainJet ?? null, axle_sprocket: kart.axleSprocket ?? null, driver_sprocket: kart.driverSprocket ?? null,
    tire_spec: inputs.tires?.brand || null, fuel: kart.fuel || null,
    min_weight_lb: kart.weightLb != null && driver.weightLb != null ? kart.weightLb + driver.weightLb + (kart.ballastLb || 0) : null,
  };
  const currentIssues = checkCurrent(current, merged).map(i => ({ ...i, text: `Your current ${i.field.replace(/_/g, ' ')} (${i.value}) doesn't meet: ${i.rule}`, sources: Object.values(i.limit).flatMap(x => x?.sources || []) }));
  const blocked = Object.values(fields).filter(f => f.status === 'blocked').map(f => f.id);

  return {
    track: { id: inputs.track, name: track.name, configuration: config?.id, geometry: demands ? 'available' : 'missing', geometryStatus: track.geometry_status },
    ruleSet: { id: ruleSet.id, name: ruleSet.name },
    derived: { air: air && { densityAltitudeFt: Math.round(air.densityAltitudeFt), relativeDensity: round(air.relativeDensity, 3), stationPressureInHg: round(air.stationPressureHpa / 33.8639, 2), pressureNote: air.pressureNote }, grip: round(grip), gripBand, trackTempF, demands },
    fields,
    order: ['front_tire_pressure', 'rear_tire_pressure', 'tire_spec', 'front_track_width', 'rear_track_width', 'rear_hub_length', 'seat_fore_aft', 'ballast_lb', 'ballast_height', 'caster', 'camber', 'toe', 'axle', 'axle_sprocket', 'main_jet', 'carb_other', 'spark_plug', 'fuel_mix'],
    legality: { ok: !blocked.length && !currentIssues.length && !merged.conflicts.length, blocked, currentIssues, conflicts: merged.conflicts, totalWeightLb: totalWeight, notes: Object.entries(merged.byField).flatMap(([k, v]) => v.notes.map(n => ({ field: k, ...n }))) },
    feel: { ...feel, applied: moves.filter(m => m.stage === 'feel').map(m => ({ lever: m.lever, steps: m.steps, tag: m.tag })) },
    next,
    notes,
    verify,
  };
}

// Resolve source refs to records for display.
export function resolveSources(kb, refs) {
  return [...new Set(refs)].map(r => (r === USER ? { id: USER, title: 'Your kart profile (entered in this app)', confidence: 'user' } : kb.sourceIndex[r] || { id: r, title: r, confidence: 'unknown', missing: true }));
}
