# Sekcia 1d — Hĺbková dekompozícia User Journeys: GAP toky (C-02…S-06) a EXTRA toky

> **Rozsah:** 7 medzier identifikovaných auditom (GAP 404) a 2 toky nájdené navyše (EXTRA 200 OK).
> **Dôležité:** pri gap tokoch popisujeme **cieľový stav v0.7**. Všetko, čo dnes v kóde existuje, je označené
> `EXISTUJE`; všetko nové je označené `NÁVRH`. Architektonický detail (Drizzle DDL, tRPC kontrakty, UI koncept)
> je v [`sekcia-2-gap-moduly-v07.md`](sekcia-2-gap-moduly-v07.md).
>
> **Zistenie auditu, ktoré mení prioritizáciu:** `GAP 404` znamená „routa neexistuje“, nie „funkcia neexistuje“.
> Pri 4 zo 7 medzier (D-04, D-06, S-05, S-06) je backend hotový alebo čiastočne hotový — chýba UI, workflow
> alebo posledný krok integrácie. Pri 3 (C-02, C-03, C-04) chýba **celý modul**. Preto sú C-02/C-03/C-04
> v Sekcii 2 rozpracované do úrovne DDL a C-04 dostáva vlastný journey s triážnou škálou.

**Poradie podľa kritickosti pre prax:**

| # | Journey | Typ medzery | Kritickosť | Ledger | Páka |
|---|---|---|---|---|---|
| JG-C02 | Hospitalizačný ICU flowsheet | celý modul chýba | 🔴 blokujúca pre tier Nemocnica | L11, L21 | R6 |
| JG-C03 | Chirurgický denník a anestéziologický protokol | čiastočné stavebné kamene | 🔴 medicínsko-právne riziko | L11 | R6 |
| JG-C04 | Triážna čakáreň a walk-in | čiastočné (waiting room, waitlist) | 🔴 strata urgentných tržieb | — (výnos R6) | R6 |
| JG-D06 | Poistné udalosti | backend áno, UI nie | 🟡 strata tržieb pri priamom zúčtovaní | L36 | — |
| JG-D04 | Zmluvy a súhlasy na zákroky | podpis áno, správa nie | 🟡 compliance | — | — |
| JG-S06 | ŠVPS dohľad a hlásenia nákaz | XML áno, B2G nie | 🟡 závislé od štátu | L13, L32 | — |
| JG-S05 | CRSZ a automatický export čipov | funkcia áno, fronta nie | 🟢 nízke riziko | L32 | — |
| JX-01 | Skladové hospodárstvo | existuje, chýba import UI | 🟢 najlacnejšia výhra | L17–L19, L35 | R4 |
| JX-02 | Manažérske reporty | existuje | 🟢 | L31 | R5 |

---

## JG-C02 — Hospitalizácia: príjem → ICU flowsheet → vizita → prepustenie

**Tier:** T2 (multi-day) · **Audit:** **GAP 404** (`/hospitalization` neexistuje) · **Ledger:** L11, L21 · **Páka:** R6
**Use Case:** UC-11 · **Business Case:** BC-07 · **Cieľová verzia:** v0.7 (fáza 1)

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny (24/7):** Veterinárny asistent | `technician` | nočná zmena: meria, nastavuje infúziu, podáva lieky — **sám**, bez lekára na dosah |
| **Primárny:** MVDr. lekár | `veterinarian` | prijíma, ordnuje plán, robí rannú vizitu, mení liečbu, prepúšťa |
| Sekundárny: Recepcia | `front_desk` | komunikuje s majiteľom, účtuje lôžko-dni, dohaduje prevzatie |
| Sekundárny: Majiteľ zvieraťa | klient | chce vedieť „ako mu je“ bez toho, aby volal o 23:00 |
| Sekundárny: Admin | `admin` | kapacita lôžok, vyúčtované vs. nevyúčtované dni, personálne zmeny |

### 2. Trigger a vstupné predpoklady

**Trigger:** (a) rozhodnutie lekára pri closeoute „pacient zostáva na klinike“ (dnes `E3` v J12 — **mimo systému**,
na papieri); (b) pooperačná observácia (JG-C03); (c) urgentný príjem s potrebou kontinuálnej liečby (JG-C04);
(d) prevzatie pacienta z inej kliniky; (e) majiteľ sa nemôže 24 h starať (napr. diabetická ketoacidóza, pyometra,
parvovírus, uretická obštrukcia, GDV po operácii).

**Pre-conditions (`NÁVRH`):**
- Definované lôžka/boxy (`ext_hospitalization_units`) s typom (ICU, oxygen box, infekčný box, veľký pes, mačka) a stavom.
- Aktívny `cases` záznam (epizóda starostlivosti) — **EXISTUJE** (`cases`, `case_entries`).
- Schválený liečebný plán a informovaný súhlas s hospitalizáciou a odhadom nákladov (JG-D04 — **EXISTUJE** `consent_forms`).
- Zásoba liekov a infúznych roztokov (JX-01 — **EXISTUJE** `products`), pri OPL dostupný svedok.
- Zmena personálu (`staff_schedules` — **EXISTUJE**, rozšíriť o nočné zmeny — `NÁVRH`).

### 3. Scenár krok-za-krokom (cieľový stav v0.7)

**A. Prijatie**

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Lekár v encountere zvolí „Prijať na hospitalizáciu“ | Vytvorí sa `ext_hospitalization_stays` (pacient, lôžko, dôvod, predpokladaná dĺžka, primárny lekár, status `admitted`); prepojí sa na `cases` a `appointments`; pacient sa objaví na **hospitalizačnej tabuli** | Lôžko nie je voľné → E1; pacient už hospitalizovaný → E2 |
| 2 | Lekár vyplní vstupné hodnotenie | Váha, BCS, dehydratácia, bolesť (škála), T/P/D, TT, sliznice, CRT, mentálny stav — rozšírenie `vital_signs` o `spo2Percent`, `systolicBp`, `etco2`, `painScore`, `mentation` (**NÁVRH**) | Chýba váha → výpočet tekutín a dávok je blokovaný |
| 3 | Lekár ordnuje plán | `ext_hospitalization_orders`: lieky (s dávkou, cestou, frekvenciou), infúzie (typ, rýchlosť ml/kg/h, celkový objem), CRI, monitoring (frekvencia vitálnych), diéta, izolácia, špecifiká | Liek nie je na sklade → okamžitá objednávka (JX-01) + varovanie |
| 4 | **Kontrola bezpečnosti** | `clinicalGuardian.checkMedications` + `dosing.calculate` (váha, druh, renálne parametre z `lab_results`); pri OPL zero-prefill a evidencia do `controlled_substance_log` so svedkom | Kritický alert → ordinácia je blokovaná, kým lekár nerozhodne s dôvodom |
| 5 | Systém rozloží plán na časované úkony | `ext_hospitalization_treatments` (plánované) pre každú zmenu: „06:00 T/P/D + bolesť“, „infúzia 4 ml/kg/h kontinuálne“, „22:00 Cefazolin 22 mg/kg IV“ | Frekvencia nezlučiteľná so zmenami → varovanie pri ordinácii |
| 6 | Súhlas a komunikácia s majiteľom | `consent_requests` s odhadom nákladov (lôžko-deň + lieky + monitoring) → podpis cez `/sign/[token]`; denný informačný kanál do portálu (**NÁVRH**) | Majiteľ odmietol hospitalizáciu → alternatívna liečba s dokumentovaným poučením |

**B. Priebeh (zmena po zmene)**

| # | Akcia | Reakcia systému |
|---|---|---|
| 7 | Asistent na tablete otvorí „Moja zmena“ | Zoznam úkonov na najbližšie 2 h s časom, pacientom, dávkou a cestou podania; filter podľa lôžka |
| 8 | Odškrtne úkon | `ext_hospitalization_treatments` → `status='given'`, `givenAt`, `givenBy`, skutočná dávka; odpis lieku zo skladu (`inventory.adjustStock`) + `dispense_charge_queue` (automatické účtovanie) |
| 9 | Zadá vitálne funkcie | `ext_hospitalization_flowsheet` (alebo rozšírené `vital_signs`) s časovou známkou; automatický prepočet bilancie tekutín (`ext_hospitalization_fluid_balance`: príjem IV/PO, výdaj moč/drenáž/vomitus/hnačka) |
| 10 | — | **Alarmovanie:** hodnota mimo definovaných hraníc (napr. laktát > 4 mmol/l, TT < 37,2 °C, HR > 180 u psa, SpO₂ < 94 %) → okamžitá notifikácia lekára (push/SMS na pohotovostný telefón), nie „až do ranna“ |
| 11 | Úkon vynechaný | Povinný dôvod (`skipped_reason`: pacient spal, zvracal, odmietol, presunutý na pokyn lekára) — medzera je **viditeľná**, nikdy tichá |
| 12 | Lekár mení plán | Verzionovanie: `ext_hospitalization_orders` s `supersededBy`/`validFrom`; každá zmena nesie autora, čas a dôvod; ďalšia zmena dostane notifikáciu |
| 13 | Ranná vizita | Systém vygeneruje **24-h zhrnutie**: trendy vitálnych, podané/vynechané úkony, bilancia tekutín, spotreba liekov, bolesť, laktát, zmeny plánu; AI zhrnutie je **draft** s HITL potvrdením |
| 14 | Denná správa pre majiteľa | Draft správy (bez interných detailov) → lekár/recepcia schváli → portál alebo SMS; `consentGateCheck` pred odoslaním |

**C. Prepustenie**

| # | Akcia | Reakcia systému |
|---|---|---|
| 15 | Lekár rozhodne o prepustení | `ext_hospitalization_stays.status='discharge_planned'`; checklist: vitálne stabilné ≥ 12 h, príjem potravy, bolesť zvládnutá per os, majiteľ poučený |
| 16 | Prepúšťacia správa | `extensions.discharge.generate` → `prepareConfirmation` → `save` → `discharge_reports` (**EXISTUJE**); domáci plán liečby, kontrola, varovné príznaky |
| 17 | Vyúčtovanie | Lôžko-dni × sadzba + lieky + monitoring + výkony → `invoices` (cez `visit_work_items` a `dispense_charge_queue`); e-Kasa doklad (J11) |
| 18 | Uzavretie | `status='discharged'` s `dischargedAt`, `dischargeOutcome` (`recovered` / `improved` / `stable` / `referred` / `died` / `euthanized` / `ama` — odchod na vlastnú žiadosť); lôžko sa uvoľní |
| 19 | Kontrola a follow-up | `encounters.completeVisit` s `followUpDisposition='scheduled'`; post-op/post-hospitalizácia journey (J19) |

**Výnimky (unhappy path)**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Kapacita lôžok vyčerpaná** | Systém nedovolí „tiché“ prijatie: buď ukáže voľné lôžko iného typu, alebo vyžaduje vedomé rozhodnutie lekára „umiestnenie mimo box (chodba/karanténa)“ s dôvodom do auditu |
| E2 | **Pacient už je hospitalizovaný** | Nový stay sa nepovolí; systém ponúkne „pokračovať v existujúcom“ alebo „nová epizóda po prepustení“ s jasným časovým rozdelením |
| E3 | **Výpadok systému počas nočnej zmeny** | Papierový fallback: vytlačiteľný formulár plánu a flowsheetu na zmenu (`NÁVRH`); po obnovení doplnenie záznamov s flagom `recorded_after_outage=true` a skutočným časom podania — nie časom doplnenia |
| E4 | **Úkon nevykonaný a nezaznamenaný** | Vizita musí vidieť „chýba 3× meranie“; `completeness` metrika per stay; žiadny stav „plán splnený“ pri medzerách |
| E5 | **Dvaja lekári menia plán súčasne** | Advisory lock na `stay_id` + optimistic revision → `CONFLICT` s diffom a povinným potvrdením |
| E6 | **Kritická hodnota v noci, lekár nedostupný** | Eskalačná reťaz: asistent → pohotovostný lekár → konateľ; každá eskalácia má časovú známku a dôvod; protokol „kto bol informovaný“ |
| E7 | **Úhyn počas hospitalizácie** | `dischargeOutcome='died'` → sympathy gate atomicky; `ext_carcass_disposals` (likvidácia kadaveru); komunikácia len manuálna (`sendCondolenceCard`); lôžko sa uvoľní s dekontaminačnou prestávkou |
| E8 | **Eutanázia** | Samostatný záznam s časom, indikáciou, použitými látkami (OPL so svedkom), potvrdením majiteľa; `reports.euthanasiaRegister` |
| E9 | **Majiteľ si pacienta berie proti odporúčaniu (AMA)** | Podpísané poučenie o rizikách (`consent_requests` s výsledkom `accepted_against_advice`); záznam v `ext_hospitalization_stays.dischargeOutcome='ama'` |
| E10 | **Presun na referenčné pracovisko** | Referalný súhrn (export `discharge_reports` + flowsheet), evidencia čo bolo odovzdané, stav `referred` |
| E11 | **Infekčný pacient** | Izolačný režim lôžka, osobitné sledovanie kontaktu, dekontaminácia po prepustení; pri podozrení na nákazu → hlásenie ŠVPS (JG-S06) |
| E12 | **Potravinové zviera** | Ochranné lehoty mäsa/mlieka (`ext_withdrawal_periods`) a CEHZ evidencia — pri prepustení musí byť lehota vypočítaná a komunikovaná majiteľovi |

### 4. Interakcia s UI (`NÁVRH`)

| Prvok | Návrh |
|---|---|
| Routa | `/hospitalization` (tabuľa lôžok), `/hospitalization/[stayId]` (detail pacienta), `/hospitalization/[stayId]/flowsheet` (mobilný pohľad pre zmenu) |
| Integrácia do existujúceho rozvrhu | Lôžko sa zobrazí ako **dlhý blok** v `/schedule` (typ miestnosti `boarding`, ktorý už existuje v `roomTypeEnum`) a ako samostatný stĺpec na `/whiteboard` („Hospitalizovaní: 3“) — bez toho, aby blokoval ambulanciu |
| Komponenty | `components/hospitalization/unit-board.tsx`, `flowsheet-grid.tsx`, `order-sheet.tsx`, `fluid-balance-panel.tsx`, `round-summary.tsx` |
| Modaly | prijatie (výber lôžka), ordinácia lieku (s Guardian a dosing), dôvod vynechania úkonu, zmena plánu (diff), prepustenie (checklist), AMA poučenie |
| Mobile-first | asistent pracuje s tabletom pri boxe: veľké dotykové ciele, offline fronta pre zápis (PWA), žiadne modal okná s 8 poliami |
| Skratky | `H` = hospitalizačná tabuľa; `Shift+V` = rýchly zápis vitálnych na aktuálnom lôžku (`NÁVRH`) |
| Živé dáta | rovnaký SSE transport ako `/whiteboard` (`/api/hospitalization/stream`) — zmena stavu sa prejaví na všetkých obrazovkách do 2 s |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| Tabuľky | `EXISTUJE` | `cases`, `case_entries`, `vital_signs`, `patient_weights`, `prescriptions`, `controlled_substance_log`, `products`, `dispense_charge_queue`, `visit_work_items`, `discharge_reports`, `ext_carcass_disposals`, `ext_withdrawal_periods`, `rooms` (`room_type='boarding'`), `historical_appointments` (importované hospitalizácie z VetSoftware V2 — `vetsoftware-v2-pipeline.ts:1204–1257`) |
| Tabuľky | `NÁVRH` | `ext_hospitalization_units`, `ext_hospitalization_stays`, `ext_hospitalization_orders`, `ext_hospitalization_treatments`, `ext_hospitalization_flowsheet`, `ext_hospitalization_fluid_balance`, `ext_hospitalization_rounds` — DDL v Sekcii 2 §2.2 |
| tRPC | `NÁVRH` | `hospitalization.listUnits/createUnit`, `hospitalization.admit/getStay/listActive/updateStatus`, `hospitalization.createOrders/updateOrder/discontinueOrder`, `hospitalization.recordTreatment/skipTreatment/listDueTreatments`, `hospitalization.recordFlowsheet/getFluidBalance`, `hospitalization.generateRoundSummary/confirmRoundSummary`, `hospitalization.prepareDischarge/discharge`, `hospitalization.exportStayPdf` |
| Zámky | `NÁVRH` | `pg_advisory_xact_lock(hashtextextended('hosp-stay:' || stayId, 0))` pre zmenu plánu; unikátne obmedzenie „jeden aktívny stay na pacienta“; serializable transakcia pre obsadenie lôžka (žiadna dvojitá rezervácia boxu) |
| Idempotencia | `NÁVRH` | `ext_hospitalization_treatments.orderId + scheduledAt` unikátne → dvojitý klik na tablete nevytvorí dva výdaje lieku |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** nepretržitá dokumentácia o poskytnutej starostlivosti vrátane nočných zmien; každá podaná dávka s časom a osobou.
- **Zákon 139/1998 Z. z.:** kontinuálna analgézia (fentanyl CRI, buprenorfín, butorfanol) = opakované záznamy v `controlled_substance_log` **so svedkom** pri každom podaní a pri znehodnotení zvyšku; trezorová bilancia musí sedieť na konci zmeny.
- **EÚ 2019/6 + CEHZ:** pri potravinových zvieratách ochranné lehoty a evidencia liečby v stáde.
- **GDPR:** denná správa pre majiteľa obsahuje minimum (ako sa má, čo dostal, kedy zavolať) — nie internú dokumentáciu.
- **RLS:** nové tabuľky musia mať politiku `tenant_isolation` (`packages/db/rls/enable-rls.sql`) a prejsť `pnpm db:rls:preflight`.
- **HITL:** AI zhrnutie vizity je draft; lekár ho potvrdzuje cez `ClinicalDiffConfirmModal` (rovnaký protokol ako J2/J17).

### 7. Merateľná úspora času a výnos (ledger **L11, L21**; páka **R6**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L11 Dokumentácia hospitalizácie a chirurgie | lekár | 25 min/prípad × 12/mes. | 10 min | 3,0 h | **1,7 h/mes. = 58 €** |
| L21 ICU flowsheet záznamy na zmenách | technik | 8 min/zmena × 90 zmien/mes. | 4 min | 6,0 h | **3,3 h/mes. = 92 €** |
| **R6 (výnos)** | — | 0 € (hospitalizácia sa dnes neodvažuje ponúknuť, alebo sa účtuje „od oka“) | 3 hospitalizácie × 380 € + 4 zákroky × 180 € = 1 860 €/mes. | — | **651 €/mes.** (realizácia 50 % × atribúcia 70 %) |

**Straty pri absencii modulu (kvalitatívne, pre BC-07):**
- Vyúčtovanie lôžko-dní je improvizácia → **únik 15–30 % tržieb z hospitalizácie** (položky sa nezachytia).
- Nočná zmena bez systému → strata informácie medzi zmenami je najčastejší zdroj medicínskeho pochybenia.
- Klinika s hospitalizáciou **nemôže** na OpenVPM prejsť → blokuje celý tier Cloud Nemocnica (229 €/mes.).

### 8. Odkaz → **UC-11** (Sekcia 3), **Sekcia 2 §2.2** (DDL a tRPC), **BC-07**

---

## JG-C03 — Chirurgia: plán → anestéziologický protokol → chirurgický denník → pooperačná starostlivosť

**Tier:** T3 · **Audit:** **GAP 404** (`/surgery` neexistuje) · **Ledger:** L11 · **Páka:** R6
**Use Case:** UC-12 · **Business Case:** BC-07 · **Cieľová verzia:** v0.7 (fáza 2)

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** MVDr. lekár (chirurg) | `veterinarian` | operuje, vedie denník, nesie zodpovednosť za postup |
| **Primárny:** Veterinárny asistent (anestéziologický asistent) | `technician` | indukuje, monitoruje, dokumentuje peroperačné hodnoty každých 5 min |
| Sekundárny: Recepcia | `front_desk` | dohaduje predoperačné vyšetrenie, súhlas, odhad ceny |
| Pasívny: Majiteľ zvieraťa | klient | podpisuje súhlas s anestéziou a zákrokom; dostáva pooperačné inštrukcie |

### 2. Trigger a vstupné predpoklady

**Trigger:** plánovaná operácia (kastrácia, OVH, dentálna extrakcia, ortopedia, odber vzoriek); urgentná operácia
(pyometra, GDV, uretická obštrukcia, trauma); nález z zobrazovania → `extensions.imaging.createSurgicalPlanFromImaging`
(**EXISTUJE**).

**Pre-conditions:**
- Predoperačné vyšetrenie: `vital_signs`, `lab_results` (minimálne hematológia + biochémia u rizikových), ASA klasifikácia.
- Podpísaný informovaný súhlas s anestéziou a zákrokom — vzor **EXISTUJE** (`lib/consult/consent-form-library.ts`, slug `surgery-anesthesia`) + `/sign/[token]`.
- Dostupnosť operačnej miestnosti (`rooms.room_type='surgery'` — **EXISTUJE**) a monitorovacích prístrojov.
- Anestetiká a OPL na sklade s platnou šaržou; pri OPL svedok.
- **NÁVRH:** `ext_surgery_cases` s termínom viazaným na `appointments` a `rooms`.

### 3. Scenár krok-za-krokom (cieľový stav v0.7)

**A. Plánovanie (pred zákrokom)**

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Lekár otvorí `/surgery` → „Nový zákrok“ | Vytvorí `ext_surgery_cases` (pacient, plánovaný dátum, typ zákroku z `procedures`, chirurg, asistent, miestnosť, odhad trvania) | Miestnosť obsadená → konflikt v `/schedule` pod rovnakým zámkom ako J7 |
| 2 | Predoperačné hodnotenie | ASA I–V + rizikové faktory (vek, obezita, brachycefalické plemeno, ochorenie obličiek/pečene/srdca); `lab_results` a `vital_signs` sa preberú automaticky | ASA ≥ III → vyžaduje sa rozšírené vyšetrenie alebo odklad; systém to vynúti |
| 3 | Anesteziologický plán | `ext_anesthesia_records` (plán): premedikácia, indukcia, udržiavanie (izoflurán/sevoflurán/TIVA), analgézia, tekutiny, monitoring (EKG, SpO₂, kapnografia, NIBP, teplota) | **Zero AI prefill** pre propofol, ketamín, fentanyl, butorfanol, buprenorfín, diazepam, midazolam — `CONTROLLED_SUBSTANCES_REGEX`; lekár vypĺňa ručne |
| 4 | Kontrola bezpečnosti | `clinicalGuardian.checkMedications` (napr. NSAID pred operáciou + kortikoidy; nefrotoxické lieky pri hypotenzii), `dosing.calculate` podľa váhy | Kritický alert → plán sa nedá schváliť bez dôvodu |
| 5 | Súhlas majiteľa | `consent_requests` s vzorom `surgery-anesthesia` + odhad nákladov + poučenie o rizikách (vrátane úhynu) → podpis `/sign/[token]`; evidencia v `consent_receipt_capabilities` | Bez podpisu → zákrok sa nedá otvoriť (hard block), okrem vitálnej indikácie s dokumentovaným dôvodom |
| 6 | Predoperačná príprava | Checklist: hladovanie (hodiny), holenie, žilový katéter, premedikácia podaná → zápis do `ext_anesthesia_events` | Nesplnená položka → varovanie pred indukciou |

**B. Zákrok (peroperačný záznam)**

| # | Akcia | Reakcia systému |
|---|---|---|
| 7 | Asistent spustí „Zákrok začatý“ | `ext_surgery_cases.status='in_progress'`, `incisionAt`; miestnosť na `/whiteboard` sa označí „OPERAČKA — prebieha“ |
| 8 | Monitorovanie každých 5 min | `ext_anesthesia_events` (čas, HR, RR, SpO₂, ETCO₂, NIBP, teplota, hĺbka anestézie, podané lieky, tekutiny) — tablet v operačke; offline fronta pri výpadku Wi-Fi |
| 9 | — | **Alarmy:** apnoe > 30 s, SpO₂ < 90 %, ETCO₂ > 60 mmHg, hypotenzia (MAP < 60 mmHg), bradykardia/tachykardia podľa druhu, hypotermia < 36,5 °C → vizuálne + zvukové varovanie a notifikácia chirurga |
| 10 | Chirurg zapisuje priebeh | `ext_surgery_cases.operativeNote` (prístup, nález, výkon, materiál, komplikácie, krvná strata); **count** kompresov/nástrojov pred a po (povinný bezpečnostný prvok) |
| 11 | Podanie OPL počas zákroku | Každá dávka do `controlled_substance_log` (čas, množstvo, šarža, kto podal, **svedok**); zvyšok ampulky → `wasted` so svedkom; trezorová bilancia |
| 12 | Ukončenie | `closureAt`, `status='recovery'`; prepočet celkového času a spotreby → `visit_work_items` a `dispense_charge_queue` |

**C. Zotavenie a pooperačná starostlivosť**

| # | Akcia | Reakcia systému |
|---|---|---|
| 13 | Prebudenie a extubácia | `ext_anesthesia_events` (extubácia, prvý nádych, teplota, bolesť podľa škály); prechod do hospitalizácie (JG-C02) alebo do ambulancie |
| 14 | Anestéziologický súhrn | Automatický súhrn: celkový čas, priemery vitálnych, epizódy mimo rozsah, spotreba liekov, komplikácie — lekár potvrdí (HITL) |
| 15 | Pooperačná analgézia a antibiotiká | `prescriptions` + `ext_hospitalization_orders` (ak zostáva); Guardian re-check |
| 16 | Denník a dokumentácia | `procedures` záznam (s `anesthesiaUsed`, `durationMinutes` — **EXISTUJE**) + SOAP (J3) s operačným nálezom |
| 17 | Prepustenie a inštrukcie | `discharge_reports` (**EXISTUJE**) + verejný `/postop/[id]` (**EXISTUJE**) s inštrukciami a formulárom na odpoveď klienta |
| 18 | Follow-up journey | `lib/autopilot/postoperative.ts` emituje `surgery_completed` → kontrolné otázky 24 h / 3. deň / 10. deň (J19); segment `post_op_recovery` |
| 19 | Vyhodnotenie | `/reports`: počet zákrokov, priemerný čas, komplikácie, spotreba, marža na zákrok |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Zákrok sa zruší (zhoršenie stavu, nedostatok času)** | `status='cancelled'` s dôvodom; súhlas zostáva platný pre nový termín len v rovnakom rozsahu; inak nový súhlas |
| E2 | **Zmena rozsahu počas zákroku** (napr. nález nádoru) | Nový `ext_surgery_cases.procedureChangeNote` s časom a dôvodom; ak zmena presahuje súhlas → dokumentované rozhodnutie „vitalita nad súhlasom“ + informovanie majiteľa ihneď po prebudení |
| E3 | **Nesúlad countu nástrojov/kompresov** | Hard stop: zákrok sa nedá uzavrieť, kým sa nezrovná alebo sa nezadokumentuje postup (RTG kontrola) — bezpečnostný prvok s právnym významom |
| E4 | **Peroperačná zástava (CPR)** | Špeciálny záznam (`ext_anesthesia_events` typ `cpr`) s časmi a liekmi; po stabilizácii alebo úmrtní nasleduje `dischargeOutcome` a (pri úhyne) sympathy gate |
| E5 | **Výpadok systému počas zákroku** | Offline fronta na tablete (záznamy s lokálnym časom), synchronizácia po obnove s flagom; papierový anestéziologický protokol ako záloha |
| E6 | **OPL bez svedka (asistent sám)** | Zápis odmietnutý (`controlledSubstanceWitnessError`) — lekár musí byť prítomný alebo sa použije iný protokol; nikdy „zapísať neskôr“ bez dôkazu |
| E7 | **Chýba súhlas, zákrok je urgentný** | Vitálna indikácia: lekár dokumentuje dôvod, dvojitý podpis (chirurg + druhý lekár/svedok), informovanie majiteľa najneskôr po stabilizácii |
| E8 | **Dentálny zákrok** | Zubný chart **EXISTUJE** (`dental_charts`, `extensions.dental.list/create/update/remove`) — musí byť prepojený s chirurgickým denníkom, nie duplicitný |
| E9 | **Potravinové zviera po operácii** | Ochranná lehota mäsa/mlieka musí byť vypočítaná a zapísaná pred prepustením |

### 4. Interakcia s UI (`NÁVRH`)

| Prvok | Návrh |
|---|---|
| Routy | `/surgery` (denník/zoznam), `/surgery/[caseId]` (detail), `/surgery/[caseId]/anesthesia` (monitor), `/surgery/[caseId]/note` (operačná správa) |
| Integrácia | Operačný deň je **blok v `/schedule`** s `rooms.room_type='surgery'`; na `/whiteboard` samostatný stĺpec „Operačka“ so stavom (príprava / indukcia / priebeh / zotavenie); prepojenie na JG-C02 pri hospitalizácii |
| Komponenty | `components/surgery/case-list.tsx`, `anesthesia-monitor.tsx` (veľké číslice, graf 5-min intervalov, alarm prahy), `instrument-count.tsx`, `operative-note-editor.tsx` |
| Modaly | predoperačný checklist, ASA klasifikácia, súhlas (odkaz na `/sign/[token]`), OPL protokol so svedkom, count mismatch, zrušenie zákroku |
| Hardware | tablet v operačke (odolný, dezinfikovateľný), pulzný oxymeter/kapnograf s manuálnym zápisom (priama integrácia prístrojov je v ROADMAP v1.0 — DICOM/PACS) |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| Tabuľky | `EXISTUJE` | `procedures` (`anesthesiaUsed`, `durationMinutes`, `performedBy`, `notes`), `rooms` (`room_type='surgery'`), `appointments`, `consent_forms`, `consent_requests`, `consent_receipt_capabilities`, `dental_charts`, `controlled_substance_log`, `discharge_reports`, `soap_notes`, `prescriptions`, `ai_imaging_analyses` |
| Tabuľky | `NÁVRH` | `ext_surgery_cases`, `ext_anesthesia_records`, `ext_anesthesia_events`, `ext_surgery_counts`, `ext_surgery_complications` — DDL v Sekcii 2 §2.3 |
| tRPC | `EXISTUJE` | `extensions.imaging.createSurgicalPlanFromImaging`, `extensions.dental.*`, `records.createProcedure`, `extensions.discharge.*`, `controlledSubstances.create`, `records.createConsentRequest/listConsentForms` |
| tRPC | `NÁVRH` | `surgery.list/get/create/updateStatus/cancel`, `surgery.createAnesthesiaPlan/confirmConsent/startCase/recordEvent/recordMedication/finishCase`, `surgery.recordCount/resolveCountMismatch`, `surgery.generateAnesthesiaSummary/confirmSummary`, `surgery.listComplications` |
| Zámky | `NÁVRH` | `takeAppointmentSchedulingLock` pri rezervácii operačky (už existuje pre `/schedule`); `pg_advisory_xact_lock(hashtextextended('surgery-case:' || caseId, 0))` pre zmenu stavu; unikátne `(caseId, eventAt)` pre monitoračné záznamy |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** operačná správa a anestéziologický protokol sú súčasť zdravotnej dokumentácie; podpis chirurga a asistenta.
- **Zákon 139/1998 Z. z.:** anestetiká a opiáty (propofol, ketamín, butorfanol, fentanyl, buprenorfín, midazolam,
  diazepam) — **nulová AI predvýplň**, ručný zápis, svedok pri podaní a znehodnotení zvyšku, trezorová bilancia po každom zákroku.
- **Informovaný súhlas (občianske právo):** vzor `surgery-anesthesia` obsahuje explicitné riziko úhynu; podpis s časovou známkou a hashom (`consent_receipt_capabilities`).
- **GDPR:** súhlas je uchovávaný ako dôkaz, nie ako marketingový údaj; revokácia nezmaže historický dôkaz.
- **HITL:** AI môže navrhnúť operačný plán z RTG nálezu (`createSurgicalPlanFromImaging`), ale plán **schvaľuje lekár** a súhlas podpisuje majiteľ.
- **Bezpečnosť pacienta:** count nástrojov a kompresov je hard gate uzavretia zákroku.

### 7. Merateľná úspora času a výnos (ledger **L11**, páka **R6**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Dokumentácia zákroku (operačná správa + anestéziologický protokol) | 25 min/zákrok (papier + večerný prepis) | 10 min (štruktúrovaný formulár + automatický súhrn) | zahrnuté v **L11 = 1,7 h/mes. = 58 €** |
| Zákroky/mes. navyše (lepšia priepustnosť operačky, presné plánovanie) | — | +4 zákroky | **4 × 180 € = 720 €**, realizácia 50 % × atribúcia 70 % → súčasť **R6 = 651 €/mes.** |
| Riziko (kvalitatívne) | chýbajúci count, chýbajúci svedok pri OPL, chýbajúci súhlas | hard gates | eliminácia najčastejších právnych dôvodov regresu pri pochybení |

### 8. Odkaz → **UC-12**, **Sekcia 2 §2.3**, **BC-07**

---

## JG-C04 — Triážna čakáreň a núdzový walk-in manažment

**Tier:** T3 · **Audit:** **GAP 404** (`/triage` neexistuje) · **Ledger:** — (benefit je výnosový a rizikový) · **Páka:** R6
**Use Case:** UC-16 · **Business Case:** BC-07, BC-04 · **Cieľová verzia:** v0.7 (fáza 2)

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | prvý kontakt; **nie je** klinicky kvalifikovaná na triáž — potrebuje štruktúrovaný skríning, nie voľnú úvahu |
| **Primárny:** MVDr. lekár (pohotovostný) | `veterinarian` | rozhoduje o prioritách, preberá kritických pacientov |
| Sekundárny: Veterinárny asistent | `technician` | meria vitálne pri triáži, zakladá žilný prístup u kritických |
| Pasívny: Majiteľ zvieraťa | klient | v strese, chce vedieť „či prežije“ a „koľko to bude stáť“ |

### 2. Trigger a vstupné predpoklady

**Trigger:** walk-in bez termínu; telefonát „môžem prísť ihneď“; pacient privezený po zrážke s autom;
predávkovanie/otrava; uretická obštrukcia; GDV; seizures; krvácanie; dyspnoe; kolaps; horúčka šteňaťa;
prechod z čakárne, kde sa stav zhoršil.

**Pre-conditions (`NÁVRH`):** definovaná triážna škála a prahy; pohotovostný lekár v `staff_schedules`;
kapacita pre emergency (operačka/ICU/kyslík); cenník urgentnej príplatkovej služby; šablóna súhlasu s urgentným postupom.

### 3. Scenár krok-za-krokom (cieľový stav v0.7)

**A. Príchod a skríning (do 3 minút)**

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Recepcia otvorí `/triage` → „Nový prípad“ | Vytvorí `ext_triage_encounters` s časom príchodu; ak pacient existuje, natiahne kartu (alergie, chronické lieky, posledné lab, váha) cez F1 | Pacient neexistuje → rýchly zápis „unknown“ s možnosťou doplniť neskôr (nikdy nezdržiavať triáž administratívou) |
| 2 | Vyplní štruktúrovaný skríning | 8 otázok: vedomie/mentácia, dýchanie, sliznice a CRT, krvácanie, trauma, bolesť, vracanie/hnačka, čas od začiatku príznakov; doplní T/P/D ak je to bezpečné | Každá odpoveď mapuje na body triážnej škály |
| 3 | Systém vypočíta prioritu | **P1 (červená, okamžite)** — apnoe/dyspnoe, bezvedomie, masívne krvácanie, GDV podozrenie, obštrukcia močových ciest, seizure > 5 min, otrava, polytrauma. **P2 (oranžová, do 15 min)** — výrazná bolesť, pretrvávajúce vracanie, horúčka šteňaťa < 12 týždňov, podozrenie na pyometru. **P3 (žltá, do 60 min)** — kulhanie, kožné problémy, chronické zhoršenie. **P4 (zelená, objednať)** — rutinné, preventívne | Výpočet je **odporúčací**: lekár môže prioritu zvýšiť (nikdy systém nerozhoduje sám) |
| 4 | Lekár potvrdí alebo upraví | `ext_triage_encounters.triageLevel` s `triagedBy`, `triagedAt`, `overrideReason` (ak sa líši od výpočtu) | Bez potvrdenia lekára sa P1 prípad nedá uzavrieť |
| 5 | P1 okamžitá akcia | Prípad sa presunie na vrch `/whiteboard` a do `/triage` tabule s červeným stavom; notifikácia lekára (push/SMS); automaticky sa otvorí encounter a pripravia `vital_signs` + `visit_work_items` | Ak lekár nie je dostupný → eskalačná reťaz (JG-C02 E6) |

**B. Čakanie a prehodnocovanie**

| # | Akcia | Reakcia systému |
|---|---|---|
| 6 | Pacient čaká | Tabuľa ukazuje poradie podľa priority, **nie** podľa času príchodu; čakacia doba per priorita sa meria a zobrazuje |
| 7 | Re-triáž | Povinná po definovanom intervale (P1: kontinuálne, P2: 15 min, P3: 30 min) alebo pri zmene stavu; každá re-triáž má časovú známku a autora |
| 8 | Komunikácia s majiteľom | Štandardizovaný skript: čo sa deje, odhad čakania, orientačná cena urgentného výkonu, čo má robiť, ak sa stav zhorší | 
| 9 | Zhoršenie stavu v čakárni | Recepcia/asistent stlačí „ESKALOVAŤ“ → priorita sa zvýši, lekár je notifikovaný, pôvodná úroveň zostáva v histórii |

**C. Riešenie a odchod**

| # | Akcia | Reakcia systému |
| 10 | Lekár preberá prípad | Prechod do štandardného encounteru (J2/J3) s predvyplnenou anamnézou z triáže — **bez opätovného vypytovania** |
| 11 | Rozhodnutie | Ambulantné ošetrenie / hospitalizácia (JG-C02) / operácia (JG-C03) / odporúčanie na referenčné pracovisko / eutanázia (indikovaná) |
| 12 | Uzavretie | `ext_triage_encounters.status='resolved'` s `outcome` a väzbou na `appointments`/`soap_notes`; vyúčtovanie urgentného príplatku (J11) |
| 13 | Neodídenie bez ošetrenia (LWBS) | `outcome='left_without_being_seen'` s dôvodom (dlhé čakanie, cena) — metrika, ktorá sa reportuje (`/reports`) |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Príliš veľa P1 naraz (kapacita)** | Systém ukáže kapacitu a vyžaduje rozhodnutie lekára o poradí; logovanie „prečo tento prvý“ (právna obhajoba); možnosť odporučiť inú kliniku s referalným súhrnom |
| E2 | **Majiteľ odmietne urgentný výkon pre cenu** | Dokumentované poučenie o rizikách + podpis (`consent_requests` s výsledkom `declined`); nikdy sa „ticho“ nepustí |
| E3 | **Pacient z iného druhu (exot) bez referenčných hodnôt** | Triážna škála má druhovo špecifické prahy (pes/mačka) a pre exoty varovanie „prahy nie sú validované“ — lekár rozhoduje |
| E4 | **Otrava s neznámou látkou** | Štruktúrovaný záznam látky, množstva, času; odkaz na toxikologickú databázu; pri OPL/predpisových liekoch klienta → `prescriptions` história |
| E5 | **Pohryznutie človeka** | Povinné hlásenie a observácia zvieraťa (J13 E-branch: `ext_rabies_observations`, 14-dňová observácia s checkpointmi) |
| E6 | **Podozrenie na nákazu (parvovírus, besnota)** | Izolácia, `ext_rabies_notifications` / hlásenie ŠVPS (JG-S06), dekontaminácia priestoru, označenie lôžka/miestnosti |
| E7 | **Walk-in počas plnej ambulancie** | P3/P4 sa presunú na najbližší voľný termín (J7) alebo na waitlist; P1/P2 sa riešia ihneď |
| E8 | **Telefonická triáž (pred príchodom)** | Skript pre recepciu (`ext_marketing_operative_scripts` — **EXISTUJE**) s rovnakými otázkami; výsledok = odporúčanie „príďte ihneď“ / „objednáme vás“; záznam hovoru do `communications` |
| E9 | **Úhyn pri príchode / mŕtve zviera privezené** | Sympathy gate; evidencia kadaveru (`ext_carcass_disposals`); žiadne automatické správy |

### 4. Interakcia s UI (`NÁVRH`)

| Prvok | Návrh |
|---|---|
| Routy | `/triage` (tabuľa prípadov s farbami), `/triage/[id]` (detail + skríning), `/waiting-room` (rozšírené o prioritu) |
| Integrácia | Jeden pohľad s `/whiteboard`: stĺpec „Triáž / urgent“ na vrchu; P1 prípady vizuálne dominujú (červená, pulzujúca indikácia čakacej doby) |
| Komponenty | `components/triage/queue-board.tsx`, `triage-wizard.tsx` (8 otázok, klávesnica-first), `priority-override-dialog.tsx`, `wait-time-ticker.tsx` |
| Modaly | potvrdenie priority lekárom, eskalácia, poučenie o odmietnutí výkonu, LWBS dôvod |
| Skratky | `T` = nová triáž; `Esc` = eskalovať aktuálny prípad; celé vyplnenie skríningu musí ísť **bez myši** (recepcia drží telefón) |
| TV | `/tv` v čakárni zobrazuje anonymizované poradie („Rex — o 10 min“), nie diagnózy |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| Tabuľky | `EXISTUJE` | `appointments` (`appointment_status`, `origin`), `appointment_waitlist`, `visit_work_items`, `vital_signs`, `patients`, `communications`, `ext_marketing_operative_scripts`, `ext_rabies_observations`, `ext_carcass_disposals` |
| Tabuľky | `NÁVRH` | `ext_triage_encounters`, `ext_triage_assessments` (re-triáže), `ext_triage_protocols` (konfigurovateľné prahy per druh) — DDL v Sekcii 2 §2.4 |
| Enum | `NÁVRH` | rozšírenie `appointment_origin` o `emergency`, alebo nový `ext_triage_encounters.source` (`walk_in`/`phone`/`transfer`/`waiting_room_deterioration`) |
| tRPC | `NÁVRH` | `triage.create/assess/reassess/escalate/list/get/resolve/listQueueMetrics`, `triage.getProtocol/updateProtocol`, `triage.convertToAppointment` |
| Zámky | `NÁVRH` | unikátne „jeden aktívny triážny prípad na pacienta“; `pg_advisory_xact_lock` pri eskalácii, aby dva kliky nevytvorili duplicitnú notifikáciu |
| Metriky | `NÁVRH` | čas do prvej lekárskej kontroly per priorita, % P1 do 5 min, LWBS rate, počet re-triáží, počet override-ov |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** aj urgentné ošetrenie musí mať záznam; čas príchodu a čas prvej kontroly sú dôkazom
  pri sťažnosti na oneskorenie.
- **Odpovednosť za škodu:** `overrideReason`, poučenie pri odmietnutí výkonu a LWBS záznam sú kľúčové dôkazy.
- **Nákazy (zákon 39/2007, vyhlášky):** podozrenie na besnotu a iné hlásené nákazy → povinné hlásenie (JG-S06).
- **GDPR:** triážny skríning je zdravotný údaj — prístup len klinické roly; TV obrazovka anonymizovaná.
- **AI hranica:** triážna kalkulačka je **deterministická** (žiadny LLM). AI nesmie rozhodovať o prioritách —
  rovnaký princíp ako pri identite pacienta v J1. Lekár môže prioritu zvýšiť aj znížiť, ale zníženie vyžaduje dôvod.

### 7. Merateľná úspora času a výnos (päka **R6**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Časová úspora | — | — | **nie je samostatne ledgerovaná** — práca recepcie pri triáži je presun práce, nie úspora; benefit je výnosový a rizikový |
| Zachytené urgentné prípady | časť walk-in odchádza (LWBS) alebo je vyšetrená neskoro | štruktúrovaná priorita + eskalácia | **R6** (3 hospitalizácie + 4 zákroky/mes.) pokrýva urgentnú líniu: 1 860 € hrubých → **651 €/mes.** započítaných |
| Medicínske riziko | P1 pacient čaká v rade za rutinnými | P1 je vždy prvý, s meraným časom | eliminácia najzávažnejšieho typu pochybenia (oneskorená starostlivosť) |

### 8. Odkaz → **UC-16**, **Sekcia 2 §2.4**, **BC-07**

---

## JG-D06 — Poistné udalosti a komunikácia s poisťovňami zvierat

**Tier:** T4 · **Audit:** **GAP 404** (`/insurance` neexistuje) · **Ledger:** L36 · **Use Case:** UC-32 → presun do **UC-33** (financie) · **Business Case:** BC-07
**Skutočný stav:** backend **existuje** (`routers/extensions/insurance.ts` — `checkEligibility`, `createClaim`,
`listClaims`; `lib/insurance/petexpert.ts` — validácia mikročipu, výpočet 10 % spoluúčasti, generovanie HTML
lekárskej správy; tabuľky `insurance_policies`, `insurance_claims`). **Chýba celý UI povrch** — jediný odkaz
v kóde je v `components/automations/clinical-automations-view.tsx`. Live API integrácia s produkčnými
credentials neprebehla (`ROADMAP.md`).

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Admin / prevádzková manažérka | `admin` | zakladá poistné zmluvy, podáva claims, sleduje stav |
| Sekundárny: Recepcia | `front_desk` | overuje poistenie pri prvej návšteve, pomáha klientovi s formulármi |
| Sekundárny: MVDr. lekár | `veterinarian` | podpisuje lekársku správu a položkový export |
| Pasívny: Majiteľ zvieraťa | klient | chce priame zúčtovanie alebo rýchle preplatenie |

### 2. Trigger a vstupné predpoklady

**Trigger:** nová poistná zmluva klienta; úraz/ochorenie s nárokom na plnenie; plánovaný zákrok s predschválením;
zamietnutý claim (doplnenie dokumentácie); upomienka poisťovne.

**Pre-conditions (`EXISTUJE`):** `insurance_policies` (poisťovňa, číslo zmluvy, platnosť, `expirationDate`,
limit, spoluúčasť, kryté položky); pacient s validným mikročipom (`extensions.crsz.validateChip`) — PetExpert
validáciu čipu vyžaduje; finalizovaná `invoices` a klinická dokumentácia.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Recepcia pri prvej návšteve zaznamená poistenie | **NÁVRH UI:** pole „Poistenie“ v `/clients/[id]/edit` → `insurance_policies` | Klient nemá poistenie → ponuka wellness plánu (J15) |
| 2 | Pri zákroku/chorobe admin otvorí claim | `insurance.checkEligibility(policyId, patientId, claimAmount)` → validácia čipu, platnosti zmluvy, limitu, spoluúčasti | Zmluva expirovala → `NOT_FOUND`/varovanie; claim sa nedá podať |
| 3 | `insurance.createClaim` | Zostaví PetExpert payload (`buildPetExpertClaimPayload`) + položkovú lekársku správu (`generatePetExpertClaimHtml`) z `invoices`/`invoice_items` a klinickej dokumentácie | Chýba položka na faktúre → claim je neúplný (blokuje podanie) |
| 4 | Lekár skontroluje a podpíše | **NÁVRH:** HITL potvrdenie lekárskej správy (rovnaký protokol ako discharge); `insurance_claims.status='submitted'` | Bez podpisu sa nepodáva |
| 5 | Odoslanie | **Dnes:** export HTML/PDF na manuálne podanie. **NÁVRH v0.7:** REST odoslanie do PetExpert + stavový webhook | Live API credentials nie sú → manuálny krok zostáva, ale systém pripraví kompletný balík |
| 6 | Sledovanie stavu | `insurance.listClaims` — stavy `draft`/`submitted`/`requested_info`/`approved`/`rejected`/`paid`; SLA sledovanie a upomienky | Poisťovňa žiada doplnenie → task pre lekára s termínom |
| 7 | Plnenie | Pri schválení: úhrada na faktúru (`billing.recordPayment` s `paymentMethod='TRANSFER'`, zdroj poisťovňa); pri priamom zúčtovaní: klient platí len spoluúčasť 10 % | Zamietnutie → dôvod, odvolanie, alebo preúčtovanie na klienta |
| 8 | Reporting | `/reports` — počet claimov, miera schválenia, priemerná doba plnenia, pohľadávky voči poisťovniam (AR) | Nízka miera schválenia → kontrola dokumentácie (často chýba diagnóza alebo položkový rozpis) |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Zamietnutie pre nedostatočnú dokumentáciu** | Claim sa vráti do stavu `requested_info` s konkrétnym zoznamom chýbajúcich položiek; odkaz na `soap_notes`/`lab_results`, ktoré treba doplniť (nie prepísať — UC-05) |
| E2 | **Klient nechce čakať na plnenie** | Faktúra sa vyúčtuje klientovi; po plnení poisťovňou refundácia (`billing.refundPayment` + e-Kasa opravný doklad) |
| E3 | **Predexistujúce ochorenie (exklúzia)** | `checkEligibility` musí vedieť označiť položky, ktoré zmluva nekryje — inak kliniky podávajú zbytočné claims a strácajú dôveryhodnosť |
| E4 | **Viac poistných zmlúv na jedného klienta** | Výber primárnej; žiadne dvojité podanie (unikátny index na `(policyId, invoiceId)`) |
| E5 | **Generali / Union (iné formáty)** | `lib/insurance/` — položkový export lekárskej správy a účtovaných položiek; **NÁVRH:** per-poisťovňa šablóna |
| E6 | **GDPR — odoslanie zdravotných údajov tretej strane** | Zmluvný základ (plnenie zmluvy v prospech klienta) + informovanie klienta; evidence v `audit_log`; minimálny rozsah údajov |

### 4. Interakcia s UI (`NÁVRH`)

| Prvok | Návrh |
|---|---|
| Routy | `/insurance` (zoznam zmlúv a claims), `/insurance/[claimId]` (detail s náhľadom lekárskej správy), pole v `/clients/[id]` |
| Komponenty | `components/insurance/policy-form.tsx`, `claim-builder.tsx` (výber faktúr a položiek), `claim-status-timeline.tsx` |
| Modaly | eligibilita (výsledok validácie), HITL potvrdenie lekárskej správy, dôvod zamietnutia, refundácia |
| Integrácia | v `/billing` pri faktúre tlačidlo „Poistiť“ → predvyplní claim z položiek faktúry |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| tRPC | `EXISTUJE` | `extensions.insurance.checkEligibility`, `.createClaim`, `.listClaims` (staffProcedure: `admin`/`veterinarian`/`technician`/`front_desk`) |
| tRPC | `NÁVRH` | `insurance.upsertPolicy/listPolicies/deactivatePolicy`, `insurance.getClaim/updateClaimStatus/requestInfo/appeal`, `insurance.exportClaimPdf`, `insurance.submitToProvider` (po pridelení credentials), `insurance.reportSummary` |
| Drizzle | `EXISTUJE` | `insurance_policies` (`expirationDate`, limit, spoluúčasť), `insurance_claims`, `invoices`, `invoice_items`, `microchip_registrations` |
| Drizzle | `NÁVRH` | `ext_insurance_claim_events` (stavová stopa, komunikácia), `ext_insurance_payouts` (párovanie plnenia s platbou) |
| Lib | `EXISTUJE` | `lib/insurance/petexpert.ts` — `validatePetExpertEligibility`, `buildPetExpertClaimPayload`, `generatePetExpertClaimHtml` |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR:** zdravotné údaje tretej strane len na základe zmluvy/plnenia v prospech subjektu; minimalizácia
  (položkový rozpis, nie celá dokumentácia); evidence odoslania v `audit_log`.
- **Zákon 39/2007 Z. z.:** lekárska správa je zdravotná dokumentácia — podpisuje lekár.
- **Zákon o poisťovníctve:** formálne náležitosti claimu per poisťovňa; systém nesmie „vymyslieť“ diagnózu,
  aby claim prešiel (etické pravidlo, rovnaké ako pri AI draftoch).
- **RLS:** poistné zmluvy sú tenan-izolované.

### 7. Merateľná úspora času (ledger **L36**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Spracovanie poistnej udalosti (zbieranie položiek, písanie správy, podanie, follow-up) | 4,0 h/mes. | 1,0 h/mes. | model 3,0 h → **real 1,7 h/mes. = 50 €** |
| Cash-flow efekt | priemerná doba plnenia 30–45 dní, ~8 % claimov zamietnutých pre formálne chyby | kompletný balík na prvý pokus | **nezapočítané v ROI** (chybajú dáta o objeme poistených klientov na SK trhu); upside pre BC-07 |

### 8. Odkaz → **UC-33**, **Sekcia 2 §2.6**, **BC-07**

---

## JG-D04 — Manažment zmlúv a súhlasov na zákroky (GDPR a informovaný súhlas)

**Tier:** T4 · **Audit:** **GAP 404** (`/consents` ako samostatná routa neexistuje) · **Ledger:** — · **Business Case:** BC-06, BC-08
**Skutočný stav:** podpisovanie súhlasov **funguje** — `consent_forms`, `consent_requests`,
`consent_receipt_capabilities`, `records.createConsentRequest/listConsentForms/listConsents`,
`components/records/consent-sign.tsx`, verejná routa `/sign/[token]` (+ `/api/sign/receipt`),
knižnica vzorov `lib/consult/consent-form-library.ts` (vrátane `surgery-anesthesia`), test integrity
`packages/db/test-consent-evidence-integrity.ts`. **Chýba:** centrálny register verzií vzorov, viazanie súhlasu
na konkrétny plánovaný zákrok s odhadom ceny, evidencia odmietnutia ako rozhodovacieho podkladu, register DPA
a interných zmlúv, expirácia a obnova súhlasov.

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** MVDr. lekár | `veterinarian` | vysvetľuje zákrok a riziká, žiada súhlas |
| Sekundárny: Recepcia | `front_desk` | dáva podpisovať formuláre pri príchode, zakladá DPA/GDPR súhlasy |
| Sekundárny: Admin | `admin` | spravuje verzie vzorov, DPA register, audity |
| Pasívny: Majiteľ zvieraťa | klient | podpisuje na tablete alebo cez odkaz v SMS |

### 2. Trigger a vstupné predpoklady

**Trigger:** plánovaný zákrok (JG-C03), hospitalizácia (JG-C02), eutanázia, odber vzoriek s anestéziou,
nový klient (GDPR informačná povinnosť), spracovanie fotiek pre marketing (J18), zmena verzie vzoru,
žiadosť o výstup dát (čl. 15), odvolanie súhlasu (čl. 7(3)).

**Pre-conditions:** aktívna verzia vzoru (`consent_forms`), identifikovaný klient (`clients`),
definovaný zákrok s odhadom ceny (`services`/`treatment_plans`), funkčný podpisový tok (`/sign/[token]`).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Lekár zvolí „Informovaný súhlas“ pri pláne zákroku | `records.listConsentForms` (aktuálne verzie vzorov) → `records.createConsentRequest` s väzbou na pacienta, zákrok, odhad ceny, riziká | Vzor je zastaraný → systém ponúkne aktuálnu verziu, nikdy starú |
| 2 | Klient dostane odkaz | SMS/e-mail s capability tokenom na `/sign/[token]`; platnosť obmedzená; `consent_receipt_capabilities` eviduje rozsah prístupu | Klient chce papier → tlač + sken do `files` s rovnakou právnou silou a poznámkou „podpísané fyzicky“ |
| 3 | Klient číta a podpisuje | `components/records/consent-sign.tsx` → podpis (dotyk/pero), časová známka, IP/user-agent hash, obsah dokumentu ako hash; `/api/sign/receipt` vráti potvrdenie | Klient nesúhlasí → `declined` s dôvodom a poučením |
| 4 | Systém uloží dôkaz | `consent_requests.status` + `consent_receipt_capabilities` + hash dokumentu; test integrity `test-consent-evidence-integrity.ts` | Dokument sa po podpise zmení → hash nesedie = dôkaz je neplatný (musí byť odhalené) |
| 5 | Zákrok sa môže začať | JG-C03 krok 5 overí platný súhlas pre **konkrétny** zákrok a **konkrétnu** verziu vzoru | Súhlas je na iný zákrok → hard block |
| 6 | Register a audit | **NÁVRH:** `/consents` — zoznam všetkých súhlasov per klient/pacient, stavy, expirácie, odvolania; export pre kontrolu | Klient odvolal súhlas → `revoke` s dátumom; zákroky pred odvolaním zostávajú platné |
| 7 | GDPR zmluvy (DPA) | **NÁVRH:** register DPA s dodávateľmi (PetExpert, Laboklin, Vertex AI, Anthropic, SMS provider) — `docs/wiki/02-slovenska-legislativa-a-integracie/7. Zmluva o spracúvaní osobných údajov pre SR (Vzor DPA).md`; stav podpisu, dátum, revízia | ⚠️ DPA s AI sub-procesormi **nie je podpísaná, región nepotvrdený** (`ROADMAP.md` bod 4) — otvorená compliance položka pilota |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Urgentný zákrok bez súhlasu** | Vitálna indikácia: dokumentovaný dôvod, podpis dvoch osôb (lekár + svedok), informovanie majiteľa bezodkladne; súhlas sa doplní spätne ako `retroactive` s vysvetlením |
| E2 | **Klient odmietol, ale zákrok je nevyhnutný** | `declined` + alternatívy + poučenie o rizikách odmietnutia; lekár rozhodne o odklade; nikdy „presvedčiť“ bez dokumentácie |
| E3 | **Nesprávny vzor podpísaný** | Zneplatnenie (`voided`) s dôvodom, nový `consent_request`; pôvodný dôkaz zostáva (nemennosť) |
| E4 | **Zmena rozsahu počas zákroku** | JG-C03 E2 — dokumentované rozhodnutie, informovanie po zákroku, nový súhlas pri ďalšom kroku |
| E5 | **Odvolanie súhlasu s marketingom** | okamžité utlmenie (`consentGateCheck`), dôkaz v `ext_automation_suppression_log`; zdravotné súhlasy (dokumentácia) zostávajú — zákonný základ |
| E6 | **Neplatný podpis (token expiroval)** | Nový token s novou platnosťou; expirovaný podpis sa **nesmie** považovať za platný |
| E7 | **Majiteľ nie je vlastník (rozvod, útulok)** | Evidencia vlastníctva a oprávnenia konať (`microchip_registrations`, prevod vlastníctva — J1 E4); pri spore → blokácia zákroku do vyjasnenia |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/sign/[token]` (**EXISTUJE**), `/api/sign/receipt` (**EXISTUJE**), `/marketing/consents` (šablóny a skripty — **EXISTUJE**), **NÁVRH** `/consents` (register), `/clients/[id]` (záložka súhlasy) |
| Komponenty | `components/records/consent-sign.tsx` (**EXISTUJE**), **NÁVRH** `components/consents/register-view.tsx`, `version-diff.tsx`, `dpa-register.tsx` |
| Modaly | výber vzoru, náhľad dokumentu pred podpisom, dôvod odmietnutia, retroaktívny súhlas |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| tRPC | `EXISTUJE` | `records.createConsentRequest/listConsentForms/listConsents`, `extensions.marketing.listConsentCandidates/grantConsent/listMediaConsents/createMediaConsent/revokeMediaConsent`, `clients.revokeSms` |
| tRPC | `NÁVRH` | `consents.list/get/void/renew/listVersions/createVersion/diffVersions`, `consents.listDpa/upsertDpa`, `consents.exportEvidencePack` |
| Drizzle | `EXISTUJE` | `consent_forms`, `consent_requests`, `consent_receipt_capabilities`, `ext_marketing_media_consents`, `sms_consent_events`, `platform_email_preference_events` |
| Drizzle | `NÁVRH` | `ext_consent_versions` (verzie vzorov s hashom a platnosťou), `ext_consent_declarations` (DPA register), `ext_consent_refusals` (odmietnutia s poučením) |
| Invarianty | — | hash dokumentu je súčasťou dôkazu; zmena šablóny po podpise = nový `consent_request`, nikdy editácia |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR čl. 7, 13, 15, 17, 77:** súhlas musí byť preukázateľný, informovaný, oddeliteľný a odvolateľný;
  evidencia dôkazu (kto, kedy, akú verziu) je povinnosťou prevádzkovateľa.
- **Občianske právo:** informovaný súhlas na zákrok s poučením o rizikách vrátane úhynu — vzor `surgery-anesthesia`.
- **Zákon 39/2007 Z. z.:** súhlas je súčasť dokumentácie o poskytnutej starostlivosti.
- **Elektronický podpis:** capability token + hash + časová známka; pri sporných prípadoch kvalifikovaný podpis.
- **DPA s AI sub-procesormi:** **otvorená položka** (`ROADMAP.md` bod 4) — do podpisu DPA a potvrdenia regiónu
  nesmie pilotná klinika posielať PHI do AI služieb bez vedomia klienta. Toto je **go/no-go gate** pre AI funkcie v pilote.

### 7. Merateľná úspora času

**Nie je ledgerovaná** — ide o compliance a rizikovú položku (BC-06). Kvalitatívne: centrálny register súhlasov
odstraňuje hľadanie papiera v zakladači (odhad 5–10 min na dohľadanie jedného súhlasu, ~20×/mes. = 2–3 h/mes.),
ale bez merania baseline sa do ROI **nezapočítava**.

### 8. Odkaz → **UC-10** (informovaný súhlas), **UC-18** (GDPR súhlasy), **Sekcia 2 §2.5**, **BC-06**

---

## JG-S06 — Štátny veterinárny dohľad a hlásenia nákaz (ŠVPS SR)

**Tier:** T4 · **Audit:** **GAP 404** (`/statutory/svps` neexistuje ako samostatná routa) · **Ledger:** L13, L32 · **Business Case:** BC-06
**Skutočný stav:** `/statutory` a `/statutory/kvepis` **existujú**. `extensions.kvepis.*` pokrýva credentials,
submissions, XSD validáciu, podpis, podanie, receipt a odmietnutie; `extensions.statutory.*` pokrýva besnotu,
observácie, ochranné lehoty a likvidáciu kadaveru; `reports.rabiesRegister/treatmentDiary/euthanasiaRegister`
poskytujú registre. **Chýba:** priame B2G SOAP/REST podanie — export je **XML-only**, produkčné integračné
kľúče ŠVPS SR neboli pridelené (`ROADMAP.md` register dlhu bod 1). Toto **nie je** možné vyriešiť vývojom;
je to external dependency.

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Admin / prevádzková manažérka | `admin` | mesačné podania, ambulantná kniha, hlásenia nákaz |
| Sekundárny: MVDr. lekár | `veterinarian` | podpisuje podania, hlási podozrenie na nákazu ihneď |
| Externý: ŠVPS SR / regionálna veterinárna správa | — | príjemca podania, vykonáva kontrolu |

### 2. Trigger a vstupné predpoklady

**Trigger:** mesačná uzávierka (ambulantná kniha); podozrenie alebo potvrdenie hlásenej nákazy; pohryznutie človeka;
úhyn s podozrením na nákazu; kontrola ŠVPS; žiadosť o výpis z registra.

**Pre-conditions:** `ext_kvepis_credentials` (pridelené produkčné kľúče — **dnes nie sú**); vyplnená prax (IČO,
DIČ, adresa, registrácia); kompletné klinické dáta za obdobie; platný podpisový prostriedok.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Admin otvorí `/statutory/kvepis` | `extensions.kvepis.getCredentials` (stav integrácie), `listSubmissions` (história podaní s stavmi) | Credentials chýbajú → jasné vysvetlenie „XML export je dostupný, priame podanie vyžaduje kľúče ŠVPS“ |
| 2 | Pripraví podanie | `createSubmission` (typ, obdobie, rozsah) → `validateAndBuild` validuje proti oficiálnej XSD scheme SVPS SR a zostaví XML | Validácia zlyhá → zoznam chýb s odkazom na konkrétny záznam (nie generická chyba) |
| 3 | Podpíše | `signSubmission` → `recordSignature` | Bez podpisu → podanie zostáva v stave `prepared` |
| 4 | Podá | `submitSubmission` (B2G) → `uploadReceipt` → `recordReceipt`; pri odmietnutí `markRejected` s dôvodom | **Dnes:** krok 4 je manuálny — admin stiahne XML a podá cez portál ŠVPS |
| 5 | Hlásenie nákazy (ihneď) | `extensions.statutory.recordRabiesNotification`, `createRabiesObservation`, `recordRabiesCheckpoint`; pri kadaveru `recordCarcassDisposal` → `ext_carcass_disposals` | Podozrenie na besnotu → okamžité hlásenie, nie „na konci mesiaca“ |
| 6 | Registre pre kontrolu | `reports.rabiesRegister`, `reports.treatmentDiary` (kniha ošetrení), `reports.euthanasiaRegister`, `reports.legacyFinancialSummary` | Kontrola ŠVPS → export balíka dôkazov (J30 v registry journeys) |
| 7 | Ochranné lehoty | `extensions.statutory.listWithdrawalPeriods/createWithdrawalPeriod` (`ext_withdrawal_periods`) — pri potravinových zvieratách | Pred porážkou musí byť lehota skontrolovaná |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Chýbajúce údaje v zázname (napr. šarža vakcíny)** | XSD validácia odmietne; systém ukáže, ktorý záznam a ktoré pole chýba; doplnenie cez UC-05 (addendum), nie prepis |
| E2 | **ŠVPS odmietne podanie** | `markRejected` s dôvodom; opravené podanie s referenciou na pôvodné; audit stopa |
| E3 | **Viacero podaní za to isté obdobie** | `ext_kvepis_submissions_ref_uq` (unikátne obmedzenie) zabraňuje duplikátu |
| E4 | **Kontrola príde neohlásene** | Rýchly export: ambulantná kniha, kniha OPL, register besnoty, evidencia kadaverov — všetko s podpisom a časom |
| E5 | **Nákaza s povinnosťou ihneď hlásiť** | Samostatný rýchly tok s notifikáciou lekára a admina; čas hlásenia je kritický (nie dni) |
| E6 | **Zmena legislatívy / XSD** | Verzionovanie schémy; staré podania zostávajú validné podľa vtedajšej verzie |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/statutory`, `/statutory/kvepis`, `/reports` (**EXISTUJE**); **NÁVRH:** `/statutory/svps` ako konsolidovaný pohľad na hlásenia nákaz + stav podaní + termíny |
| Komponenty | `components/statutory/crsz-panel.tsx`, `components/statutory/carcass-disposal-panel.tsx`, **NÁVRH** `outbreak-report-wizard.tsx`, `submission-tracker.tsx` |
| Modaly | detail chyby XSD validácie, podpis podania, rýchle hlásenie nákazy |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| tRPC | `EXISTUJE` | `extensions.kvepis.getCredentials/upsertCredentials/listSubmissions/createSubmission/validateAndBuild/signSubmission/submitSubmission/uploadReceipt/markRejected/recordSignature/recordReceipt`, `extensions.statutory.listWithdrawalPeriods/createWithdrawalPeriod/listRabiesNotifications/recordRabiesNotification/listRabiesObservations/createRabiesObservation/recordRabiesCheckpoint/listCarcassDisposals/recordCarcassDisposal`, `reports.rabiesRegister/treatmentDiary/euthanasiaRegister` |
| Drizzle | `EXISTUJE` | `ext_kvepis_credentials`, `ext_kvepis_submissions` (indexy na practice/patient/status/type/source + `ext_kvepis_submissions_ref_uq`), `ext_rabies_notifications`, `ext_rabies_observations`, `ext_carcass_disposals`, `ext_withdrawal_periods` |
| B2G | `BLOCKED` | priame podanie vyžaduje produkčné integračné kľúče ŠVPS SR — **external dependency**, v ROADMAP v0.7 |
| ÚPVS | `EXISTUJE` | generovanie GovBox XML obálok pre doručovanie do schránok orgánov štátnej správy |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z. + vyhlášky:** kniha ošetrení, hlásenie nákaz, evidencia besnoty a observácií, likvidácia kadaverov.
- **EÚ 2019/6 a 2016/429 (Animal Health Law):** hlásenie a opatrenia pri nákazách.
- **Nemennosť:** podania a registre musia byť auditovateľné — `ext_ai_audit_log` a `audit_log`.
- **Dátová suverenita:** XML export je lokálny; pri B2G ide údaj do štátneho systému — musí byť evidované, čo a kedy.

### 7. Merateľná úspora času (ledger **L13, L32**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L32 Legislatívny cyklus (KVEPIS XML, CRSZ export, uzávierky) | admin | 8,0 h/mes. | 2,5 h/mes. | 5,5 h | **3,0 h/mes. = 91 €** |
| L13 Legislatívny cyklus — lekársky podiel (OPL kniha, KVEPIS podpis) | lekár | 45 min/mes. | 15 min/mes. | 0,5 h | **0,3 h/mes. = 10 €** |

> Zvyšok úspory (nad XML export) je podmienený pridelením B2G kľúčov — v modeli sa **nepočíta**.

### 8. Odkaz → **UC-26**, **Sekcia 2 §2.7**, **BC-06**

---

## JG-S05 — Centrálna evidencia zvierat (CRSZ) a automatický export čipov

**Tier:** T4 · **Audit:** **GAP 404** (`/statutory/crsz` ako samostatná routa) · **Ledger:** L32 (zdieľaný s JG-S06) · **Business Case:** BC-06
**Skutočný stav:** funkcionalita **existuje** pod `/statutory` (`components/statutory/crsz-panel.tsx`):
`extensions.crsz.validateChip/registerMicrochip/listMicrochips/issuePetPassport/listPassports/getCertificateHtml/
lookupChip/exportKvlSrBatch/issueKvlCrPassport/listKvlCrPassports`; tabuľky `microchip_registrations`,
`pet_passports`, `kvl_cr_passports`. Validácia 15-miestnych čipov podľa ISO 11784/11785. **Chýba:** dávkový
export s frontou a dôkazom o podaní, automatická nočná dávka, reconciliácia odmietnutých záznamov, samostatná routa.

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Veterinárny asistent | `technician` | čipuje pri vakcinácii (J13) alebo pri prvej návšteve |
| Sekundárny: MVDr. lekár | `veterinarian` | overuje údaje, podpisuje export dávky |
| Sekundárny: Admin | `admin` | podáva dávky do KVL SR / CRSZ, rieši odmietnuté záznamy |
| Pasívny: Majiteľ zvieraťa | klient | chce mať psa registrovaného (zákonná povinnosť) |

### 2. Trigger a vstupné predpoklady

**Trigger:** nové čipovanie; prevod vlastníctva; zmena údajov majiteľa; nález čipu bez evidencie;
mesačná dávka exportov; kontrola; žiadosť o pas pre cestu do zahraničia.

**Pre-conditions:** validný 15-miestny čip (ISO 11784/11785); identifikačné údaje majiteľa (meno, adresa, kontakt);
druh, plemeno, dátum narodenia, pohlavie; registrácia praxe u KVL SR.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Asistent zadá čip | `extensions.crsz.validateChip` — formát, dĺžka, kontrolný súčet | Nevalidný → odmietnuté s vysvetlením, nie tiché uloženie |
| 2 | `registerMicrochip` | `microchip_registrations` s väzbou na pacienta a majiteľa, dátum implantácie, miesto | Čip už registrovaný na iného majiteľa → prevod vlastníctva (J1 E4) |
| 3 | Vydá pas | `issuePetPassport` (digitálny pas) / `issueKvlCrPassport` (pas KVL SR) → `pet_passports` / `kvl_cr_passports`; `getCertificateHtml` pre tlač | Cesta do zahraničia → overenie platnosti očkovania proti besnote (21 dní) |
| 4 | Dávka na export | **EXISTUJE:** `exportKvlSrBatch` — zostaví dávku. **NÁVRH:** fronta dávok s stavmi, nočný cron, dôkaz o podaní | Čiastočne nevalidné záznamy → dávka sa rozdelí: validné idú, nevalidné do fronty na opravu |
| 5 | Podanie a potvrdenie | **NÁVRH:** `ext_crsz_submissions` s `submittedAt`, `receiptRef`, `rejectedRecords` | Odmietnuté záznamy → task na opravu s dôvodom |
| 6 | Vyhľadanie | `lookupChip` — overenie vlastníka (napr. pri náleze zvieraťa, pri pohryznutí) | Súkromie: zobrazí sa len kontakt na majiteľa, nie celá história |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | Čip sa nedá prečítať (zlá čítačka, migrácia čipu) | Záznam „čip nemožno overiť“ s poznámkou; opätovná kontrola pri ďalšej návšteve |
| E2 | Dva čipy u jedného zvieraťa | Evidencia oboch s označením primárneho; nikdy zlúčenie do jedného |
| E3 | Majiteľ sa presťahoval / zmenil číslo | Aktualizácia + nová dávka na export; staré údaje zostávajú v histórii |
| E4 | Zviera uhynulo | `patients.status='deceased'` + hlásenie úhynu v dávke; sympathy gate |
| E5 | Export zlyhá na strane registra | Retry fronta s dôkazom; manuálny fallback (formulár na webe KVL SR) |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/statutory` (CRSZ panel — **EXISTUJE**), `/patients/[id]` (záložka identifikácia), **NÁVRH** `/statutory/crsz` (samostatná routa s frontou dávok) |
| Komponenty | `components/statutory/crsz-panel.tsx`, **NÁVRH** `crsz-batch-queue.tsx` |
| Modaly | registrácia čipu, prevod vlastníctva, náhľad pasu pred tlačou, detail odmietnutého záznamu |

### 5. Backend a dátový kontrakt

| Vrstva | Stav | Kontrakt |
|---|---|---|
| tRPC | `EXISTUJE` | `extensions.crsz.validateChip/registerMicrochip/listMicrochips/issuePetPassport/listPassports/getCertificateHtml/lookupChip/exportKvlSrBatch/issueKvlCrPassport/listKvlCrPassports` |
| tRPC | `NÁVRH` | `crsz.listBatches/createBatch/submitBatch/getBatchStatus/listRejected/resolveRejected`, cron `/api/cron/crsz-export` |
| Drizzle | `EXISTUJE` | `microchip_registrations`, `pet_passports`, `kvl_cr_passports`, `patients` |
| Drizzle | `NÁVRH` | `ext_crsz_batches`, `ext_crsz_batch_records` (s `rejectionReason`) |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z. § 20 a vyhláška:** povinná identifikácia a registrácia spoločenských zvierat.
- **ISO 11784/11785:** formát a čitateľnosť transpondéra.
- **GDPR:** register obsahuje osobné údaje majiteľa — prístup len oprávnené roly; `lookupChip` odhaľuje minimum.
- **RLS:** `tenant_isolation` na `microchip_registrations`.

### 7. Merateľná úspora času (ledger **L32** — zdieľaný s JG-S06)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Príprava dávky a podanie | ~1 h/mes. | ~15 min (fronta + nočný cron) | súčasť **L32 = 3,0 h/mes. = 91 €** (spoločne s KVEPIS) |

### 8. Odkaz → **UC-26**, **Sekcia 2 §2.7**

---

## JX-01 — Skladové hospodárstvo s expiráciami šarží

**Tier:** T4 · **Audit:** **EXTRA 200 OK** (`/inventory` existuje) · **Ledger:** L17, L18, L19, L35 · **Páka:** R4 · **Use Case:** UC-23, UC-24, UC-25 · **Business Case:** BC-05

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Veterinárny asistent | `technician` | príjem tovaru, odpis, inventúra, kontrola expirácií |
| Sekundárny: Admin | `admin` | objednávky, dodávatelia, marže, reconciliácia |
| Sekundárny: MVDr. lekár | `veterinarian` | pri predpise vidí dostupnosť a cenu (J10) |

### 2. Trigger a vstupné predpoklady

**Trigger:** doručený tovar s dodacím listom; výdaj lieku (J10); mesačná inventúra; alert na expiráciu;
dosiahnutie `reorderPoint`; návrat od klienta.

**Pre-conditions:** `products` so `sku`, `costPrice`, `unitPrice`, `taxable`, `inventoryTracked`,
`stockQuantity`, `reorderPoint`; `suppliers`; pre import — súbor dodacieho listu v podporovanom formáte
(Cymedica SK, Pharmos a.s., Samohýl SK, Henry Schein SK — `lib/inventory/wholesaler-import.ts`).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Asistent otvorí `/inventory` | `inventory.list` — položky so stavom, šaržou, expiráciou, `reorderPoint`, alertmi (`lib/inventory/alerts.ts`) | Nízky stav → krok 5 |
| 2 | Príjem tovaru — **ručne** | `inventory.create`/`update` s `lotNumber`, `expirationDate`, množstvom, nákupnou cenou | Ručný prepis 30-položkového dodacieho listu = 35 min (baseline L17) |
| 2b | Príjem tovaru — **parserom** | `extensions.wholesalerImport.parse` → náhľad (`searchProducts` na párovanie s `products`) → `confirmImport` → `applyDeliveryNote`; parser označí OPL položky (`isControlledSubstance` — test pre `Narkamon`/ketamín) | ⚠️ **UI pre import dnes neexistuje** (R-09) — parser je hotový a otestovaný; napojenie na `/inventory` je najlacnejšia výhra v0.7 |
| 3 | Párovanie položiek | Parser navrhne existujúci `products` podľa SKU/názvu; nové položky sa vytvoria s `externalSource`/`externalId` a `importFingerprint` (unikátne — duplicitný import odmietnutý) | Neisté párovanie → človek rozhodne |
| 4 | Odpis pri výdaji | `inventory.adjustStock` (výdaj, korekcia, znehodnotenie) s dôvodom; automatická väzba na `dispense_charge_queue` (J10) | Negatívny stav → varovanie a vlajka na inventúru |
| 5 | Objednávka | `purchase_orders` + `suppliers`; `inventoryAlerts` v `/reports`; marža cez `lib/inventory/markup.ts` | Kritický stav (liek potrebný dnes) → okamžitá objednávka s poznámkou |
| 6 | Expirácie | `lib/inventory/alerts.ts` — položky expirujúce do N dní; zoznam na likvidáciu; pri OPL likvidácia so svedkom (`controlledSubstanceLog.wasted`) | Expirovaná šarža → blok výdaja (J10 E3) |
| 7 | Inventúra | Prepočet fyzického a systémového stavu; rozdiely s dôvodom; reconciliácia v `/reports` | Rozdiel > prah → vyšetrovanie (krádež, chybný odpis, darovanie) |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Dodací list v nepodporovanom formáte** | Explicitná hláška s zoznamom podporovaných veľkoobchodov; možnosť ručného vstupu; nikdy tiché 0 položiek |
| E2 | **Duplicitný import toho istého listu** | `importFingerprint`/`externalId` unikátne → druhý import odmietnutý s odkazom na prvý |
| E3 | **Cena na liste sa líši od katalógovej** | Zobrazí diff a vyžaduje potvrdenie; aktualizácia `costPrice` s históriou (maržová analytika) |
| E4 | **Šarža bez expirácie** | Povinné pole pre liečivá; pre materiál voliteľné s vlajkou |
| E5 | **Vrátený tovar od klienta** | Príjem späť s dôvodom; pri liekoch kontrola, či je návrat do predaja legálny (chladový reťazec) |
| E6 | **OPL na dodacom liste** | Označenie `isControlledSubstance=true`; príjem musí ísť cez `controlledSubstances.create(action='received')` s evidenciou trezoru |
| E7 | **Chladový reťazec prerušený** | Znehodnotenie šarže s dôvodom; pri vakcínach hlásenie dodávateľovi; nikdy „predať so zľavou“ |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/inventory`, `/reports` (inventoryAlerts), `/controlled-substances`, `/billing` |
| Komponenty | `components/inventory/*`, **NÁVRH** `components/inventory/delivery-note-import.tsx` (napojenie na existujúci parser) |
| Modaly | náhľad importu s diffom, párovanie položiek, dôvod korekcie, likvidácia expirovanej šarže, inventúrny hárok |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `inventory.list/create/update/startTracking/adjustStock/listSuppliers/createSupplier/updateSupplier`, `extensions.wholesalerImport.parse/searchProducts/confirmImport/applyDeliveryNote`, `billing.listProducts`, `reports.inventoryAlerts`, `controlledSubstances.create/summary` |
| Drizzle | `products` (`lotNumber`, `expirationDate`, `stockQuantity`, `reorderPoint`, `inventoryTracked`, `costPrice`, `unitPrice`, `taxable`, `importFingerprint`, `externalSource`, `externalId`), `suppliers`, `purchase_orders`, `dispense_charge_queue`, `controlled_substance_log` |
| Lib | `lib/inventory/{alerts,dispense,markup,policy,wholesaler-import,prescription-product-pagination}.ts` |
| Invarianty | `products.importIdentityCheck` a `importFingerprintCheck` (DB check obmedzenia); `practiceIdUq`/`externalIdUq` unique indexy |

### 6. Legislatívny a bezpečnostný checkpoint

- **EÚ 2019/6:** sledovateľnosť veterinárnych liečiv po šaržiách a expiráciách; príjem len od autorizovaných veľkoobchodov.
- **Zákon 139/1998 Z. z.:** OPL na sklade v trezore, evidencia každého pohybu, likvidácia so svedkom.
- **Zákon 289/2008 Z. z.:** predaj tovaru podlieha e-Kase (sadzba DPH 5 % pre lieky od 2025).
- **GDPR/RLS:** skladové dáta sú tenan-izolované; ceny sú obchodné tajomstvo (prístup len `admin`/`veterinarian`/`technician`/`front_desk`).

### 7. Merateľná úspora času a výnos (ledger **L17, L18, L19, L35**; páka **R4**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L17 Príjem dodacieho listu | technik | 35 min × 24/mes. | 10 min | 10,0 h | **5,5 h/mes. = 154 €** |
| L18 Inventúra a reconciliácia | technik | 6,0 h/mes. | 4,0 h/mes. | 2,0 h | **1,1 h/mes. = 31 €** |
| L19 Monitoring expirácií a reorder pointov | technik | 1,5 h/mes. | 0,25 h/mes. | 1,2 h | **0,7 h/mes. = 19 €** |
| L35 Objednávky a kontrola | admin | 2,0 h/mes. | 0,75 h/mes. | 1,2 h | **0,7 h/mes. = 21 €** |
| **R4 (výnos)** | — | COGS 14 115 €/mes. × 1,8 % exspirácie = 254 € + 90 € stockouty | −60 % exspirácií | 242 € | **170 €/mes.** (atribúcia 70 %) |

### 8. Odkaz → **UC-23**, **UC-24**, **UC-25**, **BC-05**

---

## JX-02 — Manažérske finančné a prevádzkové reporty

**Tier:** T4 · **Audit:** **EXTRA 200 OK** (`/reports` existuje) · **Ledger:** L31 · **Páka:** R5 · **Use Case:** UC-33 · **Business Case:** BC-09

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Admin / konateľ | `admin` | mesačná uzávierka, rozhodovanie o cenách, personále, investíciách |
| Sekundárny: MVDr. lekár | `veterinarian` | vlastná výkonnosť, top služby |
| Externý: Účtovník | — | dostáva export; nemá prístup do systému (alebo `viewer`) |

### 2. Trigger a vstupné predpoklady

**Trigger:** koniec mesiaca; denná uzávierka e-Kasa; žiadosť účtovníka; rozhodovanie o cenách/investíciách;
kontrola ŠVPS alebo FR SR; žiadosť banky/poisťovne o výkazy.

**Pre-conditions:** uzavreté faktúry a platby; denné uzávierky e-Kasa; vyplnené `visit_closeouts`
(inak reporty ukážu „neuzavreté návštevy“); `financial_closes` pre uzavreté obdobia.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Admin otvorí `/reports` | `reports.settings` (obdobie, porovnanie, formát); prehľad: `revenue`, `appointments`, `topServices`, `inventoryAlerts` | Chýbajúce dáta za obdobie → varovanie, nie prázdny graf |
| 2 | Tržby | `reports.revenue` — podľa služby, lekára, dňa, spôsobu platby; rozpad DPH (5/19/23 %) | Rozdiel voči e-Kasa → reconciliácia (krok 6) |
| 3 | Prevádzka | `reports.appointments` — obsadenosť, no-show, priemerná dĺžka, vyťaženie lekárov a miestností | Nízka obsadenosť → opatrenia (BC-04: waitlist, pripomienky) |
| 4 | Legislatívne registre | `reports.rabiesRegister`, `reports.treatmentDiary`, `reports.euthanasiaRegister`, `reports.legacyFinancialSummary` | Kontrola → export balíka |
| 5 | Sklad | `reports.inventoryAlerts` — expirácie, reorder, rozdiely po inventúre | Vysoké straty → BC-05 opatrenia |
| 6 | Uzávierka | `financial_closes` + `extensions.reconciliation.*` (`/admin/pilot` — denná parita voči VetSoftware v2 v pilotnom období) | Nesúlad → `ext_reconciliation_discrepancies` s vyšetrovaním |
| 7 | Export | `extensions.ekasa.getAccountantExport`, CSV/PDF exporty, `extensions.auditExport.*` | Účtovník potrebuje špecifický formát → šablóna exportu |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Report nesedí s bankou** | Reconciliácia: `payment_processor_settlements`/`payouts`/`refunds`, `stripe_events`; rozdiel sa musí dať vysvetliť po položkách |
| E2 | **Neuzavreté návštevy skresľujú tržby** | Report ukáže „X návštev bez closeout“ s odkazom na frontu (J12) |
| E3 | **Spätné korekcie po uzávierke** | Uzavreté obdobie sa nemení; korekcia do nového obdobia s odkazom na pôvodné |
| E4 | **Účtovník nemá prístup** | Export súborov alebo rola `viewer` (read-only); nikdy zdieľanie prihlasovacích údajov |
| E5 | **Medziročná zmena DPH** | Sadzby sú viazané na dátum dokladu, nie na dnešnú sadzbu |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/reports`, `/billing`, `/billing/ekasa`, `/inventory`, `/admin/pilot`, `/statutory` |
| Komponenty | `components/reports/*`, `components/accounting/*`, `components/dashboard/*` |
| Modaly | výber obdobia, detail rozdielu v reconciliácii, export s výberom formátu |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `reports.settings/revenue/appointments/topServices/inventoryAlerts/rabiesRegister/treatmentDiary/euthanasiaRegister/legacyFinancialSummary`, `billing.arSummary`, `extensions.ekasa.getDailyClosures/getAccountantExport`, `extensions.reconciliation.*`, `extensions.auditExport.*` |
| Drizzle | `invoices`, `invoice_items`, `payments`, `payment_processor_*`, `appointments`, `visit_closeouts`, `products`, `ekasa_daily_closures`, `financial_closes`, `legacy_financial_*`, `ext_reconciliation_discrepancies` |
| Výkon | agregácie musia byť indexované (obdobie + practiceId); veľké exporty asynchrónne, nie v request/response |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 289/2008 Z. z.:** denné uzávierky a súlad tržieb s CHDÚ.
- **Zákon o účtovníctve:** podklady pre účtovnú závierku; nemennosť uzavretých období.
- **Zákon 39/2007 Z. z.:** registre (besnota, ošetrenia, eutanázia) musia byť exportovateľné pre kontrolu.
- **GDPR/RLS:** reporty sú agregáty; export s osobnými údajmi len pre oprávnené roly a s dôvodom.

### 7. Merateľná úspora času a výnos (ledger **L31**, páka **R5**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Reporty a mesačná uzávierka (Excel konsolidácia) | 12,0 h/mes. | 3,0 h/mes. | model 9,0 h → **real 5,0 h/mes. = 148 €** |
| Odpisy pohľadávok | tržby × 0,3 % | −60 % | **51 €/mes.** (R5, atribúcia 50 %) |

### 8. Odkaz → **UC-33**, **UC-30**, **BC-09**
