# OpenVPM AI — User Journeys, Use Cases & Business Cases

**Verzia dokumentu:** 1.0.0
**Dátum:** 2026-09-21
**Baseline:** `3537c67` (`main`, v0.6 PILOT-READY)
**Rozsah:** 19 existujúcich journeys (J1–J19) + 14 nových (J20–J30, J-NEW-1…3) = **33 journeys / 33 use cases / 9 business cases**
**Jazyk:** slovenský (technické termíny v angličtine tam, kde sú v SK vet praxi zavedené — SOAP, encounter, whiteboard, recall, check-in, discharge)

> **Pre koho je dokument.** Pre product ownera (roadmapa), pre designéra (wireframy bez doplňujúcich otázok),
> pre development (Jira ticket + acceptance criteria) a pre investora/lekára (business value bez technického žargónu).
> Každý journey je preto napísaný v troch vrstvách: **A. Journey** (UX) → **B. Use Case** (backlog) → **C. Business Case** (ekonomika skupiny).

---

## 1. Metodika a dôkazová základňa

Každé tvrdenie o správaní systému je odvodené z kódu v tomto repozitári, nie z predpokladu. Kľúčové zdroje:

| Zdroj | Čo z neho dokument čerpá |
|---|---|
| `docs/audit/2026-09-ai-ux-audit.md` | Inventár AI povrchov (A01–A20), journey karty J-01…J-21, zistenia F-xx-y s `súbor:riadok` |
| `apps/web/server/routers/**` | Skutočné procedúry, role (`requireRole`), feature gates (`requireFeature`) |
| `packages/db/schema/**` | Reálne entity a enumy (napr. `visit_closeouts`, `dispense_charge_queue`, `ext_clinician_confirmations`) |
| `docs/slovak-integration-catalog.md` | Integrácie (PetExpert, CYMEDICA/PHARMOS/SAMOHÝL, IDEXX/Fuji/Mindray, Laboklin/Synlab, FiskalPRO/VRP2) |
| `docs/clinic-pilot-workflow.md` | End-to-end sekvencia dnešnej kliniky, lifecycle stavov záznamu, HITL kontrakt |
| `docs/help/sk/*.md` | Reálne UI postupy, ktoré dnes existujú (nie hypotetické) |
| `README.md`, `ROADMAP.md` | Pricing tiery, stav v0.6, plán v0.7 / v1.0, známy technický dlh |

**Konvencia odkazov:** `router.procedura` (napr. `voice.saveAsSoapNote`), `tabuľka.stĺpec` (napr. `visit_closeouts.chargeDisposition`).
Ak niečo nie je v kóde overiteľné, je označené `UNVERIFIED` — to sú otvorené otázky pre product discovery (§7).

**Čo tento dokument NIE je:** nie je to implementačný plán ani odhad sprintov. Je to product discovery podklad,
z ktorého sa plán robí.

---

## 2. Ako čítať dokument

```
Journey (J1…)  ──►  Persóna → Trigger → Kroky (klik-po-klicku) → Alternatívy → Emócie → Prepojenia → AI touchpointy
       │
       ├──►  Use Case (UC-1xx)  ──►  Main Success Scenario, Alternate/Exception flows, Postconditions,
       │                             Business pravidlá (zákony), Dátové entity (DB tabuľky), Integrácie
       │
       └──►  Business Case (BC-n)  ──►  Status quo → Kvantifikovaná hodnota → ROI po tier-och → Moat →
                                        Adoption barriers → KPI
```

**Prioritizácia pre backlog.** Každý use case má implicitnú prioritu podľa frekvenčného tieru journey, z ktorého vychádza:

| Tier | Význam pre roadmapu | Journeys |
|---|---|---|
| **T1 — každé 2 min / hodinu** | Akákoľvek regresia = klinika stojí. Nikdy neobetovať kvalitu za AI experiment. | J1, J2, J3, J7 |
| **T2 — každý encounter** | Priama väzba na cash-flow a právnu platnosť záznamu. | J4, J8, J10, J11, J12 |
| **T3 — niekoľkokrát denne** | Onboarding a dáta klientov; ovplyvňuje kvalitu všetkých T1/T2. | J6, J9, J13 |
| **T4 — týždenne / podľa potreby** | Rast a compliance; vysoký dopad, nízka frekvencia. | J14–J19, J24–J30 |

---

## 3. Persony

| ID | Persona | Rola v systéme | Kontext a motivácia | Emočný základ |
|---|---|---|---|---|
| **P1** | **MVDr. Peter Hric**, 38, konateľ a hlavný chirurg | `veterinarian` (aj `admin` právom konateľa) | 3 lekári, 42 pacientov/deň, operuje 2 dni v týždni. Nesie právnu zodpovednosť za záznam. Diktuje medzi zákrokmi, píše po 18:00. | Skeptik s otvorenými dverami: „AI mi môže ušetriť písanie, ale nikdy nebude rozhodovať za mňa.“ Frustrácia: 40 min záznamov po ordinačných hodinách. |
| **P2** | **MVDr. Lucia Kirchnerová**, 31, 2 roky praxe | `veterinarian` | Bojí sa prehliadnutia interakcie alebo predávkovania pri exotoch. Chce oporu, nie autoritu. | Neistota → úľava, keď ju systém zastaví. Power user AI, keď jej AI ušetrí 10 min/encounter. |
| **P3** | **Zuzana Mikulová**, 45, vedúca recepcie | `front_desk` | 2 telefóny, 60 hovorov/deň, objednáva, check-in, fakturuje, e-Kasa, rieši sťažnosti. Je „gumový pás“ kliniky. | Chronický tlak. Radosť = keď klient odchádza s dokladom a nič netreba opravovať. Frustrácia = duplicitný záznam a doťahovanie kvôli faktúre. |
| **P4** | **Martin Turčan**, 27, veterinárny technik | `technician` | Odbery, RTG, vitálne, hospitalizácia, príjem tovaru, sklad. Preferuje mobil/tablet pred stolom. | Chce byť použitý na klinickú prácu, nie na prepisovanie. Frustrácia: ručné prepisovanie dodacích listov a lab. výsledkov. |
| **P5** | **Ing. Katarína Bartošová**, 52, majiteľka labradora s CKD | klient (portál, capability token) | 8 návštev/rok, chronická medikácia, 3 faktúry ročne nad 300 €. Notifikácie si neželá „spamovo“, ale chce vedieť o vakcinácii. | Chce mať prehľad bez telefonovania v ordinačných hodinách. Frustrácia: dovolať sa v 11:00. |
| **P6** | **Ján Slivka**, 34, majiteľ mačky, urgent o 21:40 | klient + `front_desk` pohotovosť | Digitálne zdatný, ale v strese. Nezaujíma ho systém, chce vedieť „či prežije a čo to bude stáť“. | Panika a nedôvera k neznámemu prostrediu. Úľava = jasná komunikácia ceny a ďalšieho kroku. |
| **P7** | **MVDr. Anna Rusnáková**, 44, prevádzková manažérka | `admin` | Reporting, KVEPIS, mzdy, HR, roly, dohľad nad compliance, komunikácia s poisťovňami. | Chce čísla, ktorým verí, a dôkazy, ktoré prežijú kontrolu ŠVPS. Frustrácia: Excel mimo systému. |

Roly v kóde: `admin | veterinarian | technician | front_desk | viewer` (`apps/web/server/trpc.ts`), plus `service_agent` pre API bežania.

---

## 4. Referenčný model kliniky (základ pre všetky business cases)

Všetky čísla v business cases vychádzajú z jedného modelu, aby boli vzájomne konzistentné a kontrolovateľné.
Model je **typická slovenská klinika** (nie pilotná solo ambulancia):

| Parameter | Hodnota | Poznámka |
|---|---|---|
| Lekári | 3 MVDr. (2,5 FTE efektívne) | 1 konateľ + 2 zamestnanci |
| Technici / asistenti | 2 | odbery, RTG, hospitalizácia, sklad |
| Recepcia | 2 osoby / 1,5 FTE | pokrytie 8:00–18:00 |
| Pacienti / deň | 42 | 30 konzultácií, 8 preventívnych, 4 procedúry/chirurgia |
| Pracovné dni / mesiac | 21,5 | vrátane 2 sobôt z 3 |
| Návštevy / mesiac | ~900 | 42 × 21,5 |
| Priemerný účet | 46 € | mix konzultácia 35 € + preventíva + zákroky |
| Obrat / mesiac | ~41 400 € | ~497 000 €/rok |
| Ordinačné hodiny | 8:00–18:00, urgent do 21:00 | 1 lekár na pohotovosti |

### 4.1 Nákladové sadzby (použité v ROI výpočtoch)

| Rola | Hrubá mzda | Náklad zamestnávateľa (~1,35×) | Náklad / hodina (168 h) | **Náklad / minúta** |
|---|---|---|---|---|
| Veterinárny lekár | 2 200 € | ~2 970 € | 17,68 € | **0,30 €** |
| Veterinárny technik | 1 250 € | ~1 690 € | 10,06 € | **0,17 €** |
| Recepcia | 1 050 € | ~1 420 € | 8,45 € | **0,15 €** |

**Ročný fond:** 252 pracovných dní × 8 h = 2 016 h/rok na úväzok.

### 4.2 Pricing tiery (podľa `README.md`; pozor na R-01 v §7)

| Tier | Cena | Cieľová klinika | Ročný náklad |
|---|---|---|---|
| **Self-hosted** | 0 € | Technicky zdatná ambulancia s vlastným HW | 0 € + ~1 200 €/rok infraštruktúra a údržba |
| **Cloud Solo** | 49 €/mes (490 €/rok) | 1 lekár, malá ambulancia | 588 €/rok |
| **Cloud Klinika** | 119 €/mes (1 190 €/rok) | 2–6 lekárov | 1 428 €/rok |
| **Cloud Nemocnica** | 229 €/mes (2 290 €/rok) | 24/7, viac pobočiek | 2 748 €/rok |

> **Poznámka k výpočtu:** „Ročný náklad“ = 12 × mesačný poplatok (49 → 588 €, 119 → 1 428 €, 229 → 2 748 €). Repozitárový `README.md` uvádza aj zvýhodnenú ročnú platbu vopred (490 / 1 190 / 2 290 €); BC tabuľky preto počítajú konzervatívne s 12× mesačným poplatkom. Rozdiel medzi marketingovým cenníkom a modelom v kóde je evidovaný ako riziko **R-01** (§7).

---

## 5. Register journeys (J1–J30, J-NEW-1…3)

### Skupina 1 — Klinická & pacientska práca (T1–T3) → [`01-klinicka-praca.md`](01-klinicka-praca.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J1 | Hľadanie pacienta / majiteľa | T1 | všetci staff | UC-101 |
| J2 | Klinická karta a hlasové diktovanie (SOAP draft) | T1 | veterinarian | UC-102 |
| J3 | Nový SOAP z encounteru (manuálne / AI draft / finalizácia) | T1 | veterinarian | UC-103 |
| J4 | Anamnéza, história a dokumenty pacienta | T2 | veterinarian, technician | UC-104 |
| J5 | Clinical Guardian — interakcie, dávkovanie, toxicita | T2 | veterinarian, technician | UC-105 |
| J6 | Nový klient + nový pacient (Duplicate Shield) | T3 | front_desk | UC-106 |

### Skupina 2 — Recepcia & rozvrh (T1–T3) → [`02-recepcia-rozvrh.md`](02-recepcia-rozvrh.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J7 | Nová návšteva / objednanie termínu (interné + online) | T1 | front_desk, klient | UC-107 |
| J8 | Check-in, čakáreň a whiteboard | T2 | front_desk, technician | UC-108 |
| J9 | Zmena, zrušenie a presun termínu + pripomienky | T3 | front_desk | UC-109 |

### Skupina 3 — Farmácia & fakturácia (T2) → [`03-farmaka-faktura.md`](03-farmaka-faktura.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J10 | Predpis, výdaj lieku a účtovanie liečiva | T2 | veterinarian, technician | UC-110 |
| J11 | Faktúra, platba a e-Kasa doklad | T2 | front_desk | UC-111 |
| J12 | Uzavretie návštevy a odovzdanie klientovi (closeout) | T2 | front_desk, veterinarian | UC-112 |

### Skupina 4 — Preventívna starostlivosť (T3–T4) → [`04-preventiva.md`](04-preventiva.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J13 | Očkovanie a hlásenie besnoty | T3 | veterinarian, technician | UC-113 |
| J14 | Recall a revakcinácia (kampane a pripomienky) | T4 | front_desk | UC-114 |
| J15 | Wellness plán a kontrolná návšteva | T4 | front_desk, veterinarian | UC-115 |

### Skupina 5 — Lab & zobrazovanie (T4) → [`05-lab-zobrazovanie.md`](05-lab-zobrazovanie.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J16 | Príjem, validácia a interpretácia lab. výsledkov | T4 | technician, veterinarian | UC-116 |
| J17 | Zobrazovacie vyšetrenie (RTG, VHS) a AI nález | T4 | veterinarian | UC-117 |

### Skupina 6 — Marketing (T4) → [`06-marketing.md`](06-marketing.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J18 | Tvorba a schválenie obsahu (content queue) | T4 | front_desk, admin | UC-118 |
| J19 | Kampaň, segmentácia a reputácia (recenzie, recall kampaň) | T4 | admin, veterinarian | UC-119 |

### Skupina 7 — Nové klinické journeys (dnes v kóde neexistujú ako modul) → [`07-nemocnica-a-urgent.md`](07-nemocnica-a-urgent.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J20 | Hospitalizácia (príjem → denné záznamy → prepustenie) | T2 (multi-day) | veterinarian, technician | UC-120 |
| J21 | Chirurgia a anestézia (plán → zákrok → pooperačná starostlivosť) | T3 | veterinarian, technician | UC-121 |
| J22 | Urgentný príjem a triáž (mimo ordinačných hodín) | T3 | veterinarian, front_desk | UC-122 |
| J23 | Telemedicína a vzdialený follow-up | T4 | veterinarian, klient | UC-123 |

### Skupina 8 — Prevádzka & back office → [`08-sklad-reporting-admin.md`](08-sklad-reporting-admin.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J24 | Sklad, inventúra a objednávanie (supply chain, exspirácie) | T4 | technician, admin | UC-124 |
| J25 | Reporting a mesačná uzávierka (výkonnosť, financie, compliance) | T4 | admin | UC-125 |
| J26 | Admin: používatelia, roly, klinika, pobočky (multi-clinic) | T4 | admin | UC-126 |

### Skupina 9 — Klientský portál, compliance, onboarding → [`09-portal-compliance-onboarding.md`](09-portal-compliance-onboarding.md)

| J | Názov | Tier | Primárny aktér | UC |
|---|---|---|---|---|
| J27 | Klientsky portál — celý deň majiteľa zvieraťa | T3 | klient (majiteľ) | UC-127 |
| J28 | Legislatívny cyklus (KVEPIS, CRSZ, OPL, e-Kasa, CEHZ) | T4 | admin, veterinarian | UC-128 |
| J29 | Eutanázia, strata pacienta a sympathy gate | T4 | veterinarian | UC-129 |
| J30 | Kontrola ŠVPS / audit a export dôkazov | T4 | admin | UC-130 |
| J-NEW-1 | Prvý deň s OpenVPM AI (setup wizard) | jednorazovo | admin | UC-131 |
| J-NEW-2 | Migrácia dát z konkurenčného systému | jednorazovo | admin, technician | UC-132 |
| J-NEW-3 | Prvý mesiac — od neistoty po „nemôžem bez toho žiť“ | jednorazovo | celá klinika | UC-133 |

### Skupina 10 — Prierezové vzory → [`10-ai-value-chain-a-multi-actor.md`](10-ai-value-chain-a-multi-actor.md)

| Oblasť | Obsah |
|---|---|
| AI Value Chain | Vstup → Spracovanie → Výstup → Human Review → Finalizácia pre 5 AI povrchov (voice, guardian, imaging, recalls, marketing) |
| AI chybové scenáre | Falošný pozitív, falošný negatív, nedostupnosť modelu — s konkrétnym UX správaním |
| Trust-building curve | Od skeptika (deň 1) po power usera (mesiac 3) — 5 fáz s odblokovaním funkcií |
| Legislatíva ako journey | Ako sa zákonná povinnosť stane neviditeľnou (auto-hlásenie, zero-prefill, immutable ledger) |
| Multi-actor journeys | 4 end-to-end sekvencie s handoffmi medzi rolami |
| Register KPI a instrumentácia | Čo merať, kde v kóde, aká je baseline a cieľ |

---

## 6. Sumárny prehľad business case-ov

| BC | Skupina | Konzervatívna ročná hodnota pre referenčný model | Návratnosť tieru Klinika (1 428 €/rok) |
|---|---|---|---|
| BC-1 | Klinická práca | 21 800 € | 24 dní |
| BC-2 | Recepcia & rozvrh | 13 400 € | 39 dní |
| BC-3 | Farmácia & fakturácia | 15 600 € | 33 dní |
| BC-4 | Preventívna starostlivosť | 9 200 € | 57 dní |
| BC-5 | Lab & zobrazovanie | 7 400 € | 71 dní |
| BC-6 | Marketing & reputácia | 6 100 € | 86 dní |
| BC-7 | Nemocnica (hospitalizácia, chirurgia, urgent, telemedicína) | 18 700 € | 28 dní |
| BC-8 | Prevádzka & back office | 11 300 € | 46 dní |
| BC-9 | Klientsky portál & onboarding | 12 900 € | 41 dní |

> **Poznámka k metodike ROI.** Hodnoty **nie sú aditívne**. Ide o hodnotu celej skupiny journeys pri
> plnom nasadení; viaceré úspory sa týkajú tej istej minúty pracovníka (napr. čas ušetrený diktovaním
> a čas ušetrený closeoutom čiastočne kolidujú). Aditívny súčet by bol marketing, nie analýza.
> Konzervatívny **kombinovaný odhad** pre referenčný model je **54 000–68 000 €/rok** (viď §6.1).

### 6.1 Kombinovaná ROI pre referenčný model

| Tier | Ročný náklad | Konzervatívna hodnota | Konzervatívne ROI | Payback |
|---|---|---|---|---|
| Self-hosted | ~1 200 € (infra + 0,5 h/týždeň IT) | 54 000 € | 45× | 9 dní |
| Cloud Solo | 588 € | 19 000 € (1 lekár) | 32× | 12 dní |
| Cloud Klinika | 1 428 € | 54 000 € | 38× | 10 dní |
| Cloud Nemocnica | 2 748 € | 68 000 € (3 pobočky, 24/7) | 25× | 15 dní |

Detailné odvodenie každej položky je v príslušnom BC; tu je len súčet konzervatívnych (nie maximálnych) scenárov.

---

## 7. Register otvorených otázok a rizík pre product discovery

Tieto body **nie sú** kritika kvality kódu — sú to rozhodnutia, ktoré musí product owner spraviť pred go-live.
Číslovanie R-xx je referencovateľné z Jira ticketov.

| ID | Zistenie | Dopad na journeys | Odporúčanie |
|---|---|---|---|
| **R-01** | **Cenník v README (49/119/229 €) nezodpovedá modelu v kóde** — `apps/web/lib/billing/plans.ts` + `lib/billing/catalog.ts` definujú **jediný flat tier 79 USD/mesiac za aktívnu lokalitu, neobmedzený počet zamestnancov**, s AI/SMS metered overage (0,05 USD/AI run, 0,03 USD/SMS). | Všetky BC počítajú s tier-mi z README; uzávierka closeout fakturácie môže zákazníkovi ukázať inú cenu, než akú videl v marketingu. | Zjednotiť zdroj pravdy: buď SK tiery (Solo/Klinika/Nemocnica) pretaviť do `plans.ts` ako `cloud_sk_solo/klinika/nemocnica`, alebo README prepísať na flat model. Do rozhodnutia držať ROI citlivé na oba modely (v BC je uvedené oboje). |
| **R-02** | **Hospitalizácia, chirurgia, urgent, telemedicína nemajú v kóde ani router, ani obrazovku.** Existujú len časti: `visit_closeouts`, `whiteboard`, `postop/[id]`, `vitals.recordVitalSigns`, `treatment_plans`. | Priamy dôvod, prečo klinika s hospitalizáciou **nemôže** prejsť na OpenVPM dnes (BC-7). | J20–J23 sú špecifikované ako nové moduly v `07-nemocnica-a-urgent.md`; odporúčaná roadmapa: hospitalizácia (v0.7) → chirurgia/anestézia (v0.8) → urgent/triáž (v0.9) → telemedicína (v1.0). |
| **R-03** | **Provenance medzera pri najpoužívanejšom AI povrchu.** `ai.draftSoapNote` a `imaging.injectFindingsIntoSoap` zapisujú text do draftu, ale pri finalizácii sa AI pôvod nezapíše do `ext_ai_audit_log` (audit F-04-1). | J2, J3, J17, J30 — dôkazový reťazec pre kontrolu a pre súd. | Doplniť `aiProvenance` marker na `soap_notes` + povinné `appendAiAuditEvent` pri finalizácii draftu, ktorý niesol AI text (návrh v J3 a J30). |
| **R-04** | **Falošné confidence skóre pri lab importe.** `lab-import.ts` počíta „94 %“ z počtu nájdených riadkov, binárne PDF sa číta ako UTF-8 (audit F-07-1). | J16 — lekár dostane falošný signál istoty v HITL bráne. | Nahradiť heuristiku poctivým stavom: „počet nájdených riadkov“ + „0 výsledkov = možná chyba formátu“, alebo nasadiť reálny OCR model s mierou neistoty. |
| **R-05** | **KVEPIS je XML-only, priame B2G podanie neexistuje** (ROADMAP v0.7, `docs/help/sk/statutory-compliance.md`). | J28 — compliance zostáva manuálnym krokom; business case nesmie rátať s „nulovou prácou“. | V BC-4/BC-9 rátať s 6 min/mesiac namiesto 0; komunikovať zákazníkovi presne. |
| **R-06** | **e-Kasa: `EKASA_FISCALIZATION_ENABLED` je default false**, formálna certifikácia integrácie neprebehla (R-P0-001 v `RISK_REGISTER.md`). | J11 — klinika nesmie dostať dojem, že doklad je fiškálne platný, kým platí default. | V UI a onboardingu zobraziť stav certifikácie; pokladnicu bez zapnutého drivera označiť ako „cvičný režim“. |
| **R-07** | **Data residency nie je v UI** a `MODEL_CARDS.md` deklaruje EÚ regióny, ktoré kód nemusí použiť (audit F-17-4). | J26 (admin), J28, J30 — GDPR čl. 28/30. | Doplniť panel „Kde tečú dáta“ do `Settings → AI` s reálnym providerom a regiónom. |
| **R-08** | **Multi-location: schéma podporuje viac pobočiek, UI je v0.6 jednolokačné** (`ROADMAP.md`, bod 6). | J26 — skupinová klinika nemôže konsolidovať reporting. | Nedávať „viac pobočiek“ do marketingu Nemocnica tieru, kým nie je hotové prepínanie kontextu pobočky (návrh v J26). |
| **R-09** | **Import dodacích listov nemá UI** (wholesaler import je hotový v `lib/inventory/wholesaler-import.ts`, UI plánované v0.7). | J24 — technik dnes prepisuje ručne, hoci parser existuje. | Najlacnejšia roadmapa s najvyšším dopadom: napojiť existujúci parser na `/inventory` (J24, krok 4). |
| **R-10** | **`agent.run` s `create_prescription` obchádza screening kontrolovaných látok** (audit F-18-1). | J10, J28 — riziko zákona 139/1998. | Do vydania opravy: `agent:write` scope nepovoliť na preskripcie kontrolovaných látok; UI musí varovať. |
| **R-11** | **`ai.patientsNeedingFollowUp` nemá UI** (jediné použitie je v `/api-docs/ai`). | J15, J23 — follow-up kanály sú dnes slepá ulička. | Pridať kartu „Follow-up na dnes“ na dashboard (návrh v J15). |

---

## 8. Súvisiace dokumenty

- [`01-klinicka-praca.md`](01-klinicka-praca.md) — J1–J6 + BC-1
- [`02-recepcia-rozvrh.md`](02-recepcia-rozvrh.md) — J7–J9 + BC-2
- [`03-farmaka-faktura.md`](03-farmaka-faktura.md) — J10–J12 + BC-3
- [`04-preventiva.md`](04-preventiva.md) — J13–J15 + BC-4
- [`05-lab-zobrazovanie.md`](05-lab-zobrazovanie.md) — J16–J17 + BC-5
- [`06-marketing.md`](06-marketing.md) — J18–J19 + BC-6
- [`07-nemocnica-a-urgent.md`](07-nemocnica-a-urgent.md) — J20–J23 + BC-7
- [`08-sklad-reporting-admin.md`](08-sklad-reporting-admin.md) — J24–J26 + BC-8
- [`09-portal-compliance-onboarding.md`](09-portal-compliance-onboarding.md) — J27–J30, J-NEW-1…3 + BC-9
- [`10-ai-value-chain-a-multi-actor.md`](10-ai-value-chain-a-multi-actor.md) — AI value chain, multi-actor, KPI

Nadväzujúce existujúce dokumenty: [`docs/audit/2026-09-ai-ux-audit.md`](../../audit/2026-09-ai-ux-audit.md),
[`docs/clinic-pilot-workflow.md`](../../clinic-pilot-workflow.md),
[`docs/slovak-integration-catalog.md`](../../slovak-integration-catalog.md),
[`docs/authorization-matrix.md`](../../authorization-matrix.md),
[`docs/migrating-to-openvpm.md`](../../migrating-to-openvpm.md).
