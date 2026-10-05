# packages/db — Agent Guide

Instructions for database schemas, migrations, RLS policies, and triggers.

## 1. Upstream Immutability & Extensions
- **Never modify** upstream schemas in `schema/*.ts`.
- All custom tables/enums MUST be created in `schema/ext_{name}.ts` and re-exported in `schema/index.ts`.
- Never manually edit `drizzle/*` or `drizzle/meta/_journal.json`.

## 2. Migration Discipline
- **Every schema change ships with its migration**: run `pnpm db:generate` and commit `NNNN_*.sql`, snapshot, and journal together.
- CI (`migration-integrity`, `rls`) strictly enforces that `pnpm db:generate` produces zero pending diffs.
- `pnpm db:push` is for local development only.

## 3. Local Targeting & Lifecycle Commands
- Target DB is strictly `openvpm_ai` locally:
  ```bash
  docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai
  ```
  Never query `-d openpims` on local Docker (it is an unmigrated template).
- Full database bootstrap: `pnpm db:bootstrap`
- Apply PostgreSQL RLS: `pnpm db:rls`
- Preflight & test RLS: `pnpm db:rls:preflight && pnpm db:rls:test`
- Type-check package: `pnpm --filter @openpims/db type-check`
