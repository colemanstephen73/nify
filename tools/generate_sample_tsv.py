#!/usr/bin/env python3
"""
Synthetic telemetry generator used to validate the analysis engine.

THIS DATA IS SYNTHETIC. It is produced by a quasi-steady-state point-mass lap
simulation of an invented circuit, with deliberately injected driver mistakes,
off-tracks and data-quality defects. The injected events are written to a
ground-truth JSON file so that the dashboard's detections can be checked
against known answers. It must never be presented as real driver data.

Usage:
    python3 tools/generate_sample_tsv.py --out data/sample_session.tsv \
        --truth data/sample_session.truth.json [--seed 7]
"""
import argparse
import json
import math
import random

import numpy as np

G = 9.81
DS = 0.5  # simulation grid step (m)

# ----------------------------------------------------------------------------
# Track definition: (kind, length_m or radius, angle_deg) ; + angle = left turn
# ----------------------------------------------------------------------------
TRACK = [
    ("S", 620),
    ("C", 38, -105, "T1"),    # heavy-braking right hairpin
    ("S", 170),
    ("C", 85, 62, "T2"),      # medium left
    ("S", 260),
    ("C", 210, -48, "T3"),    # fast right sweeper
    ("S", 330),
    ("C", 34, 58, "T4"),      # chicane left
    ("S", 28),
    ("C", 34, -55, "T5"),     # chicane right
    ("S", 380),
    ("C", 60, 95, "T6"),      # left
    ("S", 140),
    ("C", 48, 80, "T7"),      # left, exit onto straight
    ("S", 520),
    ("C", 30, 120, "T8"),     # tight left hairpin
    ("S", 210),
    ("C", 70, -70, "T9"),     # right
    ("S", 150),
    ("C", 120, 75, "T10"),    # fast left
    ("S", 300),
    ("C", 45, None, "T11"),   # closing left onto main straight (angle solved)
    ("S", 180),
]

TRACK_HALF_WIDTH = 6.0  # metres (used only for off-track geometry)


def build_track():
    total_angle = sum(p[2] for p in TRACK if p[0] == "C" and p[2] is not None)
    pieces = []
    for p in TRACK:
        if p[0] == "C" and p[2] is None:
            p = ("C", p[1], 360.0 - total_angle, p[3])
        pieces.append(p)
    k, names = [], []
    for p in pieces:
        if p[0] == "S":
            n = int(round(p[1] / DS))
            k += [0.0] * n
            names += [None] * n
        else:
            r, ang = p[1], p[2]
            length = abs(math.radians(ang)) * r
            n = int(round(length / DS))
            k += [math.copysign(1.0 / r, ang)] * n
            names += [p[3]] * n
    k = np.array(k)
    # Smooth curvature (clothoid-like transitions, ~30 m)
    win = int(30 / DS)
    kern = np.hanning(win)
    kern /= kern.sum()
    kp = np.concatenate([k[-win:], k, k[:win]])
    ks = np.convolve(kp, kern, mode="same")[win:-win]
    # Rescale so the total heading change is exactly 2*pi
    ks *= (2 * math.pi) / (ks.sum() * DS)
    heading = np.cumsum(ks) * DS
    x = np.cumsum(np.cos(heading)) * DS
    y = np.cumsum(np.sin(heading)) * DS
    # Closure correction (distribute residual linearly)
    frac = np.arange(len(x)) / len(x)
    x -= frac * x[-1]
    y -= frac * y[-1]
    s = np.arange(len(ks)) * DS
    return s, ks, x, y, heading, names


def corner_spans(names):
    spans = {}
    for i, n in enumerate(names):
        if n is None:
            continue
        a, b = spans.get(n, (i, i))
        spans[n] = (min(a, i), max(b, i))
    return spans


# ----------------------------------------------------------------------------
# Vehicle model (GT-ish car)
# ----------------------------------------------------------------------------
MU0, AERO = 1.42, 0.00011
P_OVER_M = 370.0       # W/kg
DRAG = 0.00078         # 1/m  (a_drag = DRAG * v^2)
BRK0, BRK_AERO = 1.55, 0.00010
VMAX = 80.0


def a_fwd_max(v):
    v = max(v, 3.0)
    return min(G * 1.05, P_OVER_M / v) - DRAG * v * v


def a_brk_max(v):
    return G * (BRK0 + BRK_AERO * v * v) + DRAG * v * v


def v_corner_cap(k, grip=1.0):
    ak = abs(k)
    denom = ak - G * AERO * grip
    if denom <= 1e-6:
        return VMAX
    return min(VMAX, math.sqrt(G * MU0 * grip / denom))


# ----------------------------------------------------------------------------
# Driver model
# ----------------------------------------------------------------------------
CORNER_SKILL = {  # base grip use, grip noise, throttle delay (m), delay noise, brake use, brake noise
    "T1": (0.965, 0.006, 6, 3, 0.93, 0.02),
    "T2": (0.955, 0.007, 8, 4, 0.92, 0.02),
    "T3": (0.975, 0.003, 4, 1.5, 0.94, 0.01),
    "T4": (0.950, 0.008, 9, 4, 0.91, 0.03),
    "T5": (0.955, 0.008, 8, 4, 0.92, 0.02),
    "T6": (0.965, 0.006, 7, 3, 0.93, 0.02),
    "T7": (0.960, 0.016, 10, 11, 0.92, 0.05),   # inconsistent exit
    "T8": (0.960, 0.007, 7, 3, 0.92, 0.02),
    "T9": (0.950, 0.014, 9, 7, 0.90, 0.06),     # inconsistent braking
    "T10": (0.970, 0.005, 5, 2, 0.93, 0.02),
    "T11": (0.905, 0.004, 14, 3, 0.91, 0.015),  # consistent but under-driven
}

# Injected events (ground truth)
EVENTS = [
    {"lap": 3, "corner": "T1", "type": "lockup_overshoot", "expected_level": 3},
    {"lap": 5, "corner": "T7", "type": "off_track_exit", "expected_level": 4},
    {"lap": 6, "corner": "T4", "type": "early_braking", "expected_level": 2},
    {"lap": 8, "corner": "T9", "type": "throttle_lift_exit", "expected_level": 2},
    {"lap": 9, "corner": "T2", "type": "double_braking", "expected_level": 2},
    {"lap": 15, "corner": "T11", "type": "delayed_throttle", "expected_level": 2},
    {"lap": 17, "corner": "T5", "type": "off_track_exit", "expected_level": 4},
    {"lap": 19, "corner": "T1", "type": "early_braking", "expected_level": 2},
    {"lap": 21, "corner": "T9", "type": "lockup_overshoot", "expected_level": 3},
]


def simulate_lap(s, k, spans, lap_no, rng, events, pace_scale=1.0, v_start=None):
    n = len(s)
    cap = np.full(n, VMAX)
    brake_use = np.full(n, 0.92)
    lat_noise = np.zeros(n)
    flags = {"offtrack": np.zeros(n, bool), "lockup": np.zeros(n, bool),
             "lift": np.zeros(n, bool)}
    ev_here = {e["corner"]: e for e in events if e["lap"] == lap_no}

    # learning + tyre degradation
    stint_lap = lap_no if lap_no <= 12 else lap_no - 12
    learn = -0.028 * math.exp(-(stint_lap - 2) / 2.5) if stint_lap >= 2 else -0.03
    deg = -0.0009 * max(0, stint_lap - 4)
    plan = {}
    for c, (i0, i1) in spans.items():
        g0, gs, d0, dsd, b0, bs = CORNER_SKILL[c]
        grip = (g0 + learn + deg + rng.gauss(0, gs)) * pace_scale
        grip = min(grip, 0.995)
        delay = max(0.0, d0 + rng.gauss(0, dsd))
        buse = min(0.99, b0 + rng.gauss(0, bs))
        plan[c] = dict(grip=grip, delay=delay, buse=buse)
        ev = ev_here.get(c)
        if ev and ev["type"] == "lockup_overshoot":
            plan[c]["grip"] = grip * 0.80
            plan[c]["buse"] = 1.04
            plan[c]["apex_shift"] = 14
        if ev and ev["type"] == "delayed_throttle":
            plan[c]["delay"] = delay + 45
        for i in range(i0, i1 + 1):
            cap[i] = min(cap[i], v_corner_cap(k[i], plan[c]["grip"]))
        # throttle delay: hold apex speed after the minimum-cap point
        seg = cap[i0:i1 + 1]
        va = float(seg.min())
        last_min = i0 + int(np.where(seg <= va * 1.002)[0][-1])
        apex = min(last_min + int(plan[c].get("apex_shift", 0) / DS), n - 1)
        hold = int(plan[c]["delay"] / DS)
        for i in range(apex, min(n, apex + hold)):
            cap[i] = min(cap[i], va)
        # braking zone for this corner: 250 m before corner start
        bz0 = max(0, i0 - int(250 / DS))
        brake_use[bz0:apex + 1] = plan[c]["buse"]
        if plan[c]["buse"] > 1.0:
            flags["lockup"][max(0, i0 - int(60 / DS)):i0 + int(10 / DS)] = True
        if ev and ev["type"] == "early_braking":
            # brake early, then coast to the corner
            for i in range(max(0, i0 - int(35 / DS)), i0 + 1):
                cap[i] = min(cap[i], va * 1.07)
        if ev and ev["type"] == "double_braking":
            # brake, release, brake again
            p = max(0, i0 - int(75 / DS))
            plan[c]["double_at"] = p
        if ev and ev["type"] in ("throttle_lift_exit", "off_track_exit"):
            plan[c]["exit_event"] = ev["type"]
        plan[c]["apex_idx"] = apex
        plan[c]["v_apex"] = va

    # Forward/backward passes
    v = cap.copy()
    if v_start is not None:
        v[0] = min(v[0], v_start)
    for _pass in range(2):
        for i in range(1, n):
            v[i] = min(cap[i], math.sqrt(v[i - 1] ** 2 + 2 * max(a_fwd_max(v[i - 1]), 0.05) * DS))
        for i in range(n - 2, -1, -1):
            v[i] = min(v[i], math.sqrt(v[i + 1] ** 2 + 2 * a_brk_max(v[i + 1]) * brake_use[i] * DS))
        if v_start is None:
            # wrap continuity for a flying lap
            v[0] = min(v[0], v[-1])
    # Double braking: brake, release (plateau), brake again - inside the real braking zone
    for c, p in plan.items():
        if "double_at" in p:
            i0c = spans[c][0]
            apex = i0c + int(np.argmin(v[i0c:spans[c][1] + 1]))
            bs = apex
            while bs > 1 and v[bs - 1] > v[bs] + 1e-6:
                bs -= 1
            i = bs + int(0.30 * (apex - bs))
            L = int(18 / DS)
            v_hold = v[i]
            for t in range(i, min(n, i + L)):
                v[t] = v_hold
            # brake harder after the release to still make the corner
            for t in range(apex - 1, i + L - 1, -1):
                v[t] = min(v[t], math.sqrt(v[t + 1] ** 2 + 2 * a_brk_max(v[t + 1]) * 1.0 * DS))
            for t in range(i + L, apex):
                v[t] = min(v[t], v_hold)
            # the plateau cannot be faster than a feasible approach -> brake slightly earlier
            for t in range(i - 1, max(0, i - int(250 / DS)), -1):
                v[t] = min(v[t], math.sqrt(v[t + 1] ** 2 + 2 * a_brk_max(v[t + 1]) * 0.9 * DS))
            flags.setdefault("double", []).append((i, i + L))
    # Exit events
    for c, p in plan.items():
        e = p.get("exit_event")
        if not e:
            continue
        i0, i1 = spans[c]
        a = p["apex_idx"] + int(25 / DS)
        if e == "throttle_lift_exit":
            L = int(28 / DS)
            v_hold = v[a]
            for t in range(a, min(n, a + L)):
                v[t] = min(v[t], v_hold * (1 - 0.025 * math.sin(math.pi * (t - a) / L)))
            flags["lift"][a:a + L] = True
        else:
            L = int(70 / DS)
            for t in range(a, min(n, a + L)):
                v[t] = min(v[t], v[a] * (1 - 0.22 * math.sin(math.pi * (t - a) / L)))
            flags["offtrack"][a:a + L] = True
            side = -1.0 if k[i0 + (i1 - i0) // 2] > 0 else 1.0  # run wide = outside
            for t in range(a, min(n, a + L)):
                lat_noise[t] = side * 11.0 * math.sin(math.pi * (t - a) / L)
        # re-integrate forward after the event
        for t in range(a + 1, n):
            v[t] = min(v[t], math.sqrt(v[t - 1] ** 2 + 2 * max(a_fwd_max(v[t - 1]), 0.05) * DS))
    return v, cap, flags, lat_noise, plan


def channels_from_profile(s, k, x, y, heading, v, flags, lat_noise, rng, spans):
    n = len(s)
    dvds = np.gradient(v, DS)
    a = v * dvds
    a_s = np.convolve(a, np.ones(5) / 5, mode="same")
    drag = DRAG * v * v
    thr = np.zeros(n)
    brk = np.zeros(n)
    for i in range(n):
        amax = a_fwd_max(v[i])
        need = a_s[i] + drag[i]
        if need > 0.15:
            thr[i] = np.clip(need / (amax + drag[i]), 0, 1) * 100
        elif need > -0.6:
            thr[i] = np.clip(15 + need * 20, 0, 30)
        else:
            brk[i] = np.clip((-a_s[i] - drag[i]) / a_brk_max(v[i]) * 92, 0, 140)
    if flags["lockup"].any():
        m = flags["lockup"] & (brk > 30)
        brk[m] = np.minimum(brk[m] * 1.35 + 10, 135)
    lift = flags["lift"]
    thr[lift] = np.minimum(thr[lift], 28 + 10 * np.sin(np.linspace(0, 3, lift.sum())))
    brk[lift] = 0
    for (i0, i1) in flags.get("double", []):
        brk[i0:i1] = np.minimum(brk[i0:i1], 4.0)
        thr[i0:i1] = 0
    # racing line: outside-inside-outside
    n_off = np.zeros(n)
    for c, (i0, i1) in spans.items():
        mid = (i0 + i1) // 2
        side = 1.0 if k[mid] > 0 else -1.0
        L = i1 - i0
        pre = int(80 / DS)
        for i in range(max(0, i0 - pre), min(n, i1 + pre)):
            if i < i0:
                w = (i - (i0 - pre)) / pre
                n_off[i] += -side * 3.5 * math.sin(math.pi / 2 * w)
            elif i <= i1:
                w = (i - i0) / max(L, 1)
                n_off[i] += -side * 3.5 * math.cos(2 * math.pi * w)
            else:
                w = (i - i1) / pre
                n_off[i] += -side * 3.5 * math.cos(math.pi / 2 * w)
    wobble = np.convolve(np.array([rng.gauss(0, 1) for _ in range(n)]), np.hanning(200) / np.hanning(200).sum() * 6, mode="same")
    n_tot = n_off + wobble + lat_noise
    nx, ny = -np.sin(heading), np.cos(heading)
    px = x + nx * n_tot
    py = y + ny * n_tot
    k_line = k  # approximation
    steer = np.degrees(np.arctan(2.7 * k_line)) * 13.0
    off = flags["offtrack"]
    if off.any():
        idx = np.where(off)[0]
        corr = 22 * np.sin(np.linspace(0, 5 * math.pi, len(idx))) * np.hanning(len(idx))
        steer[idx] += corr
    latg = v * v * k_line / G
    lonG = a / G
    if off.any():
        lonG[off] += np.array([rng.gauss(0, 0.18) for _ in range(off.sum())])
    gear_up = [0, 17, 27, 37, 47, 57, 99]
    gear = np.ones(n, int)
    for gi in range(1, 6):
        gear[v > gear_up[gi]] = gi + 1
    ratios = [0, 3.2, 2.35, 1.80, 1.45, 1.20, 1.02]
    rpm = np.array([v[i] * ratios[gear[i]] * 3.55 * 60 / (2 * math.pi * 0.33) for i in range(n)])
    return dict(speed=v * 3.6, throttle=thr, brake=brk, steer=steer, gear=gear, rpm=rpm,
                latg=latg, long=lonG, px=px, py=py)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--truth", required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--hz", type=float, default=20.0)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    np.random.seed(args.seed)

    s, k, x, y, heading, names = build_track()
    spans = corner_spans(names)
    L = s[-1] + DS
    rows = []
    t_session = 0.0
    lap_numbers = list(range(1, 25))
    truth = {"synthetic": True, "track_length_m": L, "laps": {}, "events": EVENTS,
             "corners": {c: {"start_m": float(s[a]), "end_m": float(s[b])} for c, (a, b) in spans.items()},
             "notes": "Lap 1, 12, 13, 24 are partial out/in laps. 0.6 s dropout in lap 10."}
    dt = 1.0 / args.hz
    for lap in lap_numbers:
        out_lap = lap in (1, 13)
        in_lap = lap in (12, 24)
        pace = 0.80 if (out_lap or in_lap) else 1.0
        v, cap, flags, latn, plan = simulate_lap(s, k, spans, lap, rng, EVENTS, pace_scale=pace,
                                                  v_start=(16.0 if out_lap else None))
        ch = channels_from_profile(s, k, x, y, heading, v, flags, latn, rng, spans)
        t_of_s = np.concatenate([[0], np.cumsum(DS / np.maximum(v[:-1], 1.0))])
        s0 = 380.0 if out_lap else 0.0
        s1 = 2900.0 if in_lap else L
        i0 = int(s0 / DS)
        i1 = min(len(s) - 1, int(s1 / DS))
        t_lo, t_hi = t_of_s[i0], t_of_s[i1]
        lap_time = t_of_s[-1] + DS / v[-1]
        truth["laps"][lap] = {"simulated_lap_time_s": float(lap_time), "partial": bool(out_lap or in_lap)}
        # sample at the logging rate
        tt = t_lo + (math.ceil((t_session % dt) / dt) * dt - (t_session % dt))
        while tt < t_hi:
            jitter = rng.gauss(0, 0.0015)
            te = tt + jitter
            si = float(np.interp(te, t_of_s, s))
            j = min(int(si / DS), len(s) - 2)
            f = (si - s[j]) / DS

            def g(arr):
                return arr[j] * (1 - f) + arr[j + 1] * f
            row = {
                "Time [s]": t_session + (te - t_lo),
                "Lap": lap,
                "Distance [m]": si,
                "Speed [km/h]": g(ch["speed"]) + rng.gauss(0, 0.25),
                "Throttle [%]": min(100, max(0, g(ch["throttle"]) + rng.gauss(0, 0.6))),
                "Brake [bar]": max(0, g(ch["brake"]) + (rng.gauss(0, 0.4) if g(ch["brake"]) > 1 else 0)),
                "Steering [deg]": g(ch["steer"]) + rng.gauss(0, 0.6),
                "Gear": int(ch["gear"][j]),
                "RPM": g(ch["rpm"]) + rng.gauss(0, 15),
                "LatAcc [g]": g(ch["latg"]) + rng.gauss(0, 0.04),
                "LonAcc [g]": g(ch["long"]) + rng.gauss(0, 0.04),
                "PosX [m]": g(ch["px"]) + rng.gauss(0, 0.25),
                "PosY [m]": g(ch["py"]) + rng.gauss(0, 0.25),
            }
            rows.append(row)
            tt += dt
        t_session += (t_hi - t_lo)
        if lap == 12:
            t_session += 312.0  # pit stop
    # --- data-quality defects -------------------------------------------------
    # 1) dropout of 0.6 s in lap 10
    lap10 = [i for i, r in enumerate(rows) if r["Lap"] == 10]
    mid = lap10[len(lap10) // 2]
    del rows[mid:mid + 12]
    # 2) duplicate timestamps
    dup_idx = sorted(rng.sample(range(100, len(rows) - 100), 15))
    for off, i in enumerate(dup_idx):
        rows.insert(i + off + 1, dict(rows[i + off]))
    # 3) random missing values
    cols = list(rows[0].keys())
    for _ in range(int(len(rows) * 0.001)):
        r = rng.randrange(len(rows))
        c = rng.choice(cols[3:])
        rows[r][c] = None
    header = "\t".join(cols)
    lines = ["# Synthetic telemetry generated by tools/generate_sample_tsv.py - NOT REAL DRIVER DATA",
             header]

    def fmt(c, v):
        if v is None:
            return ""
        if c in ("Lap", "Gear"):
            return str(int(v))
        if c == "Time [s]":
            return f"{v:.3f}"
        if c in ("Distance [m]", "PosX [m]", "PosY [m]"):
            return f"{v:.2f}"
        if c in ("LatAcc [g]", "LonAcc [g]"):
            return f"{v:.3f}"
        if c == "RPM":
            return f"{v:.0f}"
        return f"{v:.2f}"
    malformed_at = set(rng.sample(range(2000, len(rows) - 2000), 5))
    for i, r in enumerate(rows):
        lines.append("\t".join(fmt(c, r[c]) for c in cols))
        if i in malformed_at:
            lines.append("\t".join(fmt(c, r[c]) for c in cols[:6]) + "\tERR")
    with open(args.out, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    truth["defects"] = {"dropout_lap": 10, "duplicate_rows": 15, "malformed_rows": 5,
                        "missing_cells": int(len(rows) * 0.001)}
    with open(args.truth, "w") as fh:
        json.dump(truth, fh, indent=2)
    print(f"wrote {len(rows)} rows, track length {L:.1f} m")
    for lap, info in truth["laps"].items():
        print(lap, round(info["simulated_lap_time_s"], 3), "partial" if info["partial"] else "")


if __name__ == "__main__":
    main()
