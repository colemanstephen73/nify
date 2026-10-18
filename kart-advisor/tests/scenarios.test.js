// End-to-end scenarios from the brief, plus a property grid over many input combinations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kb } from './helpers/kb.js';
import { recommend, resolveSources } from '../engine/index.js';

const myKart = { weightLb: 92, engine: 'Comer C52', frontPressurePsi: 14, rearPressurePsi: 14, frontTrackWidthIn: 38, rearTrackWidthIn: 40, mainJet: 58, axleSprocket: 89, ballastHeight: 'low', ballastLb: 0 };

test('OVRP, hot dry rubbered-in, 45 lb novice driver', () => {
  const r = recommend(kb, {
    track: 'ovrp', surface: 'dry', rubber: 'rubbered', tires: { brand: 'MG Red', age: 'scuffed' },
    weather: { airTempF: 90, trackTempF: 128, rhPct: 45, pressureInHg: 29.35 },
    driver: { weightLb: 45, experience: 'novice' }, kart: { ...myKart, jetReference: { jet: 58, densityAltitudeFt: 1200 } },
  });
  // Rubbered-in (+) but a 128 °F track is greasy (-): the grip model lands on "normal", not "high".
  assert.equal(r.derived.gripBand, 'normal');
  assert.equal(r.fields.rear_track_width.value, 40, 'novice: rear width kept');
  assert.equal(r.fields.front_tire_pressure.value, 13.5, 'hot track: -0.5 psi');
  assert.equal(r.fields.axle_sprocket.display, '10/89', 'OVRP spec gear');
  assert.equal(r.fields.tire_spec.value, 'MG Red');
  assert.equal(r.fields.ballast_lb.value, 150 + 2 - 92 - 45);
  assert.ok(r.derived.air.densityAltitudeFt > 2500, 'hot day at OVRP is well above the reference');
  assert.ok(r.fields.main_jet.value <= 58, 'thinner air: never richer than the reference');
  assert.ok(r.legality.currentIssues.some(i => i.field === 'min_weight_lb'), 'without ballast the kart is light');
  assert.ok(r.legality.currentIssues.some(i => i.field === 'engine_model'), 'C52 eligibility at OVRP flagged');
  assert.equal(r.legality.blocked.length, 0);
});

test('Rocky Ridge, cool damp green track', () => {
  const r = recommend(kb, {
    track: 'rocky-ridge', surface: 'damp', rubber: 'green', tires: { brand: 'MG Red', age: 'scuffed' },
    weather: { airTempF: 52, trackTempF: 55, rhPct: 85, pressureInHg: 28.45 },
    driver: { weightLb: 48, experience: 'novice' }, kart: { ...myKart, jetReference: { jet: 58, densityAltitudeFt: 1500 } },
  });
  assert.equal(r.derived.gripBand, 'low');
  assert.equal(r.fields.rear_track_width.value, 39.5, 'more rear grip');
  assert.equal(r.fields.rear_tire_pressure.value, 15, 'cold track: +1 psi to build heat');
  assert.equal(r.fields.front_tire_pressure.value, 15);
  assert.ok(r.derived.air.densityAltitudeFt < 1500, 'cool air is denser than the reference');
  assert.ok(r.fields.main_jet.value >= 58, 'denser air: never leaner than the reference');
  assert.equal(r.fields.axle_sprocket.value, 89, 'no gear rule, no geometry: baseline kept');
  assert.equal(r.track.geometry, 'missing');
  assert.equal(r.legality.currentIssues.length, 0);
});

test('Wet day at OVRP: rain tires, rear grip added, honest about missing wet guidance', () => {
  const r = recommend(kb, { track: 'ovrp', surface: 'wet', rubber: 'green', weather: { airTempF: 60, trackTempF: 58, rhPct: 98, pressureInHg: 29.2 }, driver: { weightLb: 45 }, kart: myKart });
  assert.equal(r.fields.tire_spec.value, 'MG Rain');
  assert.equal(r.fields.rear_track_width.value, 39.5);
  assert.ok(r.notes.some(n => /No sourced wet-weather/.test(n)));
});

test('Humid, low-pressure, hot day: rich risk → smaller jet than the reference', () => {
  const r = recommend(kb, { track: 'rocky-ridge', weather: { airTempF: 92, trackTempF: 115, rhPct: 95, pressureInHg: 28.1 }, driver: { weightLb: 50 }, kart: { ...myKart, jetReference: { jet: 58, densityAltitudeFt: 1000 } } });
  assert.ok(r.fields.main_jet.value < 58);
  assert.ok(r.fields.main_jet.steps.some(s => s.stage === 'air' && /thinner/.test(s.text)));
});

test('Illegal current setup is warned, and an illegal output is clamped or blocked', () => {
  // Synthetic event supplement with a jet cap, layered on Rocky Ridge.
  const k = structuredClone(kb);
  k.tracks['rocky-ridge'].limits.push({ field: 'main_jet', op: 'max', value: 58, sources: ['vtsk_rules'], confidence: 'track_official' });
  const r = recommend(k, { track: 'rocky-ridge', weather: { airTempF: 30, trackTempF: 35, rhPct: 30, pressureInHg: 29.4 }, driver: { weightLb: 50 },
    kart: { ...myKart, mainJet: 60, jetReference: { jet: 58, densityAltitudeFt: 2500 } } });
  assert.ok(r.legality.currentIssues.some(i => i.field === 'main_jet' && i.value === 60), 'current #60 is over the cap');
  assert.equal(r.fields.main_jet.value, 58, 'dense air wants a bigger jet, the rule caps it');
  assert.ok(r.fields.main_jet.steps.some(s => s.stage === 'legality'));
  // A contradiction between layers blocks the output instead of showing it.
  k.tracks['rocky-ridge'].limits.push({ field: 'main_jet', op: 'min', value: 60, sources: ['vtsk_rules'], confidence: 'track_official' });
  const b = recommend(k, { track: 'rocky-ridge', driver: { weightLb: 50 }, kart: myKart });
  assert.equal(b.fields.main_jet.status, 'blocked');
  assert.equal(b.fields.main_jet.value, null);
  assert.ok(b.legality.blocked.includes('main_jet'));
});

test('Feel: understeer on entry + bog → front width change, no blind jet change', () => {
  const r = recommend(kb, { track: 'rocky-ridge', driver: { weightLb: 50, experience: 'novice' }, kart: myKart, feel: { text: "won't turn in, and it bogs off the slow corner", chips: [] } });
  assert.deepEqual(r.feel.applied.map(a => a.lever), ['front_track_width']);
  assert.equal(r.fields.main_jet.value, 58);
  assert.ok(r.next.some(n => n.tag === 'bog'));
});

test('Unknown baselines: nothing is invented', () => {
  const r = recommend(kb, { track: 'ovrp', surface: 'damp', driver: { weightLb: 45 }, kart: { engine: 'Comer C52' }, weather: { airTempF: 50, trackTempF: 52 } });
  assert.equal(r.fields.rear_track_width.value, null);
  assert.equal(r.fields.rear_track_width.delta, -0.5, 'direction and amount still given');
  assert.equal(r.fields.ballast_lb.status, 'withheld', 'kart weight unknown');
  assert.equal(r.fields.spark_plug.status, 'withheld');
  assert.ok(r.verify.some(v => /Pressure not entered/.test(v)));
});

// ---------- property grid ----------
test('invariants hold across a grid of conditions, drivers and feedback', () => {
  const feels = ['', 'pushes on entry', 'loose on exit', 'hops', 'pushes mid corner, loose on entry, hops', 'pinging', 'four-stroking', 'tops out', 'pushes on exit'];
  let n = 0;
  for (const track of ['ovrp', 'rocky-ridge']) for (const surface of ['dry', 'damp', 'wet']) for (const rubber of ['green', 'medium', 'rubbered'])
    for (const t of [40, 70, 130]) for (const experience of ['novice', 'intermediate', 'experienced']) for (const text of feels) {
      const inputs = { track, surface, rubber, weather: { airTempF: t - 10, trackTempF: t, rhPct: 60, pressureInHg: 28.8 }, driver: { weightLb: 50, experience }, kart: { ...myKart, jetReference: { jet: 58, densityAltitudeFt: 1000 } }, feel: { text } };
      const r = recommend(kb, inputs);
      n++;
      const tag = `${track}/${surface}/${rubber}/${t}/${experience}/"${text}"`;
      assert.ok(r.feel.applied.length <= 2, `≤2 handling changes ${tag}`);
      if (track === 'ovrp') assert.equal(r.fields.axle_sprocket.value, 89, tag);
      if (experience === 'novice') {
        // Novice: rear grip never reduced below baseline, except to cure hop.
        const rearW = r.fields.rear_track_width, hopFix = r.feel.applied.some(a => a.tag === 'hop' && a.lever === 'rear_track_width');
        if (!hopFix) assert.ok(rearW.value <= rearW.baseline, `novice rear width ${rearW.value} ${tag}`);
        assert.equal(r.fields.seat_fore_aft.value, null, 'seat is not a novice lever');
      }
      const jet = r.fields.main_jet.value;
      assert.ok(jet >= 54 && jet <= 62, `jet in range ${tag}`);
      for (const id of r.order) {
        const f = r.fields[id];
        assert.ok(f.reason && f.steps.every(s => s.sources.length), `${id} cited ${tag}`);
        if (f.status !== 'blocked' && typeof f.value === 'number') assert.ok(Number.isFinite(f.value), `${id} finite ${tag}`);
      }
      if (n % 97 === 0) for (const s of resolveSources(kb, Object.values(r.fields).flatMap(f => f.steps.flatMap(x => x.sources)))) assert.ok(!s.missing, s.id);
    }
  assert.ok(n > 900);
});
