import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../engine/air.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

test('ISA sea level: density 1.225, density altitude 0', () => {
  const s = A.airState({ tempC: 15, rhPct: 0, pressure: { kind: 'station', hpa: 1013.25 } });
  near(s.rho, 1.225, 0.001, 'rho');
  near(s.densityAltitudeFt, 0, 15, 'DA');
});

test('ISA 5000 ft standard day gives DA ≈ 5000 ft', () => {
  // ISA at 1524 m: T = 5.094 °C, P = 843.07 hPa
  const s = A.airState({ tempC: 5.094, rhPct: 0, pressure: { kind: 'station', hpa: 843.07 } });
  near(s.densityAltitudeFt, 5000, 20, 'DA');
});

test('hot day: ~ +120 ft DA per °C above ISA (dry)', () => {
  const s = A.airState({ tempC: 35, rhPct: 0, pressure: { kind: 'station', hpa: 1013.25 } });
  near(s.densityAltitudeFt, 20 * 120, 300, 'DA');
});

test('humidity lowers density (raises DA)', () => {
  const dry = A.airState({ tempC: 30, rhPct: 0, pressure: { kind: 'station', hpa: 1000 } });
  const wet = A.airState({ tempC: 30, rhPct: 100, pressure: { kind: 'station', hpa: 1000 } });
  assert.ok(wet.rho < dry.rho);
  assert.ok(wet.densityAltitudeFt - dry.densityAltitudeFt > 300, 'humid 30 °C adds several hundred ft');
});

test('Tetens saturation vapour pressure reference points', () => {
  near(A.saturationVaporPressure(0), 6.11, 0.01, 'es(0)');
  near(A.saturationVaporPressure(20), 23.37, 0.1, 'es(20)');
  near(A.saturationVaporPressure(30), 42.43, 0.2, 'es(30)');
});

test('sea-level pressure is converted to station pressure using elevation', () => {
  const p = A.stationPressureFromSeaLevel(1013.25, A.ftToM(1000));
  near(p, 977.2, 0.5, 'station pressure at 1000 ft');
  // Mixing them up is the classic ~1000 ft error, so make sure the two kinds differ.
  const st = A.airState({ tempC: 15 - 0.0065 * A.ftToM(1000), rhPct: 0, pressure: { kind: 'sea_level', hpa: 1013.25 }, elevationM: A.ftToM(1000) });
  near(st.densityAltitudeFt, 1000, 30, 'standard day at 1000 ft');
});

test('missing pressure needs elevation; assumption is reported', () => {
  assert.throws(() => A.airState({ tempC: 15, rhPct: 50 }));
  const s = A.airState({ tempC: 15, elevationM: 300 });
  assert.match(s.pressureNote, /assumed/);
  assert.equal(s.humidityAssumed, true);
});

test('unit conversions round-trip', () => {
  near(A.fToC(A.cToF(21.3)), 21.3, 1e-9, 'F/C');
  near(A.hpaToInHg(A.inHgToHpa(29.92)), 29.92, 1e-9, 'inHg');
  near(A.inHgToHpa(29.92), 1013.2, 0.1, '29.92 inHg');
});
