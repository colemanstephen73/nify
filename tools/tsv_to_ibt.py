#!/usr/bin/env python3
"""
Write a SYNTHETIC iRacing-format .ibt file from the synthetic sample TSV, for
testing the .ibt reader. Follows the irsdk disk layout:

  irsdk_header (112 B) | irsdk_diskSubHeader (32 B) | varHeaders (144 B each)
  | session-info YAML | records (bufLen B each, little-endian)

Channels use iRacing names and units (Speed m/s, Throttle/Brake 0-1,
SteeringWheelAngle rad, Lat/LongAccel m/s^2, Lat/Lon deg). Garage frames
(IsOnTrack = 0), pit-road flags on out/in laps, PlayerTrackSurface = OffTrack
during the injected off-tracks, and an array channel are included so every
reader path is exercised.

    python3 tools/tsv_to_ibt.py data/sample_session.tsv data/sample_session.truth.json data/sample_session.ibt
"""
import json
import math
import struct
import sys
import time

import numpy as np
import pandas as pd

CHAR, BOOL, INT, BITFIELD, FLOAT, DOUBLE = range(6)
SIZE = {CHAR: 1, BOOL: 1, INT: 4, BITFIELD: 4, FLOAT: 4, DOUBLE: 8}
FMT = {CHAR: "B", BOOL: "?", INT: "i", BITFIELD: "I", FLOAT: "f", DOUBLE: "d"}
TICK = 60


def main(tsv, truth_path, out):
    d = pd.read_csv(tsv, sep="\t", comment="#", on_bad_lines="skip").apply(pd.to_numeric, errors="coerce").dropna(subset=["Time [s]", "Lap", "Distance [m]"])
    d = d.drop_duplicates(subset=["Time [s]"]).sort_values("Time [s]").reset_index(drop=True)
    d = d.interpolate(limit_direction="both")
    truth = json.load(open(truth_path))
    L = truth["track_length_m"]
    # resample to 60 Hz (iRacing's disk rate) per contiguous block
    t0, t1 = d["Time [s]"].iloc[0], d["Time [s]"].iloc[-1]
    tt = np.arange(t0, t1, 1 / TICK)
    gap = np.diff(d["Time [s]"].values)
    block_edges = np.where(gap > 1.0)[0]
    valid = np.ones(len(tt), bool)
    for e in block_edges:
        a, b = d["Time [s]"].iloc[e], d["Time [s]"].iloc[e + 1]
        valid &= ~((tt > a) & (tt < b))  # pit stop: no records (car in garage/stall)
    tt = tt[valid]

    def I(col):
        return np.interp(tt, d["Time [s]"].values, d[col].values)

    lap = np.interp(tt, d["Time [s]"].values, d["Lap"].values)
    lap = np.floor(lap + 1e-9).astype(int)
    # distance: interpolate within laps only
    dist = np.empty(len(tt))
    for lp in np.unique(lap):
        m = lap == lp
        sub = d[d.Lap == lp]
        dist[m] = np.interp(tt[m], sub["Time [s]"].values, sub["Distance [m]"].values)
    lat0, lon0 = 47.2197, 14.7647
    x, y = I("PosX [m]"), I("PosY [m]")
    lat = lat0 + y / 6371000 * 180 / math.pi
    lon = lon0 + x / (6371000 * math.cos(math.radians(lat0))) * 180 / math.pi
    surface = np.full(len(tt), 3, np.int32)  # irsdk_OnTrack
    corners = truth["corners"]
    for ev in truth["events"]:
        if ev["type"] == "off_track_exit":
            c = corners[ev["corner"]]
            m = (lap == ev["lap"]) & (dist > c["end_m"] + 15) & (dist < c["end_m"] + 75)
            surface[m] = 0  # irsdk_OffTrack
    on_pit = np.zeros(len(tt), bool)
    for lp, info in truth["laps"].items():
        lp = int(lp)
        if info["partial"]:
            m = lap == lp
            if lp in (1, 13):
                on_pit[m & (dist < 380 + 60)] = True
            else:
                on_pit[m & (dist > 2900 - 120)] = True
    surface[on_pit] = 2  # irsdk_AproachingPits
    lap_last = np.full(len(tt), -1.0)
    sim = {int(k): v["simulated_lap_time_s"] for k, v in truth["laps"].items()}
    for lp in np.unique(lap):
        prev = lp - 1
        if prev in sim and not truth["laps"][str(prev)]["partial"]:
            m = np.where(lap == lp)[0]
            lap_last[m[min(len(m) - 1, 6):]] = sim[prev]  # updates a few ticks after the line, like iRacing
    chans = [
        ("SessionTime", DOUBLE, 1, "s", "Seconds since session start", tt - t0 + 12.0),
        ("SessionNum", INT, 1, "", "Session number", np.zeros(len(tt))),
        ("Lap", INT, 1, "", "Laps started count", lap),
        ("LapDist", FLOAT, 1, "m", "Meters traveled from S/F this lap", dist),
        ("LapDistPct", FLOAT, 1, "%", "Percentage distance around lap", dist / L),
        ("Speed", FLOAT, 1, "m/s", "GPS vehicle speed", I("Speed [km/h]") / 3.6),
        ("Throttle", FLOAT, 1, "%", "0=off throttle to 1=full throttle", I("Throttle [%]") / 100),
        ("Brake", FLOAT, 1, "%", "0=brake released to 1=max pedal force", I("Brake [bar]") / 100),
        ("SteeringWheelAngle", FLOAT, 1, "rad", "Steering wheel angle", np.radians(I("Steering [deg]"))),
        ("Gear", INT, 1, "", "-1=reverse 0=neutral 1..n=current gear", np.round(I("Gear"))),
        ("RPM", FLOAT, 1, "revs/min", "Engine rpm", I("RPM")),
        ("LatAccel", FLOAT, 1, "m/s^2", "Lateral acceleration (including gravity)", I("LatAcc [g]") * 9.80665),
        ("LongAccel", FLOAT, 1, "m/s^2", "Longitudinal acceleration (including gravity)", I("LonAcc [g]") * 9.80665),
        ("Lat", DOUBLE, 1, "deg", "Latitude in decimal degrees", lat),
        ("Lon", DOUBLE, 1, "deg", "Longitude in decimal degrees", lon),
        ("Alt", FLOAT, 1, "m", "Altitude in meters", np.full(len(tt), 677.0)),
        ("IsOnTrack", BOOL, 1, "", "1=Car on track physics running with player in car", np.ones(len(tt))),
        ("OnPitRoad", BOOL, 1, "", "Is the player car on pit road between the cones", on_pit),
        ("PlayerTrackSurface", INT, 1, "irsdk_TrkLoc", "Players car track surface type", surface),
        ("LapLastLapTime", FLOAT, 1, "s", "Players last lap time", lap_last),
        ("FuelLevel", FLOAT, 1, "l", "Liters of fuel remaining", 60 - (tt - t0) * 0.02),
        ("PlayerCarMyIncidentCount", INT, 1, "", "Players own incident count for this session", np.cumsum(np.r_[0, np.diff((surface == 0).astype(int)) == 1])),
        ("CarIdxLapDistPct", FLOAT, 64, "%", "Percentage distance around lap by car index", None),
        ("WaterTemp", FLOAT, 1, "C", "Engine coolant temp", np.full(len(tt), 88.0)),
    ]
    # garage frames before driving (IsOnTrack = 0, garbage values)
    G = 90
    offs, o = [], 0
    for c in chans:
        offs.append(o)
        o += SIZE[c[1]] * c[2]
    buf_len = o
    yaml = f"""---
WeekendInfo:
 TrackName: synthetic_ring
 TrackID: 999
 TrackLength: {L / 1000:.2f} km
 TrackDisplayName: Synthetic Test Ring
 TrackDisplayShortName: Synth Ring
 TrackConfigName: Full Course
 TrackCity: Nowhere
 TrackCountry: Testland

SessionInfo:
 Sessions:
 - SessionNum: 0
   SessionLaps: unlimited
   SessionType: Practice
   SessionName: PRACTICE

SplitTimeInfo:
 Sectors:
 - SectorNum: 0
   SectorStartPct: 0.000000
 - SectorNum: 1
   SectorStartPct: 0.330000
 - SectorNum: 2
   SectorStartPct: 0.680000

DriverInfo:
 DriverCarIdx: 3
 Drivers:
 - CarIdx: 0
   UserName: Pace Car
   CarScreenName: safety pcfr500s
 - CarIdx: 3
   UserName: Synthetic Driver
   CarScreenName: Synthetic GT3

...
""".encode("latin-1")
    n_rec = G + len(tt)
    var_hdr_off = 144
    sess_off = var_hdr_off + 144 * len(chans)
    buf_off = sess_off + len(yaml)
    header = struct.pack("<10i2i", 2, 1, TICK, 1, len(yaml), sess_off, len(chans), var_hdr_off, 1, buf_len, 0, 0)
    header += struct.pack("<4i", n_rec, buf_off, 0, 0) + b"\0" * 48  # varBuf[0..3]
    assert len(header) == 112
    sub = struct.pack("<qddii", int(time.time()), 12.0, float(tt[-1] - t0 + 12), int(lap.max()), n_rec)
    assert len(sub) == 32
    vh = b""
    for (name, typ, cnt, unit, desc, _), off in zip(chans, offs):
        vh += struct.pack("<iii?3x", typ, off, cnt, False)
        vh += name.encode().ljust(32, b"\0") + desc.encode()[:63].ljust(64, b"\0") + unit.encode().ljust(32, b"\0")
    assert len(vh) == 144 * len(chans)
    rows = bytearray(buf_len * n_rec)
    for ci, (name, typ, cnt, unit, desc, vals) in enumerate(chans):
        f = "<" + FMT[typ]
        sz = SIZE[typ]
        for r in range(n_rec):
            base = r * buf_len + offs[ci]
            if cnt > 1:
                continue  # array left zeroed
            if r < G:
                v = 0 if name != "LapDist" else -1.0
                if name == "SessionTime":
                    v = r / TICK
            else:
                v = vals[r - G]
            if typ in (INT, BITFIELD, CHAR):
                v = int(v)
            elif typ == BOOL:
                v = bool(v)
            else:
                v = float(v)
            struct.pack_into(f, rows, base, v)
            _ = sz
    with open(out, "wb") as fh:
        fh.write(header + sub + vh + yaml + bytes(rows))
    print(f"wrote {out}: {n_rec} records ({G} garage), {len(chans)} channels, {buf_len} B/record, {(len(rows)) / 1e6:.1f} MB")


if __name__ == "__main__":
    main(*sys.argv[1:4])
