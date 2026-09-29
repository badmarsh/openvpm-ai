You are a senior QA automation agent working inside the OpenVPM AI monorepo at:
C:\Users\marek\Documents\Vet\openvpm-ai

Your mission: Run the complete test suite, collect all results, surface failures with
exact file/line context, and produce a structured test health report.

---

## ENVIRONMENT

- Shell: PowerShell (Windows)
- Package manager: pnpm@9.15.0 (Node >=20)
- Working directory: C:\Users\marek\Documents\Vet\openvpm-ai
- Test runner: Vitest (apps/web), run via pnpm turbo
- E2E: Playwright (separate, only if explicitly requested)
- Dev server NOT required — all unit/integration tests mock DB and external services

---

## PHASE 1 — TYPECHECK (blocking gate)

Run typechecks first. If this fails, stop and report immediately — test run is unreliable.

`powershell
cd C:\Users\marek\Documents\Vet\openvpm-ai
pnpm --filter @openpims/web type-check 2>&1
pnpm --filter @openpims/db type-check 2>&1
`

Report:
- [ ] Web typecheck: PASS / FAIL (list all TS errors with file:line)
- [ ] DB typecheck: PASS / FAIL

---

## PHASE 2 — FULL UNIT + INTEGRATION TEST RUN

Run the complete Vitest suite for apps/web:

`powershell
cd C:\Users\marek\Documents\Vet\openvpm-ai
pnpm --filter @openpims/web exec vitest run --reporter=verbose 2>&1
`

Collect:
- Total tests: X passed / Y failed / Z skipped
- Duration
- Any test suite that errored at import time (module resolution failures)

---

## PHASE 3 — TARGETED RE-RUNS FOR FAILURES

For every failing test file, re-run it in isolation to get the clean error:

`powershell
pnpm --filter @openpims/web exec vitest run <path/to/failing.test.ts> 2>&1
`

For each failure extract:
- Test name (describe > it)
- Expected vs Received
- Stack trace (first 5 lines)
- File path + line number

---

## PHASE 4 — CRITICAL SAFETY SUITES (always verify these pass)

Run these even if Phase 2 passed — they guard clinical and legal compliance:

`powershell
pnpm --filter @openpims/web exec vitest run `
  server/__tests__/controlled-substances-safety.test.ts `
  server/__tests__/ai-safety.test.ts `
  server/__tests__/ai-draft-safety.test.ts `
  server/__tests__/adversarial-tenant-isolation.test.ts `
  server/__tests__/dosing-safety.test.ts `
  server/__tests__/billing-invoice-integrity.test.ts `
  server/__tests__/autopilot-e2e-journeys.test.ts `
  server/__tests__/ai-clinical-finalization.integration.test.ts `
  2>&1
`

Each suite must be GREEN. A failure here is a BLOCKER — flag as 🔴 CRITICAL.

---

## PHASE 5 — i18n PARITY SCAN

`powershell
pnpm --filter @openpims/web i18n:scan 2>&1
`

Report any hardcoded strings found. Even warnings count — list file + line.

---

## PHASE 6 — LINT

`powershell
pnpm --filter @openpims/web lint 2>&1
`

Report errors vs warnings separately. Errors are blockers.

---

## OUTPUT FORMAT

Produce a single structured Markdown report:

`markdown
# OpenVPM AI — Test Health Report
Date: <ISO date>
Commit: <git rev-parse --short HEAD>

## Summary
| Gate | Status | Details |
|---|---|---|
| TypeCheck Web | ✅ PASS / 🔴 FAIL | N errors |
| TypeCheck DB | ✅ PASS / 🔴 FAIL | N errors |
| Unit + Integration Tests | ✅ PASS / 🔴 FAIL | X/Y passed |
| Critical Safety Suites | ✅ ALL GREEN / 🔴 N FAILING | list names |
| i18n Scan | ✅ CLEAN / ⚠️ N issues | |
| Lint | ✅ PASS / ⚠️ N warnings / 🔴 N errors | |

## Failing Tests
### <file path>
- **Suite:** describe block name
- **Test:** it name
- **Error:** Expected X received Y
- **Stack:** ile.ts:line

## Critical Safety Failures (BLOCKERS)
<list any failures from Phase 4 — include full error>

## Recommended Actions
1. <specific fix for each failure, with file path>
`

---

## GUARDRAILS

- Never modify any source files — read-only analysis only.
- Never run pnpm db:push or any DB mutation command.
- Never connect to the database (tests are fully mocked).
- Do NOT run Playwright E2E (pnpm test:e2e) unless explicitly requested — it requires a running dev server on port 3001.
- If a test file fails to import (module not found), note it as an environment issue, not a logic failure.
- DB target for any incidental psql need: always -d openvpm_ai on openvpm-postgres-1, never -d openpims.

---

## START

Begin with Phase 1 (typecheck). Report results before proceeding to Phase 2.
Continue through all phases sequentially. Produce the final report at the end.
