# Cluster: AI / Agent

**Commit:** `65e008d` | **Cluster:** ai-agent | **Date:** 2026-09-14

Modules covered: Agent (`/agent`), Analýza Snímkov (`/agent/imaging`), Hlasové Diktovanie (`/agent/voice`), Prepúšťacie Správy (`/agent/discharge`), Vet Intelligence (`/vet-intel`). Tests H4 (discharge should be inside Records/Encounters), H5 (imaging should be inside Lab/Imaging).

---

## H4 Verdict: TRUE — Prepúšťacie Správy should nest inside Encounters/Records, not be a top-level nav item

**Evidence:**

The discharge page (`/agent/discharge`) operates on a patient-appointment pair:
- First action: search for a patient (`trpc.patients.search`) [VERIFIED: discharge/page.tsx:126]
- Optional: link to an appointment (`trpc.patients.getById` to get appointment context) [VERIFIED: discharge/page.tsx:131]
- Core action: `trpc.extensions.discharge.generate` → saves to `discharge_reports` table, writes SOAP via `ext_discharge.ts` schema linkage [VERIFIED: discharge/page.tsx:182–183]
- Save action: `trpc.extensions.discharge.save` then `trpc.extensions.discharge.generateSmsAndSchedule` to SMS the client [VERIFIED: discharge/page.tsx:183–186]
- Secondary action: `trpc.extensions.discharge.createMarketingPostFromCase` — one-click create social post from the discharge case [VERIFIED: discharge/page.tsx:187]

The discharge summary is semantically tied 1:1 to a specific patient visit (appointment/encounter). The ONLY reason it appears at the top level is that it was added as a custom nav item under the AI extension pattern. The `discharge_reports` table links to `patients` (required) and `appointments` (optional). [VERIFIED: discharge.ts:85–86]

**Verdict:** H4 is TRUE. This is a clinical document feature that belongs inside the Encounter workspace as a tab or action — "Generate Discharge Summary" — not a standalone nav item. The secondary "create marketing post from case" is a bonus action, not a justification for standalone nav.

---

## H5 Verdict: TRUE — Analýza Snímkov should live inside the imaging/lab workflow, not as a standalone AI nav item

**Evidence:**

The imaging page (`/agent/imaging`) uses:
- `trpc.extensions.imaging.analyze` — AI analysis of uploaded image [VERIFIED: imaging router:142]
- `trpc.extensions.imaging.injectFindingsIntoSoap` — writes AI findings directly into a SOAP note via the shared soap lifecycle (`saveAppointmentSoapDraft`) [VERIFIED: imaging.ts:539, imports `soapNotes`, `saveAppointmentSoapDraft`, `assertAiMayWriteToSoapNote`]
- `trpc.extensions.imaging.createSurgicalPlanFromImaging` — generates surgical plan [VERIFIED: imaging.ts:313]
- `trpc.extensions.imaging.calculateVhs` — VHS cardiac measurement [VERIFIED: imaging.ts:632]
- `trpc.extensions.imaging.listByPatient` — patient imaging history [VERIFIED: imaging.ts:270]

The imaging analysis workflow is: upload image → AI analyzes → optionally inject findings into SOAP note of an active encounter. This is the imaging step IN a diagnostic workflow, not a standalone tool. The page also opens with a patient selector, reinforcing that it operates within patient/encounter context.

The router also imports `validateMarketingText` [VERIFIED: imaging.ts:32] for the `createMarketingQuizFromImaging` procedure — a marketing feature bolted on.

**Verdict:** H5 is TRUE. The AI imaging analysis should be a tab/panel inside the encounter workspace (same place where a vet uploads and reviews imaging during a visit), not a top-level nav item. The marketing quiz generator is a bonus action accessible from within that panel.

---

## A. Integration Opportunities

### A1. Agent chat — no quick-start from patient/encounter context
The Agent (`/agent`) chat interface has no deep-link entry from a patient record or active encounter. A vet viewing a patient's records who wants to ask the AI about drug interactions must navigate to `/agent` separately, losing patient context. The `patientId` context is not passed.
**Missing link:** "Ask Agent" button in patient/encounter header → `/agent?patientId=UUID&context=encounter`.

### A2. Discharge — appointment/encounter is only optionally linked
The `generate` procedure accepts `appointmentId` as optional [VERIFIED: discharge.ts:86]. In practice, the page's patient search shows no active encounter status — the vet must know which appointment to reference. The page should auto-suggest the patient's most recent checked-out appointment.
**Missing link:** `trpc.appointments.list({patientId, status:'checked_out'})` → auto-suggest in discharge page.

### A3. Voice dictation — no direct "save to current encounter" shortcut
The voice page accepts a `patientId` query param [VERIFIED: voice/page.tsx:78] and generates a SOAP draft via `trpc.extensions.voice.*`. However, there is no button to "Open encounter" after saving the SOAP draft — the vet must navigate to `/encounters` separately.
**Missing link:** After SOAP confirmation → "Open in Encounter" deeplink button.

### A4. Imaging — no link to imaging study history from the lab-results page
When a vet reviews lab results (`/lab-results`), there is no cross-reference panel for imaging studies from `ext_imaging_studies`. Both are diagnostic results for the same patient.
**Missing link:** `trpc.extensions.imaging.listByPatient` → panel in lab-results or encounter workspace.

### A5. Vet Intelligence — competitor data not surfaced in marketing plan
The `/vet-intel` page runs competitor analysis and stores snapshots in `ext_marketing_competitor_snapshots`. But the Marketing Plan page (`/marketing/plan`) doesn't surface this intelligence as content suggestions or campaign angles.
**Missing link:** `trpc.extensions.marketing.listCompetitorSnapshots` → insight panel in `/marketing/plan`.

---

## B. Duplication / Overlap Check

| Pair | Overlap | Evidence |
|---|---|---|
| Agent `/agent` vs Analýza Snímkov `/agent/imaging` | **Partial** | Both use AI inference. Agent tools include `analyze_imaging` [VERIFIED: SKILL.md §6 — 26 tools], which overlaps with the standalone imaging page. The standalone page provides a richer UI (VHS calculator, DICOM viewer) that the chat interface can't match — they are complementary, not duplicates. |
| Hlasové Diktovanie `/agent/voice` vs Agent `/agent` | **Partial** | Voice tool `record_vitals_from_speech` exists in the agent [VERIFIED: tools.ts context from ux-analysis]. But the standalone voice page provides full microphone recording UX that a text chat interface cannot replace. Not a duplicate — but the agent's voice capability should link to the standalone page. |
| Prepúšťacie Správy vs Agent `create_discharge_summary` tool | **Near-total** | The agent tool `create_discharge_summary` [VERIFIED: ux-analysis §4a — 10 write-capable tools including this] does the same thing as the discharge page but through the chat interface. The standalone page adds: history list, SMS scheduling, marketing post creation. The core function is duplicated. After H4 merge (discharge becomes an encounter tab), the standalone page's history view could remain accessible from within the encounter, and the agent tool becomes the quick-path. |
| Vet Intelligence `/vet-intel` vs Marketing Studio `/marketing` | **Partial** | Vet Intel is positioned as competitor intelligence feeding marketing strategy. The Marketing Studio dashboard also shows channel performance. They share the marketing domain but serve different workflows (external intelligence vs own channel management). Not a merge candidate but should be colocated. |

---

## C. Nesting Candidates

| Module | Nesting verdict | Where |
|---|---|---|
| Analýza Snímkov | **YES — strong candidate** | Nest as a tab inside the **Encounter workspace** (accessible within `/encounters/[id]` and optionally from `/records` patient sidebar). The standalone `/agent/imaging` route can remain for direct URL access but should be removed from top-level nav. |
| Prepúšťacie Správy | **YES — strong candidate** | Nest as an action/tab inside **Encounter closeout** (the visit closeout workflow in `/encounters`). Also accessible via a "Generate discharge" button on a patient's record page. Remove from top-level nav. |
| Hlasové Diktovanie | **Borderline** | Voice dictation is used at the START of or DURING an encounter. It could be an icon-button within the encounter workspace (SOAP editor), deep-linking to the voice page with `encounterId` pre-filled. However, it is also used outside of encounters (vitals dictation standalone). Keep as a nav item but move from admin section to clinical section — it's a daily clinical tool, not an admin feature. |
| Agent | **Keep as standalone** | The Agent chat is a general-purpose interface that spans all domains. It should remain a top-level nav item, role-restricted to admin/vet. |
| Vet Intelligence | **Borderline** | Could be a tab inside Marketing Studio. The standalone page is thin — mostly a trigger button + competitor list. Strong candidate for nesting under `/marketing` as a sub-page, not a top-level nav item. |

---

## D. Settings Candidates

| Module | Verdict |
|---|---|
| Agent | **No** — daily clinical/admin workflow. |
| Analýza Snímkov | **No** — daily clinical workflow (if nested in encounter). |
| Hlasové Diktovanie | **No** — daily clinical workflow. |
| Prepúšťacie Správy | **No** — daily clinical workflow (if nested in encounter). |
| Vet Intelligence | **Partially** — the *competitor configuration* (which competitors to monitor, digest email toggle) is setup/admin. The monitoring execution is a workflow. Competitor config → Settings > Marketing. The competitor list/snapshots page → inside Marketing Studio. |

---

## E. Scope-Clarity Verdicts

| Module | Current name clarity | Proposed clarification |
|---|---|---|
| Agent | ✅ Clear | Keep — "Agent" with AI badge is internationally understood |
| Analýza Snímkov | ⚠️ "Image Analysis" is clear but misplaced in nav | After nesting: rename tab to **"AI analýza"** within the imaging section of the encounter workspace |
| Hlasové Diktovanie | ✅ Clear — "Voice Dictation" is accurate | Keep name; fix section assignment (clinical, not admin) |
| Prepúšťacie Správy | ⚠️ Clear but misplaced | After nesting: tab label **"Prepúšťacia správa"** within encounter closeout |
| Vet Intelligence | ❌ English name in Slovak product | Rename to **"Analýza konkurencie"** and nest under Marketing Studio |

---

## F. Recommendations + Migration Risk

| Module | Recommendation | Risk |
|---|---|---|
| Analýza Snímkov (`/agent/imaging`) | **Nest inside Encounter workspace** as "Snímky & AI analýza" tab. Remove from sidebar. Route `/agent/imaging` can remain for legacy links but no longer nav-visible. | **Med** — remove from custom-nav.ts: `nav.agentImaging` i18n key deprecated; `/agent/imaging` bookmarks still work (route not removed); no known e2e spec asserts this nav item [INFERRED]. Role: currently admin/vet — consistent with encounter roles. |
| Prepúšťacie Správy (`/agent/discharge`) | **Nest inside Encounter closeout** as action button + tab. Remove from sidebar. | **Med** — `nav.agentDischarge` i18n key deprecated; `/agent/discharge` bookmarks still work; `discharge_reports` linking to appointments becomes stronger. No known e2e specifically testing discharge nav [INFERRED]. |
| Hlasové Diktovanie (`/agent/voice`) | **Move to clinical section** from admin section. Keep as top-level nav item (accessed during/before encounters). Add deeplink from encounter SOAP editor. | **Low** — only `section` changes in custom-nav.ts; route unchanged; roles unchanged. |
| Agent (`/agent`) | **Keep as-is**. | None |
| Vet Intelligence (`/vet-intel`) | **Nest as tab inside Marketing Studio** (`/marketing#competition` or `/marketing/competitors`). Remove from top-level nav. | **Low** — `nav.vetIntel` i18n key deprecated; `/vet-intel` route can redirect. No known e2e for this item [INFERRED]. |
