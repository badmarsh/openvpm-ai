# Architecture and tenancy

## Runtime topology

```
Browser / portal / public token pages
        │
        ▼
Next.js (apps/web)  — middleware, App Router, tRPC `/api/trpc`, REST `/api/v1`
        │
        ├─ PostgreSQL 16 (Drizzle)  — tenant GUC app.current_practice_id
        ├─ S3/MinIO or Vercel Blob
        ├─ Stripe, Resend, Telnyx/Twilio
        └─ Vertex AI / Anthropic / optional AI_BASE_URL proxy
```

Cron hits `/api/cron/*` with `CRON_SECRET`. Docker Compose: Postgres + MinIO + web image.

## Trust of tenant identity

**Server-derived only.** `protectedProcedure` reads `session.user.practiceId`, then `withTenant(db, practiceId, ...)`. Client-supplied IDs must still be queried inside that transaction so RLS and `eq(table.practiceId, ctx.practiceId)` both apply.

`withSystem` sets `app.rls_bypass=on` for registration, login, platform admin, cron, and some webhooks. Those paths must not take a client-supplied practice id without a second check.

## Roles

`admin | veterinarian | technician | front_desk | viewer`  
Viewer: queries only. `requireRole(...)` on sensitive routers (e.g. agent: admin + veterinarian).

Platform operators: `PLATFORM_ADMIN_EMAILS`, separate from clinic admin.

## Database roles

- Owner (dev/self-host default): **RLS bypassed** — application filters are the only isolation.
- `openpims_app` (production required): RLS enforced. Hosted health asserts this role.

## Public vs authenticated

Middleware allowlist is in `apps/web/middleware.ts`. Capability paths (`/capture`, `/sign`, `/treatment-plan`) get distinct security headers. Authentication of those tokens is **not** middleware; it is route-level.

## Extension tables

New clinic features must use `packages/db/schema/ext_*.ts` rather than editing upstream core schema files (project skill). Migrations must still be generated and committed; CI fails on schema drift.
