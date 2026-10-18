# Research Track A: TopKart kid kart chassis

Accessed: 2026-10-18. Method: about 43 WebSearch queries. Search results came back as summaries only. WebFetch to `www.topkartusa.com` failed (`getaddrinfo ENOTFOUND`), so no page was opened directly. The shared web-search budget for the session ran out partway through. Two planned queries (kid kart spindle spacers, kid kart seat position for small drivers) did not run.

**Confidence cap:** I saw search summaries only, never the pages. A fact stays at its source-type level only when at least two independent results agree. Otherwise it is capped one level down:

- A single-summary manufacturer fact becomes `expert_consensus`.
- A single-summary club rule becomes `expert_consensus`.
- A single forum post becomes `inferred`.

Each capped fact says so in its notes.

## Summary

- **Model sold in the USA:** TopKart USA (shop.topkartusa.net and topkartusa.net, Indianapolis, IN) sells the model as the "**Kid Kart**" chassis, currently listed as the "**2026 Kid Kart Chassis**". It sells with a Comer C52 as standard, as a rolling chassis (no engine), or with a Briggs LO206 build. It ships without tires. I found no US model called "Baby", "Cadetto" or "Comet". MondoKart (Italy) sells the same chassis as "Top-Kart KID KART 50cc – RT20". MondoKart also sells a "Babykart" 25 mm axle, but that page is not confirmed as TopKart. "Mini Blue Eagle" is TopKart's Mini/Cadet chassis, not the kid kart.
- **Core specs, agreed across sources:**
  - 25 mm chassis tubing
  - 770 mm wheelbase (about 30.3 in)
  - Mechanical brake on the rear only
  - IMAF "Puffo" silver seat
  - D.17 (17 mm) spindles, listed at 10.5°
  - Aluminium wheels listed as "112DSM/140"
  - Partial 360-style chain guard
- **Axle conflict:** the 2026 product page says **30 mm** axle. The older TopKart USA page, MondoKart, GoKartsUSA, and TopKart USA's own axle and bearing parts all say **25 mm**. The 25 mm axle part is listed as 25x950x3, which reads as diameter x length x wall. The owner has to measure their own kart.
- **Adjustments that almost certainly exist:** seat position, rear track width (hubs on a keyed axle), front track width (spindle spacers on the 17 mm stub axle), toe (tie rods), ballast placement, tire pressure, and rear hub length.
- **Not confirmed on this chassis:** adjustable caster or camber (no eccentric pills found for the kid kart), ride-height adjustment, torsion bars, interchangeable axle stiffness, steering-ratio options, and a front or adjustable brake. **None of these should be recommended until the owner confirms them on the kart.**
- **No TopKart kid kart setup sheet was found.** That means factory baselines (track widths, toe, seat position, pressures) and weight-distribution targets are all `unknown`. Widely agreed baselines for adult karts are recorded below for reference only.
- **Club context:**
  - Comer kid kart minimum weight is usually **150 lb** with the driver (several clubs agree). Newcastle KRA sets no minimum.
  - Tires are usually **MG Red (SH/SH2/"HZ") 4.50 front and rear on 5 in rims**, with a 33–33.375 in maximum circumference. 61 Kartway (which cites the 2026 WKA manual) lists Hoosier R60B.
  - Several clubs cap tire pressure at **20 psi** for kid karts. Road America allows 30 psi.

## Findings table

| fact | value | units | source URL | confidence | notes |
|---|---|---|---|---|---|
| US distributor | Top Kart USA, Indianapolis IN; official North American importer/distributor | — | https://topkartusa.net/ ; https://shop.topkartusa.net/ | manufacturer | Several results agree. |
| Current US model name | "2026 Kid Kart Chassis" | — | https://shop.topkartusa.net/products/kid-kart-chassis | manufacturer | Product page and the topkartusa.net/chassis/kid-kart/ page both use "Kid Kart". |
| EU name for same chassis | "Top-Kart KID KART 50cc – RT20" | — | https://www.mondokart.com/en/new-chassis-mondokart/chassis-top-kart-kart-tonykart/chassis-new-top-kart-kid-kart-50cc-rt20-without-engine-without-tyres.html | expert_consensus | Retailer listing, single summary. I could not confirm what "RT20" means. |
| 2026 price (at index time) | 3,195 | USD | https://shop.topkartusa.net/products/kid-kart-chassis | expert_consensus | Single summary. Context only. |
| Engine options | Comer C52 standard; no-engine rolling chassis; Briggs LO206 build | — | https://shop.topkartusa.net/products/kid-kart-chassis | manufacturer | Two searches returned this. Both draw on the same page. |
| Ships with tires? | No | — | https://shop.topkartusa.net/products/kid-kart-chassis | expert_consensus | Single summary. |
| Chassis tubing | 25 | mm | https://shop.topkartusa.net/products/kid-kart-chassis ; https://topkartusa.net/chassis/kid-kart/ ; MondoKart RT20 page | manufacturer | 3 sources agree. |
| Wheelbase | 770 | mm | shop.topkartusa.net/products/kid-kart-chassis ; MondoKart RT20 ; https://gokartsusa.com/TopKart-Kid-Kart-Chassis-Complete-With-C50-2-2.aspx | manufacturer | 3 sources agree. 770 mm = 30.3 in (inferred conversion). |
| Axle diameter (2026 page) | 30 | mm | https://shop.topkartusa.net/products/kid-kart-chassis | expert_consensus | **Conflicts with the 25 mm sources.** One page. Shop also sells "30mm Top Kart Axles" and a "30mm x 62OD axle bearing for mini and kid kart". |
| Axle diameter (older and other sources) | 25 | mm | https://topkartusa.net/chassis/kid-kart/ ; MondoKart RT20 ; gokartsusa C50 listing ; https://shop.topkartusa.net/products/25mm-kid-kart-axle | manufacturer | 4 sources agree. The older TopKart USA page was reported as about 3,920 days old (around 2015–16). |
| 25 mm axle part spec | 25x950x3, SKU 1000-138-04, "Top Kart original Kid Kart" | mm | https://shop.topkartusa.net/products/25mm-kid-kart-axle | expert_consensus | Reads as diameter x length x wall thickness (inferred). Shown as sold out. |
| Axle bearing (25 mm) | 25 x 62 OD | mm | https://shop.topkartusa.net/collections/bearings | manufacturer | Two results. |
| Bearing cassette | "Top Kart Kid Kart 25mm Bearing Cassette"; also 30 mm aluminium cassette for mini/kid kart | — | https://cometkartsales.com/collections/bearing-cassette ; https://shop.topkartusa.net/collections/axles-hubs/bearing-cassettes | expert_consensus | |
| Axle type | Live axle, no differential (Top Kart Cadet described this way; all karts in this class) | — | https://motoiq.com/Christas-first-Racer-a-Top-Kart-Go-Kart | inferred | Single article, about a Cadet, not the Kid Kart. Live axle is universal in karting. |
| Axle key | 6x5x60 Mini/Kid Kart key; fits hubs and sprocket hub | mm | https://shop.topkartusa.net/collections/axles-hubs | expert_consensus | Keyed axle supports sliding hubs, so rear track is adjustable (inferred). |
| Rear hubs (older spec) | D.25 aluminium rear hubs | — | https://topkartusa.net/chassis/kid-kart/ | expert_consensus | Hub length not given. |
| Rear hubs (shop) | 30 mm mini hubs listed as optional for Kid Kart; a "50mm magnesium hub" was described as standard | — | https://shop.topkartusa.net/collections/30mm-and-smaller-axles/rear-wheel-hubs | inferred | The 50 mm claim looks like a mix-up with adult 50 mm axle hubs. **Treat as unreliable.** |
| Typical kid kart rear hub length (generic) | 62 mm "most common factory option on Kid Karts"; 40/62/95/115 mm available for 25 mm axle | mm | https://pointkarting.com/products/righetti-25mm-rear-hubs | expert_consensus | Aftermarket (Righetti). Not confirmed as TopKart's hub. |
| Spindle | D.17, 10.5° | mm, deg | https://topkartusa.net/chassis/kid-kart/ | expert_consensus | Older page. The 10.5° is probably the built-in spindle/kingpin (caster) angle, but the summary does not say what it measures. |
| 17 mm spindle part | "fits the Mini (cadet) and Kid Kart"; "this spindle type is discontinued" | — | https://shop.topkartusa.net/collections/spindle-components | expert_consensus | |
| Front hub | 72 mm long, 17 mm ID bearing (17x35x10) for D.17 spindles; also a 25 mm front wheel hub bearing 42x25x9 | mm | https://shop.topkartusa.net/collections/front-wheel-hubs ; https://shop.topkartusa.net/collections/bearings | expert_consensus | Which hub is fitted to the Kid Kart is not confirmed. |
| Seat | IMAF "Puffo" (Silver / Rombo type) | — | shop.topkartusa.net/products/kid-kart-chassis ; topkartusa.net/chassis/kid-kart/ | manufacturer | 2 pages agree. |
| Brakes | Mechanical, rear | — | gokartsusa C50 listing ; shop.topkartusa.net/products/kid-kart-chassis | manufacturer | "Mechanical" on 2 pages. "Rear" is from GoKartsUSA only. No adjustable brake bias or front brakes found. |
| Wheels | Aluminium "112DSM/140" type | — | shop.topkartusa.net/products/kid-kart-chassis ; topkartusa.net/chassis/kid-kart/ | manufacturer | Most likely 112 mm front and 140 mm rear rim widths (inferred, not confirmed). |
| Chain guard | Partial 360 style | — | shop.topkartusa.net/products/kid-kart-chassis ; topkartusa.net/chassis/kid-kart/ | manufacturer | |
| Overall width | 42 | in | https://gokartsusa.com/TopKart-Kid-Kart-Chassis-Complete-With-C50-2-2.aspx | expert_consensus | Archived dealer listing, single summary. |
| Recommended driver age | 5–8 | years | gokartsusa C50 listing | expert_consensus | |
| Tires as delivered (older complete kart) | Bridgestone YLC "4.50x10" | — | gokartsusa C50 listing | inferred | The size is probably 10x4.50-5 (4.50 front on a 5 in wheel). Single summary. |
| Tie rod (Mini, for comparison) | 221 mm, SR28 / Blue Eagle Mini | mm | https://shop.topkartusa.net/collections/chassis-parts | expert_consensus | Kid Kart tie-rod length unknown. |
| Rear bumper bolt kit | "25mm – Kid Kart" size | — | https://shop.topkartusa.net/collections/chassis-parts | expert_consensus | Confirms a rear bumper is fitted. |
| Parts lead time USA | about 3 days (per TopKart USA owner, via forum) | days | https://forums.kartpulse.com/t/top-kart-opinions/10227 | inferred | Single forum post. |
| Club min weight (Comer kid kart) | 150 | lb (kart + driver) | OVKA 2024/2025 manuals ; AMP 2018 ; Badger Kart Club ; 61 Kartway | track_official | 4 clubs agree. OVKA pairs it with a 0.310" kid kart restrictor slide. |
| Club min weight (Newcastle KRA Comer) | none | — | https://newcastlemotorsportspark.com/rules | expert_consensus | Conflict. Single summary. |
| Front track max (club) | 40 | in (outside rim/tire) | https://texassprintseries.com/wp-content/uploads/2025/01/206-Kid-Kart-Supplemental.pdf ; http://amrmotorplex.com/files/1415/4042/7888/AMR_Kid_Kart_Package_v3.pdf | track_official | 2 clubs agree. Not WKA text. |
| Rear track range (club) | 39–42 | in (outside rim/tire) | TSS 2025 supplemental ; AMR 2018 | track_official | 2 clubs agree. |
| Wheelbase range (club) | TSS 29–31.5 in; AMR 29–35.5 in; OVKA "about 770–900 mm" | in / mm | TSS ; AMR ; OVKA intro manual | track_official | The 770 mm TopKart fits all three (inferred). |
| Max height (club) | 20 in at any point | in | TSS 2025 supplemental | expert_consensus | Single summary. |
| WKA overall width, all classes (flat kart) | 50 in max (rule 451.5) | in | https://4cycle.com/karting/threads/how-wide-is-a-flat-kart.111655/ | inferred | Forum citing an old WKA manual. |
| Kid kart max tire pressure | 20 psi (hot); CKC 2026: 20 psi hot or cold; another club: 20.00 psi at any point, pre or post | psi | https://irp.cdn-website.com/7ce125dc/files/uploaded/CKC+2026.6+Supplemental+Ruleset.pdf ; https://forums.kartpulse.com/t/tire-pressure-cold-day-kid-kart/13973 ; motorsportreg club doc | track_official | 3 sources agree on 20. Forum reports a DQ at 20.5 psi. |
| Kid kart max tire pressure (Road America) | 30 psi after race | psi | https://roadamerica.com/sites/main/files/file-attachments/2025_rakc_class_structure.pdf | expert_consensus | Conflict with 20 psi. |
| Kid kart tire circumference max | OVKA 33.25 in; Badger 33-3/8 in; Newcastle rear 33 in | in | OVKA 2022 rulebook ; https://badgerkartclub.com/rulebook/ ; Newcastle rules | track_official | Clubs differ. Never averaged. |
| Weight distribution (adult kart baseline) | 43 front / 57 rear; 50/50 left/right; cross about 50% | % | https://kartbalance.com/ ; https://www.woodbridgekartclub.com/how-to/kart-scaling-weight-distribution/ ; https://www.angriracing.com/kart-setup ; SSC 2005 manual (kartpulse) | expert_consensus | **Not kid-kart-specific.** No kid kart target found. |
| Scaling tolerance | fronts within 5 lb of each other (older rule: rears within 10 lb) | lb | Woodbridge Kart Club ; 4cycle weight thread | expert_consensus | Adult guidance. |

## Adjustments-that-exist matrix

"Exists" means the adjustment can be made on the TopKart Kid Kart. `unknown` means no source confirms it either way, so the engine must not recommend it until the owner checks the kart.

| Adjustment | exists | evidence | confidence |
|---|---|---|---|
| Seat fore/aft and height | yes | IMAF Puffo seat is mounted with struts on every kart. No TopKart seat-position spec was found. | inferred |
| Rear track width (hub position on axle) | yes | Keyed axle (6x5x60 key "fits the hubs"), D.25 rear hubs. Club rules set rear width 39–42 in. Range of hub travel on this axle is unknown. | inferred |
| Rear hub length | yes (aftermarket) | 25 mm hubs in 40/62/95/115 mm lengths (Righetti). TopKart stock hub length unknown. | expert_consensus (generic) |
| Front track width (spindle spacers) | yes (likely) | D.17 spindle. PKT 17 mm spindle spacers "fit most Kid Karts". TopKart-supplied spacer count and widths unknown. | inferred |
| Toe (tie rods) | yes (likely) | Tie rods sold per chassis. Rod-end adjustment is universal in karts. No Kid Kart baseline toe found. | inferred |
| Tire pressure | yes | Limited by club max (20 psi at several clubs). | track_official |
| Ballast placement | yes | Club minimum weight of 150 lb with a light 5–8 year-old driver means ballast is needed. Mounting points on this chassis not documented. | inferred |
| Axle diameter | conflict | 25 mm (older and most sources) vs 30 mm (2026 page). Must be measured. | — |
| Axle stiffness (interchangeable) | unknown | Only one 25 mm TopKart axle (25x950x3) found. 30 mm "Top Kart Axles" are listed but no hardness options. Aftermarket PKT 25 mm (970 mm long) and 30 mm kid kart axles exist. | unknown |
| Caster | unknown (probably fixed) | Spindle listed as "D.17 / 10.5°". No eccentric pills or caster adjuster found for the Kid Kart. Aftermarket Sniper SA1 8 mm kingpin adjusters are sold for "most Kid Kart or Cadet chassis", so retrofitting may be possible. | unknown |
| Camber | unknown (probably fixed) | Same as caster. | unknown |
| Ride height (front or rear) | unknown | Not mentioned for this chassis. Adult karts use spindle washers or axle-bearing position. Not confirmed here. | unknown |
| Torsion bars / front bar / rear bar | unknown (no evidence they exist) | Not mentioned in any Kid Kart spec. | unknown |
| Bearing-cassette height (axle height) | unknown | Cassettes exist (25 mm TopKart Kid Kart cassette, 30 mm aluminium cassette), but no adjustable height was mentioned. | unknown |
| Ackermann / steering-arm holes | unknown | Not found. | unknown |
| Steering ratio (steering-shaft arm holes) | unknown | Not found. One parts supplier says a slower steering ratio helps young drivers, but that is generic. | unknown |
| Brakes | rear only, mechanical | No front brakes, no hydraulic system, no bias adjustment on the kid kart spec. | manufacturer (mechanical) / expert_consensus (rear) |
| Bumper / bodywork | fixed (rear bumper with 25 mm Kid Kart bolt kit) | Not a tuning lever. | expert_consensus |

**Adult-kart adjustments that do not exist or are unconfirmed on this chassis:** caster/camber eccentrics, front ride-height spacers, rear ride-height (cassette) adjustment, front and rear torsion bars, axle hardness options, adjustable seat struts (not documented), steering-arm Ackermann positions, steering-ratio holes, brake bias, front brakes, and hydraulic brakes.

## Setup effects (generic kart guidance; none of it is TopKart-specific)

| Adjustment | Handling effect | Sources | confidence |
|---|---|---|---|
| Rear track **narrower** | More rear grip, less stability. Cures oversteer or a loose kart on exit (about 1/4 in per side, or 3–5 mm steps; 2–3 mm for cadets). | https://forums.kartpulse.com/t/rear-width-setup/9855 ; https://nhka.net/wp-content/uploads/2018/02/crg-setup-guide.pdf ; https://linsellspeedshop.com/kart-troubleshooting | expert_consensus |
| Rear track **wider** | More stable and "free", less rear grip. Common practice is to run as wide as the rules allow if the kart works. Also a cure for hopping. | same | expert_consensus |
| Front track **wider** | More jacking: more front grip and quicker turn-in. Cures push or understeer (spacers usually 5 or 10 mm). Too wide makes the kart twitchy. | CRG guide ; https://www.kartinghub.co.uk/knowledge/post/getting-your-kart-dialled-in-a-beginners-guide-to-setup-a5TxAZ0Logx1qbu ; https://www.angriracing.com/kart-setup | expert_consensus |
| Front track **narrower** | Slower turn-in, less front bite. | same | expert_consensus |
| Rear tire pressure **lower** (0.5–1 psi) | More rear grip. Cure for the rear sliding on entry. | CRG guide | expert_consensus (generic) |
| Rear tire pressure **higher** (0.5–1 psi) | Less rear grip. Part of the cure for hopping. | https://forums.kartpulse.com/uploads/default/original/1X/9b7c2e0ca91fc49233ae65ac3a9b4c9472d3bea1.pdf (SSC) | expert_consensus (generic) |
| Higher pressure on a cold day | Smaller contact patch, builds heat faster. Kid kart tires are hard and karts are light, so they build little heat. | https://forums.kartpulse.com/t/tire-pressure-cold-day-kid-kart/13973 ; https://www.decuzzitires.com/post/finding-the-right-tire-pressure-for-your-go-kart | expert_consensus |
| Rear hub **shorter** | Less rear grip, frees the kart, cure for hopping. **Longer** gives more rear grip (Righetti: 115 mm "for extra rear grip"). | SSC manual ; https://pointkarting.com/products/righetti-25mm-rear-hubs | expert_consensus |
| Ballast **low/central** | Stability, predictable. **High** ballast adds weight transfer and grip but makes the kart nervous under braking and on curbs. Lower ballast is part of the hop cure. | https://kartbalance.com/blog/2026/03/lo206-briggs-206-weight-distribution-deep-dive/ ; https://forums.kartpulse.com/t/mounting-lead-ballast/6687 | expert_consensus |
| Seat position | Main lever for front/rear and left/right %. Cross weight is not set by weight placement. A shorter junior sits further forward (about 18 cm axle-to-back vs about 15 cm for an adult, per Tillett). | https://4cycle.com/karting/threads/weight-distribution-tips.56576/ ; https://tillett.co.uk/wp-content/uploads/2025/12/Kart-seat-positioning-2025.pdf | expert_consensus |
| Cross weight **higher** | More push (dirt/oval context). | https://4cycle.com/karting/threads/kids-kart-setup.86270/ | inferred (single forum, oval) |
| Softer/stiffer axle | Softer suits high grip; stiffer suits slippery conditions. Only usable if alternative axles exist for this chassis. | https://kartletix.com/2025/02/20/kart-setup-adjustments-chassis/ | expert_consensus (generic) |

**Stability-first principles for 5–8 year-olds:**

- A kid kart should be easy to drive. A young driver will not be comfortable in a kart that pushes a lot or is loose.
- A sound baseline setup and correct seat position matter more than fine tuning ("setups are not as important with kid karts until the driver is getting beat").
- A slower steering ratio smooths out erratic inputs.
- One change at a time, logged.

Sources: https://4cycle.com/karting/threads/kid-kart-setup.31126/ ; https://www.kartpartsdepot.com/FRONT_END_ADJUSTMENT_p/021.htm. Forum material is about 10–12 years old. Confidence: inferred (single forum posts), apart from "one change at a time", which is expert_consensus.

## Tires and pressures

| Tire | Size | Where required | Source | confidence |
|---|---|---|---|---|
| MG SH / SH2 (Red) | 4.50 front and rear on 5 in rims (10x4.50-5); max circumference 33-3/8 in | Badger Kart Club | https://badgerkartclub.com/rulebook/ | expert_consensus |
| MG "HZ" Red | 4.5 front / 4.5 rear | AMP (2018) | https://www.atlantamotorsportspark.com/wp-content/uploads/2018/01/AMP-Class-Structure.pdf | expert_consensus (old) |
| MG Red | 450x5; rear circumference max 33 in | Newcastle KRA | https://newcastlemotorsportspark.com/rules | expert_consensus |
| (unspecified brand) | 10x4.50-5 front and rear; max circumference 33.25 in | OVKA 2022 | https://ovka.com/files/2022/2022_OVKA_Rulebook.pdf | expert_consensus |
| Hoosier R60B | 10.0x4.5-5 (medium-hard, cold durometer 60–62) | 61 Kartway (cites 2026 WKA Tech Manual) | https://www.61kartway.com/classes/ ; https://www.hoosiertire.com/news/article/64406/?tab=news | expert_consensus |
| Bridgestone YLC | "4.50x10" (probably 10x4.50-5) | As delivered on an older complete TopKart Kid Kart | gokartsusa C50 listing | inferred |
| Vega M1 CIK Mini | 10x4.00-5 | CIK-FIA Mini (Europe), not US kid kart | Vega homologation form (fiakarting.com) | expert_consensus |

I found no source for the "4.10/4.0-5" size on MG or Vega kid kart tires.

**MG Red pressure ranges.** All of these are adult-kart guidance. None is kid-kart-specific.

| Source | Range |
|---|---|
| Riiroo, Decuzzi | 12–15 psi cold; 14–18 or 15–18 psi hot |
| AMV | 16 ±1 psi cold on low-grip tracks; 12 ±1 psi cold on high-grip tracks |
| MG Tires USA | 13–15 psi hot at first start; 10–13 psi hot on rubbered tracks |
| Nashville Kart Group | 13–14 psi hot |

The general rule is a colder day means higher starting pressure. Confidence: expert_consensus, since several sources agree on the direction.

**Kid kart practice (forum).** Run close to the 20 psi club maximum in cold or hot weather, then bleed to about 19–19.5 psi after warm-up to stay legal. Tread wear dots are misleading on kid karts because they often don't touch the ground. One parent found lower front pressure less "skatey" and better over bumps. One sprint kid kart post ran 20/20 and adjusted the rears to equalise circumference. A dirt post ran 3–5 psi on Vega Whites (dirt only). Sources: kartpulse 13973 and 13707. Confidence: inferred (anecdote, summary-only).

**No baseline pressures** for the TopKart Kid Kart were found. The baseline is `unknown`.

## Conflicts (both values kept, never averaged)

1. **Axle diameter:** 30 mm on the 2026 shop page, vs 25 mm on the older TopKart USA page, MondoKart, GoKartsUSA and the TopKart 25 mm Kid Kart axle part. This may be a 2026 change, but no source says so.
2. **Engine on archived GoKartsUSA listing:** C50 in the description, C51 in the title (context only).
3. **Rear hub standard:** "D.25 aluminium rear hubs" (older page) vs "50mm magnesium hub standard" (shop summary, likely a misattribution).
4. **Kid kart max tire pressure:** 20 psi (CKC 2026, TSRS-aligned club, forum-quoted rule) vs 30 psi after race (Road America 2025).
5. **Minimum weight:** 150 lb (OVKA, AMP, Badger, 61 Kartway) vs no minimum (Newcastle KRA).
6. **Tire spec:** MG Red SH/SH2/HZ (Badger, AMP, Newcastle) vs Hoosier R60B (61 Kartway citing the 2026 WKA manual).
7. **Max circumference:** 33.25 in (OVKA) vs 33-3/8 in (Badger) vs 33 in rear (Newcastle).
8. **Wheelbase rule range:** 29–31.5 in (TSS) vs 29–35.5 in (AMR).

## Open questions for the user (trackside or at the kart)

1. Model year of your kart, and whether it matches the "2026 Kid Kart Chassis" page or the older spec. A photo of the chassis sticker or plate helps.
2. **Measure the axle diameter** (25 or 30 mm) and length. If you can, note the axle marking or color.
3. Rear hub length and material. How far each hub can slide on the axle (min/max rear track you can actually set).
4. Front: how many spacers are on each spindle, inside vs outside the hub, and their widths. What is the current front track (outside tire to outside tire)?
5. Are there any eccentric pills, caster/camber adjusters or spindle washers on the kingpins? Is there any front or rear torsion bar or bar mounting point?
6. Is there more than one mounting hole on the steering-shaft arm or the spindle arms (steering ratio or Ackermann)?
7. Seat: current position (distance from the back of the seat to the axle), strut count, and how much fore/aft and height adjustment the mounting allows.
8. Where is the ballast now, how much is there, and what is the scaled kart+driver weight vs your club minimum?
9. Corner weights, if you can borrow scales (driver seated in full gear, equal tire pressures, wheels straight).
10. Which tire your clubs require (MG Red SH/SH2? Hoosier R60B?), and each club's maximum pressure and when it is checked (hot, cold, post-race).
11. Current toe setting and whether the tie rods have adjustable rod ends.
12. Rear track width your club allows (TSS/AMR say 39–42 in; your club may differ).

## Sources

- topkart_usa_2026_page: https://shop.topkartusa.net/products/kid-kart-chassis
- topkart_usa_kidkart_old: https://topkartusa.net/chassis/kid-kart/
- topkart_usa_home: https://topkartusa.net/ ; https://shop.topkartusa.net/
- topkart_usa_axle25: https://shop.topkartusa.net/products/25mm-kid-kart-axle
- topkart_usa_axles: https://shop.topkartusa.net/collections/axles-hubs
- topkart_usa_bearings: https://shop.topkartusa.net/collections/bearings
- topkart_usa_spindles: https://shop.topkartusa.net/collections/spindle-components
- topkart_usa_fronthubs: https://shop.topkartusa.net/collections/front-wheel-hubs
- topkart_usa_rearhubs: https://shop.topkartusa.net/collections/30mm-and-smaller-axles/rear-wheel-hubs
- topkart_usa_chassisparts: https://shop.topkartusa.net/collections/chassis-parts
- mondokart_rt20: https://www.mondokart.com/en/new-chassis-mondokart/chassis-top-kart-kart-tonykart/chassis-new-top-kart-kid-kart-50cc-rt20-without-engine-without-tyres.html
- gokartsusa_c50: https://gokartsusa.com/TopKart-Kid-Kart-Chassis-Complete-With-C50-2-2.aspx
- cometkart_cassette: https://cometkartsales.com/collections/bearing-cassette
- pk_righetti_25hubs: https://pointkarting.com/products/righetti-25mm-rear-hubs
- pk_spindle_spacers: https://pointkarting.com/products/17mm-spindle-spacers-go-kart
- pk_sniper_sa1: https://pointkarting.com/products/sniper-sa1-caster-camber-adjusters
- tss_2025: https://texassprintseries.com/wp-content/uploads/2025/01/206-Kid-Kart-Supplemental.pdf
- amr_2018: http://amrmotorplex.com/files/1415/4042/7888/AMR_Kid_Kart_Package_v3.pdf
- ovka_2025: https://ovka.com/wp-content/uploads/OVKA-Intro-to-Karting-Manual-2025-Final-v1.0.pdf
- ovka_2022: https://ovka.com/files/2022/2022_OVKA_Rulebook.pdf
- amp_2018: https://www.atlantamotorsportspark.com/wp-content/uploads/2018/01/AMP-Class-Structure.pdf
- badger: https://badgerkartclub.com/rulebook/
- kart61: https://www.61kartway.com/classes/
- newcastle: https://newcastlemotorsportspark.com/rules
- ckc_2026: https://irp.cdn-website.com/7ce125dc/files/uploaded/CKC+2026.6+Supplemental+Ruleset.pdf
- road_america_2025: https://roadamerica.com/sites/main/files/file-attachments/2025_rakc_class_structure.pdf
- kp_kid_pressure: https://forums.kartpulse.com/t/tire-pressure-cold-day-kid-kart/13973
- kp_kid_tires: https://forums.kartpulse.com/t/do-i-need-new-tires-for-kid-kart/13707
- kp_topkart_opinions: https://forums.kartpulse.com/t/top-kart-opinions/10227
- kp_rear_width: https://forums.kartpulse.com/t/rear-width-setup/9855
- ssc_2005: https://forums.kartpulse.com/uploads/default/original/1X/9b7c2e0ca91fc49233ae65ac3a9b4c9472d3bea1.pdf
- crg_guide: https://nhka.net/wp-content/uploads/2018/02/crg-setup-guide.pdf
- kartinghub: https://www.kartinghub.co.uk/knowledge/post/getting-your-kart-dialled-in-a-beginners-guide-to-setup-a5TxAZ0Logx1qbu
- angri: https://www.angriracing.com/kart-setup
- linsell: https://linsellspeedshop.com/kart-troubleshooting
- kartletix: https://kartletix.com/2025/02/20/kart-setup-adjustments-chassis/
- kartbalance: https://kartbalance.com/
- kartbalance_206: https://kartbalance.com/blog/2026/03/lo206-briggs-206-weight-distribution-deep-dive/
- woodbridge: https://www.woodbridgekartclub.com/how-to/kart-scaling-weight-distribution/
- tillett_seat: https://tillett.co.uk/wp-content/uploads/2025/12/Kart-seat-positioning-2025.pdf
- kp_ballast: https://forums.kartpulse.com/t/mounting-lead-ballast/6687
- 4cycle_kid_setup: https://4cycle.com/karting/threads/kid-kart-setup.31126/
- 4cycle_kids_setup: https://4cycle.com/karting/threads/kids-kart-setup.86270/
- 4cycle_weight: https://4cycle.com/karting/threads/weight-distribution-tips.56576/
- kpd_front_end: https://www.kartpartsdepot.com/FRONT_END_ADJUSTMENT_p/021.htm
- decuzzi: https://www.decuzzitires.com/post/finding-the-right-tire-pressure-for-your-go-kart
- riiroo: https://riiroo.com/blogs/ride-on-toy-guides/what-is-the-optimal-air-pressure-for-go-kart-tyres
- amv: https://amvkartcomponents.com/How-To-Set-Tire-Pressure-c47092437
- mg_usa_tips: https://mgtiresusa.com/tips/
- nashville: https://www.nashvillekartinggroup.com/tires
- hoosier_r60b: https://www.hoosiertire.com/news/article/64406/?tab=news
- motoiq_cadet: https://motoiq.com/Christas-first-Racer-a-Top-Kart-Go-Kart
