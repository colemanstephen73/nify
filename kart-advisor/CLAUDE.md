# CLAUDE.md: kart-advisor

Setup advisor for a TopKart kid kart with a Comer C52 (stock Ø14 mm carb), for Rocky Ridge Raceway (VT) and OVRP (NY).
The approved plan is in `PLAN.md`. This repo also contains an unrelated telemetry dashboard at the repo root, so keep everything for this project inside `kart-advisor/`.

## Commands (run from `kart-advisor/`)
- `npm install`: one-time; installs the only dependency (js-yaml, used by the data build).
- `npm start`: validates and builds `data/` into `app/data.json`, then serves at http://localhost:8080/app/
- `npm test`: data build + validation, then every `tests/**/*.test.js` (Node's built-in `node:test`). Run after every engine change.
- `node tools/build-data.js --check`: validate the knowledge base without writing.

## Conventions
- **Cite everything.** Every non-null fact in `data/` is `{value, sources: [ids], confidence}`, where the ids are keys of that file's `sources:` map. An `inferred` value may skip sources only if it carries a `derivation`. `tools/validate-data.js` enforces this, and `npm test` fails on violations.
- **Confidence vocabulary (fixed):** manufacturer, sanctioning_body, track_official, expert_consensus, anecdote, inferred, unknown.
- **Unknown is a valid answer.** Use `value: null, confidence: unknown`, never a guess. The engine withholds outputs whose baseline is unknown.
- **Search summaries only.** Research ran from web search summaries (page fetches are blocked in the cloud session). Confidence was capped one level lower unless several results agreed. Don't upgrade it without reading the primary source.
- **Engine and geometry** are pure ES modules in `engine/` (no DOM), shared by Node tests and the browser.
- **Units:** the engine works in SI internally; the UI shows °F / psi / in / lb / ft.
- **Safety bias:** for novice drivers, never recommend going looser than baseline. When in doubt, lean toward understeer (more stable), and toward rich on jetting.
- **Code style:** match the surrounding code (concise, comments explain *why*). No framework, and no runtime dependencies in `app/`.

## Layout
`research/` research notes (+ `drafts/` YAML from the research agents) · `data/` knowledge base YAML · `engine/` air density, geometry, recommendation engine · `app/` PWA · `tools/` build/validate/serve · `tests/`.

## Decisions (from PLAN.md approval, 2026-10-18)
- Project lives in `kart-advisor/`. Stack: vanilla ES modules + service worker + IndexedDB.
- Rule layers: sanctioning body → track club → event. The most restrictive value wins, and the user picks the rule set per session.
- Session-log learning shows evidence only and never changes recommendations silently.
- The cloud session can't reach Overpass, Open-Meteo or ordinary web pages (only web search works). Track geometry therefore needs the user's screenshots in `tracks/<track>/images/` (or an allowed `overpass-api.de`). Weather auto-fill runs in the user's browser.

## Status
- [x] Plan approved
- [x] Scaffold, air density (`engine/air.js`), geometry (`engine/geometry.js`), data validator: all tested
- [ ] Research (4 tracks) → `data/`
- [ ] Recommendation engine + scenarios
- [ ] UI + session log
