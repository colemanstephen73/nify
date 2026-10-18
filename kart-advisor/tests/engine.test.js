// One test (or a few) per rule in the pipeline. Scenarios live in scenarios.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb } from './helpers/kb.js';
import { recommend, resolveSources, ruleSetsFor } from '../engine/index.js';

const kart = { weightLb: 95, engine: 'Comer C52', frontPressurePsi: 14, rearPressurePsi: 14, frontTrackWidthIn: 38, rearTrackWidthIn: 40, mainJet: 58, axleSprocket: 89, ballastHeight: 'low' };
const base = (o = {}) => ({
  track: 'rocky-ridge', surface: 'dry', rubber: 'medium', tires: { brand: 'MG Red', age: 'scuffed' },
  weather: { airTempF: 75, trackTempF: 90, rhPct: 50, pressureInHg: 28.5 },
  driver: { weightLb: 50, experience: 'novice' }, ...o, kart: { ...kart, ...(o.kart || {}) },
});
const run = o => recommend(kb, base(o));
const moved = (r, id) => r.fields[id].steps.filter(s => s.stage !== 'baseline' && s.change != null);

test('baseline only: nothing moves on a normal day with no feedback', () => {
  const r = run();
  for (const id of ['front_track_width', 'rear_track_width', 'front_tire_pressure', 'rear_tire_pressure'])
    assert.equal(r.fields[id].value, r.fields[id].baseline, id);
  assert.equal(r.derived.gripBand, 'normal');
});

test('conditions: low grip narrows the rear one step for every experience level', () => {
  for (const experience of ['novice', 'intermediate', 'experienced']) {
    const r = run({ surface: 'damp', rubber: 'green', driver: { weightLb: 50, experience } });
    assert.equal(r.derived.gripBand, 'low');
    assert.equal(r.fields.rear_track_width.value, 39.5, experience);
    assert.ok(moved(r, 'rear_track_width')[0].sources.length > 0);
  }
});

test('conditions: high grip frees the rear only for experienced drivers', () => {
  const hot = { surface: 'dry', rubber: 'rubbered', tires: { brand: 'MG Red', age: 'new' }, weather: { airTempF: 85, trackTempF: 100, rhPct: 40, pressureInHg: 28.5 } };
  assert.equal(run({ ...hot }).fields.rear_track_width.value, 40);
  assert.ok(run({ ...hot }).notes.some(n => /high grip/.test(n)));
  assert.equal(run({ ...hot, driver: { weightLb: 50, experience: 'experienced' } }).fields.rear_track_width.value, 40.5);
});

test('conditions: tire pressure follows track temperature bands', () => {
  const p = t => run({ weather: { airTempF: 70, trackTempF: t, rhPct: 50, pressureInHg: 28.5 } }).fields.rear_tire_pressure.value;
  assert.equal(p(55), 15);
  assert.equal(p(70), 14.5);
  assert.equal(p(90), 14);
  assert.equal(p(125), 13.5);
});

test('no baseline entered: pressure change is relative, not invented', () => {
  const r = run({ kart: { frontPressurePsi: null, rearPressurePsi: null }, weather: { airTempF: 50, trackTempF: 55, rhPct: 50, pressureInHg: 28.5 } });
  assert.equal(r.fields.rear_tire_pressure.value, null);
  assert.equal(r.fields.rear_tire_pressure.delta, 1);
  assert.equal(r.fields.rear_tire_pressure.status, 'relative');
  const r2 = run({ kart: { seatPositionIn: null } });
  assert.equal(r2.fields.seat_fore_aft.status, 'withheld');
});

test('gearing: spec gear at OVRP cannot be changed, even when the engine revs out', () => {
  const r = run({ track: 'ovrp', kart: { axleSprocket: 86 }, feel: { text: 'tops out on the straight' } });
  assert.equal(r.fields.axle_sprocket.value, 89);
  assert.equal(r.fields.axle_sprocket.display, '10/89');
  assert.ok(r.legality.currentIssues.some(i => i.field === 'axle_sprocket'));
  assert.ok(r.next.some(n => n.tag === 'tops_out'));
});

test('gearing: open gear at Rocky Ridge, revving out drops 2 teeth, snapped to owned sprockets', () => {
  assert.equal(run({ feel: { text: 'tops out at the end of the straight' } }).fields.axle_sprocket.value, 87);
  assert.equal(run({ feel: { text: 'tops out' }, kart: { sprocketsOwned: [84, 86, 89] } }).fields.axle_sprocket.value, 86);
  const none = run({ kart: { axleSprocket: null } });
  assert.equal(none.fields.axle_sprocket.value, 89, 'starts at the WKA-suggested 10/89');
  assert.match(none.fields.axle_sprocket.steps[1].text, /No corner geometry/);
});

test('jetting: denser air than the reference session → bigger jet; thinner → smaller', () => {
  const ref = { jet: 58, densityAltitudeFt: 2000 };
  const cold = run({ weather: { airTempF: 35, trackTempF: 40, rhPct: 40, pressureInHg: 29.9, pressureKind: 'station' }, kart: { jetReference: ref } });
  assert.ok(cold.derived.air.densityAltitudeFt < -1000);
  assert.ok(cold.fields.main_jet.value > 58, `cold dense air jet ${cold.fields.main_jet.value}`);
  const hot = run({ weather: { airTempF: 95, trackTempF: 120, rhPct: 90, pressureInHg: 28.2 }, kart: { jetReference: ref } });
  assert.ok(hot.derived.air.densityAltitudeFt > 4500);
  assert.ok(hot.fields.main_jet.value < 58);
});

test('jetting: rounding favours the richer jet', () => {
  // Pick a reference so the exact answer lands just above x.3 → rounds up.
  const r = run({ kart: { jetReference: { jet: 58, densityAltitudeFt: 0 } }, weather: { airTempF: 59, trackTempF: 70, rhPct: 0, pressureInHg: 29.92 } });
  const st = r.fields.main_jet.steps.find(s => s.stage === 'air');
  const exact = Number(/Exact ([\d.]+)/.exec(st.text)[1]);
  assert.equal(r.fields.main_jet.value, exact - Math.floor(exact) >= 0.3 ? Math.floor(exact) + 1 : Math.floor(exact));
});

test('jetting: no reference session → jet kept; no jet entered → #58 start with anecdote confidence', () => {
  assert.equal(run().fields.main_jet.value, 58);
  assert.match(run().fields.main_jet.reason, /No reference session/);
  const r = run({ kart: { mainJet: null } });
  assert.equal(r.fields.main_jet.value, 58);
  assert.equal(r.fields.main_jet.steps[0].confidence, 'anecdote');
});

test('carb feel: lean → one size richer, urgent; rich → one size leaner; bog alone → no change', () => {
  const lean = run({ feel: { text: 'pinging at the end of the straight' } });
  assert.equal(lean.fields.main_jet.value, 59);
  assert.ok(lean.fields.main_jet.steps.some(s => s.urgent));
  assert.equal(run({ feel: { text: 'four-stroking on the straight' } }).fields.main_jet.value, 57);
  const bog = run({ feel: { text: 'bogs off the hairpin' } });
  assert.equal(bog.fields.main_jet.value, 58);
  assert.ok(bog.next.some(n => n.tag === 'bog'));
  assert.equal(run({ feel: { text: 'smoky, also pinging' } }).fields.main_jet.value, 58, 'rich + lean → read the plug first');
});

test('carb feel stays inside the jets you own', () => {
  assert.equal(run({ kart: { mainJet: 58, jetsOwned: [56, 58] }, feel: { text: 'pinging' } }).fields.main_jet.value, 58);
});

test('ballast: brings kart + driver to the club minimum plus margin', () => {
  const r = run({ track: 'ovrp', driver: { weightLb: 45, experience: 'novice' } });
  assert.equal(r.fields.ballast_lb.value, 150 + 2 - 95 - 45);
  assert.equal(run({ track: 'ovrp', kart: { weightLb: null } }).fields.ballast_lb.status, 'withheld');
  assert.match(run({ track: 'rocky-ridge' }).fields.ballast_lb.reason, /No minimum weight/);
  assert.equal(run({ track: 'rocky-ridge', ruleSet: 'club+wka' }).fields.ballast_lb.value, 150 + 2 - 95 - 50);
});

test('driver: a novice never gets a rear-grip reduction for understeer (front lever used instead)', () => {
  const nov = run({ feel: { text: 'pushes on exit' } });
  assert.equal(nov.fields.rear_track_width.value, 40);
  assert.equal(nov.fields.front_track_width.value, 38.4);
  const exp = run({ feel: { text: 'pushes on exit' }, driver: { weightLb: 50, experience: 'experienced' } });
  assert.equal(exp.fields.rear_track_width.value, 40.5);
});

test('driver: hop is the one exception to the novice rear-grip floor (ballast lower first)', () => {
  const r = run({ feel: { text: 'hops in the hairpin' }, kart: { ballastHeight: 'mid' } });
  assert.equal(r.fields.ballast_height.value, 'low');
  const r2 = run({ feel: { text: 'hops in the hairpin' } });
  assert.equal(r2.fields.rear_track_width.value, 40.5, 'ballast already low → widen rear');
});

test('feel: at most two handling changes; the rest go to "what to change next"', () => {
  const r = run({ feel: { text: 'loose on entry, pushes mid corner, hops, takes a few laps to get grip' } });
  assert.equal(r.feel.applied.length, 2);
  assert.ok(r.next.length >= 2);
  assert.deepEqual(r.feel.applied.map(a => a.tag), ['hop', 'oversteer_entry'], 'safety-first priority order');
});

test('feel: contradictory reports at the same phase make no change for that phase', () => {
  const r = run({ feel: { text: 'pushes on entry. loose on entry' } });
  assert.equal(r.feel.applied.length, 0);
  assert.equal(r.feel.conflicts.length, 1);
});

test('adjustments not confirmed on this chassis are never recommended', () => {
  const r = run({ feel: { text: 'pushes everywhere, loose on exit, hops' }, driver: { weightLb: 50, experience: 'experienced' } });
  for (const id of ['caster', 'camber', 'toe', 'axle']) {
    assert.equal(r.fields[id].status, 'not_adjustable');
    assert.equal(typeof r.fields[id].value, 'string');
  }
  assert.ok(!r.feel.applied.some(a => ['caster', 'camber', 'toe', 'ride_height', 'torsion_bar'].includes(a.lever)));
});

test('legality: rule sets, C52 eligibility and layer conflicts are surfaced', () => {
  assert.deepEqual(ruleSetsFor(kb, 'ovrp').map(s => s.id), ['club', 'club+wka']);
  const r = run({ track: 'ovrp' });
  assert.ok(r.legality.currentIssues.some(i => i.field === 'engine_model'), 'OVRP 2024 sheet lists only the C51');
  const both = run({ track: 'ovrp', ruleSet: 'club+wka' });
  assert.ok(both.legality.conflicts.some(c => c.startsWith('fuel')), 'WKA 87 octane vs OVRP MS98L/MS93');
  assert.equal(run().legality.currentIssues.length, 0, 'Rocky Ridge club rules: nothing illegal');
});

test('wet: rain tire from the rule, wet note shown', () => {
  const r = run({ track: 'ovrp', surface: 'wet' });
  assert.equal(r.fields.tire_spec.value, 'MG Rain');
  assert.ok(r.notes.some(n => /wet-weather/.test(n)));
});

test('every output field has a reason and resolvable sources', () => {
  const r = run({ track: 'ovrp', feel: { text: 'pushes on entry, bogs' }, kart: { jetReference: { jet: 58, densityAltitudeFt: 1000 } } });
  for (const id of r.order) {
    const f = r.fields[id];
    assert.ok(f, id);
    assert.ok(f.reason && f.reason.length > 5, `${id} reason`);
    assert.ok(f.steps.length && f.steps.every(s => s.sources.length && s.text), `${id} steps cite sources`);
    for (const s of resolveSources(kb, f.steps.flatMap(s => s.sources))) assert.ok(!s.missing, `${id}: unresolved source ${s.id}`);
  }
});

test('same input → same output', () => {
  const a = run({ feel: { text: 'pushes on entry' } }), b = run({ feel: { text: 'pushes on entry' } });
  assert.deepEqual(a, b);
});
