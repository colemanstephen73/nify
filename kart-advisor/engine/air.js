// Air density and density altitude. Pure functions, SI units inside.
// Method: ISA troposphere (ICAO Doc 7488) + Tetens saturation vapour pressure.
// These are standard physics, not kart-specific; sources are listed in data/air.yaml.

export const ISA = {
  T0: 288.15,          // K, sea-level temperature
  P0: 1013.25,         // hPa, sea-level pressure
  rho0: 1.225,         // kg/m³, sea-level density
  L: 0.0065,           // K/m, lapse rate
  g: 9.80665,          // m/s²
  Rd: 287.058,         // J/(kg·K), dry air
  Rv: 461.495,         // J/(kg·K), water vapour
};
const EXP = ISA.g / (ISA.Rd * ISA.L);      // ≈ 5.2559 (pressure exponent)

export const fToC = f => (f - 32) * 5 / 9;
export const cToF = c => c * 9 / 5 + 32;
export const inHgToHpa = x => x * 33.8639;
export const hpaToInHg = x => x / 33.8639;
export const ftToM = x => x * 0.3048;
export const mToFt = x => x / 0.3048;

// Saturation vapour pressure over water, hPa (Tetens 1930).
export function saturationVaporPressure(tC) {
  return 6.1078 * Math.pow(10, (7.5 * tC) / (tC + 237.3));
}

// Station (absolute) pressure from a sea-level-reduced reading such as a
// weather-report "barometer" / altimeter setting, hPa.
export function stationPressureFromSeaLevel(seaLevelHpa, elevationM) {
  return seaLevelHpa * Math.pow(1 - (ISA.L * elevationM) / ISA.T0, EXP);
}

// Air density in kg/m³ from station pressure (hPa), temperature (°C), relative humidity (0–100).
export function airDensity({ stationPressureHpa, tempC, rhPct }) {
  const T = tempC + 273.15;
  const pv = (Math.max(0, Math.min(100, rhPct)) / 100) * saturationVaporPressure(tempC);
  const pd = stationPressureHpa - pv;
  return (pd * 100) / (ISA.Rd * T) + (pv * 100) / (ISA.Rv * T);
}

// Altitude in the ISA at which density equals `rho`. Returns metres.
export function densityAltitudeFromDensity(rho) {
  return (ISA.T0 / ISA.L) * (1 - Math.pow(rho / ISA.rho0, 1 / (EXP - 1)));
}

// ISA density at a given density altitude (m). Inverse of densityAltitudeFromDensity.
export function densityFromDensityAltitude(hM) {
  return ISA.rho0 * Math.pow(1 - (ISA.L * hM) / ISA.T0, EXP - 1);
}

// Convenience: everything the engine needs from the weather inputs.
// pressure: { kind: 'station' | 'sea_level', hpa }; elevation is required for 'sea_level',
// and is used to estimate station pressure when pressure is missing entirely.
export function airState({ tempC, rhPct, pressure, elevationM }) {
  let stationPressureHpa, pressureNote;
  if (pressure && pressure.kind === 'station') {
    stationPressureHpa = pressure.hpa;
    pressureNote = 'station pressure entered';
  } else if (pressure && pressure.kind === 'sea_level') {
    if (elevationM == null) throw new Error('sea-level pressure needs track elevation');
    stationPressureHpa = stationPressureFromSeaLevel(pressure.hpa, elevationM);
    pressureNote = 'converted from sea-level pressure using track elevation';
  } else {
    if (elevationM == null) throw new Error('no pressure and no elevation');
    stationPressureHpa = stationPressureFromSeaLevel(ISA.P0, elevationM);
    pressureNote = 'no pressure given: assumed standard-day pressure at track elevation';
  }
  const rho = airDensity({ stationPressureHpa, tempC, rhPct: rhPct ?? 50 });
  const daM = densityAltitudeFromDensity(rho);
  return {
    stationPressureHpa, rho,
    relativeDensity: rho / ISA.rho0,
    densityAltitudeM: daM,
    densityAltitudeFt: mToFt(daM),
    pressureNote,
    humidityAssumed: rhPct == null,
  };
}
