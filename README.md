# Race telemetry analysis dashboard

A self-contained HTML dashboard that takes raw racing telemetry (**iRacing `.ibt`** files or TSV exports) and produces a race-engineering analysis of a driver: lap-to-lap consistency, mistakes and off-tracks, corner-by-corner performance, best execution at each corner, the theoretical best lap, pace versus consistency, and coaching priorities.

All analysis runs **in the browser** from the raw file. There is no server, and every number on the page is computed at load time.

## Use

| File | What it is |
|---|---|
| `dist/dashboard.html` | Empty dashboard. Open it and drag-and-drop (or **Load .ibt / TSV…**) one or more iRacing `.ibt` or TSV files. |
| `dist/sample_dashboard.html` | Dashboard with the synthetic demo session embedded. |

Both files have the chart library (Plotly's CSP-safe "strict" build, `vendor/`) built in, so they work offline and in sandboxed viewers that block CDNs or `eval`. If WebGL isn't available, the telemetry, speed-comparison and track-map charts fall back to SVG.

To build a dashboard with your own data embedded:

```bash
python3 tools/build_dashboard.py --inline-plotly --ibt my_session.ibt --out dist/my_session.html   # iRacing telemetry (base64-embedded)
python3 tools/build_dashboard.py --inline-plotly --tsv my_session.tsv --out dist/my_session.html   # omit --inline-plotly to load Plotly from cdnjs instead
```

> `data/sample_session.tsv` is **synthetic** data from `tools/generate_sample_tsv.py`: a physics-based lap simulation with injected mistakes, off-tracks and data defects. Its known answers are in `data/sample_session.truth.json`. The dashboard shows a "SYNTHETIC DEMO DATA" badge when this file is loaded.

## Replay video sync

After loading an iRacing `.ibt`, the dashboard asks whether to add a replay video. You can also open the panel at any time with **▶ Replay**. The panel docks beside the stats and shows:

- the video, with a mini track map;
- live speed, gear, RPM, throttle, brake and steering from the telemetry at the current video time;
- the running lap time, and the live delta to the reference at the current distance;
- the corner you're in, and any events flagged nearby.

As the video plays, the telemetry charts and track map show a cursor at the car's position. With **Follow lap** on, the dashboard selects the lap being played. Clicking the telemetry or speed-comparison chart seeks the video to that point on the selected lap.

**Panel size and crop:**
- **Resize:** drag the panel's left edge (top edge on narrow screens) to resize it; the stats re-flow beside it.
- **Size presets:** **Dock**, **Large** (two thirds of the screen) and **Full** (near full screen; Escape returns to Dock). ⛶ switches to browser fullscreen. When the panel is wide, the readouts move into a side column.
- **Crop:** **Crop…** shows the full frame. Drag to draw a crop, drag inside it to move it, or drag a corner to resize it. Shift+drag redraws.
- **Crop presets:** full frame, centre 4:3, top ⅔, and **Auto**, which detects and removes black letterbox or pillar-box bars from the current frame.
- The cropped area fills the panel at its true aspect ratio. **Uncrop** restores the full frame.
- Panel size and crop are remembered; the crop is stored per video.

**Sync:** pause on the frame where the car crosses the start/finish line, pick the lap, and press **Set sync point**. A second point on a later lap corrects any rate drift. Nudge buttons adjust in ±1 frame, ±0.1 s and ±1 s steps. Sync points are remembered per video in your browser.

**iRacing `.rpy` replay files can't play in a browser**: they hold simulation state, not video. Record the replay to MP4/WebM with iRacing's video capture or OBS (remux OBS `.mkv` to MP4), then load that video. Without a video, the panel plays back the telemetry on its own (0.25–4×).

`tools/make_test_replay_video.py` renders a synthetic test video, with the true session time burned into each frame, for `tests/replay_check.js`.

## Corner consistency (line & speed)

The **Consistency** section scores, corner by corner, how repeatably the driver hits the same:

- **Driving line**: GPS / X-Y lateral offset from the median line through the whole corner. Tolerance 0.6 m.
- **Entry speed**: at turn-in. Tolerance 1.5% of the median.
- **Minimum speed**: tolerance 1.5%.
- **Exit speed**: at the exit point. Tolerance 1.5%.

Each element's score is `100 / (1 + (spread / tolerance)^2)`, where spread is the robust σ (MAD-based); 50 means the spread equals the tolerance. The corner score is the mean of the available elements; without GPS, the line is left out. The section shows:

- a track-wide headline score and per-element averages, with the share of laps inside tolerance;
- a corner × element heatmap;
- per-lap strip charts for the selected corner, with the tolerance band.

The scores also appear in the corner table ("Line & speed"), the verdict, the insights and the coaching. The existing timing consistency and driver consistency scores are unchanged.

## Racing line (GPS)

When the data has GPS latitude/longitude (iRacing `.ibt` files do) or X/Y position, the corner analysis includes a racing-line comparison for the selected corner:

- **Corner map**: best-at-corner lap, selected and compared laps, all laps faintly, and the session median line, with apex, brake and closest-to-inside markers. Lateral offsets can be exaggerated (×5 or ×10) to make line differences visible; ×1 is true scale.
- **Lateral-offset trace**: distance through the corner on the x-axis, metres toward the inside (+) or wide (−) of the median line on the y-axis, with the P10–P90 band across all laps.
- **Line measures**: turn-in, apex and exit position, closest approach to the inside, track width used, path length versus the median line, and tightest radius, each with its spread and its Spearman correlation with corner time.
- **Finding**: names the line choice that goes with faster laps. It is reported only when the correlation is significant after correcting for the 7 measures tested (Fisher z, p < 0.05/7). Otherwise the dashboard says the line is not the differentiator.

Significant line findings also feed into the insights and coaching. The corner table shows each corner's apex-placement spread (Line σ).

## Excluding laps

Untick **Use** for a lap in the lap table, or press **Exclude lap** in the lap assessment, to remove that lap from the analysis. Pace, consistency, the mistake baselines, corner statistics, the theoretical best, insights and every chart are then recomputed in about 0.1 s, because the parsed data is reused. Excluded laps stay listed and their telemetry can still be viewed. They can be restored one at a time, or all at once with **Restore all**. The track model (corners and segments) always uses every complete lap, so corner IDs don't change when laps are excluded. At least 3 laps must stay in the analysis. Exclusions are remembered in your browser for the same file.

## iRacing `.ibt` support

`src/engine/ibt.js` reads the irsdk disk format directly in the browser: a 112-byte header, a 32-byte disk sub-header, 144-byte variable headers, the session-info YAML, then fixed-size sample records (usually 60 Hz). Only the channels the analysis needs are decoded, so long sessions stay fast. The reader uses:

- `SessionTime`, `SessionNum`, `Lap`, `LapDist`, `Speed`, `Throttle`, `Brake`, `SteeringWheelAngle`, `Gear`, `RPM`, `LatAccel`, `LongAccel`, `Lat`/`Lon` (track map), `FuelLevel`
- `LapLastLapTime`: iRacing's official lap times, used when they agree with the sampled timing
- `PlayerTrackSurface`: OffTrack samples become high-confidence off-tracks; pit-approach samples, together with `OnPitRoad`, mark in- and out-laps, which are excluded from statistics
- `IsOnTrack`: garage and not-driving frames are dropped and counted in the data-quality report
- From the session-info YAML: track name and config, car, driver, session type, and the official sector splits (`SplitTimeInfo`)

Truncated files (record count larger than the file) are read up to the last complete record and reported as such.

`tools/tsv_to_ibt.py` writes a synthetic, spec-conformant `.ibt` from the sample session for testing (`python3 tools/tsv_to_ibt.py data/sample_session.tsv data/sample_session.truth.json /tmp/sample.ibt`).

## Pipeline (`src/engine/`)

`RAW .ibt / TSV → ibt.js | ingest.js → laps.js → track.js → features.js → mistakes.js → scoring.js → insights.js → analyze.js → src/app/app.js (dashboard)`

- **ingest.js**: detects the delimiter, header, units row and malformed rows; types each column as numeric or categorical; maps each column to a role (lap, time, distance, speed, throttle, brake, steering, gear, RPM, accelerations, X/Y or GPS, sector, track limits, corner); normalises units; splits sessions; handles duplicate timestamps; reports sampling statistics and gaps.
- **laps.js**: finds lap boundaries (lap channel, distance resets, or an X/Y start/finish gate); interpolates lap timing to the start/finish line; checks completeness and data quality; resamples each lap onto a common distance grid.
- **track.js**: builds median reference traces; computes curvature; detects corners (merging fragments and ignoring kinks); finds brake, apex and exit points; builds non-overlapping timing segments and sectors.
- **features.js**: per-lap, per-corner metrics: brake point, peak pressure, brake applications, turn-in, minimum and exit speeds, apex position, throttle pickup and lifts, steering reversals, peak lateral g, and lateral deviation from the reference line.
- **mistakes.js**: flags events using robust z-scores against the driver's own distribution at each corner. Severity runs from L0 to L4; confidence is High, Medium or Low.
- **scoring.js**: lap status (validity vs execution vs pace), mistake score, consistency score, theoretical best, corner analysis, a grip-utilisation pace benchmark, and the priority matrix.
- **insights.js**: insight text and coaching built from the computed numbers only.

The **Method & data** section of the dashboard documents every formula and threshold.

## Tests

```bash
node tests/test_engine.js data/sample_session.tsv data/sample_session.truth.json   # ground-truth + invariant checks
node tests/run_engine.js data/sample_session.tsv                                   # text report
node tests/test_engine.js /tmp/sample.ibt data/sample_session.truth.json          # same checks through the .ibt reader
node tests/browser_check.js dist/sample_dashboard.html                             # headless browser QA (Playwright)
node tests/browser_upload.js dist/dashboard.html /tmp/sample.ibt                   # upload through the file picker
node tests/validate_charts.js dist/sample_dashboard.html                           # every chart vs computed values (incl. consistency), before/after lap exclusion
python3 tools/make_test_replay_video.py data/sample_session.tsv /tmp/replay.webm   # prints the video's true start time
node tests/replay_check.js dist/sample_dashboard.html /tmp/replay.webm <start>      # video/telemetry sync, playback, seek, .rpy handling
node tests/replay_layout_check.js dist/sample_dashboard.html /tmp/replay.webm <letterboxed.webm>  # resize, size presets, fullscreen, crop, auto bars
```
