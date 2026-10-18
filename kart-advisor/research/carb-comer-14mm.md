# Research C: Comer Ø14 mm carburetor (C51/C52 kid kart)

Accessed 2026-10-18. **Method limits:** WebFetch failed (DNS block on worldkarting.com), so everything here comes from web-search summaries of the cited pages. No PDF was opened directly. Per PLAN §1.5, confidence is capped one level below the source type unless at least 2 independent results agree. Where a sanctioning-body document was seen only through summaries and nothing independent backs it, it is labelled `track_official`. That label is used only as the next step down the confidence ladder; the fact still comes from WKA, and the notes say so. The search budget ran out after about 45 searches. A few planned checks were not run, and they are listed under Open questions.

## Summary
- **Carb model:** Dell'Orto **SHA 14-12L**. This is the only carb allowed under WKA TM Update 2022-002 (§621.1) for the C51 and C52. Track rules (KRA/Newcastle), retailers (90racing C52 kit, Zip North C50) and the 2018 AMR kid kart rules all agree. "14-12" means a 14 mm bore with a 12 mm venturi. The 0.475" no-go venturi gauge (12.07 mm) matches that.
- **Jet rules under WKA:** "Jet size is non-tech" (§621.1.2, 2022 update). This means **no WKA maximum jet**. However, all carb parts must be "as cast" and the carb body may not be repaired. The atomizer has no-go gauges (bottom hole 0.035", top hole 0.049").
- **Older or local rules still limit the jet:** WKA 2010 kid kart rules and the current KRA/Newcastle supplement allow **#54–#58**. AMR (2018) gauges the jet hole: 0.019" go, **0.026" no-go**. PKT says "WKA: #58 max, no larger than .026"". That statement looks out of date.
- **Stock jet:** the jet Comer fits at the factory is `unknown`. Retailer listings for a bare SHA 14/12L give #57. One Polish listing for an SHA 14.12N gives #58.
- **What people actually run:** #58 "works 99% of the time" with a K&N RC-1250 filter. That is a single Texas forum report (NTK). No northeast US data was found.
- **The SHA has no needle, no clip, no idle jet and no mixture screw.** The main jet is the only fuel adjustment. The slide cutaway controls the transition just off idle.
- **No published jetting chart** exists for the SHA 14 or the Comer. The jetting rule below is `inferred` from physics. A conflicting rule from Longacre is recorded alongside it.

## Carb identification (evidence)
| Evidence | Says | Source |
|---|---|---|
| WKA TM Update 2022-002 §621.1 | "Dell Orto model SHA-14-12L only. All parts must be 'as cast'." Applies to C51 and C52. | wka_tm_2022_002 |
| KRA / Newcastle supplemental rules | "Carb – Dellorto SHA 14-12L, .475 No Go Venturi, Jet Sizes Allowed #54 thru #58" for C50/C51/C52 | kra_newcastle_rules |
| AMR Kid Kart rules v3 (2018), C-51 | Venturi 0.475" no-go; jet 0.019" go / 0.026" no-go; atomizer bottom hole 0.035" no-go, top 0.049" no-go | amr_kidkart_2018 |
| 90racing C52 engine listing | SHA 14-12L on the C52 | racing90_c52 |
| Zip North C50 parts | "R2100 Dellorto SHA 14.12L Comer C50 Carb" | zipnorth_c50_carb |
| Myron's Mopeds | 14/12L replaces the old 14/12. From the air side you see 12 mm, from the engine side 14 mm. | myrons_sha |

Conclusion: the carb is the **Dell'Orto SHA 14-12L**. Several independent sources agree, so this is rated `sanctioning_body`.

## Findings
| fact | value | units | source | confidence | notes |
|---|---|---|---|---|---|
| Carb model (C51/C52) | Dell'Orto SHA 14-12L | – | wka_tm_2022_002, kra_newcastle_rules, amr_kidkart_2018, racing90_c52 | sanctioning_body | several independent sources agree |
| Bore / venturi | 14 / 12 | mm | myrons_sha, mofakult_1412l | expert_consensus | for SHA, the two numbers are the outlet/bore and the venturi |
| Venturi no-go (WKA) | 0.475 | in | wka_tm_2022_002, amr_kidkart_2018, kra_newcastle_rules | sanctioning_body | 0.475 in = 12.07 mm |
| Atomizer bottom hole no-go | 0.035 | in | wka_tm_2022_002, amr_kidkart_2018 | sanctioning_body | |
| Atomizer top hole no-go | 0.049 | in | wka_tm_2022_002, amr_kidkart_2018 | sanctioning_body | |
| Jet size (WKA 2022) | non-tech | – | wka_tm_2022_002 | track_official | WKA text, seen in summaries only, no independent confirmation, so capped |
| Jet range (KRA/Newcastle) | #54–#58 | Dell'Orto no. | kra_newcastle_rules | anecdote | track rule seen in a summary (track_official capped); "Yamaha uses WKA rules" |
| Jet range (WKA 2010 kid kart) | #54–#58 | Dell'Orto no. | ovka_wka_2010 | anecdote | superseded; seen in a summary |
| Jet hole gauge (AMR 2018) | 0.019 go / 0.026 no-go | in | amr_kidkart_2018, skyey_blog, kartpulse_comer_jetting | expert_consensus | 0.026" = 0.660 mm. PKT and a blog attribute this to WKA / Kid Kart Nationals |
| Stock jet of a bare SHA 14/12L (retail) | 57 | Dell'Orto no. | myrons_sha, mofakult_1412l | expert_consensus | moped retail spec, **not** Comer's factory spec |
| Stock jet, SHA 14.12N variant | 58 | Dell'Orto no. | mieloch_1412n | anecdote | different variant |
| Comer factory-fitted jet | unknown | – | – | unknown | ask the dealer or read the jet stamp |
| Jet type | Dell'Orto 5 mm round main jet (part 1486 family) | – | zipnorth_c50_carb, mopedarmy_sha, zweirad_jets | expert_consensus | PKT says Mini ROK jets are the same size and thread |
| Jet thread | M5 × 0.75 | mm | zipnorth_c50_carb, myrons_sha, zweirad_jets | expert_consensus | **Conflict:** Chebco sets say M5 × 0.80. Clones may differ |
| Jet sizes available | 54–58 (PKT kid kart kit); generic sets 50–72 | Dell'Orto no. | pkt_jet_holder, mieloch_jets | expert_consensus | odd sizes exist (57, 59, 61) |
| Jet numbering | nominal: number ≈ hole diameter in 0.01 mm; measured genuine jets are larger | – | ilambretta_jets, myrons_jets, kartpulse_comer_jetting | expert_consensus (that it is not exact) | measured: genuine 58 = 0.615 mm (6 mm jet), 60 = 0.627 mm. Pin-gauged: 57 = 0.0240", 59 = 0.0245", 61 = 0.0250", 62 = 0.0255". A step of one number is about +1% diameter, about +2% area |
| Needle / clip | none | – | mopedarmy_sha, puchshop_sha, myrons_sha | expert_consensus | flat slide, no jet needle |
| Idle jet / air screw | none; idle fuel comes through the small idle hole at the base of the spray tube | – | mopedarmy_sha, puchshop_sha, myrons_service | expert_consensus | a blocked idle hole means the engine won't idle |
| Off-idle transition | set by the slide cutaway; a higher cutaway number is leaner | – | mopedarmy_sha | anecdote | WKA "as cast" rule means you can't change it |
| Throttle slide part | Dell'Orto 6108 06 64 flat slide (SHA 14–16) | – | mofakult_slide, zipnorth_c50_carb | anecdote | listing shows both "no. 2" and "type 6", so the cutaway number is unconfirmed |
| Float weight | 3.5 (stamped); measured 3.30–3.65 | g | myrons_service | anecdote | |
| Float level spec | unknown | mm | – | unknown | whether it can be adjusted is also unknown |
| Float needle valve | Dell'Orto PHBG/SHA needle valve (part 2838 family) | – | zipnorth_c50_carb, chebco_needle | expert_consensus | included in the C50 rebuild kit |
| Air filter (WKA §621.2) | an aftermarket fabric and wire-mesh filter may replace the factory filter; flange and filter dimensions are specified; must not be modified | – | wka_tm_2022_002 | track_official | the dimension values were not visible |
| Air filter used in practice | K&N RC-1250 (2.25" flange, conical) | – | ntk_forum_8846, racing90_rc1250 | anecdote | |
| Air filter (KRA, UAS) | non-tech (UAS: no scoop or ram effect) | – | kra_newcastle_rules, uas_kidkart | anecdote | |
| Carb repair | no repairs to a broken body; stripped holes may get thread inserts | – | wka_tm_2022_002, amr_kidkart_2018 | sanctioning_body | |
| Typical race jet | #58 with K&N | Dell'Orto no. | ntk_7786, ntk_forum_8846 | anecdote | Texas, about 2006–2011. One thread, two posters. Not northeast |

## Legal limits
- **WKA (2022 update, still current as far as found):** SHA-14-12L only, all parts "as cast". Venturi 0.475" no-go. Atomizer holes 0.035"/0.049" no-go. **Jet size non-tech**, which means jet changes are allowed with no maximum. Air filter: a dimensioned fabric/wire-mesh aftermarket filter is allowed. The engine must stay stock. No C50 parts may be used in a C51/C52; it is unclear whether a C50-branded carb counts as a C50 part (see open questions). No newer WKA manual text was found.
- **KRA (Newcastle):** jets #54–#58, air filter non-tech.
- **AMR (2018):** jet gauge 0.019" go / 0.026" no-go.
- **Engine rule:** put `main_jet legal_max = null` for the WKA layer. Club layers can add `{field: main_jet, op: max, value: 58}` (KRA) or a hole-diameter no-go of 0.026". Jet changes are **allowed** in every rule set found. None of them seals the carb.
- **Local northeast clubs (the user's tracks):** `unknown`. Ask the user for the current supplements.

## Jetting vs conditions
**No published table exists** for the SHA 14, the Comer, or small kart two-strokes. Commercial jetting apps exist for Rotax, IAME, TM and VHSH carbs, but none covers the Comer. The Dell'Orto/Ducati guide gives only the direction: lower density, from altitude, heat or low pressure, richens the mixture and calls for a smaller jet.

**Derivation (`inferred`).** Fuel mass flow through the jet is m_f = Cd·A_j·√(2ρ_f·Δp). The venturi depression is Δp ≈ m_a²/(2ρ_a·A_v²), so √Δp ∝ m_a/√ρ_a. That gives AFR = m_a/m_f ∝ √ρ_a / A_j. Holding AFR constant therefore needs **A_j ∝ √ρ_a**, which means jet **diameter ∝ ρ_a^0.25**. An Eng-Tips thread quotes the same 0.25 exponent on diameter.

**Conflicting practitioner rule.** Longacre's air density gauge instructions say to change jet **area** by the same percentage as air density (A_j ∝ ρ). Kartpulse forum users repeat this rule. It gives twice the correction of the physics rule. Both are recorded here; they are not averaged. The engine should default to the √ρ rule, because it changes the jet less. Leaning out is the risky direction, and this rule makes smaller jet reductions when air gets thinner.

**Turning the rule into jet numbers.** One jet number is about 1.0% in diameter (about 2% area) if you go by measured genuine jets, or about 1.7% (about 3.4% area) if you go by the nominal number.

| Rule | Jet numbers per 1000 ft of density altitude | Jet numbers per 10 °F (density about 1.9%) |
|---|---|---|
| √ρ (physics), measured diameters | about 0.7 | about 0.5 |
| √ρ (physics), nominal diameters | about 0.4 | about 0.3 |
| Longacre (area ∝ ρ), measured | about 1.4 | about 1.0 |
| Longacre (area ∝ ρ), nominal | about 0.9 | about 0.6 |

(Standard atmosphere: density drops about 2.9% per 1000 ft.) Worked example using the √ρ rule with nominal diameters: a jet that is right at 0 ft DA scales to 58 → 57.6 at 1000 ft, 57.2 at 2000 ft, 56.7 at 3000 ft, and 58.4 at −1000 ft (a cold day). **Snap to the nearest whole jet number and round toward the larger (richer) jet.**

**Reference point:** `unknown`. No source gives a jet at stated conditions. The user should record jet, DA and plug read from a session that ran well and use that as the reference. Until that happens, the engine can only output changes relative to the current jet, not an absolute jet.

The AMR 0.026" no-go (0.660 mm) is roughly a genuine #62–63. If a club uses that gauge, the effective limit is above #58.

## Symptoms and plug reading
| tag | signs | fix | confidence |
|---|---|---|---|
| rich_bog / rich_top_end | sluggish, lugging off corners, sputter or four-stroking at the top, smoke, wet black plug, oil spitting from the exhaust | one jet smaller, but only after ruling out the choke, a dirty filter and a fouled plug | expert_consensus |
| four_stroking | uneven "blubbering" firing at high revs or no load | usually rich at full throttle; some is normal when off the throttle | expert_consensus (wiki_4stroking, motocrosshideout) |
| lean_ping / lean_scream | over-revs or "screams", then flattens; sharp popping; overheating; white or chalky plug; may seize | **one jet larger right away**; check for air leaks and float or fuel blockage | expert_consensus |
| lean_bog | dies or hesitates when the throttle is snapped open, then surges | richer jet; check the fuel line and filter | anecdote |
| no_idle | needs choke to idle, dies when the throttle closes | clean the idle hole and spray tube, check the float and needle valve, look for intake leaks. Not a jet change | anecdote (ntk_7786, myrons_service) |

**Plug reading (the main jet is read after a full-throttle "plug chop"):** light to dark tan or chocolate is good. White or grey is lean, or the plug heat range is too hot. Black and wet is rich. Read the insulator nose and the base of the ground strap. Plugs on two-strokes running castor oil are harder to read. Several sources prefer EGT and say the plug is a slow sanity check. **Safety:** lean running raises cylinder temperature and causes detonation and piston seizure. A seizure on a kid kart can lock the rear wheels. The engine must lean toward the richer jet whenever it is unsure.

## Conflicts
1. **Maximum jet:** WKA 2022 says "non-tech". KRA and WKA 2010 say #54–#58. AMR uses a 0.026" no-go. PKT claims WKA sets #58 max.
2. **Jet thread:** M5 × 0.75 (Zip North, Myron's, Zweiradteile) vs M5 × 0.80 (Chebco).
3. **What the jet number means:** nominal diameter in 0.01 mm (iLambretta forum) vs measured genuine jets running about 6% larger than the number (Myron's, kartpulse pin gauges).
4. **Density correction:** A_j ∝ √ρ (physics, Eng-Tips) vs A_j ∝ ρ (Longacre, kartpulse).
5. **Bare SHA 14/12L stock jet:** 57 (Myron's, mofakult) vs 58 (mieloch, 14.12N).
6. **Slide ID:** the same listing calls part 6108 06 64 both "no. 2" and "type 6".

## Open questions for the user
1. Which rulebook applies at each of your tracks, and does it cap the jet (#58, or the 0.026" no-go) or treat it as non-tech?
2. What jet is in the carb now? It is stamped on the jet. Record the date, DA and how the kart ran.
3. Do you have a jet kit (54–58)? Odd sizes?
4. What filter do you run (stock Comer or K&N RC-1250)?
5. Does your track's tech treat a C50-labelled SHA 14-12L, or C50 carb parts, as a "C-50 part" (banned under WKA 2022)?
6. Is there a newer WKA Tech Manual than the 2022-002 update? This needs checking at worldkarting.com, which can't be reached from this session.
7. Not searched (budget ran out): northeast-specific jet reports, a Dell'Orto SHA parts diagram for the slide cutaway and float level, and the full KRA filter wording.

## Sources
See `drafts/carb.yaml` `sources:` for ids. URLs:
- wka_tm_2022_002: https://www.worldkarting.com/tm-update-2022-002/ (PDF: https://www.worldkarting.com/wp-content/uploads/2022/04/Tech-Update-2022-002-COMER-C52.pdf)
- kra_newcastle_rules: https://newcastlemotorsportspark.com/rules
- amr_kidkart_2018: http://amrmotorplex.com/files/1415/4042/7888/AMR_Kid_Kart_Package_v3.pdf
- ovka_wka_2010: https://www.ovka.com/files/Tech-Corner/2010_06_June_Tech-Corner3-KidKart.pdf
- gcki_2015: https://www.racekarts.com/images/stories/gcki_forms/2015_GCKI_Classes.pdf
- uas_kidkart: http://bergfeltracing.com/stockappearingkidkartrules.html
- racing90_c52: https://90racing.com/products/comer-c52-kart-engine-90-comer-c52
- racing90_rc1250: https://90racing.com/products/k-n-air-filter-element-rc-1250
- zipnorth_c50_carb: https://zipnorth.com/collections/comer-c50-carb-fuel-parts
- pkt_changing_jets: https://pktaxles.com/kidkarters-changing-jets.html
- pkt_jet_holder: https://pointkarting.com/products/pkt-carburetor-jet-kits-holders
- skyey_blog: https://skyeyunderground.weebly.com/blog/comer-c50-tuning-manually
- kartpulse_comer_jetting: https://forums.kartpulse.com/t/questions-about-jetting-changes-on-a-comer-c50-c51/6902
- kartpulse_density: https://forums.kartpulse.com/t/adjusting-jet-sizes-according-to-changes-in-air-density/4415
- kartpulse_plug: https://forums.kartpulse.com/t/reading-spark-plug-color/6072
- kartpulse_leanrich: https://forums.kartpulse.com/t/lean-vs-rich-i-try-to-achieve-basic-understanding/9968
- ntk_7786: https://www.ntkarters.com/forum325/viewtopic.php?p=7786
- ntk_forum_8846: https://ntkarters.com/forum325/viewtopic.php?p=8846
- myrons_sha: https://www.myronsmopeds.com/category/carburetor/dellorto/
- myrons_jets: https://www.myronsmopeds.com/?p=65038
- myrons_service: https://myronsmopeds.com/2021/03/dellorto-service
- mopedarmy_sha: https://www.mopedarmy.com/wiki/Dellorto_SHA
- puchshop_sha: https://www.puchshop.de/en-gb/info-center/dellorto-sha-explained
- mofakult_1412l: https://www.mofakult.de/en/dell-orto-14-12-l-sha-carburetor-hand-choke-29727
- mofakult_slide: https://www.mofakult.lu/en/dell-orto-gas-slide-6-sha-14-16-mm-22340
- mieloch_1412n: https://mieloch.pl/en/gaznik-dellorto-sha-14-12n-10
- mieloch_jets: https://mieloch.pl/en/main-jets-dellorto-5mm-set-10-pcs-50-72
- chebco_jets: https://www.chebco.com/en/carburetors/1871-copy-of-set-of-10-nozzles-o5-phbg-sha-75-to-98.html
- chebco_needle: https://www.chebco.com/en/carburetors/1866-pointeau-carburateur-dellorto-phbg-sha.html
- zweirad_jets: https://www.zweiradteile.net/en/parts/engine-parts-cables-wires/engine-parts/55373/main-jet-set-5mm-m5-55-115-for-dellorto-phbg-sha-carburetors-25-pieces-by-citomerx-101610
- ilambretta_jets: https://www.ilambretta.co.uk/forum/viewtopic.php?p=9373
- ducati_dellorto: https://www.ducatimeccanica.com/dellorto_guide/dellorto_5.html
- longacre: https://www.longacreracing.com/instructions/text/5088PI_b_p.html
- engtips: https://eng-tips.com/threads/carburetor-jetting.138471
- wiki_4stroking: https://en.wikipedia.org/wiki/Four-stroking
- motocrosshideout: https://motocrosshideout.com/running-rich-vs-lean/
