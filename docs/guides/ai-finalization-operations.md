# AI Finalization — Operations Runbook

**Version:** 1.0.0
**Date:** 2026-09-12
**Status:** CANONICAL
**Repository:** `badmarsh/openvpm-ai`

---

## 1. Daily verification

Run the chain verifier daily against production (owner connection) and alert
on any non-zero exit:

```bash
DATABASE_URL=... pnpm audit:verify-ai -- --json > /var/log/openvpm/ai-audit-$(date +%F).json
```

Archive JSON outputs for 90 days (GDPR accountability evidence,
Zákon č. 18/2018 Z. z.). Outputs contain no full UUIDs and are safe for
log aggregation.

## 2. Finding response matrix

| Finding | Severity | Meaning | Response |
|---|---|---|---|
| `HASH_MISMATCH` | SEV-1 | Row fields altered without hash recompute | Freeze writes for the practice (`lockPracticeForExternalSideEffects`), preserve a dump, follow `incident-response.md`. Do **not** "fix" the hash. |
| `PREDECESSOR_MISMATCH` | SEV-1 | Reorder / insertion / deletion mid-chain | Same as above. |
| `SEQUENCE_GAP` | SEV-1 | Missing event (hard delete) | Same as above. |
| `SOFT_DELETED_ROW` | SEV-1 | Evidence deletion via soft-delete | Same as above. Application code never soft-deletes ledger rows. |
| `SEQUENCE_DUPLICATE` | SEV-2 | Double sequence allocation (lock failure or manual insert) | Pause finalization; root-cause before repair. |
| `MUTATED_ROW` | SEV-2 | `updated_at` drifted post-insert | Correlate with approved maintenance (§3). Unexplained drift → SEV-1 handling. |
| `FUTURE_TIMESTAMP` | SEV-3 | Clock skew > 5 min or mis-set host clock | Fix NTP; re-verify. |
| `LEGACY_ROW` | SEV-3 | Pre-chain row pending integration | Run the cutover (§4), not an incident. |
| `INVALID_CANON_VERSION` / `ALTERED_EDIT_FLAG` / `MISSING_REQUIRED_FIELD` | SEV-2 | Schema/code-version skew or tampering | Check deploy consistency first; unexplained → SEV-1 handling. |

Any SEV-1 finding pauses AI finalization for the affected practice until the
blame-free post-mortem (48 h) completes. Personal-data compromise follows
GDPR Article 33 (72 h notification).

## 3. Ledger maintenance procedure (dual control)

Ledger rows are immutable to every role including the owner; the
`protect_ai_audit_ledger()` trigger raises `55000` on UPDATE/DELETE. The
**only** bypass is the owner maintenance procedure, allowed solely for
documented backfill (§4), retention execution, or SEV repair — never for
convenience edits:

1. Change ticket with reason, scope (practice IDs / sequences), and two
   stewards (executor + reviewer).
2. Pre-change `pg_dump` of `ext_ai_audit_log` (at minimum); record dump id.
3. Owner connection, scoped bypass:
   ```sql
   BEGIN;
   SET LOCAL app.ledger_maintenance = 'on';
   -- minimal statements here
   COMMIT; -- SET LOCAL auto-resets; verify with SHOW app.ledger_maintenance;
   ```
4. Immediately run `pnpm audit:verify-ai`; attach `--json` output to the
   ticket. Any new `MUTATED_ROW` must trace to this ticket.

`SET LOCAL` (not session `SET`) is mandatory so the bypass cannot leak past
the transaction.

## 4. Cutover (brownfield only)

Fresh databases need no cutover. For databases with `LEGACY_ROW` findings,
follow `docs/ai-audit-cutover.md` (backup → `--dry-run` review → owner
`--apply` → independent verify → archive evidence).

## 5. Confirmation-protocol troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `PRECONDITION_FAILED` "confirmation token is required" | Client finalized without prepare, or bare boolean | UI must call prepare → finalize; see `docs/confirmation-protocol.md` |
| `CONFLICT` on finalize, "changed concurrently" | Stale `expectedRevision` | Reload record, re-prepare, retry |
| `CONFLICT` "already been finalized" | Double-submit or replay | Do not retry; record state is authoritative |
| `CONFLICT` after 15 min idle | Envelope TTL expired | Re-prepare (fresh clinician review) |
| `42501` on ledger insert (app role) | RLS/self-grant drift | Re-run `pnpm db:rls`; check `OPENPIMS_APP_DB_PASSWORD` rotation |
| `55000` "ledger rows are immutable" | Write path attempted UPDATE/DELETE | Application bug — fix code, never bypass in app paths |

## 6. CI gates (already wired)

- **RLS job** (`.github/workflows/ci.yml`): runs the 16-test real-DB
  finalization contract (`AI_FINALIZATION_DB_INTEGRATION=1`) on PostgreSQL —
  envelopes, races, immutability, RLS visibility.
- **Unit suites**: `audit-chain` (verifier), `audit-ledger` (append rules),
  `clinical-eval-harness` (deterministic clinical + safety benchmarks),
  `ai-draft-safety` (lifecycle), webhook signature/idempotency suites.
- **Eval harness**: deterministic (no LLM calls); a red harness blocks merge
  like any unit suite. Dosing/VHS/prompt-safety regressions are pilot
  blockers, not warnings.

## 7. References

- Confirmation protocol: `docs/confirmation-protocol.md`
- Chain design + threat model: `docs/ai-audit-ledger.md`
- Cutover: `docs/ai-audit-cutover.md`
- Incidents: `docs/incident-response.md`
- Backups: `docs/backup-restore-runbook.md`
