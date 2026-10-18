import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learn } from '../engine/learn.js';

const s = (id, date, ran, bestLap, extra = {}) => ({ id, date, track: 'ovrp', surface: 'dry', trackTempF: 90, ran, bestLap, ...extra });
const base = { rear_tire_pressure: 14, rear_track_width: 40, main_jet: 58 };

test('single changes are attributed to the lap time change', () => {
  const r = learn([
    s('a', '2026-06-01T10', base, 60.0),
    s('b', '2026-06-01T11', { ...base, rear_tire_pressure: 14.5 }, 59.6),
    s('c', '2026-06-01T12', { ...base, rear_tire_pressure: 15 }, 59.4),
    s('d', '2026-06-01T13', { ...base, rear_tire_pressure: 15.5 }, 59.3),
  ], 'ovrp');
  const up = r.changes.find(c => c.field === 'rear_tire_pressure' && c.direction === 'up');
  assert.equal(up.n, 3);
  assert.equal(up.faster, 3);
  assert.equal(up.strength, 'pattern');
  assert.ok(up.meanDeltaS < 0);
});

test('fewer than 3 observations are anecdotal; combined changes are noted', () => {
  const r = learn([s('a', '1', base, 60), s('b', '2', { ...base, rear_track_width: 40.5, main_jet: 57 }, 59.8)]);
  assert.ok(r.changes.every(c => c.strength === 'anecdotal'));
  assert.match(r.changes[0].text, /with other changes/);
});

test('sessions in different conditions are not compared', () => {
  const r = learn([s('a', '1', base, 60), s('b', '2', { ...base, main_jet: 57 }, 62, { surface: 'wet' }), s('c', '3', base, 60, { trackTempF: 130 })]);
  assert.equal(r.pairsUsed, 0);
  assert.equal(r.skipped.length, 2);
});

test('latest clean-running session becomes the jetting reference', () => {
  const r = learn([
    s('a', '1', base, 60, { engineGood: true, densityAltitudeFt: 900 }),
    s('b', '2', { ...base, main_jet: 57 }, 60, { engineGood: true, densityAltitudeFt: 2600 }),
    s('c', '3', { ...base, main_jet: 56 }, 60, { engineGood: false, densityAltitudeFt: 3000 }),
  ]);
  assert.deepEqual({ jet: r.jetReference.jet, da: r.jetReference.densityAltitudeFt }, { jet: 57, da: 2600 });
});

test('lap list is used when best lap is missing', () => {
  const r = learn([s('a', '1', base, undefined, { laps: [61, 60.5] }), s('b', '2', { ...base, main_jet: 59 }, undefined, { laps: [60.2, 60.9] })]);
  assert.equal(r.changes[0].meanDeltaS, -0.3);
});
