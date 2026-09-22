# OpenVPM AI — Špecifikácia v0.7: User Journeys, Use Cases, Business Cases

**Verzia dokumentu:** 1.0.0
**Dátum:** 2026-09-21
**Baseline kódu:** `0c4f21c` (`main`, v0.6 PILOT-READY)
**Rozsah:** Sekcia 1 (J1–J19 + 9 GAP/EXTRA tokov) · Sekcia 2 (7 medzier, detailne C-02/C-03/C-04) · Sekcia 3 (33 Use Cases) · Sekcia 4 (9 Business Cases + ROI model)
**Pilotná klinika:** Veterinárna ambulancia MVDr. Martin Sýkora
**Jazyk:** slovenský; technické termíny v angličtine tam, kde sú v SK veterinárnej a IT praxi zavedené (SOAP, encounter, whiteboard, check-in, closeout, dispense, recall)

---

## 0. Pre koho je tento dokument

| Čitateľ | Čo z dokumentu použije |
|---|---|
| **Product owner / konateľ** | Sekcia 4 (ROI, payback, prioritizácia v0.7), Sekcia 2 (prečo sú medzery blokujúce) |
| **Architekt / tech lead** | Sekcia 2 (Drizzle schémy, tRPC kontrakty, zámky, RLS), Sekcia 1 (backend kontrakty tokov) |
| **Developer** | Sekcia 3 (Use Cases s Given-When-Then = akceptačné kritériá ticketov) |
| **UX dizajnér** | Sekcia 1 (kroky, modaly, klávesové skratky, unhappy path), Sekcia 2 (UI koncepty) |
| **Klinický garant / MVDr.** | Sekcia 1 (legislatívne checkpointy), Sekcia 2 (medicínske riziká absencie modulov) |
| **Auditor / compliance** | Traceability matica (§3), legislatívne checkpointy, `_generated/financial-model.md` §K |

**Vzťah k existujúcej dokumentácii.** Tento dokument je *špecifikáciou* (čo sa má postaviť a ako sa to overí).
Nahrádza product-discovery vrstvu [`docs/product/journeys/`](../journeys/README.md), ktorá je *objavovacou* vrstvou
(persóny, emócie, alternatívne toky). Odkazy na ňu sú uvedené pri každom journey. Kde sa tieto dva dokumenty
líšia v číslach, platí **tento** dokument (používa referenčný model 45 pacientov/deň a pásmo sadzieb 25–35 €/h).

---

## 1. Metodika — dôkazová základňa

Každé tvrdenie o *existujúcom* správaní systému je overené v kóde tohto repozitára. Tvrdnutia o *budúcom*
stave (v0.7) sú označené `NÁVRH`. Neoveriteľné predpoklady sú označené `UNVERIFIED` alebo `MODEL`.

| Zdroj | Čo z neho špecifikácia čerpá |
|---|---|
| `apps/web/app/(dashboard)/**/page.tsx` | reálne routy (61 dashboard rout — viď §3) |
| `apps/web/server/routers/**` | reálne tRPC procedúry, `requireRole`, `requireFeature` |
| `packages/db/schema/**` | 158+ tabuliek, enumy, indexy, unikátne obmedzenia |
| `packages/db/rls/enable-rls.sql` | RLS politiky (`tenant_isolation`, `system_only`, `system_read/insert`, `reference_read`) |
| `apps/web/lib/**` | biznis logika: `scheduling/location.ts`, `ai/clinical-guardian.ts`, `ai/draft-safety.ts`, `controlled-substances/policy.ts`, `autopilot/consent-gate.ts`, `ekasa/service.ts`, `inventory/*` |
| `docs/confirmation-protocol.md` | HITL: dvojfázové `prepareConfirmation` → `confirm*` s envelope (TTL 900 s) |
| `docs/audit/2026-09-ai-ux-audit.md` | inventár 20 AI povrchov A01–A20 s `súbor:riadok` |
| `docs/slovak-integration-catalog.md`, `ROADMAP.md` | integrácie, známy technický dlh, cenník |
| `scripts/spec-v07-financial-model.py` | **jediný zdroj všetkých čísel** v Sekcii 1 (úspory času) a Sekcii 4 (ROI) |

### 1.1 Pravidlá pre čísla

1. **Všetky finančné a časové čísla sú generované** skriptom `scripts/spec-v07-financial-model.py`
   do [`_generated/financial-model.md`](_generated/financial-model.md). Ručne sa nesmú prepisovať.
   Zmena predpokladu = zmena v skripte + regenerácia.
2. **Kapacitná hodnota ≠ cash.** Ušetrená hodina lekára je mzdový ekvivalent, nie úspora v pokladnici,
   kým sa nekonvertuje (ďalší pacienti, zníženie FTE, menej nadčasov). ROI sa preto vykazuje v dvoch líniách.
3. **Realizačný faktor** (rok 1: 55 %, steady-state: 80 %) pokrýva learning curve a výnimky.
4. **Atribúcia systému** (35–70 %) oddeľuje efekt systému od trhu, sezóny a personálneho výkonu.
5. **Žiadne dvojité započítanie.** Každý ledger riadok (L01–L36) má práve jeden business case.

### 1.2 Šablóna journey (Sekcia 1)

Každý journey má 8 povinných polí:

```
1. Kód, názov, frekvenčný tier, stav auditu (PASS 200 OK / GAP 404)
2. Aktér (primárny + sekundárni; rola z `userRoleEnum`)
3. Trigger a vstupné predpoklady (pre-conditions)
4. Scenár krok-za-krokom — happy path + výnimky (unhappy path)
5. Interakcia s UI (routa, klávesové skratky, modaly, komponenty)
6. Backend a dátový kontrakt (Drizzle tabuľky, tRPC procedúry, zámky, idempotencia)
7. Legislatívny a bezpečnostný checkpoint (39/2007, 139/1998, 289/2008, GDPR, RLS, HITL)
8. Merateľná úspora času (baseline → OpenVPM AI; odkaz na ledger riadok)
```

---

## 2. Referenčný model kliniky (vstup pre všetky business cases)

| Parameter | Hodnota | Odvodenie |
|---|---|---|
| Lekári | 3 MVDr. | zadanie; 1 konateľ + 2 zamestnanci |
| Technici / asistenti | 2 | odbery, RTG, hospitalizácia, sklad |
| Recepcia | 1,5 FTE | pokrytie 8:00–18:00 |
| Admin / manažérka | 1 FTE | reporting, legislatíva, marketing |
| **Pacienti / deň** | **45** | 32 konzultácií + 8 preventívnych + 5 procedúr |
| Pracovné dni / mesiac | 21,5 | vrátane 2 sobôt z 3 |
| **Návštevy / mesiac** | **968** | 45 × 21,5 |
| Priemerný účet | 58,36 € | vážený mix 38 / 45 / 210 € |
| Obrat / mesiac | 56 459 € | denne 2 626 € |
| Obrat / rok | 677 508 € | — |
| Aktívna kmeňová báza | ~4 465 pacientov | 968 × 12 / 2,6 návštevy/rok |
| Kapacita personálu | 1 260 h/mes. | 7,5 FTE × 168 h |

**Hodinové sadzby** (zadané pásmo 25–35 €/h; horná hranica pre lekára, spodná pre recepciu):

| Rola | Sadzba | Zdroj pásma |
|---|---|---|
| MVDr. veterinárny lekár | **35 €/h** | horná hranica zadania (špecializovaná klinická práca) |
| Veterinárny technik / asistent | **28 €/h** | stred pásma |
| Recepcia | **25 €/h** | spodná hranica zadania |
| Admin / prevádzkový manažér | **30 €/h** | stred pásma |
| Blended (pre interné náklady) | 29 €/h | — |

**Náklady na OpenVPM AI** (cenník podľa `README.md`):

| Scenár | €/mesiac | Kedy |
|---|---|---|
| Cloud Nemocnica | **229 €** | referenčná klinika: AI objem ~1 050 udalostí/mes. presahuje limit 500 v tieri Klinika |
| Cloud Klinika + AI overage | 394 € | ak klinika trvá na tieri Klinika; overage je meterovaný cez `STRIPE_PRICE_AI_OVERAGE` |
| Self-hosted (AGPLv3) + BYO AI kľúč | 359 € | infraštruktúra 100 € + AI 189 € + 2 h IT času |
| Jednorazová investícia | **3 138 €** | migrácia a školenie 1 200 € + hardvér 720 € + interný čas 42 h |

---

## 3. Traceability matica auditu v0.6 → kód repozitára

Audit definoval **19 tokov PASS 200 OK**, **7 medzier GAP 404** a **2 nové toky EXTRA 200 OK**.
Tabuľka mapuje každú položku na reálnu routu, router a tabuľky. **Kľúčové zistenie:** `GAP 404`
znamená „neexistuje routa“, nie automaticky „neexistuje funkcionalita“ — pri 4 zo 7 medzier backend
existuje a chýba len UI alebo chýba posledný krok integrácie (stĺpec *Skutočný stav*).

### 3.1 PASS toky (J1–J19)

| Audit | Journey | Routa | tRPC router | Kľúčové tabuľky | Overené v kóde |
|---|---|---|---|---|---|
| P-01 | J1 Rýchle vyhľadávanie (F1 / Cmd+K) | globálny overlay + `/patients`, `/clients` | `patients.search`, `clients.search`, `records.searchPatientHistory` | `patients`, `clients`, `microchip_registrations`, `invoices` | `components/common/command-search.tsx:313,846` |
| P-02 | J2 Klinická karta | `/patients/[id]` | `patients.getById`, `vitals.listByPatient`, `records.listPrescriptions` | `patients`, `patient_weights`, `patient_allergies`, `vital_signs` | ✅ |
| P-03 | J3 Hlasový AI Scribe (Whisper) | `/agent/voice` | `extensions.voice.uploadAndProcess/process/formatTextToSoap/prepareConfirmation/saveAsSoapNote` | `voice_dictations`, `soap_notes`, `ext_clinician_confirmations`, `ext_ai_audit_log` | `routers/extensions/voice.ts:59–891` |
| P-04 | J3 SOAP z encounteru | `/records/new-soap/[patientId]`, `/encounters/[appointmentId]` | `records.getSoapDraft/saveSoapDraft/finalizeSoapNote/discardSoapDraft/addSoapNoteAddendum` | `soap_notes`, `soap_note_addenda`, `soap_note_replacements` | ✅ |
| P-05 | J4 Anamnéza a história | `/records`, `/patients/[id]` | `records.searchPatientHistory`, `records.listLabResults`, `records.listProblems` | `clinical_notes`, `problem_list`, `lab_results`, `files` | ✅ |
| P-06 | J5 Clinical Guardian | `/records/new-soap/[patientId]`, dashboard widget | `extensions.clinicalGuardian.checkMedications/recordAlerts/resolveAlert/dismissAlert/runAuditNow/getSummary` | `drug_interactions`, `ext_clinical_guardian_alerts`, `patient_allergies` | `lib/ai/clinical-guardian.ts:205–219` (NSAID + kortikoid) |
| P-07 | J7 Rozvrh s ochranou proti kolíziám | `/schedule` | `appointments.create/reschedule/updateStatus/availableSlots`, `booking.book` | `appointments`, `appointment_types`, `rooms`, `staff_schedules`, `recurring_series` | `lib/scheduling/location.ts:27` — `takeAppointmentSchedulingLock` → `pg_advisory_xact_lock` |
| P-08 | J8 Whiteboard so SSE streamom | `/whiteboard`, `/waiting-room` | `whiteboard.getActive/updateStatus`, `GET /api/whiteboard/stream` | `appointments`, `visit_work_items` | `app/api/whiteboard/stream/route.ts` (heartbeat 15 s) |
| P-09 | J10 Predpis, výdaj, účtovanie liečiva | `/patients/[id]`, `/inventory` | `records.createPrescription/checkPrescriptionSafety`, `billing.listDispenseChargeQueue/createDispenseChargeInvoice` | `prescriptions`, `prescription_events`, `dispense_charge_queue`, `products` | ✅ |
| P-10 | J11 Faktúra, platba, e-Kasa | `/billing`, `/billing/new`, `/billing/pos`, `/billing/ekasa` | `billing.createInvoice/recordPayment`, `extensions.ekasa.createReceiptFromPayment/retryReceipt/stornoReceipt/performDailyClosure` | `invoices`, `invoice_items`, `payments`, `ekasa_receipts`, `ekasa_daily_closures`, `ekasa_config` | `lib/ekasa/service.ts:256–258` (advisory lock na practice-day) |
| P-11 | J12 Uzavretie návštevy (closeout) | `/encounters/[appointmentId]` | `encounters.saveDraft/finalizeClinical/completeVisit/getCloseout/reopenClinical` | `visit_closeouts`, `visit_work_items`, `discharge_reports` | ✅ |
| P-12 | J13 Laboratórny panel | `/lab-results` | `extensions.labImport.parseFile/parsePdfOrImageReport/saveReport/reviewReport/assignReport`, `records.completeLabResult` | `lab_results`, `lab_analyzer_reports`, `external_lab_reports`, `external_lab_observations`, `lab_result_events` | ✅ |
| P-13 | J17 RTG a Vertebral Heart Score | `/agent/imaging` | `extensions.imaging.analyze/calculateVhs/prepareConfirmation/confirmAnalysis/injectFindingsIntoSoap` | `ai_imaging_analyses`, `files`, `ext_clinician_confirmations` | `lib/imaging/vhs-calculator.ts` |
| P-14 | J13 Očkovanie a certifikáty | `/vaccinations` | `records.createVaccination/prepareVaccinationCertificate/listVaccinations` | `vaccination_records`, `pet_passports` | ✅ |
| P-15 | J14 Recall a revakcinácie | `/recalls`, `/care-reminders` | `notifications.getVaccinationRecallPreview/sendVaccinationReminders`, `careReminders.*` | `care_reminders`, `sms_send_attempts`, `ext_automation_*` | ✅ |
| P-16 | J15 Wellness plány | `/wellness`, `/marketing/wellness` | `wellness.listPlans/enroll/listDue/generateDueInvoices/markBilled/cancel` | `wellness_plans`, `wellness_enrollments`, `ext_marketing_wellness_redemptions` | cron `/api/cron/wellness-billing` |
| P-17 | J11/P-17 Klientsky portál (PWA) | `/portal`, `/portal/book`, `/portal/[token]/*` | `portal.*`, `booking.book` (publicProcedure) | `portal_sessions`, `consent_receipt_capabilities`, `booking_pages` | ✅ |
| P-18 | J18/J19 Marketingové štúdio | `/marketing/*` (13 sub-rout) | `extensions.marketing.*`, `extensions.automationRules.*`, `extensions.crmSegments.*` | `ext_marketing_*`, `ext_automation_*`, `ext_crm_segments` | ✅ |
| P-19 | J29 Sympathy Gate | `/marketing/suppression`, `/marketing/consents` | `extensions.automationSuppression.*`, `consentGateCheck()` | `ext_automation_suppression_log`, `patients.status='deceased'`, `ext_carcass_disposals` | `lib/autopilot/consent-gate.ts:31–69` |

### 3.2 GAP toky (404) — skutočný stav v kóde

| Kód | Modul | Cieľová routa | **Skutočný stav v0.6** | Chýba | Kritickosť |
|---|---|---|---|---|---|
| **C-02** | Hospitalizačný ICU flowsheet | `/hospitalization` | ❌ **modul neexistuje**. Existujú len stavebné kamene: `cases`, `case_entries`, `vital_signs`, `discharge_reports`, `procedures.anesthesiaUsed`; import VetSoftware V2 vkladá historické hospitalizácie ako `historical_appointments` s `appointmentType: "Hospitalizácia"` (`lib/import/vetsoftware-v2-pipeline.ts:1204–1257`) | celý dátový model, UI, účtovanie lôžko-dní | 🔴 blokujúca pre tier Nemocnica |
| **C-03** | Chirurgický denník a anestéziologický protokol | `/surgery` | ⚠️ **čiastočne**: `procedures` (s `anesthesiaUsed`, `durationMinutes`), `extensions.imaging.createSurgicalPlanFromImaging`, `lib/autopilot/postoperative.ts` (emituje `surgery_completed`), `lib/consult/consent-form-library.ts` (slug `surgery-anesthesia`), verejný `/postop/[id]` | anestéziologický protokol, chirurgický denník, ASA klasifikácia, peroperačný monitoring, count of instruments | 🔴 medicínsko-právne riziko |
| **C-04** | Triážna čakáreň a walk-in | `/triage` | ⚠️ **čiastočne**: `/waiting-room`, `whiteboard`, `appointment_waitlist` + `waitlist.matchesForSlot`, `appointments.startFieldVisit`; enum `appointment_status` nemá `triaged`/`emergency` | triážna škála, priorizácia, walk-in bez termínu, čakacia doba, eskalácia | 🔴 strata urgentných tržieb |
| **D-04** | Zmluvy a súhlasy na zákroky | `/consents` | ✅ **backend a podpis existujú**: `consent_forms`, `consent_requests`, `consent_receipt_capabilities`, `records.createConsentRequest/listConsentForms/listConsents`, `components/records/consent-sign.tsx`, routa `/sign/[token]`, knižnica vzorov `lib/consult/consent-form-library.ts` | centrálna správa verzií vzorov, viazanie súhlasu na *konkrétny plánovaný zákrok*, evidencia odmietnutia, register DPA | 🟡 compliance medzera, nie blokujúca |
| **D-06** | Poistné udalosti | `/insurance` | ✅ **backend existuje, UI nie**: `routers/extensions/insurance.ts` (`checkEligibility`, `createClaim`, `listClaims`), `lib/insurance/petexpert.ts` (validácia mikročipu, 10 % spoluúčasť, HTML lekárska správa), tabuľky `insurance_policies`, `insurance_claims`. Jediná zmienka v UI: `components/automations/clinical-automations-view.tsx` | celý UI povrch, workflow stavov claimu, follow-up upomienky | 🟡 strata tržieb pri priamom zúčtovaní |
| **S-05** | CRSZ a export čipov | `/statutory/crsz` (samostatne) | ✅ **existuje pod `/statutory`**: `extensions.crsz.*` (`validateChip`, `registerMicrochip`, `issuePetPassport`, `lookupChip`, `exportKvlSrBatch`, `issueKvlCrPassport`), `components/statutory/crsz-panel.tsx`, tabuľky `microchip_registrations`, `pet_passports`, `kvl_cr_passports` | samostatná routa, dávkový export s frontou a dôkazom o podaní, automatická nočná dávka | 🟢 nízke riziko (funkcia je) |
| **S-06** | Štátny veterinárny dohľad a hlásenia nákaz | `/statutory/svps` | ✅ **existuje pod `/statutory/kvepis`**: `extensions.kvepis.*` (`getCredentials`, `listSubmissions`, `createSubmission`, `validateAndBuild`, `signSubmission`, `submitSubmission`, `uploadReceipt`, `markRejected`), `extensions.statutory.*` (besnota, ochranné lehoty, kadaver), `reports.rabiesRegister/treatmentDiary/euthanasiaRegister` | **priame B2G SOAP/REST podanie** — XML-only export, produkčné certifikáty ŠVPS SR nepridelené (`ROADMAP.md`, register dlhu bod 1) | 🟡 závislé od tretiej strany |

### 3.3 EXTRA toky (200 OK, nad rámec pôvodného auditu)

| Kód | Tok | Routa | tRPC | Tabuľky |
|---|---|---|---|---|
| **JX-01** | Skladové hospodárstvo s expiráciami šarží | `/inventory` | `inventory.list/create/update/startTracking/adjustStock/listSuppliers`, `extensions.wholesalerImport.parse/searchProducts/confirmImport/applyDeliveryNote` | `products` (`lotNumber`, `expirationDate`, `stockQuantity`, `reorderPoint`, `inventoryTracked`), `suppliers`, `purchase_orders`, `dispense_charge_queue`; logika v `lib/inventory/{alerts,dispense,markup,policy,wholesaler-import}.ts` |
| **JX-02** | Manažérske finančné reporty | `/reports` | `reports.settings/revenue/appointments/topServices/inventoryAlerts/rabiesRegister/treatmentDiary/euthanasiaRegister/legacyFinancialSummary` | `invoices`, `invoice_items`, `payments`, `appointments`, `financial_closes`, `products` |

> ⚠️ **Zistenie pre v0.7 (R-09 z `docs/product/journeys/README.md`):** parser dodacích listov pre
> Cymedica SK, Pharmos a.s., Samohýl SK a Henry Schein SK je hotový a otestovaný
> (`lib/inventory/wholesaler-import.ts`), ale **nemá UI**. Najlacnejšia položka roadmapy s najvyšším
> dopadom: napojiť existujúci parser na `/inventory` (ledger L17 = 5,5 h/mes. úspory technika).

---

## 4. Obsah špecifikácie

| Súbor | Sekcia | Obsah |
|---|---|---|
| [`sekcia-1a-journeys-klinika.md`](sekcia-1a-journeys-klinika.md) | **1** | J1–J6 — klinické jadro, AI Scribe, SOAP, história, Clinical Guardian, Duplicate Shield |
| [`sekcia-1b-journeys-recepcia-farmacia.md`](sekcia-1b-journeys-recepcia-farmacia.md) | **1** | J7–J12 — rozvrh, check-in/whiteboard, zmeny, predpis a výdaj, faktúra a e-Kasa, closeout |
| [`sekcia-1c-journeys-preventiva-lab-marketing.md`](sekcia-1c-journeys-preventiva-lab-marketing.md) | **1** | J13–J19 — očkovanie, recall, wellness, laboratórium, RTG/VHS, marketing |
| [`sekcia-1d-journeys-gap-a-extra.md`](sekcia-1d-journeys-gap-a-extra.md) | **1** | JG-C02, JG-C03, JG-C04, JG-D04, JG-D06, JG-S05, JG-S06 + JX-01, JX-02 |
| [`sekcia-2-gap-moduly-v07.md`](sekcia-2-gap-moduly-v07.md) | **2** | Architektonický návrh C-02/C-03/C-04 (Drizzle DDL, tRPC, UI), sumarizácia D-04/D-06/S-05/S-06 |
| [`sekcia-3-use-case-katalog.md`](sekcia-3-use-case-katalog.md) | **3** | UC-01…UC-33 s prioritami a Given-When-Then |
| [`sekcia-4-business-cases-roi.md`](sekcia-4-business-cases-roi.md) | **4** | BC-01…BC-09, finančný model, payback, citlivosť |
| [`_generated/financial-model.md`](_generated/financial-model.md) | — | generované tabuľky (ledger L01–L36, páky R1–R7, ROI, citlivosť, riziká) |

### 4.1 Kódovanie journey v tejto špecifikácii

Existujúci register [`docs/product/journeys/README.md`](../journeys/README.md) používa J1–J30.
Aby nedošlo ku kolízii medzi *implementovanými* a *chýbajúcimi* tokmi, táto špecifikácia zavádza:

| Prefix | Význam | Príklad |
|---|---|---|
| `J1`–`J19` | implementované toky (audit PASS 200 OK), identické s registrom | `J3` Nový SOAP z encounteru |
| `JG-<audit kód>` | gap tok (audit GAP 404) — cieľový stav v0.7 | `JG-C02` Hospitalizácia |
| `JX-<nn>` | extra tok nájdený nad rámec auditu | `JX-01` Sklad |
| `J20`–`J30` | ponechané pre register journeys (persóna/emócie) | `J29` Eutanázia a sympathy |
| `L01`–`L36` | riadok časového ledgeru (zdroj čísel úspor) | `L03` SOAP počas ordinačných |
| `R1`–`R7` | výnosová páka (hard cash) | `R1` Zníženie no-show |
| `UC-nn` | use case (Sekcia 3) — 33 položiek v 4 kategóriách | `UC-11` ICU flowsheet |
| `BC-nn` | business case (Sekcia 4) — 9 položiek | `BC-04` Zníženie no-show |

### 4.2 Frekvenčné tiery

| Tier | Význam | Journeys |
|---|---|---|
| **T1** — každé 2 minúty / každú hodinu | regresia = klinika stojí; nikdy neobetovať stabilitu za AI experiment | J1, J2, J3, J7 |
| **T2** — každý encounter | priama väzba na cash-flow a právnu platnosť záznamu | J4, J8, J10, J11, J12, JG-C02, JG-C03 |
| **T3** — niekoľkokrát denne | onboarding, dáta klientov, urgent | J5, J6, J9, J13, J16, J17, JG-C04 |
| **T4** — týždenne / podľa potreby | rast, compliance, back office | J14, J15, J18, J19, JX-01, JX-02, JG-D04, JG-D06, JG-S05, JG-S06 |

---

## 5. Legislatívny rámec — prierez všetkými sekciami

| Predpis | Implementačná povinnosť | Kde je to v kóde | Kde sa to overuje v špecifikácii |
|---|---|---|---|
| **Zákon 39/2007 Z. z.** o veterinárnej starostlivosti | HITL: AI generuje **iba draft**; lekár explicitne autorizuje pred zápisom do trvalej dokumentácie. Kniha ošetrení vyžaduje podpis lekára | `docs/confirmation-protocol.md`; `lib/ai/draft-safety.ts` (`assertClinicianConfirmed`, `generateContentHash`); `ext_clinician_confirmations` (envelope PENDING → CONSUMED, TTL 900 s); `records.finalizeSoapNote`; `ext_ai_audit_log` (HMAC-SHA256 reťazec, `lib/ai/audit-ledger.ts:108`) | každý journey: pole 7; UC-03, UC-04, UC-05, UC-11, UC-12 |
| **Zákon 139/1998 Z. z.** o omamných a psychotropných látkach | **Zero AI prefill** pre opiáty a anestetiká; manuálny zápis lekára; **svedok** pri podaní a znehodnotení; trezorová bilancia | `lib/controlled-substances/policy.ts` — `CONTROLLED_SUBSTANCES_REGEX` (ketamín, fentanyl, buprenorfín, butorfanol, metadón, diazepam, fenobarbital, propofol, morfín), `controlledSubstanceWitnessError()`, `computeControlledSubstanceBalance()`; `ClinicalDiffConfirmModal` blokuje pole cez `isControlledSubstanceName`; `controlledSubstances.create` odmieta `administered`/`wasted` bez `witnessedBy` | J10, JG-C02, JG-C03; UC-22 |
| **Zákon 289/2008 Z. z.** o e-Kase | Doklad z certifikovaného chráneného dátového úložiska (FiskalPRO ORP / VRP2), offline fronta, idempotencia, denná uzávierka, storno | `extensions.ekasa.*`; `lib/ekasa/service.ts:256` — `pg_advisory_xact_lock(hashtext(practiceId || '-ekasa-receipt-' || localDate))`; enum `ekasa_receipt_status` vrátane `OFFLINE_STORED`; cron `/api/cron/ekasa-retry`, `/api/cron/ekasa-daily-closure` | J11; UC-29, UC-30 |
| **GDPR + Sympathy Gate** | Pri úhyne/eutanázii **atomické** zablokovanie všetkej automatickej komunikácie (SMS revakcinácie, žiadosti o recenzie) | `lib/autopilot/consent-gate.ts` — `consentGateCheck()`, `assertPatientNotDeceased()`; `patients.status='deceased'`; `ext_automation_suppression_log`; `/marketing/suppression` | J14, J19, J29; UC-17, UC-18; BC-08 |
| **Zákon 452/2021 Z. z.** (elektronický marketing) | súhlas pred marketingovou správou, quiet hours, frequency cap | `sms_consent_events`, `sms_suppressions`, `email_suppressions`, `consentGateCheck` | UC-18, UC-19 |
| **EÚ 2019/6** (veterinárne liečivá) | ochranné lehoty mäsa/mlieka pri potravinových zvieratách | `ext_withdrawal_periods`, `extensions.statutory.listWithdrawalPeriods` | UC-26 |
| **RLS (PostgreSQL Row Level Security)** | 100 % izolácia medzi klinikami; žiadny cross-tenant zápis ani čítanie | `packages/db/rls/enable-rls.sql` — politiky `tenant_isolation`, `system_only`, `system_read`, `system_insert`, `reference_read`, `delivery_evidence_*`; `pnpm db:rls:preflight`, `db:rls:test` | každý journey: pole 7; Sekcia 2 (nové tabuľky musia mať `tenant_isolation`) |
| **RBAC** | roly `admin \| veterinarian \| technician \| front_desk \| viewer` (+ `service_agent` pre API) | `packages/db/schema/users.ts:20` (`userRoleEnum`), `requireRole`, `requireClinicalActorRole`, `requireFeature("agent")` | Sekcia 3 (pole *Priority* a *Akceptačné kritériá*) |

---

## 6. KPI a instrumentácia (ako sa úspory overia v realite)

Modelové úspory (Sekcia 4) musia byť overiteľné z dát, inak zostanú tvrdením. Navrhovaná instrumentácia:

| KPI | Zdroj v kóde | Baseline (meranie pred) | Cieľ (rok 1) | Cieľ (steady-state) |
|---|---|---|---|---|
| Medián času od `appointments.status='checked_in'` do `soap_notes.finalizedAt` | DB join cez `appointmentId` | merať 2 týždne pred nasadením | −35 % | −50 % |
| Podiel SOAP vytvorených hlasovým diktátom | `voice_dictations` → `soap_notes` (`source`) | 0 % | ≥ 55 % | ≥ 75 % |
| Podiel encounterov s dokončeným closeout v ten istý deň | `visit_closeouts.clinicalFinalizedAt` | merať | ≥ 90 % | ≥ 98 % |
| No-show rate | `appointments.status='no_show'` / scheduled | 12 % | 8 % | 6 % |
| Podľa recall konverzia | `care_reminders` → `appointments` | merať | +14 návštev/mes. | +25 návštev/mes. |
| Odpísané zásoby pre expiráciu | `products.expirationDate` + `inventory.adjustStock` | 1,8 % COGS | 1,1 % | 0,7 % |
| Čas na dennú uzávierku e-Kasa | `ekasa_daily_closures.closedAt` − trigger | merať | < 5 min | < 2 min |
| Počet `PRECONDITION_FAILED` z HITL envelope (expirované potvrdenia) | tRPC error log | — | < 2 % finalizácií | < 1 % |
| Počet Clinical Guardian alertov s `resolved`/`dismissed` + dôvod | `ext_clinical_guardian_alerts` | — | 100 % s dôvodom | 100 % |
| DSO (dni pohľadávok) | `invoices` + `payments` | merať | −3 dni | −6 dní |

**Pilotný protokol:** meranie baseline počas 2 týždňov *pred* ostrým nasadením (shadow run s VetSoftware v2
beží — viď `/admin/pilot` a `extensions.reconciliation.*`), potom mesačné vyhodnotenie proti týmto KPI.
Odchýlka model vs. skutočnosť > 30 % = prehodnotiť predpoklady v skripte, nie v dokumente.

---

## 7. Otvorené otázky a riziká špecifikácie

| # | Riziko / otázka | Dopad | Odporúčanie |
|---|---|---|---|
| S-01 | Sadzby 25–35 €/h sú zadané pásmo, nie mzdová databáza kliniky | ±20 % na kapacitnej hodnote | overiť s pilotnou klinikou; skript má parameter |
| S-02 | Limit 500 AI dopytov/mes. v tieri Klinika je pri 45 pacientoch/deň nedostatočný | klinika musí ísť na tier Nemocnica (229 €) alebo platiť overage | prepočítať cenník; inak je BC-02 (AI Scribe) nedodržateľný v lacnejšom tieri |
| S-03 | `agent.run` s nástrojom `create_prescription` obchádza screening kontrolovaných látok (audit F-18-1, R-10) | riziko zákona 139/1998 | **pred v0.7**: zakázať `agent:write` scope pre preskripcie OPL; UC-20 akceptačné kritérium |
| S-04 | KVEPIS je XML-only, B2G certifikáty nepridelené | JG-S06 nie je plne automatizovateľný | v Sekcii 2 uvádzame ako *dependent gate*, nie ako scope v0.7 |
| S-05 | e-Kasa integrácia nie je formálne certifikovaná FR SR | právne riziko pri kontrole | v `BC-06` je benefit počítaný ako zníženie rizika, nie ako cash |
| S-06 | Model počíta s `hospitalization_units` (lôžka), ktoré dnes schéma nemá | C-02 návrh vyžaduje novú tabuľku | zahrnuté v Sekcii 2 (§2.2.3) |
| S-07 | Multi-location: schéma podporuje, UI je jednolokačné | C-02/C-04 pre skupinovú kliniku | Sekcia 2 uvádza `locationId` v každej novej tabuľke od začiatku |
| S-08 | Čísla úspor sú modelové, nie merané | dôveryhodnosť voči investorovi | §6 KPI protokol + explicitné označenie `MODEL` pri každom čísle |

---

## 8. Zoznam skratiek

| Skratka | Význam |
|---|---|
| ASA | American Society of Anesthesiologists — klasifikácia fyzického stavu pred anestéziou |
| BCS | Body Condition Score |
| B2G | Business-to-Government (podanie do štátneho informačného systému) |
| CEHZ | Centrálna evidencia hospodárskych zvierat |
| CHDÚ | chránené dátové úložisko (e-Kasa) |
| CRI | Constant Rate Infusion — kontinuálna infúzia lieku |
| CRSZ | Centrálna evidencia spoločenských zvierat (register čipov) |
| DSO | Days Sales Outstanding — priemerná doba splatnosti pohľadávok |
| ETCO₂ | end-tidal CO₂ (kapnografia) |
| HITL | Human-in-the-Loop — povinná autorizácia človekom |
| KVEPIS | Komunitárny veterinárny evidenčný a pohraničný informačný systém |
| NSAID | nesteroidové antiflogistiká (napr. meloxicam, carprofen) |
| OKP / PKP | ochranný kód pokladnice / podpisový kód pokladnice (e-Kasa) |
| OPL | omamné a psychotropné látky |
| ORP / VRP | online registračná pokladnica / virtuálna registračná pokladnica |
| PIMS | Practice Information Management System |
| RLS | Row Level Security (PostgreSQL) |
| SOAP | Subjective, Objective, Assessment, Plan |
| SSE | Server-Sent Events |
| ŠVPS / SVPS SR | Štátna veterinárna a potravinová správa SR |
| VHS | Vertebral Heart Score — rádiologický index kardiomegálie |
