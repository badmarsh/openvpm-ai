# Clinician Confirmation Protocol (AI Finalization)

**Version:** 1.0.0
**Date:** 2026-09-12
**Status:** IMPLEMENTED_AND_TESTED
**Repository:** `badmarsh/openvpm-ai`

---

## 1. Purpose

No AI-derived clinical content may enter the medical record as finalized
documentation without an explicit, attributable, replay-safe clinician
confirmation. This document specifies the two supported confirmation paths:

- **Option 1 (standard, envelope-required):** all browser/API finalization
  of AI drafts (voice SOAP, discharge, imaging, treatment plans).
- **Option 2 (transitional, direct):** the external AI-scribe hook
  (`ai.createSoapFromAI`), which is create-only and has no pre-existing
  draft entity to bind an envelope to.

Server error messages stay in English per Skill §2; all user-facing
localization happens on the client via `useI18n()`.

---

## 2. Option 1 — One-time confirmation envelopes (standard)

### 2.1 Flow

```
clinician reviews draft in UI
        │
        ▼
prepareConfirmation({ draftId, subjective, objective, assessment, plan })
        │  issues envelope (PENDING, TTL 15 min)
        ▼
returns { confirmationId, expectedRevision, expiresAt, originalDraftHash, confirmedContentHash }
        │
        ▼
finalize({ ..., expectedRevision, clinicianConfirmed: { confirmationId } })
        │  consumes envelope atomically inside the finalization transaction
        ▼
record finalized + audit event appended (same transaction)
```

### 2.2 Envelope bindings

Each row in `ext_clinician_confirmations` binds:

| Binding | Purpose |
|---|---|
| `practiceId`, `actorId`, `actorRole` | Tenant + attributable clinician |
| `actionType`, `entityType`, `entityId` | Exact operation + draft identity |
| `expectedRevision` | Optimistic-concurrency token of the draft |
| `originalDraftHash` | SHA-256 of the AI draft at prepare time |
| `confirmedContentHash` | SHA-256 of the clinician content being confirmed |
| `status` PENDING → CONSUMED | One-time use |
| `expiresAt` (default TTL 900 s) | Bounded confirmation window |

Consume re-validates **every** binding: a token issued for draft A, revision 0,
or different content cannot finalize draft B, revision 1, or edited content.

### 2.3 Why bare booleans are rejected

A bare `clinicianConfirmed: true` carries no nonce, no expiry, and no payload
binding, so it cannot provide replay protection: a captured request could be
replayed verbatim to finalize arbitrary content. Routers therefore require an
envelope reference via `requireConfirmationEnvelopeId()` and reject missing
values **and** bare `true` with `PRECONDITION_FAILED`.

Layering note: `isClinicianConfirmed(true) === true` still holds at the
`draft-safety` type level (legacy shape recognition), but no standard
finalization router accepts it — envelope enforcement lives in the routers
and in `routers/extensions/_safety.ts`.

### 2.4 Revision discipline

`expectedRevision` is mandatory on every finalize/update path
(`requireExpectedRevision()`); there is no silent fallback to the stored
revision. A stale token fails with `CONFLICT` naming both revisions, and the
UI instructs the clinician to reload and retry. Draft saves do not consume
the token.

### 2.5 Error contract

| Situation | tRPC code | Remediation |
|---|---|---|
| Missing envelope / bare boolean | `PRECONDITION_FAILED` | Review content, call prepare, retry |
| Envelope expired (TTL 15 min) | `CONFLICT` | Re-prepare (fresh review) |
| Envelope already consumed (replay) | `CONFLICT` | Do not retry; record state is authoritative |
| Revision mismatch (concurrent edit) | `CONFLICT` | Reload record, re-prepare |
| Entity/action/actor/practice/content binding mismatch | `PRECONDITION_FAILED` | Token belongs to a different confirmation |
| Draft already finalized | `CONFLICT` | Resume the existing record |
| Envelope not found | `NOT_FOUND` | Re-prepare |

The voice/discharge UI surfaces localized `CONFLICT` /
`PRECONDITION_FAILED` remediation toasts (symmetric `en`/`sk` keys).

### 2.6 Atomicity

Envelope consumption, the clinical write, the draft→record link, and the
audit-ledger append run in **one database transaction**. If any step fails,
the envelope stays PENDING (consumable by a retry within TTL) and no partial
record exists. Finalization is additionally serialized per encounter with a
transaction-scoped advisory lock so concurrent finalizers cannot create
duplicate finalized notes.

---

## 3. Option 2 — Direct confirmation (transitional, scribe hook only)

`ai.createSoapFromAI` is the inbound hook external AI scribes POST finished
notes to. It creates an **immediately finalized** record from content with no
pre-existing draft row, so there is nothing to bind a pre-issued envelope to.

Transitional guarantees:

1. Caller must be `admin`/`veterinarian` and assert `clinicianConfirmed`
   (missing/`false` fails validation before any database work).
2. The confirmation is recorded distinctly with correlation id
   `direct:createSoapFromAI` via `assertAndConsumeDirectConfirmation()`,
   binding actor/practice/entity/revision-0/content hashes like an envelope.
3. Whole-request replay is refused by the SOAP lifecycle: a second POST for
   the same encounter fails with `CONFLICT` (existing draft/finalized note).
4. The audit-ledger append still runs in the same transaction.

**Deprecation plan:** migrate scribe integrations to draft-first finalize
(POST draft → clinician review in UI → Option 1 finalize), then remove the
direct path. The distinct correlation id makes direct confirmations countable
in the ledger at any time (`SELECT count(*) … WHERE correlation_id =
'direct:createSoapFromAI'` or the audit action type), so migration progress is
measurable and the removal can be gated on zero usage over a full pilot week.

---

## 4. Implementation map

| Piece | Location |
|---|---|
| Envelope issue/consume | `apps/web/lib/ai/clinician-confirmation.ts` |
| Router guards (`requireConfirmationEnvelopeId`, `requireExpectedRevision`) | `apps/web/server/routers/extensions/_safety.ts` |
| Draft-safety layer | `apps/web/lib/ai/draft-safety.ts` |
| Voice / discharge / imaging finalize | `apps/web/server/routers/extensions/{voice,discharge,imaging}.ts` |
| Scribe hook (Option 2) | `apps/web/server/routers/ai.ts` (`createSoapFromAI`) |
| Ledger append | `apps/web/lib/ai/audit-ledger.ts` |
| Chain verifier | `apps/web/lib/ai/audit-chain.ts`, `scripts/verify-ai-audit-trail.ts` |
| UI prepare → finalize | `apps/web/app/(dashboard)/agent/{voice,discharge}/page.tsx` |
| i18n remediation keys | `apps/web/messages/{en,sk}.json` |

## 5. Test evidence

- Real-DB contract: `apps/web/server/__tests__/ai-clinical-finalization.integration.test.ts`
  (16 tests, env-gated, run in the CI RLS job) — issue/consume, true replay,
  cross-entity reuse, expiry, cross-tenant denial, role denial,
  bare-boolean/missing-revision fail-closed, concurrent races.
- Pilot smoke: `e2e/ai-finalization-pilot.spec.ts` — login → prepare →
  finalize → replay-rejected against a live server.
- Lifecycle honesty: `apps/web/server/__tests__/ai-draft-safety.test.ts`.
