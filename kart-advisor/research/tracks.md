# Topic D: Tracks (Rocky Ridge Raceway, VT and OVRP, NY)

Accessed 2026-10-18. Research was done **from search-result summaries only**. WebFetch (sevendaysvt.com: `getaddrinfo ENOTFOUND`) and Overpass (`CONNECT tunnel failed, response 403`) both failed on the first try and were not retried. About 42 searches ran before the shared per-turn web-search budget ran out, so some planned lookups were not done (listed under Open questions).

**Confidence capping rule used here.** The task rule is: a value seen only through a search summary is capped one level below its source type, unless two or more independent results agree. In practice, `track_official` capped one level becomes `expert_consensus`. When a row says `expert_consensus (capped)`, it means "the track's own page said so, but I only saw a summary of it". It does **not** mean several independent experts agreed.

---

## 1. Summaries

### Rocky Ridge Raceway (Graniteville / Barre, VT)
- Home of the **VT Shifter Karts** club (owner Jeff Blow, race director Brandon Emerson). It is a paved, purpose-built kart road course at **905 Pirie Rd, Graniteville VT 05654**, with racing on Wednesday nights. It was built in 2006, so 2026 is its 20th season.
- **The length is disputed:** 910 ft (2026 press), "about a fifth of a mile" (≈1,056 ft, the club's own sponsorship page), and 1/6 mile (≈880 ft, a directory listing). The club page gives a **16 ft elevation change**.
- **Kid Kart class (club "Class Structure 2024" table):** 50cc Comer engine; weight, details, tires and fuel all "open"; ages **4–7**. The club blog says 4–6. A 2026 Seven Days article says the kids run **single-gear** karts. No gearing spec was found.
- Unknown: direction, number of turns, any separate kid kart layout, curbing, and exact coordinates.

### OVRP: Oakland Valley Race Park (Cuddebackville, NY)
- **305 Oakland Valley Rd, Cuddebackville NY 12729.** Two geocoder listings agree on ≈41.4743, −74.6142.
- About a **0.75 mi asphalt** sprint road course with **11 turns**. It is **26 ft wide** (the start/finish straight is 30 ft wide) and was newly paved around 2020. Older material (around 2006) says 1/2 mile, which is probably the layout before the redesign.
- Named features from ovrp.net/track: a **135° left-hander** at the end of the start/finish straight, the **"box turn"**, an **uphill chicane**, and a **180° hairpin** that connects the box turn and the chicane in the redesigned layout. The page also mentions new curbing and larger run-off.
- **Kid Kart class (OVRP class/spec sheets for 2019, 2022 and 2024, which agree):** engine "C51*", min weight **150** (presumably lb), **89 rear gear** (spec), **MG Red** slicks / **MG Rain** tires, fuel MS98L / MS93, ages **5–8**.
- The **2026 "OVRP Kart Club New Class Structure"** and the 2026 complete rules exist on ovrp.net/forms-docs, but **I could not see their contents**.
- Unknown: direction, the kid kart layout, whether a C52 is legal, the restrictor, and the exact elevation.

---

## 2. Findings: Rocky Ridge Raceway

| fact | value | units | source URL | confidence | notes |
|---|---|---|---|---|---|
| Name / club | Rocky Ridge Raceway, home of VT Shifter Karts | – | https://vtshifterkarts.com/ ; https://www.timesargus.com/eedition/page-a5/page_d17c0e20-afdb-583d-bfe9-ed2120bda3f3.html | track_official | Several results agree |
| Address | 905 Pirie Rd, Graniteville (Barre), VT 05654 | – | sevendaysvt (lead) ; timesargus brief ; https://racingnear.me/venues/rocky-ridge-raceway/ | expert_consensus | 3 results agree. GetInTheStands files it under Williamstown (same ZIP). One listing gives "400 Baptist Street", which conflicts. |
| Lat/lon | 44.1492, −72.4922 | deg | https://en.wikipedia.org/wiki/Graniteville,_Vermont | inferred | This is the **village centre**, not the track. The address was not geocoded. |
| Site elevation | ≈1,380–1,470 | ft | Wikipedia Graniteville (1,378 ft / 420 m); https://us-databases.com/zip-code/05654/ (1,452 ft); https://www.topoquest.com/place-detail.php?id=1460000 (Upper Graniteville 1,466 ft) | inferred | From nearby place and ZIP elevations. Use ≈1,450 ft until confirmed. |
| Elevation change on lap | 16 | ft | https://vtshifterkarts.com/sponsorship-opportunities-become-part-of-the-team/ | expert_consensus (capped) | Seen in 2 searches, but both trace back to one club page |
| Length (A) | 910 | ft | Seven Days (lead URL) ; timesargus 2026-08-22 brief | expert_consensus | 2026 press. Both outlets may come from the same press material. |
| Length (B) | ≈1/5 mile (≈1,056 ft) | mi | vtshifterkarts sponsorship page ; https://kartdirectory.racing/us/circuit/rocky-ridge-raceway/ | expert_consensus (capped) | Club's own page. The directory may have copied it. |
| Length (C) | 1/6 mile (≈880 ft) | mi | https://www.getinthestands.com/vermont/williamstown/motorsports/rocky-ridge-raceway | anecdote | Directory |
| Surface | paved / asphalt | – | Seven Days; GetInTheStands; vtshifterkarts | expert_consensus | Surface age is unknown (built 2006; no repave found) |
| Built | 2006 | year | vtshifterkarts sponsorship page; timesargus (20th anniversary in 2026) | expert_consensus | |
| Direction | unknown | – | – | unknown | |
| Number of turns | unknown | – | – | unknown | |
| Layouts | one known road course; any kid layout unknown | – | – | unknown | |
| Track width / curbing | unknown | – | – | unknown | |
| Race night | Wednesday | – | timesargus; vtshifterkarts | expert_consensus | 2026 dates given: Aug 26, Sep 2/9/16 |
| Classes | 6 classes: Kid Kart, Cadet (80cc Comer), L206 Kids, L206 Jr, Briggs Sr, Shifter (CR80) | – | https://vtshifterkarts.com/2021-rules-regulations/ ; Seven Days | expert_consensus | The URL says 2021 but the table heading reads "Class Structure 2024" |
| Contact | (802) 839-0486, jeffblow70@yahoo.com | – | vtshifterkarts / racingnear.me | expert_consensus | |
| Lap video | "Rocky Ridge Raceway" Jr Shifter lap, about 20 yrs old | – | https://www.youtube.com/watch?v=6AXpWMTNLCk | anecdote | Location not confirmed. Could be used to trace the layout. |

## 3. Findings: OVRP

| fact | value | units | source URL | confidence | notes |
|---|---|---|---|---|---|
| Address | 305 Oakland Valley Rd, Cuddebackville, NY 12729 | – | https://www.roadracingworld.com/?p=31379 ; https://www.mapquest.com/us/new-york/oakland-valley-race-park-367209776 ; https://ovrp.net/contact/ | expert_consensus | One listing says "30", which is a typo |
| Lat/lon | 41.4743, −74.6142 | deg | https://www.pickocny.com/explore-orange-county-ny/p/ovrp---oakland-valley-race-park-644932a818b8847a9ae0135c/ (41.47423, −74.61426) ; MapQuest (41.474357, −74.614153) | expert_consensus | Two independent geocodes agree. They place the address point, not necessarily the track centroid. |
| Site elevation | ≈520 (range 520–965 in sources) | ft | https://www.indexmundi.com/zp/us/37300.htm (Cuddebackville hamlet 158 m) ; https://wu-next-prod.wunderground.com/weather/us/ny/westbrookville/KNYCUDDE18 (PWS 965 ft) | inferred | The track is about 2 km NW of the hamlet centre. Sources conflict; confirm trackside or with a USGS lookup. |
| Length (current) | 0.75 (≈3,960 ft) | mi | https://ovrp.net/track/ ; https://ovrp.net/about/ ; https://ovrp.net/performance-kart-rentals/ ; https://www.ekartingnews.com/?p=106910 | track_official | Several agree. The feet value is my conversion (inferred). |
| Length (older) | 1/2 | mi | https://www.viperclub.org/vca/threads/ny-ct-vs-ne-karting-event-at-oakland-valley-sunday-sept-3rd.593419 ; https://www.skipbarber.com/blogs/post/oakland-valley-race-park-skip-barber (2006, garbled fraction) | anecdote | Probably the layout before the redesign |
| Turns | 11 | count | https://ovrp.net/performance-kart-rentals/ | expert_consensus (capped) | Single page, undated |
| Width | 26 (start/finish straight 30) | ft | https://ovrp.net/track/ | expert_consensus (capped) | Page is about 5.5 yrs old |
| Surface | asphalt, "newly paved" around 2020 | – | ekartingnews 2020 ; ovrp.net/about | track_official | |
| Direction | unknown | – | – | unknown | |
| Elevation change | "elevation" plus an uphill chicane, no number | – | https://www.bmwcca.org/event/ny-chapter-spring-kart-race ; ovrp.net/track | anecdote | Qualitative only |
| Curbing | "new curbing" (type unknown) | – | ovrp.net/track | expert_consensus (capped) | |
| Lap time ref | 53.42–53.43 s best lap | s | https://www.youtube.com/watch?v=PE51gN1Clc8 ; https://www.youtube.com/watch?v=H3wqfcvs2aU | anecdote | 2020-07-24. Kart class unknown. |
| Onboard (current layout) | "Onboard Lap of the New & Improved OVRP" | – | https://www.youtube.com/watch?v=B3mDj7A9I38 | anecdote | Useful for tracing the layout and confirming direction |
| Other circuits on site | 1/5 mi dirt oval ("Oakland Valley Speedway"), Supermoto dirt section | – | viperclub ; ovrp.net/track | anecdote | Not used by kid karts as far as I found |
| Season | about Apr 1 – Nov 1 | – | racingnear.me / kartdirectory | anecdote | Directories disagree slightly |
| 2026 club program | 15 club races, NY State Championship, MyLaps points | – | https://ovrp.net/kart-racing/ ; https://ovrp.net/calendar/month/2026-10/ | track_official | Club Race #14 is on 2026-10-18 |

---

## 4. Layout and corner descriptions found (qualitative only; no geometry invented)

**Rocky Ridge:** No corner descriptions were found. The club calls it a "road course" with a 16 ft elevation change. A directory says it is "designed to mimic professional circuits". The only description of the lap's character is the 16 ft of elevation and a length of about 900–1,050 ft, so a lap is short and corners will be close together. That last point is `inferred`.

**OVRP (ovrp.net/track, current/redesigned layout):**
- The start/finish straight is 30 ft wide and ends in a **135° left-hander**. There is a larger paved run-off at the end of the main straight.
- The **"box turn"**: a signature corner. Its shape is not described; the name suggests a squared, multi-apex sequence, but that is a guess.
- An **uphill chicane**.
- A **180° hairpin** that now connects the box turn and the chicane (this is the redesign).
- The BMW CCA page mentions "increasing and decreasing radius turns" and elevation.
- 11 turns in total (rental page).
- The order of corners beyond the above, the longest straight, and corner radii are **unknown**.

## 5. Kid kart rules

### Rocky Ridge: VT Shifter Karts (club rules; sanctioning body unknown)
Source: https://vtshifterkarts.com/2021-rules-regulations/ (table heading "Class Structure 2024"). No 2025 or 2026 sheet was found.

| item | value | confidence | notes |
|---|---|---|---|
| Class | Kid Kart | expert_consensus (capped) | |
| Engine | "50c Comer" (50cc Comer) | expert_consensus (capped) | Whether a C52 counts is inferred yes (it is a 50cc Comer). Confirm. |
| Min weight | "open" (no minimum) | expert_consensus (capped) | |
| Details | "Open" | expert_consensus (capped) | |
| Tires | "Open" | expert_consensus (capped) | |
| Fuel | "Open" | expert_consensus (capped) | Cadet and L206 use pump fuel |
| Gearing | single-gear kart (no gearbox); sprocket not specified | anecdote | From Seven Days. "Single gear" means no gearbox, **not** a spec sprocket. |
| Restrictor | unknown | unknown | |
| Age | 4–7 (rules table) vs 4–6 (club blog; kartdirectory) | conflict | See Conflicts |
| Safety | rib protector required; Snell M/SA2015 or SFI 31.2/41.2 or newer helmets; transponder required to be scored | expert_consensus (capped) | |
| Race vs practice | Kid Karts race (results are posted in the blog) | expert_consensus (capped) | |

### OVRP: OVRP Kart Club (track-run club; current sanctioning body unknown)
Sources: https://ovrp.net/wp-content/uploads/2024/03/Kart-Racing-Class-Structure-Description-and-Specs.pdf ; https://ovrp.net/wp-content/uploads/2022/03/2021-Kart-Class-Desc-Spec-1-3-3.pdf ; https://www.ovrp.net/wp-content/uploads/2019/04/2019-Kart-Class-Desc-Spec-1.pdf. These three versions agree. In 2006 OVRP hosted the WKA Northeast Sprint Series, but no current WKA link was found.

| item | value | confidence | notes |
|---|---|---|---|
| Engine | "C51*" (2019/2024). The older NESS sheet (2017) lists "M1 – IAME". | track_official | What the asterisk means is unclear; it may refer to the gear note. **C52 legality unknown.** |
| Min weight | 150 (lb assumed) | track_official | Units not printed in the snippets. Whether it is kart plus driver is unknown (assume yes). |
| Gearing | 89 rear gear (spec) | track_official | Clutch/driver tooth count not stated |
| Tires | MG Red (dry) / MG Rain | track_official | 2022 snippet: "MG Red / MG Premium"? (garbled) |
| Fuel | MS98L / MS93 (one summary also listed premium pump or C12) | expert_consensus | The sheet-wide fuel list may differ by class |
| Restrictor | unknown | unknown | |
| Age | 5–8 | track_official | |
| Purpose | "where our youngest drivers learn the rules of the road" (flags, controls) | track_official | Kid Karts race in club events. Lessons and rentals are also offered for 5+. |
| 2026 rules | "2026 OVRP Kart Club New Class Structure" and "2026 OVRP Kart Complete Rules" exist (https://ovrp.net/forms-docs/) | unknown contents | **The values above may be superseded.** The Jan-2025 PDF snippet didn't show a Kid Kart row. |

## 6. Geometry status
- **Overpass:** blocked (403). No centerline for either track.
- **OSM:** searches found no specific way IDs for either track.
- **Rocky Ridge:** length (conflicting), elevation change and surface are known. Centerline, direction, turn count and kid layout are all unknown. Needs screenshots in `tracks/rocky-ridge/images/` and a confirmed length to scale the trace.
- **OVRP:** length 0.75 mi, width 26 ft, 11 turns and a few named features are known. Centerline and direction are unknown. Needs screenshots. The YouTube onboard (B3mDj7A9I38) can confirm direction and corner order. A kid kart layout (full course or shortened) is not documented.

## 7. Inferred items to confirm trackside
1. Rocky Ridge lat/lon (village centre used: 44.1492, −72.4922).
2. Rocky Ridge elevation ≈1,450 ft (from village/ZIP).
3. OVRP elevation ≈520 ft (hamlet). Could be higher (a PWS nearby reads 965 ft).
4. OVRP length in ft (3,960) is a unit conversion of "0.75 mi".
5. Rocky Ridge "50c Comer" includes the C52.
6. OVRP weight "150" is in lb and includes the driver.
7. Kid karts run the full layout at both tracks. No source says either way.

## 8. Conflicts
- **Rocky Ridge length:** 910 ft (Seven Days / Times Argus 2026) vs ≈1/5 mi ≈1,056 ft (club sponsorship page, kartdirectory) vs 1/6 mi ≈880 ft (GetInTheStands). Not averaged.
- **Rocky Ridge Kid Kart age:** 4–7 (rules table) vs 4–6 (club blog, kartdirectory). Seven Days says "as young as 4".
- **Rocky Ridge address:** 905 Pirie Rd (most sources) vs 400 Baptist St (one listing).
- **OVRP length:** 0.75 mi (current, several sources) vs 1/2 mi (older posts). Most likely a layout change.
- **OVRP Kid Kart engine:** C51 (OVRP sheets) vs M1 IAME (NESS 2017 sheet).
- **OVRP elevation:** 520 ft (gazetteer) vs 965 ft (PWS).

## 9. Open questions for the user
1. Which Rocky Ridge length is current (910 ft?), and which direction do you run there?
2. Do kid karts run the full course at each track, or a shortened layout? If shortened, which corners are cut?
3. OVRP 2026 class sheet: is the C52 legal in Kid Kart? Is it still 150 lb, 89 rear, MG Red? Is there a restrictor? What clutch tooth count do you run?
4. Rocky Ridge: is any gearing, tire or weight rule actually enforced, despite "open"? What sprocket do other kid karts run?
5. Which direction does OVRP run?
6. Please add overhead or satellite screenshots of both tracks, with a scale bar, to `tracks/<track>/images/`. Or allow `overpass-api.de` in the network settings.
7. When was Rocky Ridge last paved, and how bumpy and grippy is it?
8. Not researched because the search budget ran out: typical weather, surface age at OVRP, Rocky Ridge curbing, the Rocky Ridge sanctioning body ("Vermont's only sanctioned go kart racing facility"; by whom?).

## 10. Sources
- sevendays_2026: https://www.sevendaysvt.com/arts-culture/sports/drivers-at-rocky-ridge-raceway-battle-for-the-checkered-flag/
- timesargus_2026: https://www.timesargus.com/eedition/page-a5/page_d17c0e20-afdb-583d-bfe9-ed2120bda3f3.html
- vtsk_rules: https://vtshifterkarts.com/2021-rules-regulations/
- vtsk_sponsor: https://vtshifterkarts.com/sponsorship-opportunities-become-part-of-the-team/
- vtsk_home / blog: https://vtshifterkarts.com/ , https://vtshifterkarts.com/home/blog/
- kartdirectory_rr: https://kartdirectory.racing/us/circuit/rocky-ridge-raceway/
- getinthestands_rr: https://www.getinthestands.com/vermont/williamstown/motorsports/rocky-ridge-raceway
- racingnear_rr: https://racingnear.me/venues/rocky-ridge-raceway/
- yt_rr: https://www.youtube.com/watch?v=6AXpWMTNLCk
- wiki_graniteville: https://en.wikipedia.org/wiki/Graniteville,_Vermont
- zip_05654: https://us-databases.com/zip-code/05654/
- topoquest_upper_graniteville: https://www.topoquest.com/place-detail.php?id=1460000
- ovrp_track: https://ovrp.net/track/
- ovrp_about: https://ovrp.net/about/
- ovrp_rentals: https://ovrp.net/performance-kart-rentals/
- ovrp_kart_racing: https://ovrp.net/kart-racing/
- ovrp_forms: https://ovrp.net/forms-docs/
- ovrp_lessons: https://ovrp.net/karting-lessons/
- ovrp_class_2024: https://ovrp.net/wp-content/uploads/2024/03/Kart-Racing-Class-Structure-Description-and-Specs.pdf
- ovrp_class_2025: https://ovrp.net/wp-content/uploads/2025/01/Kart-Racing-Class-Structure-Description-and-Specs.-2.pdf
- ovrp_class_2022: https://ovrp.net/wp-content/uploads/2022/03/2021-Kart-Class-Desc-Spec-1-3-3.pdf
- ovrp_class_2019: https://www.ovrp.net/wp-content/uploads/2019/04/2019-Kart-Class-Desc-Spec-1.pdf
- ness_2017: https://ovrp.net/wp-content/uploads/2017/04/NESS-STURCTURE_NEW.pdf
- ovrp_cal_2026_10: https://ovrp.net/calendar/month/2026-10/
- ekn_2020: https://www.ekartingnews.com/?p=106910
- bmwcca: https://www.bmwcca.org/event/ny-chapter-spring-kart-race
- viperclub: https://www.viperclub.org/vca/threads/ny-ct-vs-ne-karting-event-at-oakland-valley-sunday-sept-3rd.593419
- skipbarber_2006: https://www.skipbarber.com/blogs/post/oakland-valley-race-park-skip-barber
- rrw_2011: https://www.roadracingworld.com/?p=31379
- pickocny: https://www.pickocny.com/explore-orange-county-ny/p/ovrp---oakland-valley-race-park-644932a818b8847a9ae0135c/
- mapquest_ovrp: https://www.mapquest.com/us/new-york/oakland-valley-race-park-367209776
- indexmundi_cudd: https://www.indexmundi.com/zp/us/37300.htm
- wu_pws_cudd: https://wu-next-prod.wunderground.com/weather/us/ny/westbrookville/KNYCUDDE18
- yt_ovrp_new: https://www.youtube.com/watch?v=B3mDj7A9I38
- yt_ovrp_s3: https://www.youtube.com/watch?v=PE51gN1Clc8


## 11. Rocky Ridge geometry from the crew chief's screenshot (added 2026-10-18)

Source: Google satellite screenshot supplied by the user, saved as `tracks/rocky-ridge/images/overhead-google.webp`. The centreline was traced by hand on a 50 px grid (`tracks/rocky-ridge/centreline-trace.json`) and scaled to the 910 ft press length. At that scale the asphalt comes out about 26 ft wide, which is plausible for a kart track (OVRP publishes 26 ft). That supports the 910 ft figure over 880 ft or 1,056 ft, but doesn't prove it. **Everything here is `inferred`.**

| # | Corner (counter-clockwise from start/finish) | Type | Turn | Min radius |
|---|---|---|---|---|
| 1 | Bottom-hairpin exit onto the start/finish diagonal | kink (right) | ~30° | ~20 m |
| 2 | Pit-lane corner, right end | tight (left) | ~90° | ~6 m |
| 3 | Bend on the right leg | medium (right) | ~47° | ~14 m |
| 4 | Top hairpin | hairpin (left) | ~173° | ~9 m |
| 5 | Upper bend, left leg | kink (left) | ~31° | ~22 m |
| 6 | "Pinch" on the left leg | medium (right) | ~52° | ~14 m |
| 7 | Bottom hairpin | hairpin (left) | ~208° | ~10 m |

**What the layout demands:** 7 corners, and about 58% of the lap is spent turning. Three corners are tight (both hairpins and the pit-lane corner) and two are fast kinks. The longest uninterrupted straight is only ~28 m (~90 ft), on the start/finish diagonal, which kink 1 splits. The engine scores this as **balanced** (accel-vs-rolling +0.14): there is no strong case for moving off the baseline gear for the layout alone. The two hairpins reward drive off slow corners, and the short straights mean the kart rarely reaches top speed.

**Confirm trackside:** direction of travel, whether kid karts run this full layout, and the lap length.
