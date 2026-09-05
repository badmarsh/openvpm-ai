# Release runbook

## Versioning

See [`docs/production-readiness/VERSIONING.md`](VERSIONING.md). SemVer on `apps/web` / `packages/db` (`0.1.0` at audit).

## Changelog

Root [`CHANGELOG.md`](../../CHANGELOG.md) — Keep a Changelog. Unreleased notes go there before tag.

## Release candidate procedure

1. SHA on the integration branch is green: `pnpm install --frozen-lockfile`, `verify:oss-release`, `type-check`, `test`, `build`, `pnpm audit --prod --audit-level high`, RLS job equivalent.
2. Migration integrity: `db:migrations:check`; no drizzle drift.
3. E2E critical path on a disposable env (`pnpm test:e2e` subset).
4. Write changelog; bump version.
5. Tag `vX.Y.Z-rc.N` **only when the repository owner authorizes**. This agent does not publish GitHub Releases.

## Migration compatibility

- Expand/migrate/contract for breaking columns.
- Production migrate: `workflow_dispatch` on `main`, confirmation `MIGRATE_PRODUCTION`, SHA match, environment `Production`.
- If unsafe to rollback SQL: **forward-fix** only.

## Rollback / forward-fix tree

```
Deploy failed, migration NOT applied → redeploy previous app SHA
Migration applied, app incompatible → forward-fix app (do not DROP columns)
Data corruption suspected → recovery hold + restore drill path
```

## Post-deploy smoke

Automated: `node scripts/staging-smoke-test.mjs --base-url https://<staging-or-prod-host>` (exit 0 = pass; `--json` for CI artifacts; `--allow-not-ready` while a known advisory check is open). It needs no credentials and asserts:

- `GET /api/health/live` 200 with `no-store`
- `GET /api/health/ready` 200 with a redacted `checks` payload (includes schema drift + the deferred-FK gate)
- all 18 `/api/cron/*` routes → 401 anonymous, bad bearer, and bad `x-cron-secret`
- `/api/v1/*` → 401 with `WWW-Authenticate` for missing and malformed keys
- `/api/upload`, `/api/files/*`, tRPC → 401/403; unknown `/api/sign/<token>` and `/api/portal/session` → 404
- e-Kasa offline fallback in-process with `fetch` disabled: offline mode, unreachable FR SR, flag off, missing RSA key, SSRF host — receipt persisted as `OFFLINE_STORED`/`FAILED`, never `CONFIRMED`, zero egress

Manual:

- `GET /api/health/live` 200
- `GET /api/health/ready` 200 (or 503 with actionable checks)
- Login as synthetic user on staging/demo
- One patient search
- Confirm SMS/AI flags still default-off unless intended

## Production approval

GitHub Environment `Production` for migrate. App deploy approval is **operator-owned** (Vercel/Docker). Not automated in this repo beyond migrate.yml.
