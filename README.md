# Race telemetry analysis dashboard

A self-contained HTML dashboard that takes raw racing telemetry (TSV) and produces a race-engineering analysis of a driver: lap-to-lap consistency, mistakes and off-tracks, corner-by-corner performance, best execution at each corner, the theoretical best lap, pace versus consistency, and coaching priorities.

All analysis runs **in the browser** from the raw TSV. There is no server, and every number on the page is computed at load time.

## Use

| File | What it is |
|---|---|
| `dist/dashboard.html` | Empty dashboard. Open it and drag-and-drop (or **Load TSV…**) one or more TSV files. |
| `dist/sample_dashboard.html` | Dashboard with the synthetic demo session embedded (Plotly from the cdnjs CDN). |
| `dist/sample_dashboard_offline.html` | Same, with Plotly inlined. Works with no internet. |

To build a dashboard with your own data embedded:

```bash
python3 tools/build_dashboard.py --tsv my_session.tsv --out dist/my_session.html [--inline-plotly plotly.min.js]
```

> `data/sample_session.tsv` is **synthetic** data from `tools/generate_sample_tsv.py`: a physics-based lap simulation with injected mistakes, off-tracks and data defects. Its known answers are in `data/sample_session.truth.json`. The dashboard shows a "SYNTHETIC DEMO DATA" badge when this file is loaded.

## Pipeline (`src/engine/`)

`RAW TSV → ingest.js → laps.js → track.js → features.js → mistakes.js → scoring.js → insights.js → analyze.js → src/app/app.js (dashboard)`

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
node tests/browser_check.js dist/sample_dashboard.html                             # headless browser QA (Playwright)
```
