# AI Audit Chain — Cutover & Backfill

**Version:** 1.0.0
**Date:** 2026-09-12
**Status:** IMPLEMENTED_AND_TESTED
**Repository:** `badmarsh/openvpm-ai`

---

## 1. When this applies

Every row the current application writes to `ext_ai_audit_log` is chained at
insert time (sequence, predecessor link, hash). Cutover work is needed only
for **legacy rows**: rows with `sequence_number IS NULL`, produced by
pre-chain app versions or manual inserts. The verifier reports each as
`LEGACY_ROW` and exits non-zero until they are integrated.

Fresh pilot databases need **no cutover**: `db:migrate` creates the table
with chain columns (§2 of `ai-audit-ledger.md`) and every row is chained from
genesis. This document is for brownfield databases upgrading to the chained
ledger.

> Databases created with `db:push` from an older schema predate the migration
> journal entirely and cannot run `db:migrate` cleanly (0105 `CREATE TABLE`
> collides). They are dev/staging artifacts: rebuild them with `db:migrate`
> instead of cutting over.

## 2. Backfill script

`scripts/backfill-ai-audit-chain.ts` (`pnpm --filter @openpims/db audit:backfill-ai`):

```
DATABASE_URL=... pnpm audit:backfill-ai -- --dry-run \
  --default-action-type=soap_note_finalized --default-actor-role=veterinarian
DATABASE_URL=... pnpm audit:backfill-ai -- --apply \
  --default-action-type=soap_note_finalized --default-actor-role=veterinarian
```

### 2.1 Rules (fail-closed)

1. **Dry-run by default.** `--apply` is required to write; dry-run prints the
   per-practice plan (counts + sequence ranges, no UUIDs) and changes nothing.
2. **Owner-only apply.** Refuses `--apply` unless connected as the table
   owner. (Without this gate, RLS would hide rows from lesser roles and the
   script would misleadingly report "nothing to do".)
3. **Chained rows are never rewritten.** Legacy rows continue after each
   practice's existing max sequence in deterministic
   `(confirmed_at ASC, id ASC)` order. Sequence order therefore reflects
   chain-integration order; `confirmed_at` preserves wall-clock time. The
   verifier does not compare sequence against time.
4. **No silent attribution.** Missing `actorRole` resolves row → `users.role`
   (read as-of backfill, a documented approximation) → required
   `--default-actor-role`. Missing `actionType` requires
   `--default-action-type`. Both flags are mandatory.
5. **Partial-chain refusal.** Any row with a sequence but no hash (interrupted
   cutover or tampering) aborts the run for steward investigation.
6. **Single transaction.** `--apply` runs in one transaction with
   `SET LOCAL app.ledger_maintenance='on'` (the documented owner maintenance
   procedure, auto-reset at COMMIT/ROLLBACK). Any failure rolls back.
7. **Self-verification.** After applying, the script re-verifies the full
   table with the production verifier: chain errors (`HASH_MISMATCH`,
   `PREDECESSOR_MISMATCH`, `SEQUENCE_*`, remaining `LEGACY_ROW`) exit 1;
   non-chain findings (e.g. a deliberately soft-deleted row, which stays
   flagged `SOFT_DELETED_ROW` by design) are reported as warnings.
8. **Hashes use the production canonicalizer** (`computeAiAuditEventHash` +
   `toUtcIsoString`) — one implementation, no SQL/Python drift.

### 2.2 One-way + rollback

The backfill is one-way: there is no "unchain". Rollback = restore from the
pre-cutover backup. Procedure:

1. `pg_dump` the database; record the dump id in the change ticket.
2. Stop writers (maintenance window) or accept that rows inserted mid-run
   chain normally while legacy rows integrate (both paths are safe; the
   backfill only touches `sequence_number IS NULL` rows as-of its snapshot).
3. Run `--dry-run`, have a second steward review the plan.
4. Run `--apply` as the owner; confirm `Backfill verified`.
5. Run `pnpm audit:verify-ai` independently; archive the `--json` output with
   the ticket. Investigate any non-chain warnings.

## 3. Proof

Exercised end-to-end on real PostgreSQL 16 (throwaway database, since
dropped): mixed practice (2 chained + 2 legacy incl. 1 soft-deleted) and
legacy-only practice; verifier-before (3 `LEGACY_ROW` + 1 `SOFT_DELETED_ROW`),
dry-run no-op, non-owner refusal, apply + self-verify, sequence continuation
(`1,2,3,4` / `1,2`), deleted-flag preservation, verifier-after (only the
deliberate `SOFT_DELETED_ROW`), partial-chain refusal. 7/7 checks passed.

## 4. References

- Chain design + threat model: `docs/ai-audit-ledger.md`
- Verifier: `scripts/verify-ai-audit-trail.ts`
- Ops (scheduled verification, finding response): `docs/ai-finalization-operations.md`
