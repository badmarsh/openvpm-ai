# Baseline audit (Phase 0)

**Repository:** `badmarsh/openvpm-ai` (workspace checkout)  
**Inspected commit:** `98ef59a27b3e1da7348eaa474b6e991df04c277a`  
**Branch used for this work:** `arena/01a071dd-openvpm-ai` (session-fixed; do not treat as `hardening/production-readiness-10`)  
**Audit date:** 2026-09-05  
**Method:** read-only inspection of tracked source, workflows, schema, routers, public routes, tests, and operational docs. No production credentials were used.

This document records **verified repository evidence**. It does not claim GDPR certification, legal e-Kasa certification, or general-availability readiness.

## System overview

OpenVPM is a Turborepo + pnpm monorepo veterinary PIMS:

- `apps/web` — Next.js 15 App Router, React 19, tRPC dashboard API, `/api/v1` REST, cron, webhooks, portal, Slovak/AI/e-Kasa extensions
- `apps/docs` — staff guides site
- `packages/db` — Drizzle schema, committed SQL migrations, RLS SQL, seed data
- `packages/api` — shared Zod validators
- `packages/config`, `packages/email`
- `e2e/` — Playwright journeys
- `docker/docker-compose.yml` — PostgreSQL 16 + MinIO

Slovak-specific and AI extensions live in `packages/db/schema/ext_*.ts` and `apps/web/server/routers/extensions/*` (voice, imaging, e-Kasa, marketing, CRŠZ, discharge, support/WebRTC, lab import).

## Verified technology stack

| Layer | Evidence |
| --- | --- |
| Node | `package.json` engines `>=20`; CI uses Node 24 |
| Package manager | `packageManager: pnpm@9.15.0` |
| Frontend | Next.js `^15.5.21`, React `^19.2.8` (`apps/web/package.json`) |
| API | tRPC v11 (`apps/web/server/trpc.ts`, `server/routers/_app.ts`) + REST `apps/web/app/api/v1` |
| Auth | NextAuth.js v4, JWT middleware (`apps/web/middleware.ts`, `lib/auth.ts`) |
| DB | PostgreSQL 16 + Drizzle ORM `^0.45.2` |
| Tenancy | App-layer `practiceId` + `withTenant` GUC + RLS (`lib/tenant-db.ts`, `packages/db` RLS scripts) |
| Tests | Vitest (~480 `*.test.ts`/`*.spec.ts` files) + Playwright |
| CI | `.github/workflows/ci.yml`, `migrate.yml` |
| Dependabot | `.github/dependabot.yml` weekly npm + actions |

Web package version is `0.1.0`. No Git tags were present in this checkout. No root `CHANGELOG.md` existed at audit time.

## Current quality-gate results (this environment)

Commands attempted on 2026-09-05 in the sandbox:

| Command | Result |
| --- | --- |
| `node -v` | `v22.22.3` |
| `pnpm` | **not on PATH** (exit 1) |
| `test -d node_modules` | **missing** |
| `pnpm install --frozen-lockfile` | **not executed** (no pnpm) |
| `pnpm type-check` / `pnpm test` / `pnpm build` | **not executed** |
| `pnpm db:migrate` / RLS tests | **not executed** (no local Postgres in this audit pass) |
| `pnpm test:e2e` | **not executed** |

**Blocker:** this audit environment cannot run the documented quality gates until pnpm and Docker/Postgres are available. CI definitions exist but were not re-run here. Treat gate results as **unverified in this checkout**.

## Critical-path inventory

Verified present in code:

1. Staff login / session (`next-auth`, middleware public allowlist, `protectedProcedure`)
2. Tenant scoping (`withTenant`, RLS jobs in CI)
3. Clients, patients, appointments, SOAP/records, billing
4. Consent / SMS consent events, treatment-plan evidence tests
5. Portal + public booking (`/portal`, `/book`) via capability/public prefixes
6. AI agent (`server/routers/agent.ts`) — writes gated by `allowWrites`
7. Voice / imaging / marketing / e-Kasa extension routers
8. Files/uploads (`lib/upload-policy.ts`, S3)
9. Cron (`CRON_SECRET`, `/api/cron/*`)
10. Health (`/api/health`) with hosted vs self-host checks
11. Backup JSON export + restore UI + `e2e/restore-drill.spec.ts` (skipped unless `RESTORE_DRILL_BACKUP` is set)
12. OSS release scanner `scripts/verify-oss-release.mjs`

## Threat surface

- Unauthenticated public prefixes in `middleware.ts` including `/api`, `/portal`, `/book`, `/capture`, `/sign`, `/treatment-plan`, `/sms`, `/h`, `/tv`, `/waiting-room`
- Webhooks: Stripe, Resend, Telnyx, generic webhooks
- File upload and object storage
- AI providers (Vertex/Anthropic/OpenAI-compatible proxy) receiving clinical context
- Platform admin (`PLATFORM_ADMIN_EMAILS`) and `withSystem` RLS bypass
- e-Kasa outbound HTTP to configured `ekasaApiUrl`
- WebRTC support signaling (`app/api/support`)
- Cron authenticated by shared secret
- Demo credentials documented in README (`password123`) — synthetic seed only

## Observed strengths

- Least-privilege DB role + RLS CI job with many real-Postgres contracts
- Hosted health fail-closed on missing env, SMS rollout, schema drift
- Mutation audit after commit; viewer mutations blocked; recovery-hold mutations blocked
- Agent writes opt-in; roles limited to admin/veterinarian
- Messaging default-off with UUID allowlists
- Dependabot, frozen lockfile, `pnpm audit --prod --audit-level high` in CI
- Honest clinic-pilot docs (`docs/clinic-pilot-readiness.md`)
- Migration apply workflow requires explicit production confirmation

## Observed weaknesses

- **P0 — e-Kasa PKP is not FR SR RSA signing.** `generatePkp` uses HMAC-SHA256 with cert bytes truncated or the literal `openvpm-ekasa-signing-secret-placeholder`. `sendToEkasaApi` fabricates `MOCK-UID-*` on success without uid. Not a legally valid e-Kasa implementation.
- **P0 — quality gates unverified in this environment** (no pnpm/node_modules).
- **P1 — no Git tags, no CHANGELOG, package version 0.1.0**; CI does not run Playwright E2E.
- **P1 — restore drill is manual/opt-in**, not a CI gate.
- **P1 — CI only on `development`/`staging`/`main` PRs**; other branches are not gated.
- **P1 — `/api/health` mixes liveness and readiness**; process-alive vs safe-to-serve not split.
- **P1 — public `/api` prefix is fully unauthenticated at middleware**; each handler must self-protect (pattern is documented; coverage is not proven exhaustive in this audit).
- **P2 — CLAUDE.md still references `pnpm db:push` for extensions**, conflicting with committed-migration CI.
- Slovak i18n dictionaries exist (`en.json`/`sk.json`); symmetry is documented in `docs/I18N.md`, not re-verified here.

## Explicit unknowns

- Whether GitHub branch protection actually requires the CI jobs
- Production operator env completeness
- DPA / subprocessor register (legal, not in repo as executed contracts)
- Whether e-Kasa UI is reachable in production feature flags
- Live Stripe/Telnyx/Vertex configuration
- Historical git secret leakage beyond current tree (history not fully scanned)

## Prioritized backlog

### P0

1. Do not enable e-Kasa against FR SR until RSA/OKP/PKP and certification are implemented and legally reviewed; fail closed / feature-flag off for production.
2. Establish a runnable quality-gate environment (pnpm, Postgres) and record passing results.
3. Confirm every public `/api/*` handler authenticates or uses purpose-limited tokens (spot-check remaining routes).

### P1

1. Changelog + SemVer policy + tagged RC procedure (assets only; no GitHub Release without owner).
2. Split live vs ready probes.
3. Document that E2E critical path is required before deploy even if not in `ci.yml`.
4. Keep restore drill executable; schedule operator drill.
5. Secret scanning beyond private-key/Vercel token patterns.

### P2

1. Align CLAUDE.md migration guidance with `db:migrate`.
2. Accessibility and translation-symmetry CI.
3. Performance indexes only with query evidence.

## Go / no-go (Phase 0)

**NO-GO for general availability.**  
**CONDITIONAL GO / GO FOR PILOT** only after: quality gates run green, e-Kasa kept non-production, tenant RLS tests pass in CI, AI outputs remain drafts, legal/DPO review of processors.

Recommended label after this package (docs + live/ready split, still no local test run): **GO FOR PILOT** of core PIMS **without** claiming Slovak fiscal certification or GDPR compliance.
