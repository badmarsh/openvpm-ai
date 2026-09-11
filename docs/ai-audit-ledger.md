# AI Audit Ledger — Design, Canonicalization, and Threat Model

**Version:** 2.0.0  
**Date:** 2026-09-09  
**Status:** IMPLEMENTED_AND_TESTED  
**Repository:** `badmarsh/openvpm-ai`

---

> [!IMPORTANT]
> This is **application-level tamper-evidence only**. It detects in-database mutations of audit records but does **not** prevent a privileged DBA from altering records AND recomputing hashes without detection. It is **not** WORM storage, an independently notarized ledger, or legally certified forensic proof. See §5 for the complete threat model and external anchoring strategy.

---

## 1. Purpose

The `ext_ai_audit_log` table records every clinician confirmation of AI-generated clinical content in OpenVPM AI. Each event is cryptographically linked to its predecessor, so any alteration, deletion, insertion, or reordering of audit records is detectable by the chain verifier.

**Regulatory context:** Required for ŠVPS SR / KVL SR inspections and GDPR accountability under Zákon č. 18/2018 Z. z. — establishing that AI output was reviewed and explicitly confirmed by a licensed veterinarian before entering the medical record.

---

## 2. Chain Model

### 2.1 Chain Scope

The chain is **practice-scoped**: each `practiceId` maintains an independent, monotonically numbered event chain. Events across practices are isolated and do not reference each other.

**Rationale:** Practice-scoped chains match the RLS tenant isolation boundary, allow per-clinic verification, and prevent cross-tenant linkage.

### 2.2 Event Fields

| Field | Type | In Hash | Notes |
|---|---|---|---|
| `id` | UUID | ❌ | DB identifier — not in integrity payload |
| `practiceId` | UUID | ✅ | Tenant identifier |
| `sequenceNumber` | integer | ✅ | Monotonic per practice chain |
| `actorId` | UUID | ✅ | Clinician who confirmed |
| `actorRole` | text | ✅ | Role at confirmation time |
| `entityType` | enum | ✅ | soap_note / discharge_report / imaging_analysis / treatment_plan / prescription |
| `entityId` | UUID | ✅ | UUID of the confirmed record |
| `actionType` | text | ✅ | e.g. "soap_note_finalized", "imaging_confirmed" |
| `originalDraftHash` | text | ✅ | SHA-256 of raw AI draft |
| `confirmedContentHash` | text | ✅ | SHA-256 of clinician-confirmed content |
| `wasEditedByClinician` | boolean | ✅ | true if hashes differ |
| `confirmedAt` | timestamptz | ✅ | Wall-clock confirmation time (ISO 8601 UTC in payload) |
| `previousEventHash` | text | ✅ | SHA-256 of prior event; null for genesis |
| `eventHash` | text | — | SHA-256 of this event's canonical payload |
| `canonicalizationVersion` | integer | ✅ | Algorithm version (currently 1) |
| `actorName` | text | ❌ | Human-readable name — excluded (mutable) |
| `ipAddress` | text | ❌ | Request IP — excluded (operational only) |

### 2.3 Canonicalization Contract (Version 1)

**Algorithm:** `SHA-256(JSON.stringify(sortedPayload))`

Keys are sorted **alphabetically** in the canonical JSON payload. This guarantees determinism regardless of JavaScript object property insertion order.

**Fields bound (alphabetical order):**
```
actionType, actorId, actorRole, canonicalizationVersion, confirmedAt,
confirmedContentHash, entityId, entityType, originalDraftHash,
practiceId, previousEventHash, sequenceNumber, wasEditedByClinician
```

`actorName` and `ipAddress` are **intentionally excluded** — they are mutable (name changes after a legal name change) and their exclusion keeps the chain stable across legitimate metadata updates.

`confirmedAt` is serialized as ISO 8601 UTC string (`Date.toISOString()`).

**Implementation:** [`apps/web/lib/ai/audit-chain.ts`](../apps/web/lib/ai/audit-chain.ts)

### 2.4 Genesis Event

The first event in each practice chain has `previousEventHash = null`. The verifier accepts null as valid for the first event only.

### 2.5 Transactional Integrity and Concurrency Locking

The audit log append is managed centrally by `appendAiAuditEvent` ([`apps/web/lib/ai/audit-ledger.ts`](../apps/web/lib/ai/audit-ledger.ts)) and executed **inside the same database transaction** as the clinical record finalization.

To guarantee zero race conditions and strictly monotonic `sequenceNumber` allocation during concurrent finalizations:
1. **Transaction-Scoped Advisory Lock:** At the start of append, PostgreSQL acquires an exclusive transaction-scoped lock:
   ```sql
   SELECT pg_advisory_xact_lock(hashtextextended('ai_audit_chain:' || practiceId, 0));
   ```
   This lock automatically releases on COMMIT or ROLLBACK.
2. **Atomic Sequence & Linkage:** Under the lock, the ledger queries the latest row for the practice, allocates `sequenceNumber = latest.sequenceNumber + 1`, sets `previousEventHash = latest.eventHash`, and inserts the new record.
3. **Fail-Closed Rollback:** If the audit append fails or throws, the enclosing transaction aborts and all clinical record updates roll back.

**Enforced in all AI write paths:**
- Voice SOAP finalization (`apps/web/server/routers/extensions/voice.ts`)
- Imaging analysis confirmation (`apps/web/server/routers/extensions/imaging.ts`)
- Discharge report saving & finalization (`apps/web/server/routers/extensions/discharge.ts`)
- AI SOAP generation (`apps/web/server/routers/ai.ts`)

**Verified by tests:** [`apps/web/lib/ai/__tests__/audit-ledger.test.ts`](../apps/web/lib/ai/__tests__/audit-ledger.test.ts), the real-DB contract [`apps/web/server/__tests__/ai-clinical-finalization.integration.test.ts`](../apps/web/server/__tests__/ai-clinical-finalization.integration.test.ts) (16 tests, run in the CI RLS job), and the pilot smoke [`e2e/ai-finalization-pilot.spec.ts`](../e2e/ai-finalization-pilot.spec.ts).

---

## 3. Verification Commands

```bash
# Standard chain verification (nonzero exit on any error)
pnpm audit:verify-ai

# Allow empty table — for dev/first-run environments
pnpm audit:verify-ai --allow-empty

# Machine-readable JSON output for CI/monitoring
pnpm audit:verify-ai --json

# Run unit tests for the chain verifier
pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/audit-chain.test.ts
```

The verifier (`scripts/verify-ai-audit-trail.ts`):
- Fails with nonzero exit code on ANY integrity error
- Queries events in deterministic `(practice_id, sequence_number)` order,
  **including soft-deleted rows** (a filtered check could not detect
  evidence deletion)
- Recalculates every event hash from stored fields
- Validates predecessor linkage for every non-genesis event
- Validates sequence continuity (detects gaps, duplicates)
- Detects future timestamps beyond 5-minute clock-skew allowance
- Detects legacy pre-chain rows (`LEGACY_ROW`, `sequence_number IS NULL`)
- Detects soft-deleted rows (`SOFT_DELETED_ROW`) and post-insert mutations
  (`MUTATED_ROW`, `updated_at` drift beyond 5 s)
- Redacts sensitive data (practiceId suffix only; UUIDs scrubbed from
  free-text details; `eventId` omitted) in output
- Supports `--allow-empty` for dev/first-run, `--json` for machine consumption

---

## 4. What the Verifier Detects

| Threat | Detected | Detail |
|---|---|---|
| Modified `originalDraftHash` | ✅ | Hash mismatch on recalculation |
| Modified `confirmedContentHash` | ✅ | Hash mismatch |
| Modified `actorId` | ✅ | Hash mismatch |
| Modified `actorRole` | ✅ | Hash mismatch |
| Modified `wasEditedByClinician` | ✅ | Hash mismatch + explicit flag check |
| Modified `entityId` or `entityType` | ✅ | Hash mismatch |
| Deleted middle event | ✅ | Sequence gap detected |
| Inserted phantom event | ✅ | Predecessor chain broken |
| Reordered events | ✅ | Predecessor chain broken |
| Duplicated sequence number | ✅ | Duplicate detection |
| Future-dated events | ✅ | Clock skew check (5 min) |
| Cross-tenant event injection | ✅ | practiceId bound in hash |
| Soft-deleted event (evidence deletion) | ✅ | `SOFT_DELETED_ROW`, excluded from linkage to avoid cascade noise |
| Post-insert row mutation | ✅ | `MUTATED_ROW` via `updated_at`/`created_at` drift (5 s tolerance) |
| Pre-chain legacy row | ✅ | `LEGACY_ROW` — integrate via `docs/ai-audit-cutover.md` |
| Modified `actorName` | ⚠️ | NOT detected — excluded from hash by design |
| DBA alters rows + recomputes hashes | ❌ | Requires external anchoring |
| Full DB restore to earlier state | ❌ | Requires external checkpointing |

---

## 5. Threat Model and Limitations

### 5.1 What This Provides

- Detection of ad-hoc row mutations (UPDATE/DELETE) in the audit table without hash recomputation
- Detection of inserted phantom events
- Detection of reordered, missing, or duplicated events
- Detection of altered actor, practice, entity, content, or role fields

### 5.2 What This Does NOT Provide

- Prevention of a **privileged DBA** who has both write access and knowledge of the hashing algorithm — they could alter records and recompute hashes undetected
- **WORM (Write Once Read Many)** storage guarantees
- **Independent legal notarization** (e.g. eIDAS-qualified electronic timestamp)
- Protection against a **full database restore** to an earlier state without the anchor

### 5.3 External Anchoring Interface

For stronger forensic claims, implement the `AuditAnchorProvider` interface defined in `audit-chain.ts`:

```typescript
export interface AuditAnchorProvider {
  anchor(practiceId: string, eventHashes: string[], checkpoint: number): Promise<void>;
  verify(practiceId: string, checkpoint: number): Promise<{ ok: boolean; detail?: string }>;
}
```

**Compatible anchoring strategies (no proprietary lock-in):**

| Strategy | Strength | Notes |
|---|---|---|
| S3 Object Lock (WORM) | High | Write batch Merkle root to immutable S3 object daily |
| RFC 3161 TSA timestamp | High | Cryptographic timestamp from a trusted authority |
| PostgreSQL append-only replica | Medium | Separate DB with no UPDATE/DELETE permissions |
| Transparency log (RFC 9162) | High | Public verifiable log |

**Recommended implementation:** A daily scheduled cron that computes a Merkle root of all events since the last checkpoint and writes it to an S3-compatible bucket with Object Lock enabled. The `NoOpAuditAnchorProvider` class in `audit-chain.ts` provides a safe no-op for development.

---

## 6. Deployment Requirements

| Requirement | Status |
|---|---|
| Run `pnpm db:migrate` (fresh DBs) so migration 0105 creates the ledger with chain columns | DEPLOYMENT_REQUIREMENT |
| Integrate legacy (`sequence_number IS NULL`) rows before pilot sign-off | DONE — `scripts/backfill-ai-audit-chain.ts`, see `docs/ai-audit-cutover.md` |
| Schedule `pnpm audit:verify-ai` in CI/CD (and daily in ops) | DEPLOYMENT_REQUIREMENT — see `docs/ai-finalization-operations.md` |
| Configure external anchoring for regulatory strength | PILOT_TARGET |
| Implement scheduled anchor checkpoint cron | PILOT_TARGET |
