# OpenVPM AI — Release Checklist & Deployment Runbook

**Version Target:** v0.1.0-rc.1  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Canonical Pre-Flight Verification (Phase 4 Deliverable)  

---

## 1. Pre-Flight Quality Gates

Before any production or pilot deployment, all gates must pass with zero errors:

- [ ] **Type Safety:** `pnpm type-check` executes cleanly across `@openpims/web`, `@openpims/db`, `@openpims/email` (0 errors).
- [ ] **Deterministic AI Evaluation:** `pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/clinical-eval-harness.test.ts` (13/13 tests passing).
- [ ] **Audit Trail Integrity:** `pnpm audit:verify-ai` reports 0 anomalies or tampering.
- [ ] **i18n Symmetry:** Verify 100% key parity between `apps/web/messages/sk.json` and `messages/en.json`.
- [ ] **Upstream Migration Journal:** Confirm `packages/db/drizzle/meta/_journal.json` is pristine and untouched.
- [ ] **Production Build:** `pnpm build` completes successfully with code 0.

---

## 2. Database Migration Protocol

- [ ] Connect to staging/production PostgreSQL database.
- [ ] Apply schema updates via `pnpm db:push` (ensures `ext_*` schemas are deployed without conflicting with upstream migration journals).
- [ ] Confirm `ext_ai_audit_log` table exists with proper indexes (`\d ext_ai_audit_log`).
- [ ] Ensure least-privilege role `openpims_app` has appropriate DML permissions and RLS policies are enabled (`packages/db/rls/enable-rls.sql`).

---

## 3. Environment & Secrets Verification

- [ ] `DATABASE_URL`: Verified PostgreSQL 16 connection string with SSL in production.
- [ ] `NEXTAUTH_SECRET`: Minimum 64-char cryptographically random secret.
- [ ] `NEXTAUTH_URL`: Canonical practice URL (e.g. `https://app.vetsykora.sk`).
- [ ] `AI_MODEL`: Set to supported model ID (default `gemini-2.5-flash` or Anthropic Claude).
- [ ] `GOOGLE_VERTEX_PROJECT` / `ANTHROPIC_API_KEY`: Verified active inference provider credentials.
- [ ] `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: Private storage access verified.
- [ ] `CRON_SECRET`: Bearer token configured for Vercel/external cron invocations.
