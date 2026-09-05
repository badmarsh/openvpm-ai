# Go-live checklist

Use with [`docs/clinic-pilot-readiness.md`](../clinic-pilot-readiness.md). Tick only with evidence.

## Software

- [ ] Release SHA recorded
- [ ] `pnpm install --frozen-lockfile` on that SHA
- [ ] `pnpm verify:oss-release`
- [ ] `pnpm type-check`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm audit --prod --audit-level high`
- [ ] RLS migrate + `db:rls` + `db:rls:test` on a clone of prod schema (staging)
- [ ] E2E critical path on staging
- [ ] `/api/health/live` and `/api/health/ready` green in target env

## Configuration

- [ ] `NEXTAUTH_SECRET` unique, 32+ bytes
- [ ] HTTPS only
- [ ] App uses `openpims_app` role
- [ ] Object storage private
- [ ] `HOSTED_BILLING_ENABLED` only if Cloud
- [ ] SMS flags false unless named pilot UUIDs
- [ ] AI provider DPA on file **or** AI left unconfigured
- [ ] e-Kasa **disabled** until R-P0-001 closed

## Clinic

- [ ] Fit confirmed (companion animal, connected browser)
- [ ] Parallel run with existing PIMS
- [ ] Sample CSV dry-run
- [ ] One real visit (synthetic or consented) charted end-to-end
- [ ] Export/backup taken
- [ ] Rollback owner named

## People

- [ ] DPO/legal: processors
- [ ] Veterinary champion
- [ ] Ops on-call knows runbooks

If any P0 open: **NO-GO**. If P1 acknowledged: **GO FOR PILOT** only.
