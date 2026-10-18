# Kid Kart Setup Advisor

A phone-friendly web app for the crew chief of a **TopKart kid kart** with a **Comer C52** (stock Dell'Orto SHA 14-12L carb). Pick the track and the day's conditions and it gives a setup sheet: tire pressures, track widths, ballast, gearing, main jet, plug and fuel mix. Every line shows the recommended value, what it changed from, why, and the source.

The tracks are **Rocky Ridge Raceway** (Graniteville, VT) and **OVRP** (Cuddebackville, NY).

The app puts the driver first. For a new driver it never takes away rear grip (a slightly hooked-up kart beats a loose one), it makes at most two handling changes at a time, and it rounds jetting toward rich. Anything illegal under the selected rules is blocked, and anything the research couldn't confirm is marked **need info** instead of guessed.

## Run it

```bash
cd kart-advisor
npm install        # once: installs js-yaml for the data build
npm start          # builds data/ → app/data.json, serves http://localhost:8080/app/
```

**On your phone:**
- **Same Wi-Fi:** open `http://<computer-ip>:8080/app/`. Offline mode needs `localhost` or `https`, so for trackside use, host the `kart-advisor/` folder on any static HTTPS host (e.g. GitHub Pages).
- **Install it:** open it once, then "Add to Home Screen". After the first load it works with no signal; only weather auto-fill needs internet.

**Hosted single-file version:** `npm run bundle` writes `dist/kart-advisor-standalone.html`, one self-contained file you can open in any browser (and `dist/kart-advisor.html` for hosts that add their own page wrapper). It works the same way, except weather is typed in by hand, the backup is copy/paste, and there is no offline service worker.

## Using it at the track
1. **Kart tab:** enter what you normally run (pressures, widths, gear, jet, kart weight). Recommendations are changes from these numbers, and blanks are never guessed.
2. **Setup tab:** track, rules, weather (**Fill from weather forecast** uses Open-Meteo at the track's coordinates), track temperature (IR gun), surface, rubber, tires, driver, and how the kart felt. Then press **Get setup**.
3. Read the sheet. **Steps and sources** under each line shows every rule that touched it, with links.
4. **Save to session log.** Afterwards, add what you actually ran and the lap times in the **Log** tab. Tick **Engine ran clean** on a session with a tan plug: that becomes the jetting reference, and jet changes for later weather are calculated from it.
5. The **What helped here** list in the Log tab compares sessions in similar conditions. It is evidence only and never changes recommendations.

Back up with **Export log + profile** (JSON). Import it on another phone.

## How the recommendation works
`engine/index.js` runs these stages in order. Each one adds "moves" with a reason and sources, and values are worked out at the end:

1. **Baseline:** your kart profile, or a cited default (e.g. 10/89 gearing, #58 jet).
2. **Track demands:** corner mix and longest straight adjust gearing, unless the rules fix the gear (OVRP: spec 89). Neither track has geometry yet: see below.
3. **Conditions:** one combined **grip estimate** (surface, rubber, tire age, track temp), so cold + green + old tires don't stack three changes. Low grip narrows the rear; track temperature sets pressure; wet switches to the rain tire allowed by the rules.
4. **Air density:** density altitude from temperature, humidity and pressure (`engine/air.js`, ISA + Tetens). The jet is scaled from your reference session (flow area ∝ √density), snapped to jets you own, and rounded toward rich.
5. **Driver:** ballast to the minimum weight plus a 2 lb margin, mounted low. Experience sets the rear-grip floor (new: never reduce rear grip except to cure hop).
6. **Feel:** your words or the buttons become tags. At most two handling changes and one carb change; the rest go to "what to change next". Lean signs mean one size richer right away. A bog alone gets a diagnosis, not a jet change.
7. **Clamp + legality:** clamp to physical ranges and the parts you own, then rule layers (club, optionally + WKA), with the most restrictive value winning. Illegal outputs are blocked, and illegal current setups are flagged.

Tunables (step sizes, thresholds, which fix goes with which symptom) are in `data/advisor.yaml` with sources. Edit them there, not in code.

## Knowledge base (`data/`, hand-editable YAML)
| File | Contents |
|---|---|
| `chassis.yaml` | Which adjustments exist on the TopKart (and which don't), tire options, setup levers and quirks |
| `engine.yaml`, `carb.yaml` | C52 specs, gearing, fuel; SHA 14-12L jets, jetting physics, rich/lean symptoms |
| `rules/wka.yaml` | WKA §621 Kid Kart (Comer) limits the engine enforces |
| `tracks/<track>.yaml` | Location, layout notes, club rule layer, items to confirm trackside |
| `geometry/<track>.yaml` | Per-corner data (created by the geometry tool) |
| `advisor.yaml` | Engine tunables and policy |
| `air.yaml` | Sources for the air-density maths |

Every value is `{value, sources, confidence}`, and `npm test` fails on an uncited value. Confidence levels: manufacturer, sanctioning_body, track_official, expert_consensus, anecdote, inferred, unknown.

Research notes are in `research/`. **Start with `research/OPEN-QUESTIONS.md`**: it lists what still needs confirming (most importantly, whether the C52 is legal in OVRP's Kid Kart class).

## Adding track geometry
Neither track has corner data yet. The research session couldn't reach OpenStreetMap. Either:

- **OpenStreetMap:** run this at https://overpass-turbo.eu (or `curl` against `https://overpass-api.de/api/interpreter`) and save the result as JSON:
  ```
  [out:json];way["highway"="raceway"](around:1500,41.4743,-74.6142);out geom;
  ```
  (Rocky Ridge: use the track's coordinates; the stored ones are the village centre.) Then:
  `node tools/track-geometry.js ovrp overpass ovrp-overpass.json`
- **Screenshot:** put an overhead image in `tracks/<track>/images/`. Trace the centreline in the direction of travel as pixel points into a JSON file (`{"image": "...", "points": [[x,y],...], "targetLengthFt": 3960}`, or `metresPerPixel` from a scale bar). Then:
  `node tools/track-geometry.js ovrp pixels trace.json`. Corners from imagery are marked **inferred**.

The tool writes `data/geometry/<track>.yaml` with each corner's direction, radius, turn angle, type (hairpin / sweeper / kink / chicane / decreasing radius), entry/apex/exit and preceding straight, plus a demands summary. Run `npm test` afterwards.

## Tests
```bash
npm test          # data validation + engine unit tests + scenarios + invariant grid (node:test)
npm run test:ui   # browser smoke test (Playwright + Chromium): phone layout, sheet, log, offline, dark mode
```
