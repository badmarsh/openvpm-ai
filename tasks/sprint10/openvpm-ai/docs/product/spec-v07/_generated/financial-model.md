<!-- GENEROVANÉ skriptom scripts/spec-v07-financial-model.py — NEUPRAVOVAŤ RUČNE -->

# Finančný model OpenVPM AI — referenčná klinika (3 MVDr., 45 pacientov/deň)

> **Status:** parametrický model, nie meranie z produkcie. Všetky vstupy sú explicitné;
> zmenu predpokladov robte výhradne v skripte a generujte znova.

**Metodika**

1. **Kapacitná hodnota** (časový ledger) = ušetrené hodiny × hodinová sadzba. Nie je to cash-flow,
   kým sa čas nekonvertuje na ďalšie výkony alebo sa nezníži počet FTE. Preto sa v ROI vykazujú
   *dva* paybacky: iba hard cash (konzervatívny) a cash + kapacita (plná hodnota).
2. **Realizačný faktor** (rok 1: 55 %) pokrýva learning curve, čiastočnú adopciu a prípady,
   kde automatizácia nefunguje (offline, výnimky, kontrola). Steady-state rok 2+: 80 %.
3. **Atribúcia systému** pri výnosových pákach (35–70 %) oddeľuje efekt systému od trhových,
   sezónnych a personálnych vplyvov — bez nej by model pripisoval OpenVPM AI celý rast tržieb.
4. **Žiadne dvojité započítanie:** každý ledger riadok má práve jeden BC; R1 (no-show) a R7
   (konverzia kapacity na nové termíny) sa vzájomne vylučujú — započítava sa len R1.
5. **Rizikové efekty** (pokuty, regresy) sú vykázané ako očakávaná hodnota, nie ako mesačný cash.

## A. Referenčný model kliniky

| Parameter | Hodnota | Odvodenie |
|---|---|---|
| Pacienti / deň | 45 | 32 konzultácií + 8 preventívnych + 5 procedúr |
| Pracovné dni / mesiac | 21,5 | vrátane 2 sobôt z 3 |
| Návštevy / mesiac | 968 | 45 × 21,5 |
| Priemerný účet | 58,36 € | vážený mix (38 € / 45 € / 210 €) |
| Obrat / deň | 2 626 € | — |
| Obrat / mesiac | 56 459 € | — |
| Obrat / rok | 677 508 € | — |
| Personál | 3 MVDr. + 2 technici + 1,5 FTE recepcia + 1,0 FTE admin | — |
| Kapacita personálu | 1 260,0 h/mes. | 168 h × FTE |
| Sadzby (pásmo 25–35 €/h) | lekár 35 €, technik 28 €, recepcia 25 €, admin 30 € | horná hranica pre lekára, spodná pre recepciu |
| Aktívna kmeňová báza | ~4 465 pacientov | 968 × 12 / 2,6 návštevy/rok |

## B. Časový ledger (L01–L36)

| L# | Journey / aktivita | Rola | Baseline | OpenVPM AI | Úspora | Objem/mes. | Model h/mes. | Real. h/mes. | Real. €/mes. | BC |
|---|---|---|---|---|---|---|---|---|---|---|
| L01 | J1 Vyhľadanie pacienta/majiteľa (lekársky podiel 40 %) | lekár | 1,50 | 0,42 | 1,08 | 774,0 | 13,9 h | 7,7 h | 268 € | BC-01 |
| L02 | J2/J4 Klinická karta, anamnéza a história pred vyšetrením | lekár | 4,00 | 2,50 | 1,50 | 968,0 | 24,2 h | 13,3 h | 466 € | BC-01 |
| L03 | J3 SOAP dokumentácia — počas ordinačných hodín | lekár | 6,00 | 2,50 | 3,50 | 774,0 | 45,1 h | 24,8 h | 869 € | BC-01 |
| L04 | J3 SOAP dokumentácia — po ordinačných hodinách | lekár | 3,50 | 1,50 | 2,00 | 774,0 | 25,8 h | 14,2 h | 497 € | BC-02 |
| L05 | J5 Clinical Guardian — interakcie, alergie, kontraindikácie | lekár | 2,50 | 0,50 | 2,00 | 300,0 | 10,0 h | 5,5 h | 192 € | BC-01 |
| L06 | J10 Predpis a safety check (lekárska časť) | lekár | 1,50 | 0,50 | 1,00 | 500,0 | 8,3 h | 4,6 h | 160 € | BC-01 |
| L07 | J12 Closeout: diagnóza, inštrukcie, follow-up | lekár | 2,00 | 1,25 | 0,75 | 968,0 | 12,1 h | 6,7 h | 233 € | BC-01 |
| L08 | J13 Vakcinácia, certifikát, hlásenie (lekárska časť) | lekár | 1,50 | 0,50 | 1,00 | 350,0 | 5,8 h | 3,2 h | 112 € | BC-01 |
| L09 | J16 Interpretácia lab výsledkov a záver | lekár | 3,00 | 1,50 | 1,50 | 220,0 | 5,5 h | 3,0 h | 106 € | BC-01 |
| L10 | J17 RTG — meranie VHS a text nálezu | lekár | 6,00 | 2,50 | 3,50 | 120,0 | 7,0 h | 3,9 h | 135 € | BC-01 |
| L11 | JG-C02/C03 Hospitalizácia a chirurgia — dokumentácia (v0.7) | lekár | 25,00 | 10,00 | 15,00 | 12,0 | 3,0 h | 1,7 h | 58 € | BC-07 |
| L12 | J29 Eutanázia/úhyn — administratíva a sympathy | lekár | 20,00 | 8,00 | 12,00 | 8,0 | 1,6 h | 0,9 h | 31 € | BC-08 |
| L13 | J28 Legislatívny cyklus — lekársky podiel (OPL kniha, KVEPIS podpis) | lekár | 45,00 | 15,00 | 30,00 | 1,0 | 0,5 h | 0,3 h | 10 € | BC-06 |
| L14 | J2/J8 Vitálne funkcie, odbery, príprava pri pacientovi | technik | 6,00 | 4,00 | 2,00 | 700,0 | 23,3 h | 12,8 h | 359 € | BC-01 |
| L15 | J16 Lab import, validácia a zápis do karty | technik | 8,00 | 2,00 | 6,00 | 220,0 | 22,0 h | 12,1 h | 339 € | BC-01 |
| L16 | J10 Výdaj lieku a účtovanie (dispense → charge queue) | technik | 3,00 | 1,00 | 2,00 | 500,0 | 16,7 h | 9,2 h | 257 € | BC-01 |
| L17 | JX-01 Príjem dodacieho listu (ručné prepisovanie → parser) | technik | 35,00 | 10,00 | 25,00 | 24,0 | 10,0 h | 5,5 h | 154 € | BC-05 |
| L18 | JX-01 Inventúra a reconciliácia skladu | technik | 6,00 h | 4,00 h | 2,00 h | 1,0 | 2,0 h | 1,1 h | 31 € | BC-05 |
| L19 | JX-01 Monitoring expirácií a reorder pointov | technik | 1,50 h | 0,25 h | 1,25 h | 1,0 | 1,2 h | 0,7 h | 19 € | BC-05 |
| L20 | J13 Asistencia pri vakcinácii, pas a čip | technik | 2,00 | 1,00 | 1,00 | 350,0 | 5,8 h | 3,2 h | 90 € | BC-01 |
| L21 | JG-C02 ICU flowsheet — záznamy na zmenách (v0.7) | technik | 8,00 | 4,00 | 4,00 | 90,0 | 6,0 h | 3,3 h | 92 € | BC-07 |
| L22 | J7 Objednanie termínu (telefonické) | recepcia | 4,50 | 2,50 | 2,00 | 700,0 | 23,3 h | 12,8 h | 321 € | BC-01 |
| L23 | J8 Check-in a čakáreň | recepcia | 1,50 | 1,00 | 0,50 | 968,0 | 8,1 h | 4,4 h | 111 € | BC-01 |
| L24 | J11 Faktúra, platba, e-Kasa doklad | recepcia | 5,00 | 3,50 | 1,50 | 968,0 | 24,2 h | 13,3 h | 333 € | BC-01 |
| L25 | J12 Closeout (charge disposition, follow-up termín) | recepcia | 3,00 | 2,00 | 1,00 | 968,0 | 16,1 h | 8,9 h | 222 € | BC-01 |
| L26 | J9 Zmena/zrušenie termínu a notifikácia | recepcia | 6,00 | 3,00 | 3,00 | 180,0 | 9,0 h | 5,0 h | 124 € | BC-04 |
| L27 | J9 Pripomienky na ďalší deň (ručné volania → bulk) | recepcia | 30,00 | 10,00 | 20,00 | 21,5 | 7,2 h | 3,9 h | 99 € | BC-04 |
| L28 | J6 Nový klient a pacient (formulár, súhlasy, duplicita) | recepcia | 9,00 | 4,00 | 5,00 | 45,0 | 3,8 h | 2,1 h | 52 € | BC-01 |
| L29 | J27 Klientsky portál — odklonenie vstupných hovorov | recepcia | 4,00 h | 1,50 h | 2,50 h | 1,0 | 2,5 h | 1,4 h | 34 € | BC-08 |
| L30 | J14 Recall kampaň — ručný zoznam a volania | recepcia | 240,00 | 60,00 | 180,00 | 1,0 | 3,0 h | 1,7 h | 41 € | BC-03 |
| L31 | JX-02 Reporty a mesačná uzávierka | admin | 12,00 h | 3,00 h | 9,00 h | 1,0 | 9,0 h | 5,0 h | 148 € | BC-09 |
| L32 | J28 Legislatívny cyklus (KVEPIS XML, CRSZ export, uzávierky) | admin | 8,00 h | 2,50 h | 5,50 h | 1,0 | 5,5 h | 3,0 h | 91 € | BC-06 |
| L33 | J18/J19 Marketing: obsah, kampane, recenzie, suppression | admin | 9,00 h | 3,00 h | 6,00 h | 1,0 | 6,0 h | 3,3 h | 99 € | BC-08 |
| L34 | J15 Wellness: enrolment a cyklická fakturácia | admin | 3,75 h | 1,00 h | 2,75 h | 1,0 | 2,8 h | 1,5 h | 45 € | BC-03 |
| L35 | JX-01 Sklad: objednávky a kontrola | admin | 2,00 h | 0,75 h | 1,25 h | 1,0 | 1,2 h | 0,7 h | 21 € | BC-05 |
| L36 | JG-D06 Poistné udalosti a komunikácia s poisťovňou (v0.7) | admin | 4,00 h | 1,00 h | 3,00 h | 1,0 | 3,0 h | 1,7 h | 50 € | BC-07 |
| **Σ** | — | — | — | — | — | — | **374,7 h** | **206,1 h** | **6 267 €** | — |

## C. Úspory podľa rolí

| Rola | FTE | Kapacita h/mes. | Model úspory | Realizované (55 %) | % kapacity | Sadzba | Hodnota €/mes. | Na deň/človeka |
|---|---|---|---|---|---|---|---|---|
| lekár | 3,0 | 504,0 h | 162,9 h | 89,6 h | 17,8 % | 35 €/h | 3 137 € | 83 min |
| technik | 2,0 | 336,0 h | 87,1 h | 47,9 h | 14,3 % | 28 €/h | 1 341 € | 67 min |
| recepcia | 1,5 | 252,0 h | 97,1 h | 53,4 h | 21,2 % | 25 €/h | 1 336 € | 99 min |
| admin | 1,0 | 168,0 h | 27,5 h | 15,1 h | 9,0 % | 30 €/h | 454 € | 42 min |
| **Spolu** | 7,5 | 1 260,0 h | **374,7 h** | **206,1 h** | **16,4 %** | — | **6 267 €** | 77 min |

**Lekári:** model 162,9 h → realizované 89,6 h = 83 min/deň/lekár = 3 137 €/mes.

## D. Mapa journey → ledger (podklad pre Sekciu 1)

| Journey (Sekcia 1) | Ledger riadky | Poznámka |
|---|---|---|
| J1 — Hľadanie pacienta/majiteľa | L01 | L01: 7,7 h / 268 € (lekár) |
| J2 — Klinická karta a hlasové diktovanie | L02, L03, L04, L14 | L02: 13,3 h / 466 € (lekár); L03: 24,8 h / 869 € (lekár); L04: 14,2 h / 497 € (lekár); L14: 12,8 h / 359 € (technik) |
| J3 — Nový SOAP z encounteru | L03, L04 | L03: 24,8 h / 869 € (lekár); L04: 14,2 h / 497 € (lekár) |
| J4 — Anamnéza a história | L02 | L02: 13,3 h / 466 € (lekár) |
| J5 — Clinical Guardian | L05 | L05: 5,5 h / 192 € (lekár) |
| J6 — Nový klient a pacient | L28 | L28: 2,1 h / 52 € (recepcia) |
| J7 — Objednanie termínu | L22 | L22: 12,8 h / 321 € (recepcia) |
| J8 — Check-in, čakáreň, whiteboard | L23, L14 | L23: 4,4 h / 111 € (recepcia); L14: 12,8 h / 359 € (technik) |
| J9 — Zmena/zrušenie a pripomienky | L26, L27 | L26: 5,0 h / 124 € (recepcia); L27: 3,9 h / 99 € (recepcia) |
| J10 — Predpis, výdaj, účtovanie liečiva | L06, L16 | L06: 4,6 h / 160 € (lekár); L16: 9,2 h / 257 € (technik) |
| J11 — Faktúra, platba, e-Kasa | L24 | L24: 13,3 h / 333 € (recepcia) |
| J12 — Closeout a odovzdanie klientovi | L07, L25 | L07: 6,7 h / 233 € (lekár); L25: 8,9 h / 222 € (recepcia) |
| J13 — Očkovanie a hlásenie besnoty | L08, L20 | L08: 3,2 h / 112 € (lekár); L20: 3,2 h / 90 € (technik) |
| J14 — Recall a revakcinácia | L30 | L30: 1,7 h / 41 € (recepcia) |
| J15 — Wellness plán | L34 | L34: 1,5 h / 45 € (admin) |
| J16 — Laboratórne výsledky | L09, L15 | L09: 3,0 h / 106 € (lekár); L15: 12,1 h / 339 € (technik) |
| J17 — RTG / VHS a AI nález | L10 | L10: 3,9 h / 135 € (lekár) |
| J18/J19 — Marketing a reputácia | L33 | L33: 3,3 h / 99 € (admin) |
| J27 — Klientsky portál | L29 | L29: 1,4 h / 34 € (recepcia) |
| J28 — Legislatívny cyklus | L13, L32 | L13: 0,3 h / 10 € (lekár); L32: 3,0 h / 91 € (admin) |
| J29 — Eutanázia a sympathy gate | L12 | L12: 0,9 h / 31 € (lekár) |
| JX-01 — Skladové hospodárstvo | L17, L18, L19, L35 | L17: 5,5 h / 154 € (technik); L18: 1,1 h / 31 € (technik); L19: 0,7 h / 19 € (technik); L35: 0,7 h / 21 € (admin) |
| JX-02 — Manažérske reporty | L31 | L31: 5,0 h / 148 € (admin) |
| JG-C02/C03 — Hospitalizácia a chirurgia (v0.7) | L11, L21 | L11: 1,7 h / 58 € (lekár); L21: 3,3 h / 92 € (technik) |
| JG-D06 — Poistné udalosti (v0.7) | L36 | L36: 1,7 h / 50 € (admin) |

> Niektoré ledger riadky sú zdieľané viacerými journey (napr. L03 patrí J2 aj J3, L14 patrí J2 aj J8) — v súčtoch BC sa každý riadok započítava **práve raz** podľa stĺpca BC.

## E. Výnosové páky (hard cash)

| # | Výnosová páka | Hrubý efekt | Realizácia | Atribúcia systému | Započítané €/mes. | BC | Odvodenie |
|---|---|---|---|---|---|---|---|
| R1 | Zníženie no-show a doplnenie slotov (pripomienky + waitlist) | 2 696 € | 100 % | 60 % | 1 618 € | BC-04 | 66 uvoľnených termínov/mes. × obsadenosť 70 % = 46 návštev × 58 € |
| R2 | Automatizovaný recall / revakcinácie | 630 € | 100 % | 70 % | 441 € | BC-03 | +14 revakcinácií/mes. × 45 € |
| R3 | Wellness (preventívne) plány — recurring | 1 500 € | 50 % | 50 % | 375 € | BC-03 | 60 plánov × 25 €/mes.; rampa roku 1 50 % |
| R4 | Zníženie strát v zásobách (exspirácie + stockouty) | 242 € | 100 % | 70 % | 170 € | BC-05 | COGS 14 115 €/mes. × 1,8 % × 60 % + stockouty 90 € |
| R5 | Zníženie odpisov pohľadávok (DSO, online platby) | 102 € | 100 % | 50 % | 51 € | BC-09 | tržby 56 459 € × 0,3 % × 60 % |
| **Σ v0.6** | — | **5 170 €** | — | — | **2 654 €** | — | hard cash, vstupuje do paybacku |
| R6 | Hospitalizácia + chirurgia + urgent (moduly C-02/C-03/C-04, v0.7) | 1 860 € | 50 % | 70 % | 651 € | BC-07 | 3 hospitalizácie × 380 € + 4 zákroky × 180 € — **mimo základného paybacku** |
| R7 | *Voliteľná* konverzia uvoľnenej kapacity na nové termíny | 1 506 € | 40% | — | 602 € | BC-01 | +1 slot/lekár/deň = 64 slotov/mes.; **nezapočítava sa**, aby nedošlo k dvojitému započítaniu s R1 |

## F. Alokácia na business cases (bez dvojitého započítania)

| BC | Názov | Kapacitné h (real.) | Hodnota kapacít €/mes. | Páky | Hard cash €/mes. | Spolu €/mes. |
|---|---|---|---|---|---|---|
| BC-01 | Klinická priepustnosť a uvoľnená kapacita | 151,5 h | 4 624 € | — | 0 € | 4 624 € |
| BC-02 | Eliminácia nočnej administratívy | 14,2 h | 497 € | — | 0 € | 497 € |
| BC-03 | Retencia cez preventívne plány a recall | 3,2 h | 87 € | R2, R3 | 816 € | 903 € |
| BC-04 | Zníženie no-show a prázdnych slotov | 8,9 h | 222 € | R1 | 1 618 € | 1 840 € |
| BC-05 | Zabránenie stratám v zásobách | 8,0 h | 225 € | R4 | 170 € | 394 € |
| BC-06 | Legislatívna bezpečnosť a eliminácia pokút | 3,3 h | 100 € | — | 0 € | 100 € |
| BC-07 | Hospitalizácia, chirurgia a urgent (v0.7) | 6,6 h | 200 € | R6 | 651 € | 851 € |
| BC-08 | Klientska skúsenosť, portál a reputácia | 5,6 h | 164 € | — | 0 € | 164 € |
| BC-09 | Finančná disciplína, reporting a uzávierka | 5,0 h | 148 € | R5 | 51 € | 199 € |
| **Σ v0.6** | — | **199,5 h** | **6 068 €** | — | **2 654 €** | **8 722 €** |
| **Σ vrátane v0.7** | — | **206,1 h** | **6 267 €** | — | **3 305 €** | **9 573 €** |

> Kontrola dvojitého započítania: Σ kapacitných hodín = Σ ledger (206,1 h), Σ hard cash v0.6 = Σ pák R1–R5 (2 654 €). R6 (v0.7) a R7 (voliteľná konverzia kapacity) sú uvedené oddelene a do základného paybacku **nevstupujú**.

## G. Náklady

| Scenár nákladov | €/mesiac | Poznámka |
|---|---|---|
| Cloud Nemocnica (neobmedzená AI) | 229 € | Odporúčané pre 45 pacientov/deň: AI objem ~1 050 udalostí/mes. presahuje limit 500 v tieri Klinika. |
| Cloud Klinika + AI overage | 394 € | 550 AI udalostí nad limit × 0 € (cena overage je parameter `STRIPE_PRICE_AI_OVERAGE`, nie je v repozitári fixná). |
| Self-hosted (AGPLv3) + BYO AI kľúč | 359 € | infraštruktúra 100 € + AI 189 € + 2 h IT času lekára/konateľa. |

| Jednorazová investícia | Hodnota |
|---|---|
| Migrácia dát + školenie (partner) | 1 200 € |
| Hardvér (tablet, mikrofón, tlačiareň dokladov) | 720 € |
| Interný čas školenia (42 h × 29 €) | 1 218 € |
| **Spolu** | **3 138 €** |

## H. Payback a ROI (základný scenár: Cloud Nemocnica)

| Metrika | Hodnota |
|---|---|
| Hard cash prínos | 2 654 €/mes. |
| Kapacitná hodnota (nie cash, kým sa nekonvertuje) | 6 267 €/mes. |
| Prevádzkový náklad | 229 €/mes. |
| Čistý mesačný cash efekt | 2 425 €/mes. |
| **Payback jednorazových nákladov (iba hard cash)** | **1,3 mesiaca** |
| **Payback (cash + kapacitná hodnota)** | **0,4 mesiaca** |
| Násobok návratnosti predplatného (iba cash) | 11,6× |
| Násobok návratnosti predplatného (cash + kapacita) | 39,0× |
| Ročný čistý cash efekt | 29 102 € |
| Kumulatívny efekt za 36 mesiacov | 388 421 € |

## I. Citlivosť

| Scenár | Realizácia kapacít | Realizácia cash pák | Hard cash €/mes. | Kapacita €/mes. | Náklad €/mes. | Čistý efekt (cash) | Payback (cash) | Payback (cash+kapacita) |
|---|---|---|---|---|---|---|---|---|
| Stresový — adopcia zlyháva | 25 % | 35 % | 929 € | 2 849 € | 229 € | 700 € | 4,5 mes. | 0,9 mes. |
| Pesimistický | 40 % | 60 % | 1 592 € | 4 558 € | 229 € | 1 363 € | 2,3 mes. | 0,5 mes. |
| Konzervatívny (základ rozhodovania) | 55 % | 100 % | 2 654 € | 6 267 € | 229 € | 2 425 € | 1,3 mes. | 0,4 mes. |
| Steady-state (rok 2+, vrátane v0.7 pák) | 80 % | 115 % | 3 052 € | 9 116 € | 229 € | 2 823 € | 1,1 mes. | 0,3 mes. |

## J. Rampa adopcie a kumulatívny efekt

| Mesiac | Realizačný faktor | Kumulatívny čistý efekt (cash + kapacita − náklady − jednorazové) |
|---|---|---|
| 1 | 35 % | 3 275 € |
| 2 | 35 % | 9 689 € |
| 3 | 35 % | 16 102 € |
| 4 | 55 % | 24 795 € |
| 6 | 55 % | 42 180 € |
| 9 | 70 % | 73 386 € |
| 12 | 70 % | 104 591 € |
| 18 | 80 % | 173 839 € |
| 24 | 80 % | 243 088 € |
| 36 | 85 % | 388 421 € |

## K. Rizikové (ne-cash) efekty — očakávaná hodnota

| Riziko | Sadzba / škoda | Pravdepodobnosť ročne | Očakávaná hodnota €/rok | Ako to OpenVPM AI znižuje |
|---|---|---|---|---|
| Pokuta za porušenie e-Kasa povinností (§ 289/2008 Z. z.) | 3 000 € | 2,0 % | 60 € | idempotentné doklady, offline fronta, denná uzávierka, OKP/PKP evidencia (minimálna sadzba; pravdepodobnosť zistenia pri kontrole FR SR 2 %/rok) |
| Pokuta / náprava pri kontrole ŠVPS (zákon 39/2007 Z. z.) | 1 500 € | 5,0 % | 75 € | KVEPIS XSD validátor, ambulantná kniha, hlásenia nákaz, auditný reťazec (chyby v ambulantnej knihe a hláseniach) |
| Škoda z chýbajúcej evidencie OPL (zákon 139/1998 Z. z.) | 5 000 € | 1,0 % | 50 € | zero AI prefill, povinný svedok, trezorová bilancia, immutable log (nesprávne vedená kniha opiátov, chýbajúci svedok) |
| Regres poisťovne / náhrada škody pri dokumentačnom pochybení | 8 000 € | 1,0 % | 80 € | HITL finalizácia, nemennosť záznamu, korekcie cez addendum/replacement (neúplná dokumentácia pri poistnej udalosti) |
| Pokuta GDPR (čl. 83) pri úniku / nesprávnom súhlase | 4 000 € | 0,5 % | 20 € | RLS izolácia, consent gate, suppression centrum, sympathy gate (reálne sankcie vo veterinárnom sektore sú nižšie, ide o konzervatívny odhad) |
| **Σ** | — | — | **285 €** | ≈ 24 €/mes. |
