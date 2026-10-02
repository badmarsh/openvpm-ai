---
id: 32
kind: sprint
title: AI provenance ledger on SOAP finalization (records, ai, imaging)
state: done
priority: P0
source: GT-001
prs: [74]
targets:
  - packages/db/schema/ext_soap_ai_provenance.ts
  - packages/db/schema/index.ts
  - packages/db/drizzle
  - apps/web/lib/records/soap-ai-provenance.ts
  - apps/web/lib/records/soap-lifecycle.ts
  - apps/web/server/routers/records.ts
  - apps/web/server/routers/ai.ts
  - apps/web/server/routers/extensions/imaging.ts
  - apps/web/lib/ai/draft-safety.ts
  - apps/web/app/(dashboard)/records/new-soap/[patientId]/page.tsx
  - docs/reference/ai-audit-ledger.md
creates:
  - packages/db/schema/ext_soap_ai_provenance.ts
  - apps/web/lib/records/soap-ai-provenance.ts
contract_test: apps/web/server/__tests__/soap-ai-provenance.contract.test.ts
premises:
  - "missing: packages/db/schema/ext_soap_ai_provenance.ts"
  - "missing: apps/web/lib/records/soap-ai-provenance.ts"
  - "lacks: apps/web/lib/records/soap-lifecycle.ts | appendAiAuditEvent"
  - "lacks: apps/web/server/routers/ai.ts | provenanceReceiptId"
  - "contains: apps/web/server/routers/extensions/imaging.ts | injectFindingsIntoSoap: imagingProcedure"
  - "contains: apps/web/lib/ai/audit-ledger.ts | export async function appendAiAuditEvent("
  - "contains: apps/web/lib/ai/draft-safety.ts | entityType: \"soap_note\" | \"discharge_report\" | \"imaging_analysis\" | \"treatment_plan\" | \"prescription\";"
  - "contains: apps/web/app/(dashboard)/records/new-soap/[patientId]/page.tsx | setSubjective(draftTextToHtml(draft.subjective));"
  - "exists: packages/db/drizzle/0113_cheerful_khan.sql"
  - "missing: packages/db/drizzle/meta/0114_snapshot.json"
  - "lines: apps/web/lib/records/soap-lifecycle.ts | 1000..1070"
note: "promoted from GT-001; delivered in #74 (migration 0114_regular_doctor_doom)"
---

# Sprint 32: AI provenance ledger on SOAP finalization

**Why now:** this is P0 clinical evidence, audit finding F-04-1 (`docs/audits/2026-09-ai-ux-audit.md` §4 J-04). A SOAP note that started as an AI draft (`ai.draftSoapNote`), or that had AI imaging findings injected (`imaging.injectFindingsIntoSoap`), is finalized through `records.finalizeSoapNote` → `finalizeAppointmentSoapDraft` **without any `ext_ai_audit_log` row**. Nobody can show later which sentences the model wrote. Voice, discharge, imaging-confirm and the external scribe (`ai.createSoapFromAI`) already append to the ledger; the in-app draft path is the gap.
**Rules:** [`tasks/RULES.md`](../RULES.md) applies in full, in particular §1.2 (the migration must be committed) and §1.8 (ledger inside the transaction).

## 1. Current state (measured 2026-09-27 at `aeeb123b`)

- `apps/web/lib/records/soap-lifecycle.ts` (1,034 lines): `finalizeAppointmentSoapDraft` (≈L362–474) flips `soap_notes.status` to `finalized` and returns `{ outcome: "finalized", note, transitioned: true }`. It doesn't import `appendAiAuditEvent` and its actor is `{ id, name }` only, with no role.
- `apps/web/server/routers/records.ts` `finalizeSoapNote` (≈L1763) is gated by `requireRole("admin", "veterinarian")`, calls the lifecycle in `ctx.db.transaction`, and afterwards dispatches the `soap_note.created` webhook.
- `apps/web/server/routers/ai.ts` `draftSoapNote` (≈L360–560) returns the bare `SoapDraft` (`{subjective, objective, assessment, plan}` strings) from `lib/ai/soap-draft.ts`, and records only `recordUsage(ai_run)`. It knows the model: `resolvePracticeLanguageModel(... "deepThinking")` or `configuredModel()`.
- `apps/web/app/(dashboard)/records/new-soap/[patientId]/page.tsx` ≈L492: `onSuccess: (draft) => { setSubjective(draftTextToHtml(draft.subjective)); … }`. Draft text becomes **HTML** in the editor and is persisted later by `saveSoapDraft`, so a verbatim comparison must be HTML-insensitive.
- `apps/web/app/(dashboard)/encounters/[appointmentId]/page.tsx` ≈L1203: the AI draft goes through `ClinicalDiffConfirmModal`, and only the confirmed **Plan** is copied into `setAmbulatorySoapPlan`. That state feeds `<VisitCloseout soapPlan={ambulatorySoapPlan}>` (≈L1498), **not** `soap_notes`. `AmbulatorySoapCard` only reports plan edits upward through `onPlanChange`. So this path is out of scope here (verified 2026-09-27, see Follow-ups).
- `apps/web/server/routers/extensions/imaging.ts` `injectFindingsIntoSoap` (≈L699): appends `[AI Rádiológia (<TYPE>) – návrh na overenie lekárom]:\n<result>` to `objective` through `saveAppointmentSoapDraft` inside a transaction. `aiImagingAnalyses.modelId` is available.
- `apps/web/lib/ai/audit-ledger.ts`: `appendAiAuditEvent(tx, {practiceId, actorId, actorName, actorRole, entityType: "soap_note" | …7 types, entityId, actionType, originalDraftHash, confirmedContentHash, wasEditedByClinician?})` is fail-closed on role (admin/veterinarian for `soap_note`) and advisory-locked per practice.
- `apps/web/lib/ai/draft-safety.ts` ≈L128: `AiConfirmationAuditRecord.entityType` lists only 5 of the ledger's 7 types (F-20-3).
- The ledger has **no** model, provider or section columns. Its canonical hash is frozen (GT-001 out of scope), which is why per-section provenance lives in a new side table linked by `audit_event_id`.

## 2. Change

**2A. Side table** `packages/db/schema/ext_soap_ai_provenance.ts`, exported from `schema/index.ts`:
`ext_soap_ai_provenance` with `baseColumns()`, `practice_id` (FK practices, not null), `patient_id` (FK patients, not null), `soap_note_id` (FK soap_notes, null until linked), `appointment_id` (nullable), `issued_to` (FK users, not null), `source` pgEnum `soap_ai_source` (`soap_draft`, `imaging_findings`), `source_entity_id` (uuid, nullable; the imaging analysis id), `model_id` (text), `provider` (text, nullable), `feature_key` (text, not null, e.g. `soap_draft` / `imaging`), `draft_hash` (text, not null), `section_hashes` (jsonb `{subjective?, objective?, assessment?, plan?}` → sha256 hex or null), `consumed_at` (timestamptz), `audit_event_id` (uuid, nullable). Indexes: `(practice_id, soap_note_id)` and `(practice_id, patient_id, issued_to, created_at)`. **Store hashes only, never draft text** (GDPR: the text already lives in the note). Run `pnpm db:generate` to produce migration `0114_*`; a second run must print "No schema changes". RLS applies automatically (`practice_id`).

**2B. Pure module** `apps/web/lib/records/soap-ai-provenance.ts` (no DB access):
- `soapSectionPlainText(value)`: strip HTML tags, decode `&nbsp;`/`&amp;`/`&lt;`/`&gt;`, collapse whitespace, trim. Reuse `lib/records/soap-content.ts` helpers if one already does this.
- `hashSoapSections(sections)` → `{subjective, objective, assessment, plan}`: the sha256 hex of the plain text, or `null` when empty.
- `hashSoapDraft(sections)` → sha256 over the canonical JSON of the four plain-text sections (fixed key order).
- `classifySectionProvenance(draftHashes, finalSections)` → per section `ai_verbatim` (same hash) · `ai_edited` (draft non-null, final non-empty, different hash) · `ai_removed` (draft non-null, final empty) · `manual` (draft null, final non-empty) · `none` (both empty; omit from the result). The contract case 3 fixes the expected output.
- `buildSoapAiFinalizationEvent(receipts, finalSections)` → `null` when `receipts` is empty. Otherwise `{ originalDraftHash, confirmedContentHash, wasEditedByClinician, sections }`:
  - `originalDraftHash`: the receipt's `draftHash` if there is exactly one, else sha256 of the sorted `draftHash`es joined by `\n`;
  - `confirmedContentHash`: `hashSoapDraft(finalSections)`;
  - `wasEditedByClinician`: true unless every AI-touched section is `ai_verbatim`;
  - `sections`: the merged classification. Where several receipts touch a section, any verbatim match wins.

**2C. Issue receipts** (server-side only; the client never supplies hashes):
- `ai.draftSoapNote`: after a successful draft, insert a receipt (`source: "soap_draft"`, `feature_key: "soap_draft"`, `issued_to: ctx.user.id`, `soap_note_id: null`, `model_id` = the resolved model id if obtainable, else `"configured"`) and return `{ ...draft, provenanceReceiptId }`. Additive: existing consumers ignore the new field.
- `imaging.injectFindingsIntoSoap`: in the **same transaction** as `saveAppointmentSoapDraft`, insert a receipt (`source: "imaging_findings"`, `source_entity_id: analysis.id`, `model_id: analysis.modelId`, `feature_key: "imaging"`, `section_hashes: { objective: hash(imagingFinding) }`, linked to the saved `draft.id`). Move the transaction boundary to wrap both writes.

**2D. Link on save:** `records.saveSoapDraft` gets optional `aiProvenanceReceiptId: z.string().uuid().optional()`. When present, inside the save transaction: lock the receipt `FOR UPDATE` and require the same `practice_id`, the same `patient_id`, `issued_to = ctx.user.id`, `consumed_at IS NULL`, `soap_note_id IS NULL OR = saved note id`, and `created_at` within 24 h. Then set `soap_note_id` and `appointment_id`. If it doesn't qualify, throw `PRECONDITION_FAILED` "AI draft receipt is not valid for this note." (English, per the protocol doc). Saving the same receipt twice is idempotent.

**2E. Append on finalize:** `finalizeAppointmentSoapDraft` input gets `actor.role`. Only on the `transitioned: true` branch, in the same `db`/transaction: select the unconsumed receipts for `soap_note_id = finalized.id` `FOR UPDATE`, then `buildSoapAiFinalizationEvent(receipts, normalizeSoapSections(finalized))`. If that isn't null, call `appendAiAuditEvent(db, { entityType: "soap_note", entityId: finalized.id, actionType: "soap_note_finalized", actorRole, … })`, then set `consumed_at = now()` and `audit_event_id` on those receipts. If the append throws, the whole finalization rolls back (fail closed, RULES §1.8). No receipts → no ledger row and behaviour is unchanged. `records.finalizeSoapNote` passes `role: ctx.user.role` using the existing `requireClinicalActorRole` helper from `ai.ts` (move it to a shared lib if it's router-local).

**2F. Client:** `new-soap/[patientId]/page.tsx` keeps `draft.provenanceReceiptId` in state after `draftWithAi` succeeds and sends it as `aiProvenanceReceiptId` on the next `saveSoapDraft`/autosave. It clears the value once the save succeeds. No visible UI change, so no i18n change is expected. Encounter page: see §1. Only wire it if the plan reaches `soap_notes`.

**2G. Alignment:** `AiConfirmationAuditRecord.entityType` becomes `AppendAiAuditEventInput["entityType"]` (import the type). In `docs/reference/ai-audit-ledger.md`, add a "Surfaces that write" table: surface · router procedure · `actionType` · entity type. Rows: voice, discharge, imaging confirm, `ai.createSoapFromAI`, `records.finalizeSoapNote` (new), marketing.

Presentation-only? **No.** This is a clinical-evidence write path.

## 3. Frozen (DO NOT TOUCH)

- `ClinicalDiffConfirmModal`, `lib/ai/clinician-confirmation.ts` (the envelope protocol), `lib/ai/audit-chain.ts` (canonical hash, v1) and the `ext_ai_audit_log` schema.
- `records.finalizeSoapNote` does **not** start requiring a confirmation envelope in this sprint. **Sprint 33** adds that gate on top of the receipts introduced here (owner decision 2026-09-27: the veterinarian must make the final, attributable click on AI content).
- The existing lifecycle outcomes (`finalized` / `conflict`, `transitioned`), the conflict and revision semantics, and the post-commit `soap_note.created` webhook ordering.
- Tests that must stay green: `lib/records/__tests__/soap-lifecycle.test.ts`, `server/__tests__/pilot-clinical-flow.test.ts`, `server/__tests__/extensions-ai-finalization.test.ts`, `server/__tests__/ai-draft-safety.test.ts`, `lib/__tests__/i18n-structure.test.ts`, plus every `lib/ai/__tests__/*audit*` test.
- No draft text in the new table. Hashes only.

## 4. Contract

`apps/web/server/__tests__/soap-ai-provenance.contract.test.ts` has 11 armed cases (`it.fails`) covering 2A–2G. Flip each one to `it` as it lands. On top of the contract, add behavioural tests with the scripted-DB pattern from `ai-draft-safety.test.ts` for the three GT-001 scenarios:
1. AI draft → save with receipt → finalize: exactly one `appendAiAuditEvent` with `actionType: "soap_note_finalized"`, and the receipt is consumed.
2. Imaging inject → finalize: one event, and `sections.objective` is `ai_verbatim` or `ai_edited`.
3. A manual note → finalize: no ledger call.

Plus a negative test: a receipt issued to another user, or for another patient, is rejected on save with `PRECONDITION_FAILED`.

```bash
pnpm --filter @openpims/web exec vitest run server/__tests__/soap-ai-provenance.contract.test.ts \
  lib/records/__tests__/soap-lifecycle.test.ts server/__tests__/pilot-clinical-flow.test.ts \
  server/__tests__/extensions-ai-finalization.test.ts server/__tests__/ai-draft-safety.test.ts
pnpm --filter @openpims/db db:generate   # second run: "No schema changes"
pnpm --filter @openpims/web type-check && pnpm --filter @openpims/web lint
```

If a Postgres is available, extend `ai-clinical-finalization.integration.test.ts` with scenario 1 (it's env-gated and runs in the CI RLS job).

## 5. Follow-ups (report only)

- ~~Should finalization require a confirmation envelope when AI receipts are linked?~~ Decided 2026-09-27 (yes, as a legal requirement for the vet's final click). Specified as Sprint 33.
- GT-006 (per-section acceptance plus a visible AI marker) can read `ext_soap_ai_provenance` directly.
- Retroactive provenance for existing notes is explicitly out of scope (GT-001).
- The encounter page's AI draft feeds the visit closeout plan (`VisitCloseout soapPlan`), not `soap_notes` (§1). Does the closeout write that AI text anywhere persistent without a ledger row? Check it and spec it separately if so.
