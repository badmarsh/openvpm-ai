# Operations runbook

On-call uses `/api/health` (readiness) and `/api/health/live` (process up). Do not paste PHI, tokens, or clinical text into tickets.

## Incident triage

1. Confirm blast radius: hosted vs self-host, single practice vs platform.
2. Check `/api/health` JSON `ok` and `checks.*` (no secret names in body by design).
3. Check deploy SHA vs last good.
4. If data integrity suspected: enable recovery hold (owner procedure in backup runbook) rather than silent repair.

## Service outage

- Process dead: `/api/health/live` fails → restart web, inspect Next instrumentation logs.
- Ready fail, live OK: database, schema drift, hosted env, storage.

## Database outage

- App: 503 on ready; do not run migrations blindly.
- Failover: restore from operator Postgres backup/WAL (not clinic JSON) if cluster lost.

## Failed migration

- `migrate.yml` production job requires `MIGRATE_PRODUCTION` + exact 40-char SHA + GitHub Environment `Production`.
- If migrate fails: do not roll back schema unless the migration is proven reversible. Prefer forward-fix. See RELEASE_RUNBOOK.

## Failed deployment

- Roll back application to previous SHA **only if** DB migrations are compatible with old code.
- If migration already applied: forward-fix the app.

## Provider outage (Stripe/Resend/Telnyx/Vertex)

- Stripe: record payments manually; do not replay webhooks from untrusted sources.
- SMS: flags default off; leave `MESSAGING_SENDING_ENABLED=false` if carrier issues.
- AI: unset model or wait; charting continues without agent.

## Suspected data breach

1. Rotate `NEXTAUTH_SECRET`, DB passwords, API keys, storage keys.
2. Preserve logs (without expanding PHI in copies).
3. Notify DPO / legal — **requires legal review**, not automated.
4. Email `security@openvpm.com` process in `SECURITY.md`.

## Compromised secret

Rotate the single secret; invalidate sessions if `NEXTAUTH_SECRET` changes; disable leaked API keys in product.

## Message-delivery incident

Use SMS operations queues and recovery-hold rules. Do not send “sorry” blasts without consent checks.

## e-Kasa / POS incident

Treat current e-Kasa as **non-certified**. If a clinic used it: stop sending, preserve receipts table, engage accounting. Do not “fix” PKP in place.

## Restore

Follow `docs/backup-restore-runbook.md` and `BACKUP_RESTORE_AND_DR.md`.

## Support / emergency access

Platform admin emails only. No shared staff passwords. Demo `password123` is seed-only.
