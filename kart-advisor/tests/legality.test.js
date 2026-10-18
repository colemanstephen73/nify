import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLayers, enforce, checkCurrent, isLegal } from '../engine/legality.js';

const body = { name: 'Body', fileKey: 'rules/body', limits: [
  { field: 'main_jet', op: 'max', value: 70, sources: ['s'] },
  { field: 'axle_sprocket', op: 'one_of', value: [76, 78, 80, 82], sources: ['s'] },
  { field: 'min_weight_lb', op: 'min', value: 190, sources: ['s'] },
] };
const club = { name: 'Club', fileKey: 'tracks/club', limits: [
  { field: 'main_jet', op: 'max', value: 68, sources: ['c'] },
  { field: 'axle_sprocket', op: 'one_of', value: [80, 82, 84], sources: ['c'] },
  { field: 'min_weight_lb', op: 'min', value: 180, sources: ['c'] },
] };

test('most restrictive limit wins across layers', () => {
  const m = mergeLayers([body, club]);
  assert.equal(m.byField.main_jet.max.value, 68);
  assert.equal(m.byField.main_jet.max.layer, 'Club');
  assert.deepEqual(m.byField.axle_sprocket.one_of.value, [80, 82]);
  assert.equal(m.byField.min_weight_lb.min.value, 190);
  assert.deepEqual(m.conflicts, []);
  assert.deepEqual(m.byField.main_jet.max.sources, ['tracks/club:c']);
});

test('enforce clamps and snaps, recording why', () => {
  const m = mergeLayers([body, club]);
  const j = enforce(72, m.byField.main_jet);
  assert.equal(j.value, 68);
  assert.equal(j.adjustedBy[0].op, 'max');
  assert.equal(enforce(77, m.byField.axle_sprocket).value, 80);
  assert.equal(enforce(66, m.byField.main_jet).adjustedBy.length, 0);
});

test('irreconcilable rules block the output', () => {
  const m = mergeLayers([{ name: 'A', fileKey: 'a', limits: [{ field: 'driver_sprocket', op: 'eq', value: 10, sources: ['x'] }] },
    { name: 'B', fileKey: 'b', limits: [{ field: 'driver_sprocket', op: 'one_of', value: [11, 12], sources: ['y'] }] }]);
  assert.equal(m.conflicts.length, 1);
  const r = enforce(10, m.byField.driver_sprocket);
  assert.equal(r.value, null);
  assert.match(r.blocked, /no legal value/);
});

test('current setup is checked', () => {
  const m = mergeLayers([body, club]);
  const issues = checkCurrent({ main_jet: 70, axle_sprocket: 82, min_weight_lb: 185 }, m);
  assert.deepEqual(issues.map(i => i.field), ['main_jet', 'min_weight_lb']);
  assert.ok(isLegal(68, m.byField.main_jet));
});
