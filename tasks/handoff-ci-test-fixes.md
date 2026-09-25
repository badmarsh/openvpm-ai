# Handoff: CI Test Fixes (OpenVPM AI)

Updated: 2026-09-25 (continued from previous handoff)

## Done

1. **`config/__tests__/sidebar-nav-count.test.ts`** — admin count 35 → **36** (2 assertions).
   - Root cause: sidebar now exposes 36 canonical hrefs for admin (vanilla 20 + overview + custom-nav 15); the test was stale at 35.
   - Verified: 4/4 pass, lint clean, type-check clean.

## Remaining 29 failures across 12 files — root-cause triage

### Group 1 — Agent provider proxy env leakage (12 tests) ★ confirmed root cause
Files: `lib/agent/__tests__/runner.test.ts` (4), `lib/agent/__tests__/inference-proxy.test.ts` (2),
`lib/agent/__tests__/runner-rate-limit.test.ts` (2), `app/api/health/route.test.ts` (4).

**Root cause (confirmed in code):** `lib/agent/inference-proxy.ts` does
`inferenceProxyBaseUrl() = nonBlank(process.env.AT_PROXY_URL) ?? nonBlank(process.env.AI_BASE_URL)`.
The local env (`apps/web/.env` sets `AI_BASE_URL`, `AI_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`) makes
`hasInferenceProxyConfiguration()` always true, so `isAgentConfigured()` returns true in tests that stub
only `AT_PROXY_URL`/Vertex vars. Health route sees "Hosted AI via AT inference proxy".

**Fix:** neutralize proxy env (`AI_BASE_URL`, `AT_PROXY_URL`, `AT_PROXY_KEY`) in the Vertex-only test
scenarios; keep the AI_BASE_URL fallback in code (intentional, from ai-proxy-error-fix).

### Group 2 — Port drift localhost:3000 → :3001 (5 tests)
Files: `server/__tests__/auth-router.test.ts` (3), `server/__tests__/calendar-feed.test.ts` (1),
`lib/__tests__/email-preferences.test.ts` (1).

**Root cause (confirmed):** canonical origin derived from env (`NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL`
= `:3001` in local `.env`, app runs on 3001 per AGENTS.md). Tests hardcode `:3000` expectations.
Fix: tests must pin the origin env vars deterministically.

### Group 3 — Email dev-mode / Resend env leakage (5 tests)
File: `lib/__tests__/email.test.ts` (5). `RESEND_API_KEY` present locally forces hosted path.
Investigate test env setup; stub `RESEND_API_KEY`/provider vars to "".

### Group 4 — S3 env/config (2 tests)
File: `lib/__tests__/s3.test.ts` (2) — deepEqual mismatch on SHA-256 evidence + replica advisory.
Investigate.

### Group 5 — Live AI calls in tests (4 tests)
Files: `lib/voice/__tests__/treatment-extractor.test.ts` (3, STACK_TRACE_ERROR at collection),
`server/__tests__/marketing.test.ts` (1, generateImage fallback). Possibly network I/O triggered by
proxy env leakage (Group 1 root cause) — may resolve after Group 1 fix; verify.

### Group 6 — DB-dependent (1 test)
File: `server/__tests__/settings-admin-safety.test.ts` (1) — reports provider refusal / retry path;
handoff notes local DB FK constraint. Investigate.

## Verification order
- Targeted: `pnpm --filter @openpims/web exec vitest run <file>`
- Full suite: `pnpm --filter @openpims/web test` (JSON reporter into tasks/web-test.json)
- Lint: `pnpm lint` → Type-check: `pnpm type-check`