import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeel } from '../engine/feel.js';

const tags = (t, c) => parseFeel(t, c).tags.sort();

test('phase-specific handling phrases', () => {
  assert.deepEqual(tags('Pushes on entry but loose on exit'), ['oversteer_exit', 'understeer_entry']);
  assert.deepEqual(tags("won't turn into the corners"), ['understeer_entry']);
  assert.deepEqual(tags('rear steps out on the throttle'), ['oversteer_exit']);
});

test('no phase defaults to mid-corner', () => {
  assert.deepEqual(tags('kart is tight'), ['understeer_mid']);
});

test('engine symptoms', () => {
  assert.deepEqual(tags('bogs off the hairpin'), ['bog']);
  assert.deepEqual(tags('blubbering and smoky at the top'), ['rich']);
  assert.deepEqual(tags('pinging at the end of the straight'), ['lean']);
});

test('negation is respected', () => {
  assert.deepEqual(tags('no understeer, it hops in turn 2'), ['hop']);
  assert.deepEqual(tags("didn't bog at all"), []);
});

test('chips are merged and "good" yields to real problems', () => {
  assert.deepEqual(tags('felt good', ['oversteer_entry']), ['oversteer_entry']);
});

test('conflicts and unknown text are reported, not guessed', () => {
  const r = parseFeel('pushes on entry, loose on entry, the steering wheel is purple');
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.notUnderstood, ['the steering wheel is purple']);
});
