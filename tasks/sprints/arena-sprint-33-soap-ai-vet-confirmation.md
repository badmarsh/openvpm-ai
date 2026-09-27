---
id: 33
kind: sprint
title: Vet's final confirmation click on AI-assisted SOAP notes
state: done
priority: P0
source: GT-001
depends_on: [32]
prs: [76]
targets:
  - apps/web/server/routers/records.ts
  - apps/web/lib/records/soap-lifecycle.ts
  - apps/web/components/records/ai-soap-finalize-dialog.tsx
  - apps/web/components/records/ambulatory-soap-card.tsx
  - apps/web/app/(dashboard)/records/new-soap/[patientId]/page.tsx
  - apps/web/messages/en.json
  - apps/web/messages/sk.json
  - docs/confirmation-protocol.md
creates:
  - apps/web/components/records/ai-soap-finalize-dialog.tsx
contract_test: apps/web/server/__tests__/soap-finalization-confirmation.contract.test.ts
premises:
  - "lacks: apps/web/server/routers/records.ts | prepareSoapFinalization"
  - "contains: apps/web/components/records/ambulatory-soap-card.tsx | const finalize = trpc.records.finalizeSoapNote.useMutation({"
  - "contains: apps/web/app/(dashboard)/records/new-soap/[patientId]/page.tsx | const finalizeMutation = trpc.records.finalizeSoapNote.useMutation()"
  - "contains: apps/web/lib/ai/clinician-confirmation.ts | export async function issueClinicianConfirmation("
  - "contains: apps/web/lib/ai/clinician-confirmation.ts | export async function consumeClinicianConfirmation("
  - "contains: apps/web/server/routers/extensions/_safety.ts | export function requireConfirmationEnvelopeId("
  - "missing: apps/web/components/records/ai-soap-finalize-dialog.tsx"
note: "owner decision 2026-09-27: the vet makes the final click on AI content; blocked on 32"
---

# Sprint 33: The vet's final confirmation click on AI-assisted SOAP notes

**Why now:** this is the owner's decision of 2026-09-27. When a SOAP note contains AI-generated text, the responsible veterinarian must make an explicit, attributable final confirmation before it enters the medical record. The code base already treats this as law: `ai-swarm.ts` notes `humanInTheLoop: true // Zákon 39/2007 Z. z. §3`, and the encounter toast cites *Act 39/2007 Coll.* Voice, discharge and imaging already enforce it with the Option 1 envelope (`docs/confirmation-protocol.md`). The in-app SOAP editor is the last AI path finalized by a plain button.
**Depends on:** Sprint 32. Its `ext_soap_ai_provenance` receipts are how the server knows a note is AI-assisted. The status reads `BLOCKED` until 32 is `done`.
**Rules:** [`tasks/RULES.md`](../RULES.md), §1.1 in particular. `ClinicalDiffConfirmModal` and `lib/ai/clinician-confirmation.ts` are reused **unchanged**.

## 1. Current state (measured 2026-09-27)

- There are two finalize callers, and both call `records.finalizeSoapNote` directly:
  - `app/(dashboard)/records/new-soap/[patientId]/page.tsx` ≈L194 `const finalizeMutation = trpc.records.finalizeSoapNote.useMutation()` (this literal is **pinned** by `lib/__tests__/soap-editor-ui.test.ts` L94) and ≈L527 `await finalizeMutation.mutateAsync(...)`;
  - `components/records/ambulatory-soap-card.tsx` ≈L187 `const finalize = trpc.records.finalizeSoapNote.useMutation({ … })` and ≈L235 `await finalize.mutateAsync(...)`.
- The envelope primitives exist:
  - `issueClinicianConfirmation(db, {practiceId, actorId, actorRole, actionType, entityType, entityId, expectedRevision, originalDraftHash, confirmedContentHash, ttlSeconds?, correlationId?})`, which is admin/vet only with a 900 s TTL;
  - `consumeClinicianConfirmation(db, …)`;
  - `requireConfirmationEnvelopeId()` and the zod `clinicianConfirmationInput`, used by `imaging.ts` L876.
  - Reference: `discharge.prepareConfirmation` (`discharge.ts` ≈L232) → `finalize`.
- After Sprint 32, `finalizeAppointmentSoapDraft` can see the linked receipts and computes `buildSoapAiFinalizationEvent(...)`, which gives `originalDraftHash`, `confirmedContentHash` and per-section provenance.

## 2. Change

**2A. `records.prepareSoapFinalization`** (`requireRole("admin", "veterinarian")`), input `{patientId, appointmentId, noteId, expectedRevision}`:
- Load the draft and its unconsumed receipts, then build the event with Sprint 32's helper.
- If there are no receipts, return `{ required: false }`.
- Otherwise call `issueClinicianConfirmation` with `actionType: "soap_note_finalized"`, `entityType: "soap_note"`, `entityId: noteId`, `expectedRevision`, and both hashes from the event. It returns `{ required: true, confirmationId, expiresAt, sections }`, where `sections` is the per-section provenance, so the dialog can show it without sending any draft text.

**2B. `records.finalizeSoapNote`** takes `clinicianConfirmed: clinicianConfirmationInput.optional()` and passes it to the lifecycle. Inside `finalizeAppointmentSoapDraft`, on the `transitioned` branch, when receipts exist:
- A missing envelope throws `new SoapLifecycleError("PRECONDITION_FAILED", "This SOAP note contains AI-generated content. Review it and confirm as the responsible veterinarian before finalizing.")`.
- Otherwise call `consumeClinicianConfirmation` with the same bindings **before** the ledger append from Sprint 32, all in the one transaction (protocol §2.6).
- Every binding mismatch, expiry or replay surfaces through the existing error contract (§2.5).
- Notes without receipts are unchanged: no envelope and no extra click.

**2C. `getSoapDraft`** adds `aiAssisted: boolean` (true when unconsumed receipts are linked), so the UI knows before the click.

**2D. `components/records/ai-soap-finalize-dialog.tsx`** (new): `export function AiSoapFinalizeDialog({ open, sections, onConfirm, onCancel, pending })`.
- Built from shadcn `AlertDialog` and the page-kit tokens.
- It lists each section with its provenance label (`soap.aiConfirm.section_ai_verbatim` / `_ai_edited` / `_ai_removed` / `_manual`).
- It shows a checkbox, `t("soap.aiConfirm.acknowledge", "I reviewed this content and take responsibility for it as the attending veterinarian.")`.
- The confirm button uses `disabled={pending || !acknowledged}`. **This is the vet's final click.**

**2E. Callers:** in both finalize handlers:
- If `draft.aiAssisted`, call `prepareSoapFinalization`. If `required`, open the dialog, and on confirm call `finalizeSoapNote({... , clinicianConfirmed: { confirmationId }})`.
- On `CONFLICT` (expired or stale), re-prepare once. On `PRECONDITION_FAILED`, show the server message.
- Keep the pinned literal `const finalizeMutation = trpc.records.finalizeSoapNote.useMutation()` exactly.

**2F. i18n** (en + sk, nested): `soap.aiConfirm.{title, body, acknowledge, confirm, cancel, section_ai_verbatim, section_ai_edited, section_ai_removed, section_manual, expired}`.

**2G. Docs:** in `docs/confirmation-protocol.md` §1 and the §4 implementation map, add the SOAP editor path (`records.prepareSoapFinalization` → `records.finalizeSoapNote`).

Presentation-only? **No.** This adds a clinical-safety gate.

## 3. Frozen (DO NOT TOUCH)

- `ClinicalDiffConfirmModal`, `lib/ai/clinician-confirmation.ts`, `lib/ai/audit-chain.ts` and `ext_clinician_confirmations`.
- Manual SOAP finalization UX, which gets no new click. This is the key product constraint.
- Pinned literals in `soap-editor-ui.test.ts` (`const finalizeMutation = trpc.records.finalizeSoapNote.useMutation()`, `"SOAP note finalized in another session"`, `if (finalizedElsewhereRef.current) return;`, `finalizedElsewhere || !draftInitialized || conflictRef.current`, the `already_finalized` ordering) and `encounter-workspace-ui.test.ts` (the `<a href>` new-soap links and `closeoutQuery.data?.closeout?.status !== "clinical_finalized"`).
- Tests that must stay green: `soap-editor-ui.test.ts`, `encounter-workspace-ui.test.ts`, `lib/records/__tests__/soap-lifecycle.test.ts`, `server/__tests__/pilot-clinical-flow.test.ts`, `server/__tests__/ai-draft-safety.test.ts`, the Sprint 32 contract and `i18n-structure.test.ts`.

## 4. Contract

`apps/web/server/__tests__/soap-finalization-confirmation.contract.test.ts` has 8 armed cases. Also add behavioural tests with a scripted DB:
1. AI-assisted draft finalized without an envelope → `PRECONDITION_FAILED`, nothing written.
2. prepare → finalize → one consumed envelope and one ledger row.
3. Replaying the same `confirmationId` → `CONFLICT`.
4. Editing the note after prepare (hash mismatch) → `PRECONDITION_FAILED`.
5. A manual note finalizes without prepare, exactly as before.

If Postgres is available, extend `ai-clinical-finalization.integration.test.ts` with cases 2 and 3.

## 5. Follow-ups (report only)

- The e2e pilot (`e2e/ai-finalization-pilot.spec.ts`) could add the SOAP path once the UI lands.
- GT-006 (per-section acceptance and a visible AI marker in the editor) naturally reuses the dialog's provenance labels.
- Legal wording of the acknowledgement text: have the owner (MVDr.) confirm the Slovak phrasing.
