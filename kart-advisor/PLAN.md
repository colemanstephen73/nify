# TopKart Kid Kart Setup Advisor: Plan (v1)

Status: **draft, waiting for approval**. Nothing in here has been coded or researched yet.
Facts in this plan are working assumptions. Research will confirm or overturn each one, and none of them goes into `data/` without a source.

---

## 0. Decisions to confirm before work starts

| # | Decision | My recommendation |
|---|---|---|
| D1 | **Where the project lives.** This repo already holds an unrelated project, the race telemetry dashboard (`src/`, `data/`, `dist/`, `tests/` at the root). | Put everything under `kart-advisor/` so the two projects never collide. All paths below are relative to `kart-advisor/`. |
| D2 | **UI stack** (see §5). | Vanilla ES modules + service worker + IndexedDB, with no framework and no runtime dependencies. |
| D3 | **Which rulebook governs each track.** Rocky Ridge looks like a club with its own class rules ("single-gear" kid karts). OVRP has its own club rules and may host WKA or other series events. | Model *layers*: sanctioning body → track club → event supplement. The **most restrictive** value wins. You pick the rule set per session (e.g. "OVRP club night" vs "WKA event at OVRP"). |
| D4 | **Learning from the session log.** | Show evidence only ("at OVRP, +1 psi rear came before faster laps 3 of 4 times"). Never change a recommendation silently. You can promote a learned adjustment into a rule by hand. |
| D5 | **Network limits in this cloud session** (see §1.5). | Do the research through web search, and use your screenshots for track geometry. The app itself calls the weather API from your phone, which has normal internet. |

---

## 1. Research

Four subagents run in parallel, one per track below. Each one writes `research/<topic>.md` and a draft YAML fragment. I review both before anything is merged into `data/`.

### 1.1 Output format (every research file)
- **Findings table:** `fact | value | units | source URL | confidence | notes`.
- **Confidence scale (fixed vocabulary):** `manufacturer`, `sanctioning_body`, `track_official`, `expert_consensus` (several independent experienced sources agree), `anecdote` (a single post or video), `inferred` (derived by me; the derivation is shown), `unknown`.
- **Conflicts:** when sources disagree, record both values with their sources. Never average them.
- **Open questions:** things only you can answer, or that need checking trackside.
- **Never invent a spec.** Missing values are recorded as `unknown` and listed in the open questions.

### 1.2 Tracks
| Track | Topic file | Scope |
|---|---|---|
| A | `research/chassis-topkart.md` | Which adjustments really exist on the TopKart kid kart (current and recent models). Factory baseline, weight distribution, cross-weight targets, tire options and pressure ranges, known quirks. Explicitly lists adult-kart adjustments that **don't** exist on this chassis. |
| B | `research/engine-comer-c52.md` | WKA Tech Manual §621, its 2022 C52 update, and anything newer. Restrictor/plate, clutch (engagement RPM, type), chain, legal gearing, fuel/oil ratio and approved oils, plug and heat range, break-in, maintenance intervals, C52 vs C50/C51 (stroke, interchangeable parts). |
| C | `research/carb-comer-14mm.md` | Confirm the exact carb model (lead: Dell'Orto SHA 14). Stock and maximum legal main jet, idle/needle setup if any, float level, filter, whether the class seals or fixes the carb, jetting vs. temperature/humidity/pressure/altitude, rich/lean symptoms and plug reading. |
| D | `research/tracks.md` + `tracks/<track>/` | Address, coordinates, length, surface, direction, kid kart layout, elevation, corner-by-corner geometry, local class rules (engine, minimum weight, tires, gearing, age), and what the layout demands. |

### 1.3 Track geometry method
1. **Preferred:** query the Overpass API for `highway=raceway` ways within about 1.5 km of each site.
2. **Fallback:** you drop overhead or satellite screenshots into `tracks/<track>/images/`, ideally with a scale bar or two known points. I trace the centerline with vision into a pixel polyline, scale it to metres using the published track length or the scale bar, and record the result as `inferred`.
3. **Processing** (`tools/geometry.js`, tested):
   - Resample the centerline every 1 m.
   - Smooth it, then compute curvature from the three-point circumradius.
   - Segment it into corners where |curvature| > threshold.
   - For each corner, record: number, direction, minimum radius, total turn angle, entry/apex/exit distance, preceding straight length, and type. Types are classified from radius and angle, and radius change across the corner: hairpin, sweeper, kink, chicane, decreasing radius.
4. **Demands summary:** share of lap distance in tight vs. fast corners, longest straight, estimated minimum corner speeds (from radius and a kid kart lateral grip estimate, flagged `inferred`), and an "acceleration vs. rolling speed" score.
5. **Kid kart layouts:** kid karts may run a shortened layout. Each layout is stored as its own `configurations[]` entry. If no source shows the kid layout, it is marked `unknown` and listed as a question for you.

### 1.4 What research likely can't settle (expected open questions)
- Exact TopKart model/year you own, and its as-delivered settings (photos of your kart help).
- The kid kart layout at each track and the current-season local rules (rule PDFs are often club Facebook posts).
- Track elevation and curbing, and whether the lap or layout has changed recently.

### 1.5 Constraint found while planning: this session's network
From this cloud container, **web search works**, but **fetching pages does not**. These fail: WebFetch on any non-search host, Overpass (`overpass-api.de`), Open-Meteo, USGS elevation, KartPulse.

As a result:
- Research works from search-result summaries. A fact is still cited to its original URL, but confidence is capped one level lower unless several results agree. I won't claim to have read a PDF I couldn't open.
- **Overpass is unavailable** from here, so geometry needs your screenshots. Alternatively, allow `overpass-api.de` (and `api.open-meteo.com` for testing) under the environment's *Network access → Allowed domains* (cloud environment menu → Edit; docs: https://code.claude.com/docs/en/cloud-environments#network-access).
- The **app** calls the weather API from your phone's browser, so the container restriction doesn't affect the app at the track. Weather code is tested against recorded fixtures.

---

## 2. Data model (`data/`, hand-editable YAML)

All files carry `schema_version`, `updated`, and a `sources:` map (`id → {url, title, confidence, accessed, notes}`). Every value refers to source IDs, so you can edit any number without touching code.

```yaml
# data/chassis.yaml (shape only; values come from research)
schema_version: 1
model: TopKart kid kart (model/year TBD)
adjustments:
  rear_track_width:
    exists: true            # false = the adjustment doesn't exist and the engine never outputs it
    units: mm
    range: {min: null, max: null}   # null = unknown, so the engine can't recommend outside the baseline
    step: null
    baseline: null
    effect: "wider rear → less rear grip / frees the kart"
    sources: [topkart_manual_2023]
    confidence: manufacturer
  caster: {exists: unknown, ...}
tires:
  - {brand: ..., compound: ..., pressure_cold_psi: {min, max, by_temp: [...]}, sources: [...]}
quirks: [...]
```

- `data/engine.yaml`: specs, break-in, maintenance, plug options, fuel/oil ratio, gearing (clutch tooth count, axle sprocket options), C50/C51/C52 differences.
- `data/carb.yaml`: carb model, stock jet, jet series and numbering, float level, filter, and a `jetting_table` keyed by density altitude bands (or a reference point plus a correction rule), with its derivation and confidence.
- `data/tracks/rocky-ridge.yaml`, `data/tracks/ovrp.yaml`: location, elevation, `configurations[]` with centerline polyline, per-corner data, a demands summary, `inferred_items[]` (for you to confirm), and `local_rules`.
- `data/rules/wka.yaml` (plus a file per club if their rules are separate): the limits the engine enforces, e.g. `{field: main_jet, op: max, value: ..., source}`, `{field: gearing, op: one_of, values: [...]}`, `{field: carb, op: sealed}`, plus minimum weight, tire spec, fuel spec and restrictor.
- **Validation:** `tools/validate-data.js` checks every file against a JSON Schema (`data/schema/*.json`). It fails when a value has no source, when a confidence label isn't from the fixed vocabulary, when a range is inverted, or when a rule refers to an unknown field. This check is part of `npm test`.
- **Build:** browsers can't read YAML directly, so `tools/build-data.js` compiles `data/**/*.yaml` into one `app/data.json` (using js-yaml as a dev dependency). The app and the engine tests read that compiled JSON.

---

## 3. Recommendation engine (the core)

### 3.1 Shape
- Pure functions in `engine/`, with no DOM, so the same code runs in Node tests and the browser.
- `recommend(knowledgeBase, inputs) → SetupSheet`.
- Each output field carries `{value, baseline, units, steps: [{rule_id, delta, reason, sources}], clamped_by, legality, confidence}`. The UI renders the "reason" and "source" columns directly from `steps`, so every output field has a reason and source *by construction*. A test asserts that no field is ever missing them.

### 3.2 How inputs interact (the hard part)
Naively stacking independent rules double-counts. For example, "cold", "green track" and "old tires" would each add rear grip, and together swing the kart three steps. To avoid that:

1. **Intermediate state, not direct edits.** Stages 2–5 don't change the setup directly. They feed a small number of derived quantities, and only those quantities drive the setup fields:
   - `grip_index` (0–1): built from track temperature, rubber, dry/damp/wet, and tire age. One combined number, so conditions never stack independently.
   - `balance_target` (understeer/oversteer units, positive = more understeer, i.e. more stable): from track demands, grip, driver experience, and feel feedback.
   - `tire_temp_need`: how much the tires need help getting up to temperature (cold day, hard compound, light driver).
   - `relative_air_density` and `density_altitude`: from temperature, pressure, and humidity.
   - `accel_vs_rolling_speed` score: from track geometry.
2. **Levers in priority order.** A `balance_target` is turned into chassis changes using the levers that **exist on this chassis**, in a researched priority order, e.g. tire pressure → rear width → front width → seat. Each lever has a step size and a per-session limit. A lever that doesn't exist, or whose range is unknown, is skipped. Nothing is assumed from adult karts.
3. **Safety bias.** Driver experience sets a floor: for a novice, `balance_target` can't go below the baseline toward oversteer. When rules conflict, the result leans toward understeer. The engine **never** makes the kart looser to gain speed for a novice, and every wet or damp setup is checked for stability.
4. **Feel feedback is narrow.** The free text is parsed into tags (e.g. `understeer_entry`, `oversteer_exit`, `bog_low_rpm`, `rich_top_end`). Then:
   - At most **2 changes** are applied. Handling and carb changes are separate lists, so a bog doesn't use up a handling change.
   - Each tag maps to an ordered list of fixes. The first fix that is available and legal is used.
   - Conflicting tags (e.g. understeer and oversteer at the same phase of the corner) don't produce a change; the engine asks for clarification instead.
   - An unknown phrase is reported as "not understood".
5. **Gearing.**
   - If the rules fix the gearing (likely for kid karts, e.g. "single-gear"), the output is that gear, with the rule as its reason, and track demands are noted but not applied.
   - Otherwise, the sprocket is chosen so that estimated top speed at the end of the longest straight reaches, but doesn't exceed, the engine's useful RPM band. The choice is then shifted by the accel-vs-rolling score and by grip (lower grip → taller gear).
   - The result is snapped to available legal sprockets.
6. **Jetting.**
   - Density altitude uses the standard method: saturation vapor pressure (Magnus) gives the vapor partial pressure from humidity, then air density = dry part + vapor part, which converts to density altitude.
   - The jet comes from the researched table, or from a reference jet adjusted by the square root of relative air density in jet *flow*. The physics: fuel flow ∝ jet area × √(Δp) and air flow ∝ ρ, so constant air/fuel ratio needs jet area ∝ √ρ. This rule is flagged `inferred` unless research finds a manufacturer table.
   - The jet is snapped to available sizes and clamped to the legal maximum. If the class seals the carb or fixes the jet, the output is "spec jet: not adjustable", and only the plug/mixture notes apply.
   - With manual pressure entry, the app makes sure you entered station pressure and not the sea-level-corrected reading (QNH), or converts using elevation. Mixing them up is a common source of 1000+ ft errors.
7. **Clamp and legality last.** The pipeline ends with:
   - clamping to physical ranges, then
   - a legality pass using the selected rule layers.

   An output that would be illegal is **blocked**: it is replaced with the nearest legal value and the reason, or with "no legal recommendation", and never shown as a suggestion. Your *current* setup inputs are also checked, so the app warns you if what's on the kart is illegal.
8. **Unknowns spread.** If a baseline is `unknown`, that field's output says "no baseline: set from your kart and record it" and the engine skips it, instead of guessing. Each field's confidence is the lowest confidence of the sources behind it.

### 3.3 Pipeline (matches your 7 steps)
`baseline → track demands → conditions → air density/jetting → driver → feel feedback → clamp + legality`. Each stage is a list of rule objects:
```js
{ id: 'cond.cold_track_pressure', stage: 'conditions', sources: ['…'],
  when: ctx => ..., apply: ctx => ({ field, delta, reason }) }
```
The rule table lives in `engine/rules/*.js`. Its numeric tunables (step sizes, thresholds) live in `data/engine-tunables.yaml`, so you can tune them without touching code.

---

## 4. Inputs and outputs (app)

**Inputs**
- Track and configuration, date/time, rule set.
- Air and track temperature, humidity, pressure. Weather auto-fills from Open-Meteo using the track coordinates (free, no API key, works in the browser). It can be overridden, and the last values are cached offline.
- Dry / damp / wet; rubber laid down (green / medium / rubbered-in); tire brand and age (new / scuffed / old).
- Driver weight and experience; current gear and jet.
- Feel notes: free text **plus** quick-tap chips (understeer entry/mid/exit, oversteer entry/mid/exit, bog, rich, lean, chatter/hop). Chips are more reliable than parsing text on a phone.

**Outputs:** the setup sheet. Each row shows value, baseline, change, reason, source (tap to open the link), and confidence. It also shows:
- a legality banner,
- a "what to change next" list (at most 2 handling changes and 1 carb change), and
- inferred items to verify.

**Session log (IndexedDB)**
- Each entry stores inputs, the recommended sheet, what was actually run (editable), lap times (best/average or a pasted list), and feel notes.
- Export/import as JSON, for backups and moving to another phone.
- The "what helped" view per track lists each single change between consecutive sessions in similar conditions, alongside the lap time change. Changes with n < 3 are shown as anecdotal.

---

## 5. UI stack options

| Option | Pros | Cons |
|---|---|---|
| **A. Vanilla ES modules + service worker + IndexedDB** (recommended) | No build step for the app, no runtime dependencies, tiny and fast on a phone, matches this repo's existing no-framework style, works offline easily. | A bit more hand-written DOM code. |
| B. Preact + Vite + vite-plugin-pwa | Components, hot reload. | Needs a build toolchain and dependency upkeep for a small app. |
| C. SvelteKit static adapter | Nice developer experience. | Heaviest toolchain for the benefit. |

With Option A:
- **Install:** the app is installable to the phone home screen as a PWA.
- **Theme:** high-contrast light theme by default (best in sunlight), dark mode via `prefers-color-scheme` plus a manual toggle.
- **Layout:** 18 px+ body text, tap targets of at least 48 px, single-column layout.
- **Run:** `npm start` builds `data.json` and serves `app/` with a tiny dependency-free Node static server on localhost (service workers need localhost or https).
- **Hosting:** optional static hosting (e.g. GitHub Pages) so your phone can load it once and then use it offline at the track.

---

## 6. Tests (Node 22 built-in `node:test`, no framework)

1. **Data:** every YAML file passes its schema, every value has a source, and no orphan source IDs.
2. **Unit:** one test per rule (fires / doesn't fire / delta / cites a source). Plus:
   - the density altitude formula against published reference values,
   - geometry corner detection on synthetic shapes (circle, hairpin, chicane, kink).
3. **Properties:** across a grid of inputs, every output is in range and legal, every field has a reason and source, a novice is never looser than baseline, at most 2 feel changes, and the same input gives the same output.
4. **End-to-end scenarios** (expected outputs written as tests *before* the UI):
   - "OVRP, hot, dry, rubbered-in, 45 lb driver, novice"
   - "Rocky Ridge, cool, damp, green track"
   - "Wet"
   - "High humidity, low pressure (rich risk)"
   - "Illegal current jet entered → warned"
   - "Feel: understeer on entry + bog"
   - "Unknown baseline → field withheld"
5. **UI smoke test:** Playwright with the preinstalled Chromium loads the app offline, fills in a scenario, and checks the sheet renders and the log saves and reloads.

`npm test` runs all of these. They run after every engine change.

---

## 7. Layout

```
kart-advisor/
  PLAN.md  CLAUDE.md  README.md  package.json
  research/  chassis-topkart.md  engine-comer-c52.md  carb-comer-14mm.md  tracks.md
  data/  chassis.yaml engine.yaml carb.yaml engine-tunables.yaml
         tracks/{rocky-ridge,ovrp}.yaml  rules/*.yaml  schema/*.json
  tracks/<track>/images/        # your screenshots
  engine/  index.js stages/*.js rules/*.js air.js geometry.js legality.js feel.js
  app/     index.html app.js sw.js styles.css data.json(built) manifest.webmanifest
  tools/   build-data.js validate-data.js serve.js trace-geometry.js
  tests/   *.test.js scenarios/*.yaml
```

## 8. Order of work after approval
1. Scaffold the project, CLAUDE.md, and package.json. Launch the four research subagents in parallel.
2. Review the research; write `data/` with sources; tell you about open questions and unknowns.
3. Track geometry (Overpass if you allow the domain, otherwise your screenshots).
4. Engine: tests first, then the stages, iterating until green.
5. UI and the session log, then the Playwright smoke test.
6. README and CLAUDE.md; commit and push to `claude/topkart-setup-advisor-kglke7`.

## 9. Definition of done
Same as your list:
- four research files with sources, confidence levels and open questions;
- both tracks with corner-by-corner data and inferred items flagged;
- the engine passes its tests, and every output field has a reason and source;
- the app runs locally with one command documented in CLAUDE.md and README.md.
