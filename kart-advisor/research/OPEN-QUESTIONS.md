# Open questions for the crew chief

These are things the research could not settle. The answers change recommendations, so the app either asks for them (Kart tab) or says what it assumed. Full detail is in each research file's "Open questions" section.

**How the research was done.** Every fact came from web-search summaries. Page and PDF fetches were blocked in the build session, and the search budget ran out near the end. Confidence was capped one level lower unless several sources agreed.

## Rules (most important: legality)
1. **OVRP 2026 class sheet** ([forms page](https://ovrp.net/forms-docs/)): is the **Comer C52** legal in Kid Kart? The 2019–2024 sheets say "C51*". Also check whether it's still **150 lb**, the **89-tooth spec gear**, MG Red/Rain tires and MS98L/MS93 fuel, and whether there's a restrictor or jet limit. Until then the app flags the C52 at OVRP.
2. **Rocky Ridge (VT Shifter Karts):** is there a 2025/2026 class sheet? The 2024 table says weight, tires and fuel are "open". What sprocket do the other kid karts run? Is there a jet rule?
3. Do you race either track under **WKA** or another sanctioning body? WKA would add 150 lb, 87-octane fuel and a 10-tooth drum with #219 chain.
4. Kid kart **tire pressure cap** at either track? Some clubs cap it at 20 psi.

## Your kart (enter in the Kart tab)
5. TopKart **model year**, and **axle diameter**: sources say both 25 mm and 30 mm.
6. **Rear hub length** and which hubs you own; how far the hubs can slide on the axle.
7. **Front spindle spacers:** how many, how wide, and which side of the hub.
8. Any **caster/camber adjusters** or torsion bars fitted? The app assumes none.
9. **Seat position** (your own measurement) and how far it can move.
10. **Kart weight** ready to race without the driver; ballast amount and location.
11. **Baseline** track widths and cold tire pressures you normally run. No factory baseline was found.

## Engine and carb
12. **Fuel:oil ratio** and oil from your engine builder. Sources conflict: 16:1 (US practice) vs 25:1 (Comer sheet).
13. **Spark plug** in it now. No published C52 plug was found; the C50 list is NGK BPMR7A / Champion RCJ7Y / Bosch WS5F.
14. **Main jet** in the carb now and the **jets you own**. After a session where the engine runs clean (tan plug), tick "engine ran clean" in the Log so the app has a jetting reference.
15. **Air filter** you run (one forum report: K&N RC-1250 with a #58).
16. Engine hours and last service; tach readings if you have them (the published 6,500 rpm peak doesn't match owners' 9,600–11,000 rpm tach readings).

## Tracks (geometry and trackside checks)
17. **Overhead screenshots** of both tracks with a scale bar, in `tracks/<track>/images/`. The alternative is allowing `overpass-api.de` in the cloud environment's network settings. Then run `node tools/track-geometry.js` to get per-corner data. **Neither track has corner data yet.**
18. **Lap direction** at each track, and whether **kid karts run the full course** or a short layout.
19. **Rocky Ridge length:** 910 ft (2026 press), ~1,056 ft (club page) or 880 ft (directory)?
20. **Elevations** are estimates (Rocky Ridge ~1,450 ft, OVRP ~520 ft, possibly higher). They only matter if you enter sea-level pressure instead of station pressure.
21. **Rocky Ridge coordinates** are the village centre, not the track. That's fine for weather, but not for geometry.

## Not covered by any source found
- Wet-weather chassis setup for this kart: the app only switches tires and adds rear grip.
- Kid-kart weight distribution and cross-weight targets: only adult-kart figures were found, and they aren't used.
- Clutch engagement rpm, break-in and maintenance intervals for the C52.
