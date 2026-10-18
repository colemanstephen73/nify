# CLAUDE.md: kart-advisor

Setup advisor for a TopKart kid kart with a Comer C52 (stock Ø14 mm carb), for Rocky Ridge Raceway (VT) and OVRP (NY).
The approved plan is in `PLAN.md`. This repo also contains an unrelated telemetry dashboard at the repo root, so keep everything for this project inside `kart-advisor/`.

## Commands (run from `kart-advisor/`)
- `npm install`: one-time; installs the only dependency (js-yaml, used by the data build).
- `npm start`: validates and builds `data/` into `app/data.json`, then serves at http://localhost:8080/app/
- `npm test`: data build + validation, then every `tests/**/*.test.js` (Node's built-in `node:test`). Run after every engine change.
- `npm run test:ui`: Playwright smoke test (phone viewport, sheet, log, offline, dark mode). Set `SHOTS=<dir>` for screenshots.
- `node tools/build-data.js --check`: validate the knowledge base without writing.
- `node tools/track-geometry.js <track> overpass|pixels <file>`: centreline → `data/geometry/<track>.yaml` (see README).

## Conventions
- **Cite everything.** Every non-null fact in `data/` is `{value, sources: [ids], confidence}`, where the ids are keys of that file's `sources:` map. An `inferred` value may skip sources only if it carries a `derivation`. `tools/validate-data.js` enforces this, and `npm test` fails on violations.
- **Confidence vocabulary (fixed):** manufacturer, sanctioning_body, track_official, expert_consensus, anecdote, inferred, unknown.
- **Unknown is a valid answer.** Use `value: null, confidence: unknown`, never a guess. The engine withholds outputs whose baseline is unknown.
- **Search summaries only.** Research ran from web search summaries (page fetches are blocked in the cloud session). Confidence was capped one level lower unless several results agreed. Don't upgrade it without reading the primary source.
- **Engine and geometry** are pure ES modules in `engine/` (no DOM), shared by Node tests and the browser.
- **Units:** the engine uses the units karts are set up in (psi, in, lb, °F, teeth, jet #). Only the air-density maths in `engine/air.js` is SI.
- **Safety bias:** for novice drivers, never recommend going looser than baseline. When in doubt, lean toward understeer (more stable), and toward rich on jetting.
- **Code style:** match the surrounding code (concise, comments explain *why*). No framework, and no runtime dependencies in `app/`.

## Engine design (engine/index.js)
- Stages add **moves** (lever ± steps + reason + sources); field values are computed at the end, so each field keeps a full `steps` trace. A test asserts every field has a reason and sources that resolve.
- Source refs are `"<fileKey>:<id>"` (e.g. `chassis:ssc_2005`, `tracks/ovrp:ovrp_class_2024`). `kb.sourceIndex` resolves them, and `user:profile` means the user's kart profile.
- **Conditions** feed one grip estimate (`advisor.yaml grip_model`), so they don't stack.
- **Rear-grip floor** by experience: novice = no rear-grip reduction at all, except to cure hop; intermediate = none from conditions; experienced = free.
- **Feel:** at most 2 handling changes and 1 carb change. Lean signs mean +1 jet, marked urgent. A bog alone gets a diagnosis, not a jet change.
- **Jetting** is relative to a reference session (manual in the profile, or the last log session ticked "engine ran clean"): jet # ∝ density^0.25, rounded toward rich.
- **Legality:** `engine/legality.js` merges the layers so the most restrictive value wins. It blocks an output that can't be made legal and flags an illegal current setup.

## Layout
`research/` research notes (+ `drafts/` YAML from the research agents) · `data/` knowledge base YAML · `engine/` air density, geometry, recommendation engine · `app/` PWA · `tools/` build/validate/serve · `tests/`.

## Decisions (from PLAN.md approval, 2026-10-18)
- Project lives in `kart-advisor/`. Stack: vanilla ES modules + service worker + IndexedDB.
- Rule layers: sanctioning body → track club → event. The most restrictive value wins, and the user picks the rule set per session.
- Session-log learning shows evidence only and never changes recommendations silently.
- The cloud session can't reach Overpass, Open-Meteo or ordinary web pages (only web search works). Track geometry therefore needs the user's screenshots in `tracks/<track>/images/` (or an allowed `overpass-api.de`). Weather auto-fill runs in the user's browser.

## Status (2026-10-18)
- [x] Plan approved; research tracks A–D in `research/` with sources, confidence and open questions (`research/OPEN-QUESTIONS.md`)
- [x] Knowledge base in `data/`, validated
- [x] Engine + learning module + tests (66 unit/scenario/property tests, UI smoke test)
- [x] App (Setup / Kart / Log / Info), offline service worker, IndexedDB log, export/import
- [ ] **Track geometry for both tracks**: blocked on screenshots or Overpass access. Run `tools/track-geometry.js` when available.
- [ ] Confirm the user's open questions (C52 legality at OVRP, 2026 rule sheets, kart baseline), then update `data/`
- Search budget ran out during research. Follow-ups worth searching: wet-weather kid kart setup, the OVRP 2026 sheet, VT Shifter Karts 2026 rules.
