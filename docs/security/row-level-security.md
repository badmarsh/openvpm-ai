# Row-Level Security (RLS)

OpenVPM enforces multi-tenant isolation in two layers:

1. **Application layer** — every query is scoped by `ctx.practiceId` (tRPC) or
   the API key's practice. This is the primary guard and works on any database.
2. **Database layer (RLS)** — Postgres policies that independently reject any row
   whose `practice_id` doesn't match the active tenant context. Defense in depth:
   even a query that forgets its `practiceId` filter returns nothing.

## How it works

Policies key off a per-transaction GUC, `app.current_practice_id`, set by the
app (`apps/web/lib/tenant-db.ts`):

- `withTenant(db, practiceId, fn)` — opens a transaction, sets the tenant GUC,
  runs `fn` on that transaction. Used by `protectedProcedure` so the whole
  authenticated request is tenant-scoped.
- `withSystem(db, fn)` — sets `app.rls_bypass = on` for legitimately
  cross-tenant or pre-tenant work (login, registration, the client portal,
  platform admin, the API-key lookup).

The policy on every tenant table is:

```sql
USING      (app_rls_bypass() OR practice_id = app_current_practice_id())
WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id())
```

With no context set, the GUC is NULL → the policy denies by default.

## The owner-bypass model (why dev/self-host is unaffected)

We deliberately do **not** use `FORCE ROW LEVEL SECURITY`. The table **owner**
bypasses RLS, so:

- Migrations, `pnpm db:push`, `pnpm db:seed`, and **dev / self-host** (which
  connect as the owner `openpims`) are completely unaffected — RLS is a no-op.
- Enforcement turns on only when the app connects as the **least-privilege role**
  `openpims_app` (created by the migration), which is subject to RLS.

This means RLS is safe to ship: it adds protection for the restricted role
without any risk to the default configuration.

## Applying it

```bash
pnpm db:rls        # apply policies + create the openpims_app role (run as owner)
pnpm db:rls:test   # live verification: proves cross-tenant isolation
```

`db:rls:test` checks, against a real database as `openpims_app`: a tenant sees
only its own rows, cross-tenant INSERT is rejected, no-context queries return
nothing, and the system bypass sees everything.

## Activating enforcement in production

1. `pnpm db:rls` against the production database.
2. `ALTER ROLE openpims_app PASSWORD '<strong-password>';` (the migration sets a
   dev placeholder).
3. Point the hosted `DATABASE_URL` at `openpims_app`.

### Entrypoint coverage (all wired)

Every DB access path now sets a tenant or system context, so the app runs
correctly under the enforcing `openpims_app` role:

- tRPC `protectedProcedure` → `withTenant`; `publicProcedure` + login → `withSystem`;
  platform admin → `withSystem`; API-key auth lookup → `withSystem`.
- `app/api/v1/*` data queries → `withTenant(auth.ctx.practiceId, ...)`.
- `app/api/cron/*` (reminders, backup) → broad reads in `withSystem`, per-practice
  writes/exports in `withTenant`.
- `app/api/webhooks/*` (client + subscription) and `lib/webhook-dispatcher.ts` →
  `withSystem` / `withTenant(practiceId)`.
- `app/api/upload` → `withTenant(session.practiceId, ...)`;
  `app/api/portal/checkout` → `withSystem`.

These are no-ops on the owner connection (dev/self-host). To activate enforcement
in production: run `pnpm db:rls`, set a real `openpims_app` password, and point
`DATABASE_URL` at that role (Phase 5 infra). Re-run `pnpm db:rls:test` against
staging to confirm isolation under the restricted role.
