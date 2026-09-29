# OpenVPM AI — Product Discovery: User Journeys, Use Cases & Business Cases

> **Verzia:** 1.0 · **Stav:** PILOT-READY (v0.6) · **Dátum:** 2026-09-21
> **Jazyk dokumentu:** slovenčina (odborné termíny v angličtine podľa zavedených zvyklostí SK vet praxe)

---

## Účel a cieľové publikum

Tento dokument je **hĺbková product-discovery analýza** veterinárneho informačného systému OpenVPM AI. Každý journey, use case a business case je napísaný tak, aby:

1. **Designer** vedel nakresliť wireframe bez ďalších otázok
2. **Developer** vedel napísať Jira ticket s acceptance criteria
3. **Investor** pochopil business value aj bez technického backgroundu
4. **Veterinár** povedal „áno, presne takto to robíme / chceme robiť“

---

## Metóda a evidenčná základňa

Analýza vychádza z auditovaného zdrojového kódu repozitára OpenVPM AI:

- **21 extension schém** (ext_*.ts): voice, clinical_guardian, discharge, imaging, dental, lab_import, ekasa, kvepis, crsz, statutory, marketing, marketing_website, automation, content_calendar, crm, channel_accounts, ai_settings, ai_audit_log, confirmations, support
- **31 extension routerov** (tRPC): voice, clinical-guardian, discharge, imaging, dental, lab-import, ekasa, kvepis, crsz, statutory, marketing, automation-*, crm-segments, insurance, accounting, reconciliation, wholesaler-import, duplicate-shield, audit-export, support, ai-settings, v2-import
- **Legislatívne moduly:** KVEPIS (Zákon 39/2007), CRSZ (ISO 11784/11785), CEHZ, e-Kasa (Zákon 289/2008), OPL (Zákon 139/1998), GDPR
- **4 858 automatizovaných testov** (100 % pass rate), 114 klinických AI eval scenárov
- **Gap analýza:** C-01 anestézia chýba, C-02 ICU/flowsheet chýba, C-03 chirurgia periop chýba, C-04 triáž chýba, C-06 DICOM čiastočný

---

## Persóny

| ID | Meno | Rola | Profil |
|-----|------|------|--------|
| **P1** | MVDr. Kováčová | admin + veterinarian | Majiteľka kliniky, 15 r. praxe, 2–4 lekári, rozhoduje o nákupoch. Chce efektivitu a legislatívnu bezpečnosť. |
| **P2** | MVDr. Hruška | veterinarian | Mladý lekár, 2 r. praxe, tech-savvy, rád diktuje, dôveruje AI ak vidí dôkaz. |
| **P3** | Zuzana | front_desk | Recepčná, nemá vet vzdelanie, obslúži 40–60 telefónátov/deň, booking + check-in + faktúrácia. |
| **P4** | Peter | technician | Vet technik, 5 r. praxe, meria vitálne, pripravuje pacientov, asistuje pri zákrokoch. |
| **P5** | Ing. Kováč | admin | Manžel majiteľky, stará sa o financie, štatistiky, e-Kasa uzávierky, marketing. |
| **P6** | Mária Nováková | — (portál) | Majiteľka 2 psov, používa klientsky portál, chce online booking a digitálny očkovací preukaz. |

---

## Inventár journeys J1–J30

> **Poznámka:** V repozitári neexistuje kanonický súbor s číslovaním J1–J19. Číslovanie nižšie je rekonštrukcia z frekvenčného rankingu a skupín zo zadania.

### Existujúce journeys (J1–J19)

| Sk. | J# | Názov | Primárna persóna | Tier | Frekvencia |
|-----|----|-------|-------------------|------|------------|
| 1 — Klinická | J1 | Vyhľadanie pacienta/majiteľa (Cmd+K) | P2, P3 | 1 | Každé 2 min |
| | J2 | Otvorenie klinickej karty pacienta | P2 | 1 | Každú hodinu |
| | J3 | Nový SOAP záznam (whiteboard → encounter) | P2 | 1 | Každú hodinu |
| | J4 | Hlasové diktovanie → SOAP | P2 | 1 | Každú hodinu |
| | J5 | Predpis lieku + Clinical Guardian kontrola | P2 | 2 | Každý encounter |
| | J6 | Prepúšťacia správa / discharge + follow-up | P2 | 2 | Každý encounter |
| 2 — Recepcia | J7 | Nová návšteva / booking | P3 | 1 | Každú hodinu |
| | J8 | Check-in + whiteboard tok | P3 | 2 | Denne |
| | J9 | Registrácia nového klienta a pacienta | P3 | 3 | Niekoľko denne |
| 3 — Farmácia | J10 | Výdaj liečiva zo skladu | P4, P2 | 2 | Každý encounter |
| | J11 | Vytvorenie faktúry a uzavretie návštevy | P3, P2 | 2 | Každý encounter |
| | J12 | Platba + e-Kasa doklad | P3 | 2 | Každý encounter |
| 4 — Preventíva | J13 | Očkovanie + vakcinačný certifikát | P2, P4 | 4 | Týždenne |
| | J14 | Recall / pripomienka revakcinácie | P3, P5 | 4 | Týždenne |
| | J15 | Wellness plán a membership | P2, P3 | 4 | Týždenne |
| 5 — Lab | J16 | Import lab výsledkov a review | P2 | 4 | Podľa potreby |
| | J17 | Zobrazovacie vyšetrenie + AI analýza VHS | P2 | 4 | Podľa potreby |
| 6 — Marketing | J18 | AI content calendar a sociálne posty | P5, P3 | 4 | Týždenne |
| | J19 | Recenzie, reputácia a CRM automatizácie | P5, P3 | 4 | Týždenne |

### Nové journeys (J20–J30)

| Sk. | J# | Názov | Primárna persóna | Stav v v0.6 |
|-----|----|-------|-------------------|-------------|
| 7 — Hospitalizácia | J20 | Hospitalizácia: príjem → denné záznamy → prepustenie | P2, P4 | Gap C-02 |
| 8 — Chirurgia | J21 | Chirurgia: plánovanie → anestézia → zákrok → pooperačná starostlivosť | P2, P4 | Gap C-01, C-03 |
| 9 — Urgentná | J22 | Urgentný príjem a triáž | P2, P3 | Gap C-04 |
| 10 — Telemed | J23 | Telemedicína / vzdialená konzultácia | P2, P6 | Čiastočný |
| 11 — Inventúra | J24 | Inventúra, objednávanie, expirácie | P4, P5 | Základný |
| 12 — Reporting | J25 | Mesačné štatistiky a finančné prehľady | P1, P5 | Základný |
| 13 — Admin | J26 | Správa používateľov, rolí, multi-clinic | P1 | Čiastočný |
| 14 — Portál | J27 | Klientsky portál: end-to-end journey majiteľa | P6 | Funkčný |
| 15 — Onboarding | J28 | Prvý deň: setup wizard | P1 | Funkčný |
| | J29 | Migrácia dát z konkurenčného systému | P1, P5 | Funkčný |
| | J30 | Prvý mesiac: od neistoty po adoptíu | P1, P2 | Procesný |

---

## Stavové stroje z produkčného kódu

| Entita | Stavy |
|--------|-------|
| Appointment | scheduled → confirmed → checked_in → in_exam → checked_out · no_show · cancelled |
| Visit closeout | draft → clinical_finalized → completed |
| SOAP | draft → finalized (s confirmedContentHash, finalizedBy) |
| e-Kasa receipt | STANDARD · STORNO · RETURN · DEPOSIT · WITHDRAWAL |
| KVEPIS submission | DRAFT → VALIDATED → SIGNED → SUBMITTED → ACKNOWLEDGED · REJECTED |
| Lab result | flags: unknown · normal · abnormal · critical |
| Controlled substance | received · administered · wasted · returned (svedok povinný pre administered/wasted) |
| Voice session | upload → formatTextToSoap → extractBillableItems → prepareConfirmation → clinicianConfirmed |
| Imaging analysis | draft → klinician confirmAnalysis (s hash) |
| Care reminder | open → completed · dismissed |
| Wellness enrollment | active · cancelled |
| Portal appointment | booking → scheduled (recepcia potvrdí) |

---

## Legislatívne referencie

| Skratka | Plný názov |
|---------|------------|
| **Z39** | Zákon č. 39/2007 Z. z. o veterinárnej starostlivosti |
| **Z139** | Zákon č. 139/1998 Z. z. o omamných a psychotropných látkach |
| **Z289** | Zákon č. 289/2008 Z. z. o e-Kasa (§10 — 48h lehota) |
| **Z362** | Zákon č. 362/2011 Z. z. o liekoch |
| **Z576** | Zákon č. 576/2004 Z. z. o zdravotnej starostlivosti |
| **GDPR** | Nariadenie EÚ 2016/679 o ochrane osobných údajov |

---

## Use Case číslovanie

| Skupina | Rozsah UC | Journeys |
|---------|-----------|----------|
| Klinická | UC-101 – UC-106 | J1–J6 |
| Recepcia | UC-201 – UC-203 | J7–J9 |
| Farmácia & faktúrácia | UC-301 – UC-303 | J10–J12 |
| Preventíva | UC-401 – UC-403 | J13–J15 |
| Lab & zobrazovanie | UC-501 – UC-502 | J16–J17 |
| Marketing | UC-601 – UC-602 | J18–J19 |
| Nové journeys | UC-701 – UC-711 | J20–J30 |

---

## Štruktúra dokumentov

| Súbor | Obsah |
|-------|-------|
| [01-clinical-journeys.md](01-clinical-journeys.md) | J1–J6 + Business Case: Klinická práca |
| [02-frontdesk-journeys.md](02-frontdesk-journeys.md) | J7–J9 + Business Case: Recepcia |
| [03-pharmacy-billing-journeys.md](03-pharmacy-billing-journeys.md) | J10–J12 + Business Case: Farmácia & faktúrácia |
| [04-preventive-journeys.md](04-preventive-journeys.md) | J13–J15 + Business Case: Preventíva |
| [05-lab-imaging-journeys.md](05-lab-imaging-journeys.md) | J16–J17 + Business Case: Lab & zobrazovanie |
| [06-marketing-journeys.md](06-marketing-journeys.md) | J18–J19 + Business Case: Marketing |
| [07-new-journeys.md](07-new-journeys.md) | J20–J30 + Business Cases |
| [08-ai-value-chain.md](08-ai-value-chain.md) | AI value chain, trust-building, compliance journeys |
| [09-multi-actor-journeys.md](09-multi-actor-journeys.md) | Multi-actor scénare |
| [10-portal-journeys.md](10-portal-journeys.md) | Klientsky portál z perspektívy majiteľa |
| [11-kpi-roadmap.md](11-kpi-roadmap.md) | KPI framework, ROI model, roadmap mapping |