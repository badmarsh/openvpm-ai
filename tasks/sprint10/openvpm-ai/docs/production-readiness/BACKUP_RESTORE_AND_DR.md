# Backup, restore, and disaster recovery

Canonical product procedure: [`docs/backup-restore-runbook.md`](../backup-restore-runbook.md) and [`docs/file-object-recovery-runbook.md`](../file-object-recovery-runbook.md). This page states assumptions and the evidence boundary.

## Assumptions (not accepted until an operator signs)

| Item | Assumption | Status |
| --- | --- | --- |
| RPO | Hosted daily 03:00 UTC JSON export + independent replica when enabled | **Assumption** until production cron/heartbeat verified |
| RTO | Small clinic JSON restore minutes; full DB+objects hours | **Assumption** |
| Encryption | Storage-provider encryption at rest; TLS in transit | **Requires production operator validation** |
| File binaries | Not inside JSON; replica rollout default off | Independent replica **not** complete until file runbook drill passes |

## What a backup command does **not** prove

Existence of `/api/cron/backup` or `pnpm backup:verify-evidence` does **not** prove restores work. Proof requires:

1. Artifact integrity verifier (`apps/web` `backup:verify-evidence`) — checksums only.
2. Application dry-run restore.
3. `e2e/restore-drill.spec.ts` with `RESTORE_DRILL_BACKUP` on a **scratch** database.
4. Post-restore UI checks (client + patient chart).

The Playwright drill is **skipped in CI** unless the env var is set. Last documented drill in the runbook: **2026-07-10**.

## Restore decision

- Same-install total DB loss: Postgres snapshot/WAL as **database owner**.
- Single practice, no files: clinic JSON into empty practice via Settings.
- Signed consent PDFs: owner `backup:recover-practice` legal-evidence mode.
- Never claim GDPR deletion completeness without legal retention review.

## Failure scenarios

| Scenario | Action |
| --- | --- |
| Corrupt JSON | Stop; do not edit file to pass verifier |
| Restore mid-failure | Recovery hold stays on; owner review |
| Lost object store | File runbook; JSON manifests alone insufficient |
| Oversized export (>50 MB) | Heartbeat `oversized`; capacity plan |

## Roles

- Clinic admin: on-demand export, empty-practice restore (no legal evidence).
- Database owner: WAL restore, legal evidence, hold release.
- Platform operator: cron health, replica coverage.

## Scheduled drill recommendation

Quarterly: synthetic backup through `restore-drill.spec.ts` on disposable Postgres. Record SHA, timings, pass/fail in an operator ticket — not in git with clinic data.
