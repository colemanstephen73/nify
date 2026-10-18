# Research B: Comer C52 kid kart engine

Accessed 2026-10-18. **Method caveat:** every fact below comes from web-search result summaries. WebFetch failed (DNS) on `www.wkaraces.com/technical-manual` and on the WKA PDF `www.worldkarting.com/wp-content/uploads/2022/04/Tech-Update-2022-002-COMER-C52.pdf`. I have not read any PDF directly. Per PLAN 1.5, confidence is capped one level below the source type unless two or more independent results agree. Capped values say so in their notes. The session's shared web-search budget ran out after about 42 searches, so a few planned lookups did not happen (C52 plug model, UK C50 technical regulations detail, Bergfelt carb notes). These are listed under Open questions.

Confidence order (fixed vocabulary): manufacturer > sanctioning_body > track_official > expert_consensus > anecdote > inferred > unknown.

## Summary

- **WKA §621 now covers the Comer C-51 and C-52.** TM Update 2022-002 (dated 19 Apr 2022, effective immediately) added the C-52. The 2023 Tech Manual approved changes (1 Oct 2022) say the C-50 is no longer allowed and that no C-50 parts may be fitted to C-51 or C-52 engines. Clubs that still want the C-50 are pointed to the 2012 manual.
- **How to tell the engines apart: crank stroke.** C-51 is 38 mm (1.486") and 48 cc. C-52 is 40 mm (1.575") and 50 cc. A C-52 crank may only be used with a C-52 cylinder and piston. Some C-51 cylinder grinding is allowed "for parity". No equivalent allowance for the C-52 appeared in the summaries.
- **The engine must stay stock.** Carb is Dell'Orto SHA-14-12L only, as cast (§621.1). Clutch drum must be a Comer 10-tooth for #219 chain (§621.17.1). Axle sprocket is "non-tech", meaning any size. There is no gear-ratio rule at WKA National level, but local promoters may set one. Suggested gear is 10/89. Fuel is spec 87 octane plus oil. No ratio is given.
- **Published tech limits (C-52):**
  - Ignition timing 0.055–0.067" BTDC, about 19–21°.
  - Exhaust port height at least 1.206" (114° ATDC, 3 mm rod).
  - Intake height at most 0.435".
  - Combustion chamber at least 7.7 cc.
  - C-52 piston required; lower ring land to piston bottom at least 1.155".
  - Muffler must be OEM, with exit-hole limits (values not visible in the summaries).
  - Clutch shoes must be Comer-cast, unpolished, and meet minimum width and maximum diameter limits. Springs have a set coil count and wire diameter (values not visible).
- **Manufacturer and dealer specs:**
  - 50.27 cc, bore × stroke 40 × 40 mm, Nikasil aluminium cylinder, piston port, forced-air cooling.
  - Electronic ignition, centrifugal clutch, 10T #219 pinion, SHA 14-12L carb.
  - Dealers quote **2 hp at 6,500 rpm**.
- **Unresolved items:**
  - Fuel/oil ratio: 16:1 (several US sources) or 25:1 / 4% (Comer C50 spec sheet; a C52 dealer listing).
  - C52 spark plug and gap. A UK C50 document lists Champion RCJ7Y, NGK BPMR7A or Bosch WS5F, which are short-thread plugs.
  - Clutch engagement RPM, break-in, maintenance intervals and max RPM. No source found for any of these.
- **Class weight and age:** WKA Manufacturers Cup and Florida Winter Cup pages give Kid Kart Comer as ages 5–7 (attained age), 150 lb kart + driver, "Comer C51 only", spec 87 octane. These pages look older than the C52 update. Most clubs use 150 lb for ages 5–8. Beaver Dam uses 155 lb. Road America lists 150/170.
- **Local tracks:** No kid kart rules were found for Rocky Ridge (VT) or OVRP (NY). NHKA (NH) places 2-cycle kid karts under WKA engine rules (2016 page).

## Findings table

| fact | value | units | source URL | confidence | notes |
|---|---|---|---|---|---|
| Engines covered by WKA §621 | Comer C-51, C-52 | – | https://www.worldkarting.com/tm-update-2022-002/ ; https://www.worldkarting.com/documents/2022/10/2023-wka-tech-manual-approved-changes.pdf/ | sanctioning_body | Two WKA documents agree. |
| C-50 status (WKA) | not allowed; no C-50 parts in C-51/C-52 | – | same two as above | sanctioning_body | 2012 manual referenced for clubs wishing to allow C-50. |
| TM Update 2022-002 date | 2022-04-19, effective immediately, Board of Trustees approved | – | https://www.worldkarting.com/tm-update-2022-002/ | track_official | Single WKA doc (capped from sanctioning_body; summary-only). |
| Stock rule | stock as supplied; no grinding or aftermarket except as specified; changes only to promote equality | – | https://www.worldkarting.com/tm-update-2022-002/ | sanctioning_body | Repeated across many summaries and the 2023 changes doc. |
| C-52 stroke | 40 (1.575) | mm (in) | https://www.worldkarting.com/tm-update-2022-002/ ; https://90racing.com/products/comer-c52-kart-engine-90-comer-c52 | sanctioning_body | WKA and dealer agree. Measured by dial indicator in plug hole zeroed at BDC; should read at or just under 1.575". |
| C-51 stroke | 38 (1.486) | mm (in) | https://www.worldkarting.com/tm-update-2022-002/ | sanctioning_body | Matches the 2015 C50 spec sheet's 38 mm (C50/C51 same stroke). |
| C-52 bore | 40 | mm | https://90racing.com/products/comer-c52-kart-engine-90-comer-c52 ; https://shop.topkartusa.net/products/comer-c52-engine | expert_consensus | Dealers relaying manufacturer data. The C50 spec sheet also gives 40 mm bore. |
| C-52 displacement | 50.27 (WKA: "50") | cc | 90racing; topkartusa; WKA TM 2022-002 | expert_consensus | C-51: 48 cc (WKA). |
| C-52 power | 2 hp (2 CV) @ 6,500 | hp @ rpm | https://shop.topkartusa.net/products/comer-c52-engine ; https://www.racingkart.it/en/motori-kart/comer/motore-comer-c52 | expert_consensus | Two dealers, probably copying the same Comer catalogue. 6,500 rpm conflicts with anecdotal tach peaks of 9,600–11,000 rpm (see Conflicts). |
| Cylinder | aluminium, Nikasil plated; piston-port intake | – | 90racing | anecdote | Single dealer (capped). |
| Cooling | forced air | – | 90racing; topkartusa | expert_consensus | |
| Ignition | electronic | – | 90racing; C50 spec sheet 2015 http://eolstoragewe.blob.core.windows.net/wm-553616-cmsimages/50cccomerspecsheet.pdf | expert_consensus | Ignition maker unknown. |
| Ignition timing (C-51 & C-52) | 0.055–0.067 (≈19–21° BTDC) | in BTDC | https://www.worldkarting.com/tm-update-2022-002/ | track_official | Single WKA doc, seen in two separate summaries (capped). Dial-indicator procedure. |
| Carb (WKA) | Dell'Orto SHA-14-12L only; all parts as cast; no repairs to broken bodies; stripped holes may use thread insert or one-size-larger screw | – | https://www.worldkarting.com/wp-content/uploads/2022/04/Tech-Update-2022-002-COMER-C52.pdf | sanctioning_body | §621.1. Dealers also list SHA 14-12L as fitted. Carb detail belongs to Track C. |
| Main jet | 58 stock (UK Bambino); jets 54–58 "allowed" in an unattributed snippet with ".475 no-go venturi" | Dell'Orto size | https://www.dellorto.co.uk/shop/dellorto-motorcycle-carburettors-parts/complete-carburettors-dellorto-motorcycle-carburettors-parts/sha-12-to-16mm/r2100-sha-14-12l/ ; http://www.bergfeltracing.com/c50carb.html | anecdote | Not a WKA figure. Hand off to Track C. |
| Min combustion chamber volume | C-51 7.4; C-52 7.7 (both ≈6.49:1 CR) | cc | Tech-Update-2022-002 PDF | track_official | Single doc (capped). |
| Exhaust port height (min) | C-52 1.206" (114° ATDC with 3 mm rod); C-51 1.204" (112°) | in | Tech-Update-2022-002 PDF | track_official | Dial indicator on head, zeroed at TDC. C-51 may grind the port top to reach the minimum; the summary shows no such allowance for the C-52. |
| Intake port height (max) | C-52 0.435; C-51 0.417 | in | Tech-Update-2022-002 PDF | track_official | Single doc (capped). |
| C-52 piston | C-52 piston required; min 1.155" from bottom of lower ring land to piston bottom | in | https://www.worldkarting.com/tm-update-2022-002/ | track_official | Single doc (capped). |
| Muffler | OEM only, with exit-hole limits | – | https://www.worldkarting.com/tm-update-2022-002/ | track_official | Exit-hole numbers not visible. L.A.D. Specialties sells a "Comer C-51 muffler gauge" (https://ladspecialties.com/comer-c-51-muffler-gauge/). |
| Restrictor (WKA) | unknown | – | https://www.eldoraspeedway.com/wp-content/uploads/2020/03/2020-class-specifications.pdf | unknown | Eldora 2020 says "50cc Comer w/WKA Restrictor", but no WKA restrictor for Comer appeared in any WKA summary. It may refer to the muffler/venturi limits. Open question. |
| Clutch type | centrifugal, 3-shoe (C50) | – | C50 spec sheet 2015; 90racing | expert_consensus | |
| Clutch shoes (WKA) | Comer name cast in; stock appearing; not polished, no metal removed; min shoe width, min assembly width, max shoe diameter | – | https://www.worldkarting.com/tm-update-2022-002/ | track_official | Numeric values not visible. A forum says WKA allows minimal grinding to the minimum spec (https://forums.kartpulse.com/t/comer-c-50-c-51-kid-kart-clutch/3908). |
| Clutch springs (WKA) | coil count and wire diameter specified | – | https://www.worldkarting.com/tm-update-2022-002/ | track_official | Values not visible. Cryo springs hold more tension, so engagement RPM is higher (anecdote, ntkarters). |
| Clutch engagement RPM | unknown | rpm | – | unknown | No source found. Anecdote: a high idle (about 4,000) can engage the clutch at idle. |
| Clutch drum | Comer 10-tooth for #219 chain | teeth | Tech-Update-2022-002 PDF §621.17.1; 90racing; https://pktaxles.com/products/comer-c50-219-clutch-drum-go-kart | sanctioning_body | WKA and two dealers agree. Z11/Z12 drums are sold (Mondokart) but are not WKA legal. |
| Chain | #219 | pitch | as above | sanctioning_body | |
| Axle sprocket (WKA) | non-tech (any size) | teeth | Tech-Update-2022-002 PDF | track_official | Single doc (capped). |
| Gear ratio rule (WKA National) | none; local promoters may set one | – | https://www.worldkarting.com/tm-update-2022-002/ | track_official | |
| Suggested gear | 10/89 | driver/axle | WKA TM 2022-002; Road America 2024 rule book; Eldora 2020 ("WKA gear 10/89") | sanctioning_body | Several sources agree. Some clubs make 10/89 mandatory. |
| Typical axle range | 79–88 with 9–10T driver | teeth | https://forums.kartpulse.com/t/vintage-100cc-build-in-us/10210?page=5 | anecdote | Generic kid kart forum post. Under WKA the driver must be 10T. |
| Fuel (WKA) | spec 87 octane gasoline + oil; purchased from WKA at national events | – | https://www.worldkarting.com/series/manufacturers-cup/ ; https://nicole-gaines-8xm9.squarespace.com/tech-updates/tm-update-2019-001 | sanctioning_body | Two WKA pages agree. 61 Kartway (2026) lists 87 octane ethanol as a local option. |
| Fuel/oil ratio | CONFLICT: 16:1 vs 25:1 (4%) | ratio | see Conflicts | expert_consensus / track_official | No WKA ratio rule found. |
| Oil type | any quality 2-stroke racing oil; "not castor" (C52 dealer) | – | https://shop.topkartusa.net/products/comer-c52-engine ; https://4cycle.com/karting/threads/comer-kid-kart-oil-gas-mix-ratio.64197/ | anecdote | No approved-oil list found. |
| Spark plug | C52 unknown. UK C50 2022 regs permit Champion RCJ7Y, NGK BPMR7A, Bosch WS5F. C50 spec sheet: "short thread" plug | – | https://eolstoragewe.blob.core.windows.net/wm-553616-cmsimages/ComerC50EMRMSASpecSheet2022-21012022.pdf ; C50 spec sheet 2015 | inferred | Inferred for the C52 from the C50 (same family). The UK documents were not opened. Long-reach BR8ES/BR9ES-type plugs probably do not fit a short-thread head. Unverified. |
| Plug gap | unknown | mm | – | unknown | |
| Max RPM / peak power RPM | unknown (dealer: peak 2 hp @ 6,500) | rpm | https://4cycle.com/karting/threads/c51-kid-kart-racing-why-is-my-kids-engine-so-much-slower.107502/post-766589 | anecdote | C51 owner: tach peak 9,600 rpm; a faster rival "closer to 11,000". Forum: the Comer needs revs kept "in the power band". |
| Idle RPM | about 2,400 stable (one C51); 4,000 seen on a fresh rival engine | rpm | same 4cycle thread | anecdote | A high idle causes creep or clutch engagement (kartpulse clutch thread). |
| Break-in | unknown | – | – | unknown | No Comer C5x break-in found. |
| Maintenance intervals | unknown | hours | – | unknown | Point Karting sells a C50/K80 ring lapping tool. That shows rings are serviceable but gives no interval. |
| WKA Kid Kart (Comer) age | 5–7 attained | years | https://www.worldkarting.com/series/manufacturers-cup/ ; https://www.worldkarting.com/series/florida-winter-cup/ | sanctioning_body | Two WKA pages agree. They may be outdated. |
| WKA Kid Kart (Comer) min weight | 150 (kart + driver) | lb | same two WKA pages | sanctioning_body | Chassis note on the same page says "under 200 lb". Clubs mostly use 150. |
| WKA Kid Kart engine per series page | "Comer C51 only" | – | same | sanctioning_body | Conflicts with TM 2022-002 adding the C52 to §621 (see Conflicts). |
| Newer WKA updates (2023–2026) | TM 2024-001 (pans, TAG, SuperKart, shifter); 2025-001/002 (bodywork, roll cage); 2026-001..003 (road-race fuel system, deck lid, roll cage). None found for Comer | – | https://www.worldkarting.com/tm-update-2024-001/ ; https://www.worldkarting.com/category/tech-updates/ | track_official | Summary-only. The 2026 Tech Manual itself was not found. |

## Rules by sanctioning body

### WKA (World Karting Association)
- **§621 (Comer C-51 / C-52 kid kart engine):** TM Update 2022-002. Sources: https://www.worldkarting.com/tm-update-2022-002/ and PDF https://www.worldkarting.com/wp-content/uploads/2022/04/Tech-Update-2022-002-COMER-C52.pdf
  - General: stock as supplied, no grinding or aftermarket except as specified, equality-only changes.
  - Engine identification by crank stroke (C-51 1.486", C-52 1.575"). A C-51 crank goes only with a C-51 case, cylinder and piston. A C-52 crank goes only with a C-52 cylinder and piston.
  - §621.1 Carburetor: Dell'Orto SHA-14-12L only, as cast.
  - Timing 0.055–0.067" BTDC (C-51 and C-52).
  - Ports: exhaust minimum C-51 1.204" and C-52 1.206". Intake maximum C-51 0.417" and C-52 0.435". C-51 may grind the port top to reach the minimum; the port may not be widened.
  - Combustion chamber minimum: C-51 7.4 cc, C-52 7.7 cc.
  - C-52 piston: minimum 1.155" from lower ring land to bottom.
  - Muffler: OEM, with exit-hole limits.
  - Clutch shoes and springs: dimensional limits (values unknown).
  - §621.17.1: Comer 10T clutch drum, #219 chain.
  - Axle sprocket non-tech. No national gear rule. Suggested 10/89.
- **2023 Tech Manual approved changes (1 Oct 2022):** C-50 no longer allowed; no C-50 parts in C-51/C-52. https://www.worldkarting.com/documents/2022/10/2023-wka-tech-manual-approved-changes.pdf/
- **§214.1 Kid Karts / class structure (Manufacturers Cup, Florida Winter Cup pages):** ages 5–7 attained, 150 lb, "Comer C51 only", spec 87 octane. TM 2020-001 touched §214.1 (kart numbering).
- **TM Update 2019-001:** Kid Kart "Comer C51 only (see Section 621)", spec 87 octane purchased from WKA.
- **2024–2026 TM updates:** nothing Comer-specific found.

### IKF
- 2021 IKF Rulebook has a section for the Comer C-51 piston-port kid kart engine, **§622.51**. Contents not visible. https://www.ikfkarting.com/wp-content/uploads/2021/2021-IKF-Rulebook.pdf (unknown detail)

### Motorsport UK (Bambino, context only)
- Comer C50 homologated as the sole Bambino engine from 2014.
- C50 spec sheet 2015 (158677/B): 40 × 38 mm, 48 cc, 4% mix, electronic ignition, short-thread plug, 3-piece centrifugal clutch, 10T #219, SHA 14-12L.
- C50 technical regs 2022: plugs Champion RCJ7Y, NGK BPMR7A or Bosch WS5F.
- Control fuel Carless MUK95 (2021 BKC bulletin).

### Clubs and tracks (context; not our tracks unless noted)
| Body | Rule | Source | Confidence |
|---|---|---|---|
| Road America Karting Club (WI) 2023–2025 | Kid Kart 5–8, 150/170 lb, Comer C50/51 or Briggs 206 Jr, Comer gear 10/89, MG Red tyre, max circumference 33-3/8" | https://roadamerica.com/sites/main/files/file-attachments/2025_rakc_class_structure.pdf | track_official (not our track) |
| Little Eldora (OH) 2020 | Kid Karts 4–7, 50cc Comer w/WKA restrictor, WKA gear 10/89, tyre circumference max 33" | https://www.eldoraspeedway.com/wp-content/uploads/2020/03/2020-class-specifications.pdf | track_official |
| Pitt Race (PA) 2023 | Kid 5–8, 150 lb, Comer or Honda 50 | https://pittrace.motorsportreg.com/index.cfm/event/event.requirements/uidEvent/93F09EFF-E763-2FA5-FB9BCA66F8156497 | track_official |
| Badger Kart Club (WI) | Follows WKA; 150 lb; Comer C-50 or C-51 | https://badgerkartclub.com/rulebook/ | track_official |
| Beaver Dam (WI) | Comer C-50/C-51, 155 lb | (search summary; URL from wismotorsports.net) | anecdote |
| 61 Kartway | Follows 2026 WKA TM; Kid Kart Comer C51, 150 lb; 87 octane ethanol (local option) | https://www.61kartway.com/classes/ | track_official |
| OVKA (OH) | Comer 150 lb | https://ovka.com/get-started/ | track_official |
| Bushnell Motorsports Park (FL) | Comer Kid Kart 150 lb; "2026 will be the final year for Comer Kid Kart class" | https://bushnellmotorsportspark.com/championship-kart-series-2/ | track_official |
| Unnamed club (forum quote) | 401.1 Kid Kart 5–7, 150 lb Comer; gear Comer 10/89 mandatory | https://forums.kartpulse.com/t/kid-kart-fitting-lo206/11979 | anecdote |
| NHKA (NH) | 2-cycle kid karts and cadets under WKA engine and kart rules (2016 page) | https://nhka.net/rules/kart-rules/ | anecdote (dated) |
| Rocky Ridge Raceway (VT) | **nothing found** | – | unknown |
| OVRP, Oakland Valley Race Park (NY) | **nothing found**. A 4cycle thread on "Oakland Valley Speedway" peewee (5–8, 245 lb, regular chassis, 4-stroke) is probably unrelated or outdated | https://4cycle.com/karting/threads/new-peewee-class-at-oakland-valley-speedway-cheap-start-up.50380/ | anecdote |

## C50 / C51 / C52 differences

| Item | C-50 | C-51 | C-52 | Source / confidence |
|---|---|---|---|---|
| Stroke | 38 mm | 38 mm (1.486") | 40 mm (1.575") | C50 spec sheet; WKA TM 2022-002. sanctioning_body |
| Bore | 40 mm | (40 mm, inferred) | 40 mm | C50 sheet; dealers. expert_consensus (C-51 inferred) |
| Displacement | 48 cc | 48 cc | 50 cc (50.27) | WKA; dealers |
| Kill switch | none on front cover | on front cover | integrated kill switch and petcock | kartpulse forum (anecdote); 90racing |
| Exhaust port min | – | 1.204" (may be ground to reach) | 1.206" (no grinding allowance seen) | WKA. track_official |
| Intake port max | – | 0.417" | 0.435" | WKA. track_official |
| Combustion chamber min | – | 7.4 cc | 7.7 cc | WKA. track_official |
| WKA legality | banned (2023 TM); allowed only under the 2012 manual at club option | legal §621 | legal §621 (but some series pages still say "C51 only") | WKA |
| Parts mixing | no C-50 parts in C-51/C-52 | C-51 crank only with C-51 case/cyl/piston | C-52 crank only with C-52 cyl/piston; C-52 piston required | WKA. sanctioning_body |
| Shared parts | clutch drum (10T #219), clutch shoes and carb are sold as fitting C50/C51/C52 | | | Mondokart, PKT listings. anecdote |

Forum view: "essentially the same engine with slight improvements to components at each higher number" (https://forums.kartpulse.com/t/comer-c50-vs-c51-vs-c52/8938, anecdote).

## Conflicts

1. **Fuel/oil ratio**
   - 16:1 (8 oz/US gal): 90racing C52 listing; Flow Racers (C51); 4cycle forum consensus. Forum adds about 6 oz in cold weather and 9–10 oz in heat.
   - 25:1 (4%): Comer C50 spec sheet 2015 (manufacturer/homologation document, summary only); C52 dealer summary (topkartusa/racingkart) "4% (25:1), not castor".
   - Both are recorded. The manufacturer-origin figure is 4%. The US kid kart practice figure is 16:1.
2. **Is the C52 legal in WKA Kid Kart?**
   - TM 2022-002 adds the C-52 to §621.
   - The WKA Manufacturers Cup / Florida Winter Cup class pages and 61 Kartway (citing the 2026 TM) say "Comer C51 only".
   - Unresolved.
3. **Peak RPM**
   - Dealer: 2 hp @ 6,500 rpm.
   - Owner tach anecdotes: 9,600 rpm peak on a C51, rival about 11,000.
   - 6,500 may be the peak-torque figure or a catalogue simplification. It should not be used as the gearing target until confirmed.
4. **WKA Kid Kart age**
   - WKA pages: 5–7 attained.
   - Most clubs: 5–8.
   - Eldora: 4–7.
5. **Weight**
   - WKA: 150 lb.
   - Road America: 150 / 170 (meaning of the second figure unclear).
   - Beaver Dam: 155.
   - WKA chassis note: "under 200 lb".
6. **"WKA Restrictor" (Eldora)**
   - No restrictor appears in any §621 summary.

## Open questions for the user

1. Which rules govern your races at Rocky Ridge (VT) and OVRP (NY): WKA, a club book, or track supplements? Please share the current kid kart class sheet. Nothing was found online.
2. Do those tracks allow the C52 in Kid Kart, or only the C51? Do they mandate a gear (for example 10/89)?
3. Minimum weight and age range at your tracks (150 lb? ages 5–7 or 5–8?).
4. Does either track require a restrictor or a specific jet for the Comer?
5. What fuel/oil ratio and oil does your engine builder or dealer recommend (16:1 or 25:1)? Which oil are you using?
6. What spark plug is in the engine now? Please give the model printed on the insulator and the thread length.
7. Engine hours or age, and when the top end and clutch were last serviced.
8. Does the kart have a tach? Peak RPM on your longest straight and idle RPM would anchor the gearing model.
9. Which sprockets do you own (driver 10T assumed; axle tooth counts available)?

Things to verify when search or fetch is available:
- Full TM 2022-002 PDF: muffler exit-hole sizes, clutch shoe and spring numbers, any jet rule.
- The 2026 WKA Tech Manual §621 and §214.
- IKF §622.51.
- UK C50 technical regulations 2022: clutch engagement and plug gap.
- A Comer C52 owner's manual: break-in and service intervals.

## Sources

| id | URL | title | confidence |
|---|---|---|---|
| wka_tm_2022_002 | https://www.worldkarting.com/tm-update-2022-002/ | WKA TM Update 2022-002 (page) | sanctioning_body (items corroborated) / track_official (single-doc items, capped) |
| wka_tm_2022_002_pdf | https://www.worldkarting.com/wp-content/uploads/2022/04/Tech-Update-2022-002-COMER-C52.pdf | Tech Update 2022-002 COMER C52 (PDF) | as above; fetch failed |
| wka_2023_changes | https://www.worldkarting.com/documents/2022/10/2023-wka-tech-manual-approved-changes.pdf/ | 2023 WKA Tech Manual Approved Changes, 1 Oct 2022 | sanctioning_body |
| wka_mfg_cup | https://www.worldkarting.com/series/manufacturers-cup/ | WKA Manufacturers Cup Series page | sanctioning_body |
| wka_fl_winter | https://www.worldkarting.com/series/florida-winter-cup/ | WKA Florida Winter Cup page | sanctioning_body |
| wka_tm_2019_001 | https://nicole-gaines-8xm9.squarespace.com/tech-updates/tm-update-2019-001 | WKA TM Update 2019-001 (old site mirror) | track_official (capped) |
| wka_tm_2024_001 | https://www.worldkarting.com/tm-update-2024-001/ | WKA TM Update 2024-001 | track_official |
| wka_tech_updates | https://www.worldkarting.com/category/tech-updates/ | WKA Tech Updates index | track_official |
| comer_c50_sheet_2015 | http://eolstoragewe.blob.core.windows.net/wm-553616-cmsimages/50cccomerspecsheet.pdf | Comer C50 Specification Sheet 2015 158677/B | sanctioning_body (capped from manufacturer/homologation; summary-only) |
| comer_c50_uk_regs_2022 | https://eolstoragewe.blob.core.windows.net/wm-553616-cmsimages/ComerC50EMRMSASpecSheet2022-21012022.pdf | Comer C50 Bambino technical regs, valid 1 Jan 2022 | track_official (capped) |
| comer_c52_catalog_2022 | https://www.comer-topkart.it/wp-content/uploads/2022/01/CATALOGO-COMER-C52-2022.pdf | Comer C52 2022 catalogue (parts) | unknown (contents not seen) |
| dealer_90racing | https://90racing.com/products/comer-c52-kart-engine-90-comer-c52 | 90 Racing, Comer C52 listing | anecdote (single dealer) |
| dealer_topkartusa | https://shop.topkartusa.net/products/comer-c52-engine | TopKart USA, Comer C52 Engine | anecdote |
| dealer_racingkart_it | https://www.racingkart.it/en/motori-kart/comer/motore-comer-c52 | Racing Kart, Engine Comer C52 | anecdote |
| dealer_pkt_drum | https://pktaxles.com/products/comer-c50-219-clutch-drum-go-kart | PKT, Comer 219 clutch drum | anecdote |
| dealer_mondokart_drum | https://www.mondokart.com/en/engine-accessories-mondokart/generic-engine-parts-mondokart/clutches-accessories-mondokart/clutch-bell-60cc-125cc-kf-mondokart/clutch-drum-sprocket-z10-c50-60-80-50cc-comer.html | Mondokart Z10 drum C50/C52 | anecdote |
| dellorto_uk_sha14 | https://www.dellorto.co.uk/shop/dellorto-motorcycle-carburettors-parts/complete-carburettors-dellorto-motorcycle-carburettors-parts/sha-12-to-16mm/r2100-sha-14-12l/ | Eurocarb R2100 SHA 14.12L (58 main jet, Bambino) | anecdote |
| bergfelt_c50carb | http://www.bergfeltracing.com/c50carb.html | Bergfelt Racing C50 carb tech | anecdote (dated) |
| flowracers_ratio | https://flowracers.com/blog/2-stroke-fuel-ratios/ | Flow Racers 2-stroke fuel ratios | anecdote |
| fourcycle_mix | https://4cycle.com/karting/threads/comer-kid-kart-oil-gas-mix-ratio.64197/ | 4cycle: Comer kid kart oil/gas mix | anecdote |
| fourcycle_c51_slow | https://4cycle.com/karting/threads/c51-kid-kart-racing-why-is-my-kids-engine-so-much-slower.107502/post-766589 | 4cycle: C51 slower (rpm/idle) | anecdote |
| kartpulse_clutch | https://forums.kartpulse.com/t/comer-c-50-c-51-kid-kart-clutch/3908 | KartPulse: Comer C-50/C-51 clutch | anecdote |
| kartpulse_c50_c52 | https://forums.kartpulse.com/t/comer-c50-vs-c51-vs-c52/8938 | KartPulse: C50 vs C51 vs C52 | anecdote |
| kartpulse_gearing | https://forums.kartpulse.com/t/vintage-100cc-build-in-us/10210?page=5 | KartPulse: kid kart gearing range | anecdote |
| kartpulse_lo206_kk | https://forums.kartpulse.com/t/kid-kart-fitting-lo206/11979 | KartPulse: club 401.1 kid kart quote | anecdote |
| ntkarters_clutch | https://ntkarters.com/forum325/viewtopic.php?p=7791 | ntkarters: kid kart clutch springs | anecdote |
| ladspec_muffler | https://ladspecialties.com/comer-c-51-muffler-gauge/ | L.A.D. Comer C-51 muffler gauge | anecdote |
| ikf_2021 | https://www.ikfkarting.com/wp-content/uploads/2021/2021-IKF-Rulebook.pdf | 2021 IKF Rulebook (§622.51) | sanctioning_body for existence only; contents unknown |
| rakc_2025 | https://roadamerica.com/sites/main/files/file-attachments/2025_rakc_class_structure.pdf | Road America Karting Club 2025 class structure | track_official |
| rakc_2024_book | https://www.roadamerica.com/sites/main/files/file-attachments/rakc_-_2023_official_rule_book_-_revised_5-6-23.pdf | RAKC rule book (Comer 10/89) | track_official |
| eldora_2020 | https://www.eldoraspeedway.com/wp-content/uploads/2020/03/2020-class-specifications.pdf | Little Eldora 2020 class specs | track_official |
| pittrace_2023 | https://pittrace.motorsportreg.com/index.cfm/event/event.requirements/uidEvent/93F09EFF-E763-2FA5-FB9BCA66F8156497 | Pitt Race 2023 requirements | track_official |
| badger_kc | https://badgerkartclub.com/rulebook/ | Badger Kart Club rulebook | track_official |
| kartway61 | https://www.61kartway.com/classes/ | 61 Kartway classes (2026) | track_official |
| ovka | https://ovka.com/get-started/ | OVKA get started | track_official |
| bushnell | https://bushnellmotorsportspark.com/championship-kart-series-2/ | Bushnell Championship Kart Series | track_official |
| nhka_rules | https://nhka.net/rules/kart-rules/ | NHKA kart rules | anecdote (2016) |
| ovs_peewee | https://4cycle.com/karting/threads/new-peewee-class-at-oakland-valley-speedway-cheap-start-up.50380/ | 4cycle: Oakland Valley Speedway peewee | anecdote |
