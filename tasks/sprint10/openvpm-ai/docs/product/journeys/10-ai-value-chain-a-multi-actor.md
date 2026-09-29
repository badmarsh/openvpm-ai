# Prierezové vzory — AI Value Chain, chybové scenáre, dôvera, multi-actor a KPI

> Tento dokument neopisuje jednu obrazovku. Opisuje **pravidlá, ktoré platia pre všetky journeys**:
> kde AI pridáva hodnotu, ako zlyháva, ako si lekár buduje dôveru, ako sa legislatíva stáva neviditeľnou,
> a čo má development merať, aby sa dalo obhájiť, že to funguje.

---

## 1. AI Value Chain

Pre každý AI povrch platí jednotný reťazec: **Vstup → Spracovanie → Výstup → Human Review → Finalizácia**.
Akýkoľvek AI povrch, ktorý tento reťazec nemá kompletne pokrytý (vrátane auditu), je v OpenVPM AI **nedokončený**.

### 1.1 Hlasové diktovanie (J2)

```
[Vstup]                [Spracovanie]              [Výstup]                 [Human Review]            [Finalizácia]
audio 20–120 s   →     STT (SK slovník)      →    SOAP draft        →      ClinicalDiffConfirmModal  →   saveAsSoapNote
+ kontext pacienta     + LLM štruktúrovanie       (S/O/A/P bloky)          + potvrdenie lekára           (jedna transakcia)
+ encounter context    (voice.formatTextToSoap)   + zdroj: AI asistent      (15-min obálka, TTL)
                                                                                                        + hash draftu a obsahu
```

| Riziko | Čo sa stane dnes | Čo musí platiť |
|---|---|---|
| **False positive** (doplní liek/dávku, ktorú lekár nepovedal) | Zero-prefill pri OPL chráni; pri iných liekoch to musí zachytiť lekár v diff modáli | Čísla a lieky z AI musia byť **vizuálne odlíšené** od ručne písaného textu („AI-prepísané číslo“) |
| **False negative** (vynechá vetu, napr. „alergia na penicilín“) | Nikto si to nemusí všimnúť | AI nesmie tvrdiť úplnosť; UI musí umožniť „doplniť, čo AI nestihla“ a lekár si musí zachovať rituál kontroly |
| **Nedostupnosť modelu** | Manuálny editor bez AI (funguje) | Nikdy nesmie blokovať klinickú prácu; audio sa nesmie stratiť |
| **Audit** | **Chýba** AI provenance pri finalizácii (R-03) | Povinný `appendAiAuditEvent` pri finalizácii draftu s AI textom |

### 1.2 Clinical Guardian (J5)

```
[Vstup]                     [Spracovanie — DETERMINISTICKÉ]        [Výstup]              [Human Review]        [Finalizácia]
liek + váha + druh     →    keyword sety + SQL pravidlá       →    alert (severity)  →   lekár rozhodne      →   záznam rozhodnutia
+ problem list              (NSAID, kortikosteroidy, nefrotox.)      + dáta, ktoré viedli   (zmena/dismiss)       v SOAPE + audite
+ lab + alergie + lieky                                            k rozhodnutiu
```

**Zásada:** Guardian **nie je AI a nesmie sa tak nazývať** (audit F-X2-1). Je to deterministický bezpečnostný mechanizmus — jeho hodnota je v reprodukovateľnosti a auditovateľnosti. AI smie vstupovať len do *prezentácie* (priorita, vysvetlenie), nikdy do *rozhodnutia*.

| Riziko | Správanie |
|---|---|
| **False positive** | Dismiss s dôvodom (povinný) + spätná väzba do kvality pravidla |
| **False negative** (chýbajúce pravidlo) | Systém musí ukázať „kontrola neúplná“; nesmie tvrdiť „bez rizika“ |
| **Nedostupnosť** | Kontrola sa nedá vykonať → systém vyžaduje vedomé potvrdenie lekára (nikdy ticho nezapíše predpis) |

### 1.3 AI zobrazovanie — RTG/VHS (J17)

```
[Vstup]              [Spracovanie]            [Výstup]                     [Human Review]          [Finalizácia]
snímka          →    vision model        →    nález ako NÁVRH         →    lekár potvrdí/odmietne  →   injectFindingsIntoSoap
+ kontext pacienta   (feature_mappings)      + limit modelu v texte        + ClinicalDiffConfirmModal  (len do draftu, prefix AI)
                                             + žiadne "istoty" bez metrík                              + appendAiAuditEvent
```

| Riziko | Správanie |
|---|---|
| **False positive** (halucinovaný nález) | Návrh je editovateľný, odmietnuteľný; odmietnutie sa **tiež** zapisuje (aby sa dala merať kvalita modelu) |
| **False negative** (prehliadnutý nález) | V texte musí byť explicitne, že ide o podporný nástroj a nezachytáva všetko; lekár nesmie „prestať pozerať“ |
| **Nedostupnosť** | Manuálny popis je plnohodnotná cesta; snímka sa nikdy nestratí; chýbajúci timeout/abort sa musí doplniť |
| **Regulačné** | Ak sa výstup prezentuje ako diagnostická pomôcka, môže ísť o MDR — komunikácia musí zostať „podporný nástroj s ľudskou kontrolou“ |

### 1.4 Automatizované recally a pripomienky (J14, J15)

```
[Vstup]                [Spracovanie]                  [Výstup]             [Human Review]        [Finalizácia]
klinická udalosť  →    výpočet termínu            →    text správy     →    schválenie textu    →   odoslanie
(vakcína, liek,         + consent/sympathy gate         + segment              + náhľad           + sledovanie konverzie
diagnóza)               + suppression log               + konverzný odhad      + možnosť zrušiť   + report v €
```

| Riziko | Správanie |
|---|---|
| **False positive** (správa nesprávnemu klientovi) | Consent + suppression + sympathy gate na viacerých vrstvách; pri pochybnostiach radšej neposlať |
| **False negative** (nikoho neosloví) | Systém musí zobraziť „koľko pacientov je po termíne“, aj keď kampaň nebeží |
| **Nedostupnosť** | Journey sa zasekne viditeľne (nie ticho); recepcia dostane úlohu |

### 1.5 Marketing AI (J18, J19)

```
[Vstup]                [Spracovanie]                [Výstup]               [Human Review]           [Finalizácia]
fakty o klinike   →    composer / AI text      →    text + médium    →    schválenie (admin/vet)  →   publikácia
+ téma + sezóna        + validateMarketingText       + alt-text             + blokácia Rx tvrdení       + AI audit (marketing_content)
                       (block/warn)                  + médium so súhlasom   + kontrola fotky/konsentu
```

| Riziko | Správanie |
|---|---|
| **False positive** (klinicky problematické tvrdenie) | Validátor blokuje; nikdy nejde von bez schválenia |
| **False negative** (nevhodný tón v citlivom období) | „Tichý režim“ pri kríze; sympathy gate pre celé segmenty |
| **Cudzí vstup** (recenzia, inquiry) | Vždy ohraničený text, obmedzená dĺžka; pri podozrení blokovať a eskalovať |

### 1.6 Súhrnná matica chybových scenárov

| Povrch | Falošný pozitív → UX správanie | Falošný negatív → UX správanie | Nedostupnosť modelu |
|---|---|---|---|
| Diktovanie | Diff modál, viditeľné AI čísla, zero-prefill OPL | „Doplň, čo chýba“ + nutnosť lekárskej kontroly | Manuálny editor, audio zachované |
| Guardian | Dismiss s dôvodom + spätná väzba | „Kontrola neúplná“ | Vyžaduje vedomé potvrdenie |
| Imaging | Odmietnutie návrhu (aj s auditom) | Explicitné limity modelu v UI | Manuálny popis |
| Recally | Gate na konsenty/sympathy; radšej neposlať | Zoznam pacientov po termíne viditeľný vždy | Úloha pre recepciu, viditeľne zaseknuté |
| Marketing | Blokujúca validácia | Krízový režim a schvaľovanie | Lokálny deterministický composer |

---

## 2. Trust-building journey: od skeptika po power usera

Dôvera sa v klinickom systéme **nezískava funkciami, ale tým, čo systém odmietne spraviť**. Cesta má 5 fáz
a každá má svoje odomykanie aj svoje „červené čiary“.

| Fáza | Kedy | Stav lekára | Čo systém musí urobiť | Čo systém nesmie urobiť | Metrika prechodu |
|---|---|---|---|---|---|
| **1. Skeptik** | Deň 1–3 | „AI mi nebude zasahovať do záznamu.“ | Plne funkčný manuálny režim; AI len na vyžiadanie, nikdy automaticky | Nespúšťať AI automaticky, neposielať AI notifikácie, neschovávať klasické funkcie za AI | Lekár použije systém bez AI (t1 journey completion) |
| **2. Zvedavý pozorovateľ** | Deň 4–10 | „Skúsim to na niečom nepodstatnom.“ | AI draft na jednom encounteri; viditeľná kontrola a možnosť odmietnuť | Nezapisovať AI text bez potvrdenia; nezobrazovať „istotu“ bez dát | Prvý AI draft + odmietnutie/úprava bez straty dôvery |
| **3. Prvý úspech** | Týždeň 2–3 | „Toto mi ušetrilo 8 minút.“ | Merateľná úspora (report), AI korektne spracuje práve jeho štýl diktovania | Nepreháňať úsporu; nepoužiť jednu chybu ako „AI je super“ | ≥ 3 AI drafts, ≥ 1 prevzaté aspoň na 50 % |
| **4. Rutinný používateľ** | Mesiac 1–2 | „Diktujem vždy, keď môžem.“ | AI je súčasť workflow, ale stále s review; Guardian chráni | Neznižovať kontrolu (žiadne auto-finalize), nezvyšovať agresivitu notifikácií | Podiel encounterov s AI draftom ≥ 45 % |
| **5. Power user / advokát** | Mesiac 3+ | „Bez tohto by som nerobil.“ | AI v čo najväčšom počte povrchov (imaging, discharge, recally), zdieľanie skúseností s kolegami | Nesľubovať nesplniteľné (autonómna medicína), nepoužívať AI na hodnotenie lekárov | NPS ≥ 45; podiel AI povrchov v praxi ≥ 3 |

**Červené čiary dôvery (nikdy, v žiadnej fáze):**

1. AI zapíše do finalizovaného záznamu bez ľudského potvrdenia.
2. AI zobrazí číslo istoty, ktoré nemá reálny základ (F-07-1).
3. AI obíde kontrolu OPL.
4. AI odošle správu klientovi v citlivej situácii (úhyn, sťažnosť, eutanázia).
5. AI zmení cenu, liek alebo dávku bez vedomého rozhodnutia lekára.
6. Systém tvrdí, že niečo urobil (podanie, uzávierka, doručenie), keď to neurobil.

---

## 3. Legislatíva ako journey: ako sa povinnosť stáva neviditeľnou

Legislatívne povinnosti nepatria medzi „funkcie pre právnika“ — patria do denného workflow. Model zrelosti:

| Stupeň | Význam | Príklad |
|---|---|---|
| **Z0 — Ručné** | Používateľ si musí pamätať, že povinnosť existuje | Papierová kniha ošetrení |
| **Z1 — Asistované** | Systém pripomenie a pripraví podklady, používateľ vykoná | KVEPIS: pripomienka + XML export |
| **Z2 — Automatizované** | Systém vykoná, používateľ schvaľuje | Besnota: hlásenie sa vytvorí z vakcinácie |
| **Z3 — Neviditeľné** | Systém vykoná bez toho, aby si to niekto všimol (a je to dôkazovo pokryté) | Ochranná lehota sa nedá „zabudnúť“, lebo je súčasťou predpisu |

| Povinnosť | Cieľ | Dnešný stav v kóde | Čo chýba do Z3 |
|---|---|---|---|
| **Kniha ošetrení** | Z3 | Z3 (SOAP, nemenné záznamy, audit) | Provenance AI textu (R-03) |
| **Hlásenie besnoty (3 dni)** | Z2 → Z3 | Z2 (`ext_rabies_notifications` z vakcinácie) | Automatické podanie (B2G čaká na kredencie, R-05); kontrola úplnosti šarží |
| **KVEPIS ambulantná kniha** | Z1 → Z2 | Z1 (XSD validácia + XML export, manuálne podanie) | Priame podanie a stav podania v UI |
| **CRSZ mikročipy** | Z2 | Z2 (validácia ISO, lokálna evidencia, KVL export) | Párovanie s B2G a upozornenie na duplicity |
| **e-Kasa doklady a uzávierky** | Z2 → Z3 | Z2 (drivers FiskalPRO/VRP2, offline front, retry; **default off**, R-06) | Certifikácia + viditeľný stav v UI |
| **OPL evidencia** | Z2 | Z2 (`controlled_substance_log`, zero-prefill, svedok) | Automatická kontrola úplnosti a otvorených záznamov |
| **Ochranné lehoty (EÚ 2019/6)** | Z3 | Z2–Z3 (`ext_withdrawal_periods`) | Blokovanie bez evidencie + zahrnutie do portálových inštrukcií |
| **CEHZ (hospodárske zvieratá)** | Z1 | Z1 (validácia 6-miestnych kódov fariem) | Napojenie na dennú prácu terénneho lekára |
| **Likvidácia mŕtvych zvierat** | Z2 | Z2 (`ext_carcass_disposals`) | Väzba na sympathy journey a reporting |
| **GDPR (prístup, minimalizácia, sub-procesori)** | Z2 → Z3 | Z2 (RLS, audit log, export dát; **residency panel chýba**, R-07) | „Kde tečú dáta“ v Settings + DPA stav |
| **Zákon 139/1998 (OPL)** | Z2 | Z2 | Ochrana pred agent tool obchvatom (R-10) |

**Kľúčový princíp dizajnu:** povinnosť sa má stať neviditeľnou **až vtedy, keď je preukázateľná**.
Predtým je lepšie ju používateľovi ukázať (Z1), než ju skryť a tvrdiť, že je vyriešená. Odtiaľ plynie aj
pravidlo pre UI: **nikdy nezobrazovať „zelené“ povinnosti, ktoré neboli reálne podané** (napr. KVEPIS
„vygenerované“ ≠ „podané“).

---

## 4. Multi-actor journeys

V reálnej klinike nikto nerobí journey sám. Nasledujú 4 end-to-end sekvencie s handoffmi — a s tým, kde sa
informácia najčastejšie stratí.

### 4.1 Bežný deň: objednávka → vyšetrenie → faktúra → portál

| # | Aktér | Akcia | Systém | Handoff riziko |
|---|---|---|---|---|
| 1 | Klient | Objedná sa online (alebo zavolá) | `booking.book` / `portal.requestAppointment` / `appointments.*`, zámok proti dvojitému zápisu | Dvojitá rezervácia, nepotvrdený termín |
| 2 | Recepcia | Potvrdí a pošle pripomienku | `appointments.*`, pripomienky, suppression | Kanál bez súhlasu, klient nedostane info |
| 3 | Recepcia | Check-in | `appointments` → whiteboard | Zamrznutý whiteboard, pacient „neviditeľný“ |
| 4 | Technik | Vitálne, odbery | `vitals.recordVitalSigns`, `lab_results` | Chýbajúca váha → blokované dávkovanie |
| 5 | Lekár | Diktovanie + SOAP + Guardian | `voice.*`, `records.*`, `clinicalGuardian` | AI text bez provenance (R-03) |
| 6 | Lekár | Predpis a výdaj | `prescriptions`, `dispense_charge_queue` | Výdaj bez účtu, chýbajúca šarža |
| 7 | Technik | Príprava lieku | sklad + `dispense_charge_queue` | Negatívny stav skladu |
| 8 | Recepcia | Faktúra + e-Kasa + platba | `billing.*`, `ekasa_*` | Neuzavretý deň, cvičný vs. fiškálny režim |
| 9 | Recepcia | Closeout (platba, lieky, follow-up) | `visit_closeouts` | Zabudnutý follow-up |
| 10 | Systém | Odošle doklad a follow-up | SMS/e-mail/portál, `care_reminders` | Zlá adresa, žiadny retry |
| 11 | Klient | Vidí faktúru a inštrukcie, zaplatí | portál | Nezrozumiteľný text, chýbajúci súhlas |

**Kritické handoff body:** (2)→(3) potvrdenie termínu, (4)→(5) váha a lab, (6)→(7) výdaj, (8)→(9) platba a closeout, (10)→(11) doručenie. Na každom z nich musí byť stav viditeľný **a nesmie sa dať „preskočiť potichu“**.

### 4.2 Chirurgický deň (plán → zákrok → pooperačná kontrola)

| # | Aktér | Akcia | Handoff riziko |
|---|---|---|---|
| 1 | Recepcia | Naplánuje zákrok + pre-op inštrukcie, rozpočet | Chýbajúci súhlas s cenou |
| 2 | Klient | Potvrdí, prinesie pacienta (lačnenie) | Nedodržané lačnenie → zrušený zákrok |
| 3 | Technik | Pre-op lab, príprava prístroja a materiálu | Chýbajúce výsledky, materiál nie je na sklade |
| 4 | Lekár | Pre-op checklist a anestézia (vrátane OPL) | Chýbajúca váha, OPL bez svedka |
| 5 | Lekár + technik | Zákrok, materiál, dokumentácia | Nezapísaný materiál → stratené euro |
| 6 | Lekár | Pooperačný plán a prepúšťacia správa | Nezrozumiteľné inštrukcie pre klienta |
| 7 | Systém | Post-op check-in `/postop/[id]` | Klient neodpovie → komplikácia neskoro |
| 8 | Lekár | Kontrola a ukončenie case | Nezachytená komplikácia, chýbajúca fakturácia revízie |

### 4.3 Hospitalizácia cez tri zmeny

| # | Aktér | Akcia | Handoff riziko |
|---|---|---|---|
| 1 | Lekár | Prijatie, plán úkonov | Plán zostane len v hlave |
| 2 | Technik (ranná zmena) | Úkony, vitálne, dokumentácia | Nezaznamenaný úkon |
| 3 | Technik (nočná zmena) | Kontrola, infúzie, zmena stavu | Neodovzdaná zmena → duplicitná liečba |
| 4 | Lekár (vizita) | Zhodnotenie, úprava plánu | Chýbajúce dáta za 24 h |
| 5 | Recepcia | Denná komunikácia s majiteľom (denník) | Rodina volá 5× denne, recepcia nevie odpovedať |
| 6 | Lekár | Prepustenie, plán domácej liečby | Nezrozumiteľné inštrukcie, chýbajúca kontrola |
| 7 | Systém | Fakturácia hospitalizačných dní a liekov | Neúčtované dni (typická strata) |

### 4.4 Compliance týždeň (KVEPIS, OPL, e-Kasa, kontrola)

| # | Aktér | Akcia | Handoff riziko |
|---|---|---|---|
| 1 | Lekár/technik | Počas týždňa generuje klinické udalosti (očkovania, výdaje) | Chýbajúce údaje (šarža, svedok) |
| 2 | Admin | Kontroluje compliance dashboard | Nevidí, čo chýba, kým nie je po termíne |
| 3 | Admin | KVEPIS validácia a export, manuálne podanie | Domnieva sa, že je podané |
| 4 | Admin | OPL a ochranné lehoty — kontrola uzavretia | Otvorené záznamy bez svedka |
| 5 | Admin | e-Kasa uzávierky a kontrola rozdielov | Neuzavretý deň ostane nepovšimnutý |
| 6 | Admin/lekár | Príprava dôkazov pre kontrolu (J30) | Chýbajúca AI stopa (R-03) |
| 7 | Kontrolór | Overenie | Klinika nevie, čo systém nevie dokázať |

**Princíp pre multi-actor:** každý handoff musí mať **vlastníka a stav**. Ak handoff nemá vlastníka (napr. „kto skontroluje, že follow-up bol naplánovaný?“), práca sa stratí — a to je presne miesto, kde má produkt vytvárať hodnotu.

---

## 5. Register KPI a instrumentácia

Nasledujúca tabuľka je „kontrakt merania“: čo merať, kde sú dáta a aká je baseline z referenčného modelu.
Slúži produktu aj investorovi (obhájiteľné čísla namiesto dojmov).

| Oblasť | KPI | Definícia / vzorec | Zdroj v kóde | Baseline | Cieľ (3 mesiace) |
|---|---|---|---|---|---|
| Klinická práca | Čas finalizácie SOAP | `finalizedAt − createdAt` (p50/p95) | `soap_notes` | 6–10 min | ≤ 3,5 min |
| Klinická práca | Podiel AI draftov prevzatých | drafty s AI, kde hash ≠ hash draftu | `ext_clinician_confirmations`, `soap_notes` | 0 % | ≥ 45 % |
| Klinická práca | Záznamy po ordinačných hodinách | podiel finalizácií po 18:00 | `soap_notes.finalizedAt` | 40–60 % | < 15 % |
| Bezpečnosť | AI text bez provenance | finalizované AI drafty bez `ext_ai_audit_log` | `ext_ai_audit_log` vs. drafty | **> 0 (R-03)** | **0** |
| Bezpečnosť | Alerty dismissnuté bez dôvodu | podiel dismissov bez reason | `ext_clinical_guardian_alerts` | n/a | < 5 % |
| Recepcia | No-show rate | `no_show` / všetky termíny | `appointments` | 8–12 % | < 6 % |
| Recepcia | Podiel online/portál objednávok | (booking+portal)/celkový počet | `appointments`, `booking_pages` | 0–5 % | ≥ 25 % |
| Recepcia | Čas objednania (recepcia) | čas od otvorenia modalu po uloženie | front-end telemetria | 2,5–4 min | < 60 s |
| Whiteboard | p95 refresh | oneskorenie stavu na obrazovke | SSE eventy | 15–30 s | < 5 s |
| Fakturácia | Podiel výdajov bez účtovania | `dispense_charge_queue` bez faktúry | `dispense_charge_queue` | 2–3 % | < 0,3 % |
| Fakturácia | Rozdiely v dennej uzávierke | neuzavreté dni / mesiac | `ekasa_daily_closures` | 2–5 | ~0 |
| Fakturácia | Podiel faktúr hradených online | platby cez Stripe / všetky platby | `payments`, `stripe_events` | 0 % | ≥ 20 % |
| Sklad | Exspirácie za mesiac | hodnota odpísaných položiek | pohyby skladu | 240–600 € | < 120 € |
| Preventíva | Zaočkovanosť besnoty | platné vakcíny / aktívni psi | `vaccination_records` | 60–75 % | ≥ 88 % |
| Preventíva | Recall konverzia | termíny z kampane / oslovení | `ext_marketing_recall_schedules` → `appointments` | 0 % | ≥ 15 % |
| Preventíva | Wellness príjem | platby z enrollmentov | `wellness_enrollments`, `payments` | 0 € | ≥ 1 500 €/mes |
| Lab | Čas do zobrazenia výsledku | od odberu po zobrazenie | `lab_results` | 10–25 min | ≤ 5 min |
| Lab | Falošné confidence | zobrazené „istoty“ bez základu | UI testy | > 0 (F-07-1) | 0 |
| Imaging | Podiel AI návrhov prevzatých | potvrdené / všetky analýzy | `ai_imaging_analyses` | n/a | ≥ 40 % |
| Nemocnica | Zaznamenané úkony hospitalizácie | vykonané / plánované | `hospitalization_task_log` (nové) | 75–90 % | ≥ 98 % |
| Nemocnica | Zachytené urgentné tržby | urgentné cases s faktúrou | `emergency_cases` (nové) | 80 % | ≥ 97 % |
| Compliance | Položky po termíne | počet položiek s prekročeným termínom | compliance stav v `ext_*` | 3–10/mes | 0 |
| Compliance | Čas prípravy auditu | čas generovania balíka | J30 meranie | 4–8 h | ≤ 30 min |
| Onboarding | Dokončenie onboardingu | dokončené praxe / začaté | `ONBOARDING_JOURNEY_STEPS` stav | n/a | ≥ 85 % |
| Onboarding | Čas do prvého workflow | od registrácie po prvý doklad | `conversion_milestones` | n/a | ≤ 2 dni (solo) |
| Adopcia | Používanie T1 journeys | aktívne dni / pracovné dni | `usage_records`, `funnel_events` | n/a | ≥ 90 % |
| Dôvera | NPS lekárov | prieskum po 30 dňoch | `ext_pilot_feedback` | n/a | ≥ 45 |
| Ekonomika | Churn | zrušené predplatné / aktívne | `subscription`, `stripe_events` | n/a | < 1,5 %/mes |
| Ekonomika | Náklad na AI beh | náklad / počet AI behov | `usage_records`, `plans.ts` overage | neznámy | meraný a klesajúci |
| Podpora | Čas do vyriešenia incidentu | od reportu po uzavretie | support | n/a | < 24 h |

### 5.1 Instrumentačné pravidlá (aby metriky neklamali)

1. **Meraj udalosť, nie dojem.** Ak sa nedá merať, nedá sa obhájiť (a investor to spozná).
2. **KPI nesmie obsahovať klinický obsah.** Telemetria meria počty a časy, nie texty (GDPR čl. 5).
3. **Každý AI povrch má meranie kvality:** počet potvrdení, úprav a odmietnutí. Ak sa odmietnutia nemerajú, kvalita modelu sa nedá zlepšovať.
4. **Baseline musí byť z reálnej kliniky, nie z dema.** Bez baseline je každý „nárast“ marketing.
5. **Nezamieňaj adoptciu s hodnotou.** Vysoké používanie pri nulovej úspore je tiež zlyhanie (a naopak: malé používanie s veľkou úsporou je príležitosť).

---

## 6. Odporúčania pre roadmapu (vychádzajúce z tejto analýzy)

| Priorita | Odporúčanie | Prečo (z tohto dokumentu) | Tier dopadu |
|---|---|---|---|
| **P0** | Doplniť AI provenance pri finalizácii SOAP (R-03) | Bez toho je celý dôkazový reťazec neúplný pri najpoužívanejšej AI funkcii | všetky |
| **P0** | Odstrániť falošné confidence skóre v lab importe (R-04) | Falošná istota v HITL bráne je horšia než žiadna AI | všetky |
| **P0** | UI pre import dodacích listov (R-09) | Parser existuje, hodnota je okamžitá (J24) | Klinika, Nemocnica |
| **P1** | One-click audit bundle + data residency panel (J30, R-07) | Rozhoduje o dôvere pri kontrole a o GDPR súlade | Klinika, Nemocnica |
| **P1** | Hospitalizačný modul (J20) | Bez neho je Nemocnica tier nepredajný | Nemocnica |
| **P1** | Waitlist auto-offer + drag-to-reschedule (J9) | Priama väzba na tržby (no-show a kapacita) | všetky |
| **P2** | Chirurgia a anestézia (J21) | Najrizikovejšia časť dňa + najvyššia hodnota zákroku | Klinika, Nemocnica |
| **P2** | Follow-up UI pre `ai.patientsNeedingFollowUp` (R-11) | Hotová logika bez UI = nulová hodnota | všetky |
| **P2** | Multi-location UI a reporting (R-08) | Podmienka pre sľub Nemocnica tieru | Nemocnica |
| **P3** | Triáž a urgentný modul (J22) | Rozširuje trh, ale vyžaduje prevádzkovú zrelosť | Nemocnica |
| **P3** | Telemedicína (J23) | Nový príjem a diferenciácia, nižšia priorita než nemocnica | Klinika, Nemocnica |

Toto poradie nie je náhodné: **najprv dôvera a dôkazy (P0), potom tržby (P1) a až potom rozširovanie
klinických schopností (P2–P3)**. V medicínskom softvéri je dôvera jediná mena, ktorá sa nedá dokúpiť.
