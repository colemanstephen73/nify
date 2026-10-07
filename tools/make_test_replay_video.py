#!/usr/bin/env python3
"""
Render a SYNTHETIC "replay video" from the sample telemetry, for testing the
video <-> telemetry sync. Each frame shows the true session time, lap, speed and
the car's position on the track map, so alignment can be checked by eye and by
test. The video starts at an offset the dashboard does not know (default: 4 s
before the start of lap 3).

    python3 tools/make_test_replay_video.py data/sample_session.tsv out.webm [--lap 3 --lead 4 --seconds 120 --fps 30]

Requires numpy, pandas, Pillow and ffmpeg (VP8/WebM output; add --mp4 for H.264).
"""
import argparse
import subprocess

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFont


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tsv")
    ap.add_argument("out")
    ap.add_argument("--lap", type=int, default=3)
    ap.add_argument("--lead", type=float, default=4.0, help="seconds of video before the lap starts")
    ap.add_argument("--seconds", type=float, default=120.0)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--mp4", action="store_true")
    a = ap.parse_args()
    d = pd.read_csv(a.tsv, sep="\t", comment="#", on_bad_lines="skip").apply(pd.to_numeric, errors="coerce")
    d = d.dropna(subset=["Time [s]", "Lap"]).drop_duplicates(subset=["Time [s]"]).sort_values("Time [s]").reset_index(drop=True)
    t, lap, dist = d["Time [s]"].values, d["Lap"].values, d["Distance [m]"].values
    # lap start = first sample of the lap minus distance/speed (same convention as the dashboard)
    i0 = np.where(lap == a.lap)[0][0]
    t_lap = t[i0] - dist[i0] / (d["Speed [km/h]"].values[i0] / 3.6)
    t_start = t_lap - a.lead
    W, H = 640, 360
    x, y = d["PosX [m]"].values, d["PosY [m]"].values
    ok = np.isfinite(x) & np.isfinite(y)
    x0, x1, y0, y1 = x[ok].min(), x[ok].max(), y[ok].min(), y[ok].max()
    sc = min((W * 0.55 - 20) / (x1 - x0), (H - 40) / (y1 - y0))
    proj = lambda px, py: (W * 0.42 + 10 + (px - x0) * sc, H - 20 - (py - y0) * sc)
    ref = d[(d.Lap == a.lap)]
    base = Image.new("RGB", (W, H), (16, 18, 22))
    dr = ImageDraw.Draw(base)
    pts = [proj(px, py) for px, py in zip(ref["PosX [m]"].values, ref["PosY [m]"].values) if np.isfinite(px)]
    dr.line(pts, fill=(70, 76, 86), width=6)
    try:
        font = ImageFont.truetype("DejaVuSansMono-Bold.ttf", 22)
        small = ImageFont.truetype("DejaVuSansMono.ttf", 15)
    except OSError:
        font = small = ImageFont.load_default()
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(a.fps), "-i", "-"]
    cmd += (["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast"] if a.mp4 else ["-c:v", "libvpx", "-b:v", "600k", "-deadline", "realtime", "-cpu-used", "8"])
    cmd += [a.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(a.seconds * a.fps)
    for f in range(n):
        ts = t_start + f / a.fps
        j = min(len(t) - 1, max(0, np.searchsorted(t, ts)))
        im = base.copy()
        dd = ImageDraw.Draw(im)
        cx, cy = proj(x[j], y[j]) if np.isfinite(x[j]) else (0, 0)
        dd.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(56, 189, 248))
        dd.text((14, 14), "SYNTHETIC TEST REPLAY", font=small, fill=(250, 178, 25))
        dd.text((14, 44), f"t = {ts:9.2f} s", font=font, fill=(236, 238, 241))
        dd.text((14, 78), f"Lap {int(lap[j])}", font=font, fill=(236, 238, 241))
        dd.text((14, 112), f"{d['Speed [km/h]'].values[j]:5.0f} km/h", font=font, fill=(236, 238, 241))
        dd.text((14, 146), f"{dist[j]:6.0f} m", font=font, fill=(167, 173, 183))
        dd.text((14, H - 30), f"video {f / a.fps:6.2f} s", font=small, fill=(107, 114, 128))
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()
    print(f"wrote {a.out}: {a.seconds:.0f} s @ {a.fps} fps, video 0 = session t {t_start:.3f} s (lap {a.lap} starts at {t_lap:.3f} s)")


if __name__ == "__main__":
    main()
