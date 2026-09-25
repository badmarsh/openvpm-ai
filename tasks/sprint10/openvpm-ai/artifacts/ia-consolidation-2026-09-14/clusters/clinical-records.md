# Cluster: Clinical / Records

**Commit:** `65e008d` | **Cluster:** clinical-records | **Date:** 2026-09-14

Modules covered: Záznamy (`/records`), Vyšetrenia (`/encounters`), Laboratórium (`/lab-results`), Zdravotné pripomienky (`/care-reminders`), Pripomienky (`/recalls`). Also covers H6 (Records vs Encounters vs Zdravotné pripomienky boundary).

---

## H6 Verdict: PARTIALLY TRUE — boundary is blurry but not collapsed

**Evidence:**

- **Záznamy (`/records`):** Backs `trpc.records.*` — a 4,878-line router [VERIFIED: REORGANIZATION-FINDINGS.md §8] covering SOAP notes, vaccinations, prescriptions, lab results, problems, procedures. This is the *patient-level* aggregated clinical record view — you search for a patient and see all their historical data across encounter types.
  - Key queries: `trpc.records.listSoapNotes`, `trpc.records.listVaccinations`, `trpc.records.listPrescriptions`, `trpc.records.listProblems`, `trpc.records.listLabResults`, `trpc.records.listProcedures` [VERIFIED: records/page.tsx:795–943]

- **Vyšetrenia (`/encounters`):** Backs `trpc.encounters.*` + `trpc.appointments.*`. This is the *visit-level* view — list of active/recent appointments with status, allows opening encounter workspace (SOAP editor, vitals, treatment plans for that specific visit). [VERIFIED: encounters/page.tsx:51–64]

- **Laboratórium (`/lab-results`):** Backs `trpc.records.listLabResults`, `.completeLabResult`, `.updateLabResultStatus`, `.assignLabFollowUp`. Also surfaces `ext_lab_imports` via `trpc.extensions.labImport.*`. This is a *workflow queue* — the lab technician review inbox where pending results are completed and assigned. [VERIFIED: lab-results/page.tsx:243–307]

- **Zdravotné pripomienky (`/care-reminders`):** Backs `trpc.careReminders.*` on `care_reminders` table. Purpose: proactive per-patient wellness/vaccination reminders — send outreach, set complete/dismissed. Has patient-level scope. [VERIFIED: care-reminders/page.tsx:86]

- **Pripomienky (`/recalls`):** Backs `trpc.notifications.getVaccinationRecallPreview` + `.sendVaccinationReminders`. Purpose: batch vaccination recall messaging — cross-patient list of overdue vaccines for batch outreach. [VERIFIED: recalls/page.tsx:51]

**Boundary verdict:**
- `Záznamy` = **longitudinal patient record** (past history, search across all records for a patient)
- `Vyšetrenia` = **active visit workspace** (today's or recent visits — the clinical workflow surface)
- `Laboratórium` = **lab result review queue** (technician/vet workflow for completing and routing lab results)
- `Zdravotné pripomienky` = **per-patient proactive care tasks** (one clinic-initiated reminder per patient-need)
- `Pripomienky` = **cross-patient batch recall dispatcher** (send to many overdue patients at once)

These ARE meaningfully different — H6 is partially true (the names are confusing) but the underlying implementations don't collapse. The confusion is naming, not architecture.

---

## A. Integration Opportunities

### A1. Záznamy — missing live vitals panel
The patient record page pulls SOAP notes, vaccinations, etc., but the vitals trend chart (`trpc.vitals.listByPatient`) is only surfaced when the records page has an active patient selected AND the component is loaded. There is no inline "current vitals snapshot" panel in the patient record sidebar — a vet must navigate to an encounter to see the latest recorded weight/temperature. [VERIFIED: records/page.tsx:799 — vitals query exists but only in context of an open patient]
**Missing link:** `trpc.vitals.listByPatient` → summary widget in Záznamy patient sidebar.

### A2. Laboratórium — no link to imaging studies
The lab-results page (`/lab-results`) handles blood/biochemistry/urinalysis results, but does not surface imaging studies from `ext_imaging_studies`. A vet reviewing lab results has no way to cross-reference X-ray findings for the same patient from this page.
**Missing link:** `trpc.extensions.imaging.listByPatient` → cross-reference panel in lab-results review screen.

### A3. Zdravotné pripomienky — no direct pathway to schedule from reminder
When a care reminder fires (e.g., "Rabies vaccine due"), the page shows the patient and allows "Send Outreach" — but has no "Schedule Appointment" quick-action that pre-fills appointment type from the reminder's care type. The user must navigate separately to `/schedule`.
**Missing link:** `trpc.appointments.create` → "Book appointment" action button on care-reminder row.

### A4. Pripomienky — no link back to clinical record for each patient
The recall list shows patient names and overdue vaccines but has no deep-link to the patient's vaccination record (`/records?patientId=...`) to inspect why the vaccine is overdue or what prior vaccines exist.
**Missing link:** Patient name in recall list → `/records?patientId=UUID` deep link.

### A5. Záznamy — treatment plans not surfaced alongside records
`trpc.treatmentPlans.*` (longitudinal clinical care plans) and `trpc.treatmentEstimates.*` (visit-scoped client-facing proposals) are never queried from the records page. A vet looking at a patient's full history cannot see their active treatment plan without navigating to an encounter.
**Missing link:** `trpc.treatmentPlans.listByPatient` → "Active care plans" widget in Záznamy.

---

## B. Duplication / Overlap Check

| Pair | Overlap | Evidence |
|---|---|---|
| Záznamy vs Vyšetrenia | **Partial** | Both surface SOAP notes: records page queries `trpc.records.listSoapNotes` (historical, all visits); encounters page opens the SOAP editor per active appointment via `trpc.encounters.*`. Different operational purpose (review vs edit), same data. Not a merge candidate — but records page should be read-only SOAP history, encounters page the editing surface. Currently the distinction is unclear because records/page.tsx also has a full prescription creation form. [VERIFIED: records/page.tsx:891, 1064] |
| Zdravotné pripomienky vs Pripomienky | **Partial** | Both deal with vaccination/care reminders. `care_reminders` (individual, action-per-patient, outreach sendable) vs `notifications.vaccinationRecallPreview` (cross-patient batch). Conceptually adjacent but workflow is different. No merge — but should be the same nav section with clear sub-labels. |
| Laboratórium vs Záznamy (lab_results) | **Near-total for data** | Both use `trpc.records.listLabResults` — records page shows per-patient lab history, lab-results page shows the clinic-wide review inbox. The DATA is the same table; the VIEW is different (one is patient-scoped historical, one is workflow queue). This is a *view split*, not a duplication — keep both but clarify the purpose label. |

---

## C. Nesting Candidates

| Module | Nesting verdict | Where |
|---|---|---|
| Laboratórium | **Borderline** — currently it IS a standalone workflow (the review inbox needs to be discoverable by technicians independently of a specific patient). However, the lab trend charts and per-patient lab history in Záznamy means half its value is patient-scoped. **Recommendation: keep standalone for the queue/inbox, but add a patient-context lab panel inside Vyšetrenia.** | Lab trend panel → inside encounter workspace as a tab |
| Zdravotné pripomienky | **No** — it is a proactive list that spans all patients. It has its own operational cadence (daily workflow for front desk). Keep standalone. | — |
| Pripomienky | **Weak nesting candidate** — could be a "Batch Recall" tab inside Zdravotné pripomienky. They share the vaccination domain. | Tab inside `/care-reminders` |

---

## D. Settings Candidates

| Module | Verdict |
|---|---|
| Záznamy | **No** — daily clinical workflow. |
| Vyšetrenia | **No** — daily clinical workflow. |
| Laboratórium | **No** — daily workflow queue. |
| Zdravotné pripomienky | **No** — daily front-desk workflow. |
| Pripomienky | **Partially** — the *recall configuration* (which vaccines trigger recall, at what interval) lives in settings. But the *execution* page (send batch reminders) is a workflow item. The execution page stays in nav; the schedule config moves to Settings > Clinical Protocols. |

---

## E. Scope-Clarity Verdicts

| Module | Current name clarity | Proposed clarification |
|---|---|---|
| Záznamy | ❌ Ambiguous — "Records" in Slovak PIMS context could mean any saved data | Rename to **Klinická karta** or keep "Záznamy" with subtitle "História pacienta" — the scope is: *all historical clinical entries for a selected patient* |
| Vyšetrenia | ✅ Clear — "Examinations/Visits" accurately describes the active visit workspace | Keep; add scope statement: *active and recent visit workflows — SOAP editing, vitals, closeout* |
| Laboratórium | ⚠️ Partially ambiguous — reads like a physical lab, but is actually a result-review queue | Rename to **Lab výsledky & Inbox** or add subtitle "Príjem výsledkov" |
| Zdravotné pripomienky | ⚠️ Long and overlaps "Pripomienky" | Rename to **Starostlivosť o pacientov** or **Preventívna starostlivosť** |
| Pripomienky | ❌ Too generic — "Reminders" overlaps Zdravotné pripomienky | Rename to **Hromadné vaccinačné výzvy** or **Recall — Hromadné odoslanie** |

---

## F. Recommendations + Migration Risk

| Module | Recommendation | Risk |
|---|---|---|
| Záznamy | **Keep as-is, rename to clarify scope** — "Klinická karta" or keep Záznamy with subtitle. Add vitals snapshot widget and treatment plan panel (§A1, §A5). | **Low** — route unchanged, no role changes. i18n key `nav.records` stays. No e2e specs assert this nav item label specifically [INFERRED from e2e/ scan]. |
| Vyšetrenia | **Keep as-is**. Remove prescription-creation form from records page (move to encounters only) to enforce the boundary. | **Low** — behavioral change inside the page, not navigation. |
| Laboratórium | **Keep as standalone** + add patient-context lab panel inside encounter workspace (new tab). Rename label to "Lab výsledky" for clarity. | **Low** — route unchanged. i18n key `nav.labResults` stays. |
| Zdravotné pripomienky | **Keep as standalone**. Add "Book appointment" action button per row (§A3). | **Low** — enhancement only. |
| Pripomienky | **Merge as tab inside Zdravotné pripomienky**. Route `/recalls` becomes `/care-reminders#batch-recall` tab. | **Med** — deep-link `/recalls` breaks. e2e spec `dogfood.spec.ts` or `fresh-clinic-mock-launch.spec.ts` may assert `/recalls` navigation [INFERRED — could not verify recall-specific e2e]. i18n key `nav.recalls` removed. Role restriction: currently `admin/vet/front_desk` only (not technician or viewer) — consistent with care-reminders roles. |
