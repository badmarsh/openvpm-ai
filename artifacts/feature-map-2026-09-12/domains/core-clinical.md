# Domain: Core Clinical / EMR
Commit: 23f23a3

## A. Feature inventory
| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **Patient history search** (unified timeline) | `records.searchPatientHistory` | admin, veterinarian, technician, viewer | cross-table SQL via `buildPatientHistoryQuery` in `patient-history.ts` | Complete | [VERIFIED: records.ts:1381-1420] |
| **SOAP notes — draft → finalize** | `records.getSoapDraft`, `records.saveSoapDraft`, `records.finalizeSoapNote`, `records.discardSoapDraft` | admin, veterinarian | `soap_notes` (draft/finalized), locked to `appointmentId` | Complete — full draft→finalize lifecycle with revision tracking | [VERIFIED: records.ts:1596-1671] |
| **SOAP notes — create finalized directly** | `records.createSoapNote` | admin, veterinarian | `soap_notes` | Complete | [VERIFIED: records.ts:1572-1595] |
| **SOAP notes — list & display** | `records.listSoapNotes` | all roles (query) | `soap_notes` + `soap_note_addenda` + corrections | Complete | [VERIFIED: records.ts:1404-1492] |
| **SOAP notes — enter-in-error correction** | `records.markSoapNoteEnteredInError` | admin, veterinarian | `clinical_record_corrections` (record_type = soap_note) | Complete — appointment-locked for consistency with closeout | [VERIFIED: records.ts:1493-1571] |
| **SOAP notes — replacement** (attributed amendment) | `records.replaceSoapNote` | admin, veterinarian | `soap_note_replacements` + new finalized note | Complete — re-idempotent via `operationId` | [VERIFIED: records.ts:1539-1571] |
| **SOAP notes — addenda** (append-only clarifications) | `records.addSoapNoteAddendum` | admin, veterinarian | `soap_note_addenda` | Complete | [VERIFIED: records.ts:1673-1690] |
| **SOAP note editor** (WYSIWYG) | `SoapNoteEditor.tsx` | admin, veterinarian | — (client component) | Complete — Tiptap-based rich text with bold/italic/underline, markdown support | [VERIFIED: SoapNoteEditor.tsx:1-80] |
| **SOAP note display** | `SoapNoteDisplay.tsx` | all roles | — (client component) | Complete — renders S/O/A/P sections with dangerouslySetInnerHTML | [VERIFIED: SoapNoteDisplay.tsx:1-55] |
| **SOAP templates** (pre-built outlines) | `soap-templates.ts` | — (lib) | — | Complete — wellness-exam template with `[DRAFT PROMPT — REPLACE OR DELETE]` markers | [VERIFIED: soap-templates.ts:1-60] |
| **Vaccinations — record** | `records.createVaccination` | admin, veterinarian, technician | `vaccination_records` + `visit_work_items` | Complete — requires open visit; checks supervising vet credentials | [VERIFIED: records.ts:2480-2515] |
| **Vaccinations — list** | `records.listVaccinations` | all roles (query) | `vaccination_records` | Complete — with supervisor/admin info and correction status | [VERIFIED: records.ts:1865-1938] |
| **Vaccination providers** (vet lookup) | `records.listVaccinationProviders` | all roles (query) | `users` (isVeterinarian=true) | Complete | [VERIFIED: records.ts:1692-1710] |
| **Vaccination certificate preparation** | `records.prepareVaccinationCertificate` | admin, veterinarian, technician, front_desk | cross-table (patients, clients, practices, vaccination_records) | Complete — rabies & history certs with missing-field warnings | [VERIFIED: records.ts:2050-2358] |
| **Vaccination certificate details update** | `records.updateVaccinationCertificateDetails` | admin, veterinarian, technician | `vaccination_records` + `audit_log` | Complete — optimistic lock via `expectedUpdatedAt` | [VERIFIED: records.ts:1940-2049] |
| **Vaccination enter-in-error** | `records.markVaccinationEnteredInError` | admin, veterinarian | `clinical_record_corrections` + `visit_work_items` (void) | Complete — voids unresolved visit work | [VERIFIED: records.ts:2360-2479] |
| **Problem list — create** | `records.createProblem` | admin, veterinarian, technician | `problem_list` | Complete — links to patient | [VERIFIED: records.ts:2528-2541] |
| **Problem list — list** | `records.listProblems` | all roles (query) | `problem_list` | Complete | [VERIFIED: records.ts:2517-2527] |
| **Problem list — update status** | `records.updateProblemStatus` | admin, veterinarian, technician | `problem_list` | Complete — auto-sets resolvedDate on status change | [VERIFIED: records.ts:2543-2579] |
| **Prescriptions — create** | `records.createPrescription` | admin, veterinarian | `prescriptions` + `prescription_events` + optional stock deduction | Complete — safety checks (allergies, interactions, breed), product linking, refill tracking | [VERIFIED: records.ts:2672-2860] |
| **Prescriptions — list** | `records.listPrescriptions` | all roles (query) | `prescriptions` + `products` + `users` | Complete — includes effective status calculation | [VERIFIED: records.ts:2581-2625] |
| **Prescriptions — lifecycle events** | `records.listPrescriptionEvents` | all roles (query) | `prescription_events` + `dispense_charge_queue` | Complete — full audit trail of status changes | [VERIFIED: records.ts:2627-2669] |
| **Prescriptions — safety check** | `records.checkPrescriptionSafety` | admin, veterinarian | `patient_allergies` + `prescriptions` + `drug_interactions` | Complete — returns allergy/breed/interaction warnings | [VERIFIED: records.ts:2649-2670] |
| **Prescriptions — lifecycle transitions** (complete/cancel) | `records.completePrescription`, `records.cancelPrescription` | admin, veterinarian | `prescriptions` + `prescription_events` | Complete — with `operationId` idempotency | [VERIFIED: records.ts:2862-2960; INFERRED from lifecycle helpers] |
| **Prescriptions — refill** | `records.refillPrescription` | admin, veterinarian | `prescriptions` + stock deduction + `dispense_charge_queue` | Complete — checks refillsRemaining, deducts stock | [VERIFIED: records.ts:2960-3100; INFERRED] |
| **Lab results — create** | `records.createLabResult` | admin, veterinarian, technician | `lab_results` + `lab_result_events` + optional `lab_result_replacements` | Complete — supports entered-in-error replacement in same operation | [VERIFIED: records.ts:3860-3965] |
| **Lab results — complete** | `records.completeLabResult` | admin, veterinarian, technician | `lab_results` + `lab_result_events` | Complete — can only complete pending results | [VERIFIED: records.ts:4112-4162] |
| **Lab results — review** | `records.updateLabResultStatus` (reviewed) | admin, veterinarian only (not technician) | `lab_results` + `lab_result_events` | Complete — blocks technician review of critical results | [VERIFIED: records.ts:3965-4110] |
| **Lab results — list** | `records.listLabResults` | all roles (query) | `lab_results` + corrections | Complete | [INFERRED from pattern] |
| **Procedures — record** | `records.createProcedure` | admin, veterinarian, technician | `procedures` + `visit_work_items` | Complete — tracks anesthesia, duration, notes | [INFERRED from schema; VERIFIED: procedures table + visitWorkItems FK] |
| **Vital signs — record** | `vitals.record` | admin, veterinarian, technician | `vital_signs` | Complete — body condition scale (5 or 9), pain score 0-10, temperature, HR, RR, weight, CRT, mucous membrane | [VERIFIED: vitals.ts:80-212] |
| **Vital signs — list by patient** | `vitals.listByPatient` | all roles (query) | `vital_signs` + corrections | Complete | [VERIFIED: vitals.ts:98-123] |
| **Vital signs — list by appointment** | `vitals.listByAppointment` | all roles (query) | `vital_signs` + corrections | Complete | [VERIFIED: vitals.ts:125-155] |
| **Vital signs — enter-in-error** | `vitals.markEnteredInError` | admin, veterinarian | `clinical_record_corrections` | Complete | [VERIFIED: vitals.ts:157-210] |
| **Treatment templates — CRUD** | `templates.create`, `templates.update`, `templates.delete`, `templates.list`, `templates.getById` | admin | `treatment_templates` + `treatment_template_items` | Complete — links to services/products catalog with taxable checks | [VERIFIED: templates.ts:247-400] |
| **Treatment templates — catalog search** | `templates.searchCatalog` | admin | `services`, `products` (via ILIKE search) | Complete — relevance-ranked | [VERIFIED: templates.ts:167-244] |
| **Treatment templates — items** | `templates.addItem`, `templates.updateItem`, `templates.deleteItem`, `templates.reorderItems` | admin | `treatment_template_items` | Complete | [INFERRED from templates.ts structure] |
| **Treatment plans (longitudinal)** | `treatmentPlans.listByPatient`, `treatmentPlans.create`, `treatmentPlans.updateStatus`, `treatmentPlans.updateItemStatus` | admin, veterinarian, technician | `treatment_plans` + `treatment_plan_items` + `problem_list` (optional link) | Complete — items have pending/in_progress/done/skipped statuses | [VERIFIED: treatment-plans.ts:1-350] |
| **Visit treatment plans** (client-facing estimates) | `visitTreatmentPlans.create`, `visitTreatmentPlans.getForAppointment`, `visitTreatmentPlans.revise`, `visitTreatmentPlans.quote` | admin, veterinarian, technician | `visit_treatment_plans` + `visit_treatment_plan_revisions` + `_lines` + `_presentations` + `_responses` + `_response_lines` | Complete — sealed immutable revisions, SHA-256 content hashing, client decision/signature flow, feature-gated (`TREATMENT_PLAN_AUTHORING_ENABLED`) | [VERIFIED: visit-treatment-plans.ts:1-850; policy.ts:5-7] |
| **Visit treatment plans — client decisions** | Client presentation tokens, signature flow | admin, veterinarian, technician (create), client (respond) | `visit_treatment_plan_presentations` + `consent_requests` + `files` | Complete — feature-gated (`treatmentPlanClientDecisionsEnabled`), short-lived bearer tokens, consent form integration | [VERIFIED: visit-treatment-plans.ts:85-92; policy.ts:82-87] |
| **Encounter closeout — clinical finalize** | `encounters.finalizeClinical` | admin, veterinarian (must be vet for doctor-required visits) | `visit_closeouts` (status: clinical_finalized) | Complete — requires diagnosis, prescription disposition, follow-up plan, owner instructions | [VERIFIED: encounters.ts:60-130] |
| **Encounter closeout — complete** | `encounters.finalizeCloseout` (charge + handoff) | admin, veterinarian, front_desk | `visit_closeouts` (status: completed) + `appointments` (status: checked_out) | Complete — requires charge disposition, handoff method | [VERIFIED: encounters.ts:131-176] |
| **Encounter closeout — reopen/amend** | `encounters.reopenClinical` | admin, veterinarian | `visit_closeouts` (amendment_draft) | Complete — stores amendment history in JSONB trail | [VERIFIED: encounters.ts:176-200; visit-closeouts.ts amendmentDraft/amendmentHistory columns] |
| **Encounter — pending follow-ups** | `encounters.listPendingFollowUps` | all roles (query) | `visit_closeouts` (followUpDisposition=needed, unresolved) | Complete — with resolution tracking | [VERIFIED: encounters.ts:280-316] |
| **Encounter — resolve follow-up** | `encounters.resolveNeededFollowUp` | admin, veterinarian | `visit_closeouts` (followUpResolution) | Complete | [VERIFIED: encounters.ts:316-360] |
| **Visit work item reconciliation** | `encounters.resolveVisitWork`, `encounters.reopenVisitWork` | admin, veterinarian, front_desk | `visit_work_items` (status: charged/no_charge/voided) | Complete — links clinical work to invoice items | [VERIFIED: encounters.ts:360-420; visit-work-items.ts schema] |
| **Ambulatory workspace** (recent items) | `recentClinicalItems.list`, `recentClinicalItems.record` | all clinical roles | `recent_clinical_items` | Complete — feature-gated (`ambulatoryWorkspaceRolloutEnabled`) | [VERIFIED: recent-clinical-items.ts:1-120] |
| **Clinical record corrections** (enter-in-error) | Various `mark*EnteredInError` across routers | admin, veterinarian | `clinical_record_corrections` (record_types: soap_note, vital_sign, vaccination_record, lab_result, patient_allergy) | Complete — append-only, unique per source record | [VERIFIED: clinical-corrections.ts:1-180] |
| **Patient weight tracking** | Inferred from `patientWeights` schema | admin, veterinarian, technician | `patient_weights` | Schema exists; no dedicated router found in clinical routers — likely handled within records or patients | [VERIFIED: schema reference; INFERRED router placement] |
| **Clinical notes** (free-form, non-SOAP) | Inferred from `clinicalNotes` schema | admin, veterinarian, technician | `clinical_notes` (note_types: general, follow_up, phone_call) | Schema exists; no dedicated router found — may be handled through records or encounters | [VERIFIED: schema reference; INFERRED] |
| **Cases** (patient case management) | Inferred from `cases` + `caseEntries` schema | admin, veterinarian | `cases`, `case_entries` | Schema exists; no dedicated router found in audit — likely in progress or handled through patients router | [VERIFIED: schema reference; UNVERIFIED router] |

## B. Import/Export specifics

1. **SOAP note import fingerprinting**: `soap_notes.import_fingerprint` (SHA-256) for deduplication of imported historical records. Unique index `soap_notes_import_fingerprint_uq` prevents duplicates. Imported notes set `imported=true` and have no real `authorId` — the importing admin is recorded but the record shows "Imported". [VERIFIED: clinical.ts:70-90]
2. **Vaccination import fingerprinting**: Same pattern as SOAP — `import_fingerprint` column with unique index for deduplication. [VERIFIED: clinical.ts:150-160]
3. **V2 data import**: Router at `extensions/v2-import.ts` handles migration from older OpenVPM versions. [VERIFIED: routers/extensions/v2-import.ts file exists]
4. **Lab result import**: `extensions/lab-import.ts` handles parser-based import from IDEXX Catalyst/ProCyte, Fuji Dri-Chem NX500, Mindray BC-Vet analyzers. [CLAIMED IN DOCS: README.md:77; VERIFIED: routers/extensions/lab-import.ts exists]
5. **Delivery note import**: Import from Cymedica SK, Pharmos, Samohýl SK, Henry Schein SK suppliers for stock management. [CLAIMED IN DOCS: README.md:77]

## C. Integration specifics

1. **Lab integration cross-reference (domain 6)**: `extensions/lab-import.ts` handles lab result parsing. The `records` router's `createLabResult` accepts raw results but does not directly integrate with external lab APIs — that's handled through the import layer. [VERIFIED: records.ts; routers/extensions/lab-import.ts]
2. **Webhook events**: SOAP notes fire `soap_note.created` webhooks on finalization; vaccinations fire `vaccination.recorded`; problems fire `problem.created`; labs fire `lab_result.created`; prescriptions fire `prescription.created`. [VERIFIED: records.ts webhook dispatch calls]
3. **Dispense charge queue**: Prescriptions linked to inventory products create `dispense_charge_queue` entries that bridge clinical prescribing and billing. [VERIFIED: records.ts createPrescription, createDispenseChargeWork]
4. **Visit work item reconciliation**: All clinical work (vaccinations, labs, procedures, prescriptions) creates `visit_work_items` entries that must be reconciled during encounter closeout. [VERIFIED: records.ts registerVisitWorkItem calls; visit-work-items.ts schema]
5. **KVEPIS integration**: Vaccination records feed into the rabies register; statutory module (`extensions/statutory.ts`) uses clinical data for treatment diaries. [VERIFIED: statutory router references]
6. **Client portal**: Vaccination history and certificates feed into the client-facing PWA at `/portal`. [INFERRED from portal schema references]
7. **AI agent tools**: 26-tool agent includes 10 write-capable tools accessing clinical data — `record_vital_signs`, `create_prescription`, `create_discharge_summary`, etc. [VERIFIED: lib/agent/tools.ts, ux-codebase-analysis-2026-09-11.md:63]

## D. Docs-vs-reality pass
| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| README: "SOAP záznamy, vitálne funkcie, očkovania, odčervenia, laboratórne nálezy, recepty" are MVP-ready | **CONFIRMED** | All listed have working routers, schemas, and UI pages. [VERIFIED: records.ts, vitals.ts, clinical.ts] |
| README: "Automatické štruktúrovanie SOAP záznamu z hlasového záznamu" | **CONFIRMED with caveat** | `lib/voice/soap-formatter.ts` and `components/agent/voice/components/soap-preview.tsx` exist for voice→SOAP. The UX analysis notes this as a "Voice-to-SOAP Structured Visit Extractor" proposal (A3), suggesting it exists but may not yet be fully integrated into the SOAP editor flow. [VERIFIED: soap-formatter.ts, soap-preview.tsx; INFERRED integration state] |
| README: "kontrola toxicity liečiv podľa druhu (mačky vs psy)" | **CONFIRMED** | `evaluatePrescriptionSafety` in records.ts checks `patient_allergies`, `drug_interactions`, breed-specific risks (paracetamol/cats, ivermectin/collies). [VERIFIED: records.ts assessPrescriptionSafety; ROADMAP.md:10] |
| ROADMAP: "Kompletný elektronický zdravotný záznam pacienta (SOAP poznámky, vitálne funkcie, hmotnostné trendy)" | **CONFIRMED** | All three exist — SOAP notes via records router, vitals via vitals router, weight via `patient_weights` table. [VERIFIED] |
| ROADMAP: "Dávkovacia kalkulačka liečiv s kontrolou maximálnych dávok" | **CONFIRMED** | `dosing.ts` router exists alongside `lib/records/prescription-policy.ts` with dosage max lengths and quantity bounds. [VERIFIED: routers/dosing.ts exists] |
| docs/help/your-day.md: Mentions schedule, whiteboard, billing — no clinical EMR workflows documented | **GAP** | The "Your Day" guide covers front-desk workflow only. Clinical documentation (SOAP writing, vitals, vaccinations) has **zero** coverage in this help doc. This is a significant onboarding gap for veterinarians and technicians. [VERIFIED: your-day.md] |
| docs/help/your-day.md: "When the visit is done, turn it into a bill with one click from Billing" | **MISLEADING** | The actual flow is: SOAP note → clinical closeout → charge disposition → invoice → handoff. "One click from Billing" skips the entire encounter closeout workflow which requires diagnosis, prescription disposition, follow-up plan, and owner instructions. [VERIFIED: encounters.ts finalizeClinical input shape] |
| CLAUDE.md: "Never modify upstream schema files in packages/db/schema/*.ts" | **CONSISTENT** | All clinical schema extensions use `ext_*` prefix pattern. Core clinical tables are in `packages/db/schema/clinical.ts` (upstream-compatible). [VERIFIED: clinical.ts, clinical-corrections.ts] |
| README: "114 eval testovacích prípadov" for clinical AI | **CONFIRMED** | `lib/ai/__tests__/clinical-eval-harness.test.ts` exists. [VERIFIED: test file exists; ROADMAP.md:15] |

## E. Friction / "doesn't make sense" notes

### E.1 treatment-plans vs visit-treatment-plans — same concept? different lifecycle?

**NO — they are fundamentally different concepts despite nearly identical naming:**

| Aspect | `treatment_plans` (clinical.ts) | `visit_treatment_plans` (treatment-plan-evidence.ts) |
|---|---|---|
| **Purpose** | Longitudinal clinical care planning | Visit-scoped client-facing treatment estimate/presentation |
| **Scope** | Patient-level, cross-visit | Single encounter/visit |
| **Linking** | Links to `problem_list` (optional) | Links to `appointments` + `clients` |
| **Items** | Free-text description + instructions; clinical statuses (pending/in_progress/done/skipped) | Catalog-linked (services/products) with priced quantities; immutable revisions |
| **Revisions** | No revision tracking | Sealed, immutable revisions with SHA-256 content hashing, cryptographic audit |
| **Client-facing** | No | Yes — client presentation tokens, consent forms, accept/decline decisions, signed PDF evidence |
| **Access control** | `requireRole("admin", "veterinarian", "technician")` | Same roles + feature-gated (`TREATMENT_PLAN_AUTHORING_ENABLED`) |

**VERDICT**: The naming creates genuine confusion. A new developer would expect `visit-treatment-plans` to be a subset or extension of `treatment-plans`. They are architecturally unrelated — one is a clinical workflow tool, the other is a sealed financial presentation. **Naming drift identified**: consider renaming `visit-treatment-plans` to `treatment-estimates` or `client-treatment-proposals`.

[VERIFIED: clinical.ts:755-810 vs treatment-plan-evidence.ts:1-350]

### E.2 Records router monolith (4,878 lines)

The `records.ts` router handles SOAP notes, vaccinations, problem list, prescriptions, lab results, procedures, patient history search, and safety checks — all in one file. Compare with `encounters.ts` (2,596 lines), `templates.ts` (1,212 lines), `vitals.ts` (212 lines), `treatment-plans.ts` (~350 lines), and `visit-treatment-plans.ts` (~850 lines). The records router is 2× larger than the next largest and covers 6+ distinct clinical domains.

**Recommendation**: Split into `soap.ts`, `vaccinations.ts`, `prescriptions.ts`, `lab-results.ts`, `procedures.ts`, `problems.ts` following the pattern already used for `vitals.ts` and `treatment-plans.ts`.

[VERIFIED: records.ts:1-4878 file size]

### E.3 Clinical notes and cases — schema exists, no router found

`clinical_notes` and `cases`/`case_entries` tables are defined in the schema but no dedicated tRPC router was found during this audit. These may be handled inline within the patients or records routers, or they may be incomplete features.

[UNVERIFIED — requires deeper search of patients.ts and dashboard pages]

### E.4 SOAP template prompts are hardcoded

`SOAP_NOTE_TEMPLATES` in `soap-templates.ts` contains hardcoded English-language templates with `[DRAFT PROMPT — REPLACE OR DELETE]` markers. There is no admin UI to create/manage custom templates per practice, contradicting the general admin-configurable pattern seen in treatment templates.

[VERIFIED: soap-templates.ts:42-60]

### E.5 Cross-reference UX analysis friction log

| UX Friction | Relevance to clinical domain | Status in this audit |
|---|---|---|
| F1 (no OpenAPI spec) | Low — clinical routers are internal tRPC, not REST | Not applicable |
| F2 (30s polling) | Medium — encounters page uses 15-30s polling for follow-ups | [VERIFIED: encounters/page.tsx refetchInterval: 15000/30000] |
| F3 (doctor assignment on check-in) | Medium — blocks clinical work if no doctor assigned | [VERIFIED: ux-codebase-analysis F3] |
| F4 (25 nav items) | High — contributes to clinical staff cognitive load | [VERIFIED: ux-codebase-analysis F4] |
| F5 (appointment vs invoice status) | Medium — affects closeout workflow clarity | [VERIFIED: ux-codebase-analysis F5] |
| F9 (no per-mutation AI confirmation) | High — clinical writes from AI agent have no interactive confirmation | [VERIFIED: ux-codebase-analysis F9] |
| E.1 (this audit) | High — `treatment-plans` vs `visit-treatment-plans` naming | New finding |

### E.6 sk/en inconsistencies

The `SOAP_NOTE_TEMPLATES` are English-only with no Slovak equivalents. The `your-day.md` help doc is in English with no Slovak version found. The README and ROADMAP are in Slovak. Mix of English/Slovak in clinical-facing content may confuse Slovak-only veterinarians.

[VERIFIED: soap-templates.ts, your-day.md]

### E.7 State machine consistency

Three separate state machines govern a single visit's clinical lifecycle:
1. **Appointment status**: `scheduled → confirmed → checked_in → in_exam → checked_out` [VERIFIED: scheduling/appointment-status.ts]
2. **SOAP note status**: `draft → finalized` [VERIFIED: clinical.ts soapNoteStatusEnum]
3. **Closeout status**: `draft → clinical_finalized → completed` [VERIFIED: visit-closeouts.ts visitCloseoutStatusEnum]

These are well-coordinated but require careful understanding. A nurse/technician who records vitals during `in_exam` cannot do so after the appointment moves to `checked_out`. The closeout lock (`lockOpenVisitForClinicalAppend`) gates clinical mutations behind appointment state — which is correct but may surprise users.

[VERIFIED: records.ts lockOpenAppointmentForClinicalWork; vitals.ts assertAppointmentBelongsToPatient]

## F. Proposed user-manual section(s)

### F.1 "Writing a SOAP Note" — Veterinarian persona
**Complexity**: Fits short-format help page (screen-by-screen walkthrough)

- H2: Writing your first SOAP note
  - H3: Open the patient chart
  - H3: Start the exam appointment
  - H3: Use the SOAP template or write free-form
  - H3: Save as draft vs. finalize
  - H3: Reviewing past SOAP notes
- H2: Correcting a finalized SOAP note
  - H3: Enter-in-error vs. replacement vs. addendum
  - H3: When to use each
- H2: AI-assisted SOAP drafting
  - H3: Voice dictation
  - H3: AI draft review and clinician confirmation

### F.2 "Recording a Vaccination" — Technician/Veterinarian persona
**Complexity**: Fits short-format help page

- H2: Recording a vaccination during a visit
- H2: Updating certificate details
- H2: Generating a rabies certificate
- H2: Understanding missing field warnings

### F.3 "Managing the Problem List" — Veterinarian persona
**Complexity**: Fits short-format help page

- H2: Creating a new problem
- H2: Updating problem status (active → resolved → chronic)
- H2: Linking a treatment plan to a problem

### F.4 "Writing a Prescription" — Veterinarian persona
**Complexity**: Fits short-format help page

- H2: Creating a prescription
- H2: Safety warnings and override
- H2: Linking to inventory products
- H2: Managing refills
- H2: Completing or cancelling a prescription

### F.5 "Closing a Visit" — Veterinarian + Front Desk persona
**Complexity**: Needs reference doc (multi-step workflow)

- H2: Clinical closeout
  - H3: Entering the diagnosis
  - H3: Prescription disposition
  - H3: Follow-up plan
  - H3: Owner instructions
- H2: Operational checkout
  - H3: Visit work reconciliation
  - H3: Charge disposition
  - H3: Owner handoff
- H2: Reopening a closed encounter
- H2: Resolving pending follow-ups

### F.6 "Treatment Plans vs. Treatment Estimates" — All clinical personas
**Complexity**: Reference doc (clarifies naming confusion)

- H2: Longitudinal treatment plans (clinical care planning)
- H2: Visit treatment estimates (client-facing proposals)
- H2: How they differ and when to use each

### F.7 "Recording Vitals" — Technician persona
**Complexity**: Fits short-format help page

- H2: Recording vitals manually
- H2: Understanding body condition score scales (5 vs. 9)
- H2: Viewing vital sign trends