import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../engine/geometry.js';

// Build a closed path from straights and arcs: ['S', len] or ['L'|'R', radius, angleDeg].
function track(parts) {
  let x = 0, y = 0, h = 0;
  const pts = [[x, y]];
  for (const p of parts) {
    if (p[0] === 'S') {
      for (let s = 0.5; s <= p[1]; s += 0.5) pts.push([x + s * Math.cos(h), y + s * Math.sin(h)]);
      x += p[1] * Math.cos(h); y += p[1] * Math.sin(h);
    } else {
      const sg = p[0] === 'L' ? 1 : -1, R = p[1], A = (p[2] * Math.PI) / 180;
      const cx = x - sg * R * Math.sin(h), cy = y + sg * R * Math.cos(h);
      const steps = Math.ceil((R * A) / 0.5);
      for (let k = 1; k <= steps; k++) {
        const hh = h + sg * (A * k) / steps;
        pts.push([cx + sg * R * Math.sin(hh), cy - sg * R * Math.cos(hh)]);
      }
      h += sg * A; x = pts[pts.length - 1][0]; y = pts[pts.length - 1][1];
    }
  }
  return pts.slice(0, -1);
}

test('oval of two 180° hairpins: 2 hairpins, correct radius and straights', () => {
  const r = G.analyzeCentreline(track([['S', 60], ['L', 8, 180], ['S', 60], ['L', 8, 180]]));
  assert.deepEqual(r.warnings, []);
  assert.equal(r.corners.length, 2);
  for (const c of r.corners) {
    assert.equal(c.type, 'hairpin');
    assert.equal(c.direction, 'left');
    assert.ok(Math.abs(c.minRadiusM - 8) < 1.5, `radius ${c.minRadiusM}`);
    assert.ok(Math.abs(c.precedingStraightM - 60) < 8, `straight ${c.precedingStraightM}`);
  }
  assert.ok(Math.abs(r.lengthM - (120 + 2 * Math.PI * 8)) < 2);
  assert.equal(r.demands.character, 'acceleration');
});

test('clockwise rectangle with 90° corners reads as right-handers', () => {
  const r = G.analyzeCentreline(track([['S', 50], ['R', 12, 90], ['S', 30], ['R', 12, 90], ['S', 50], ['R', 12, 90], ['S', 30], ['R', 12, 90]]));
  assert.equal(r.corners.length, 4);
  assert.ok(r.corners.every(c => c.direction === 'right' && c.type === 'medium'));
  assert.ok(r.corners.every(c => Math.abs(c.turnAngleDeg - 90) < 8));
});

// A half-lap turning 180° repeated twice always closes (point symmetry).
const twice = half => track([...half, ...half]);

test('kink, sweeper, chicane and tight corner are classified exactly', () => {
  const r = G.analyzeCentreline(twice([
    ['S', 40], ['L', 30, 20],                          // kink
    ['S', 30], ['L', 30, 70],                          // sweeper
    ['S', 20], ['R', 9, 60], ['S', 5], ['L', 9, 60],   // chicane
    ['S', 30], ['L', 8, 90],                           // tight
  ]));
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.corners.map(c => c.type), Array(2).fill(['kink', 'sweeper', 'tight', 'tight', 'tight']).flat());
  const kink = r.corners[0];
  assert.ok(Math.abs(kink.turnAngleDeg - 20) <= 4, `kink angle ${kink.turnAngleDeg}`);
  assert.ok(Math.abs(r.corners[1].turnAngleDeg - 70) <= 5);
  const chic = r.corners.filter(c => c.chicane === 1);
  assert.equal(chic.length, 2, 'two corners in the first chicane');
  assert.notEqual(chic[0].direction, chic[1].direction);
  assert.ok(Math.abs(r.demands.longestStraightM - 40) < 10);
});

test('decreasing radius corner is detected', () => {
  const r = G.analyzeCentreline(twice([['S', 60], ['L', 20, 50], ['L', 7, 80], ['S', 40], ['L', 12, 50]]));
  assert.deepEqual(r.warnings, []);
  assert.equal(r.corners.length, 4);
  assert.deepEqual(r.corners.map(c => c.type), ['decreasing_radius', 'medium', 'decreasing_radius', 'medium']);
});

test('an open trace is flagged', () => {
  const r = G.analyzeCentreline(track([['S', 60], ['L', 10, 180], ['S', 30]]));
  assert.equal(r.warnings.length, 1);
});

test('pixel trace scaled to published length; y flip keeps directions', () => {
  // A counter-clockwise square in maths coords is clockwise in image coords.
  const px = [];
  for (let i = 0; i < 100; i++) px.push([i, 0]);
  for (let i = 0; i < 100; i++) px.push([100, i]);
  for (let i = 100; i > 0; i--) px.push([i, 100]);
  for (let i = 100; i > 0; i--) px.push([0, i]);
  const m = G.fromPixels(px, { targetLengthM: 277 });
  assert.ok(Math.abs(G.perimeter(m) - 277) < 0.5);
  const r = G.analyzeCentreline(m, { cornerRadius: 60 });
  assert.ok(r.corners.every(c => c.direction === 'right'), 'image-clockwise square turns right');
});

test('lat/lon conversion preserves distances', () => {
  const m = G.fromLatLon([[44.0, -72.0], [44.001, -72.0]]);
  assert.ok(Math.abs(m[1][1] - 111.2) < 0.5);
});
