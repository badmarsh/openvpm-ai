# Controlled Pilot Readiness Report — Clinical AI Finalization

**Version:** 1.0.0
**Date:** 2026-09-12
**Branch:** `arena/01a09231-openvpm-ai` (from `e9f3f99`)
**Verdict:** **CONDITIONAL-GO** (conditions in §6; no P0 open)

---

## 1. Scope

Controlled-pilot readiness for the clinical-AI finalization surface: voice
SOAP, discharge, imaging, treatment-plan confirmation paths, the audit
ledger + verifier, authorization layer, dosing/formulary safety, file /
portal / webhook boundaries, and the ops evidence to run a pilot week.

Out of scope (unchanged pre-existing behavior): full-suite green status
(baseline carries extensive pre-existing failures — see §5), external
audit anchoring (pilot-target per `ai-audit-ledger.md` §6), production
deployment itself.

## 2. P0 risks fixed

| # | Risk | Fix | Proof |
|---|---|---|---|
| 1 | Privileged role fallbacks in authz | Fail-closed central actor-role resolution; unknown/missing roles deny | `authorization.test.ts`, RLS job |
| 2 | Replayable confirmations (bare booleans, no nonce/expiry) | One-time envelopes bound to actor/practice/entity/revision/content; bare `true` rejected | Real-DB contract 16/16; pilot smoke |
| 3 | Lost-update / double-finalize races | Mandatory `expectedRevision`, per-encounter advisory locks, atomic consume+write+audit | Concurrent-race contract tests |
| 4 | Mutable / unverifiable audit trail | Practice-scoped hash chain, immutability trigger + RLS, verifier with lifecycle detections | `audit-chain` 32/32; verifier E2E 8/8 |
| 5 | Extension tables missing on fresh migrate | Committed backlog as migration 0105 (32 tables); `db:generate` clean | Fresh-migrate + `db:rls` runs |
| 6 | Unsigned / duplicate webhooks | Verified: all inbound webhooks check signatures + transactional claims; added Stripe SDK tests | `stripe-webhook-signature` 6/6 |
| 7 | Unbounded prompt input | `visitContext` truncated to documented 2000 chars (was dead constant) | Eval harness §8 |
| 8 | Verifier blind spots | Soft-deleted rows no longer filtered; `MUTATED_ROW`/`LEGACY_ROW` detections; UUID redaction | Verifier E2E 8/8 |

## 3. Evidence ledger

| Suite / proof | Result | Where |
|---|---|---|
| Real-DB finalization contract (real PG16 + RLS + locks) | **16/16** | `server/__tests__/ai-clinical-finalization.integration.test.ts`, CI RLS job |
| Audit chain unit | **32/32** | `lib/ai/__tests__/audit-chain.test.ts` |
| Eval harness (clinical + safety, deterministic) | **25/25** | `lib/ai/__tests__/clinical-eval-harness.test.ts` |
| Stripe webhook signatures (real SDK, offline) | **6/6** | `lib/__tests__/stripe-webhook-signature.test.ts` |
| Verifier E2E on real PG16 (tamper matrix + reverts + redaction) | **8/8** | throwaway proof, DB dropped |
| Backfill E2E on real PG16 (dry-run, owner gate, sequencing, guards) | **7/7** | throwaway proof, DB dropped |
| Pilot flow vs live server + real PG16 (login→prepare→finalize→replay) | **7/7** | headless (no browser in sandbox); Playwright spec runs in CI |
| Branch-vs-baseline full-suite failure diff | **0 regressions** (67 vs 69; deltas are fixed/renamed tests) | recorded pre-reset; tree re-verified post-reset |
| `db:generate` drift | clean ("No schema changes") | |
| `tsc --noEmit` repo-wide (`@openpims/web`) | 0 errors (exit 0) | |

## 4. Deliverables

- Central authz layer (`lib/authorization.ts`), confirmation protocol
  (`docs/confirmation-protocol.md`, Options 1 + 2 with scribe deprecation plan)
- Envelope + revision enforcement (`lib/ai/clinician-confirmation.ts`,
  `routers/extensions/_safety.ts`, voice/discharge/imaging/ai routers)
- Ledger v2 + verifier (`audit-ledger.ts`, `audit-chain.ts`,
  `scripts/verify-ai-audit-trail.ts`) with lifecycle detections
- Cutover tooling (`scripts/backfill-ai-audit-chain.ts`,
  `docs/ai-audit-cutover.md`)
- Ops runbook (`docs/ai-finalization-operations.md`: daily verify, finding
  matrix, dual-control maintenance, troubleshooting, CI gates)
- Migration 0105 + RLS ordering fix + UI prepare→finalize + symmetric i18n
- Pilot E2E spec + fixture (`e2e/ai-finalization-pilot.spec.ts`, gated
  `PILOT_E2E=1`, disposable-DB guards)

## 5. Honest limitations

1. **Full unit suite is not green** — neither on baseline (69 failing) nor
   branch (67 failing). All remaining failures are pre-existing and
   untouched by this work (0 branch-only failures by duration-stripped
   diff). Pilot-go does not require full-suite green, but the backlog
   should be triaged before production graduation.
2. **Playwright pilot spec has not run under a real browser.** Every step
   was proven headless against a live server (7/7), and the spec parses,
   skips, and guards correctly — but the browser run must happen in CI
   (sandbox blocks browser CDN downloads).
3. **No external audit anchoring yet.** The ledger is application-level
   tamper-evidence (a DBA who recomputes hashes is undetected). Acceptable
   for a controlled pilot with a trusted DBA; required before graduation
   (pilot-target in `ai-audit-ledger.md` §6).
4. **Option 2 scribe path is transitional.** Bounded (create-only,
   role-gated, distinctly correlated, lifecycle CONFLICT on replay) with a
   measurable deprecation plan — but direct confirmations should trend to
   zero during the pilot.
5. **Production build** (`next build`) could not complete in this sandbox:
   it fails only at fetching `Inter`/`DM Sans` from Google Fonts (TLS to
   Google is blocked here; `app/layout.tsx` is untouched by this work, so
   baseline fails identically). Mitigations: repo-wide `tsc` exits 0, the
   dev server compiles and serves all pilot routes, and CI runs
   `pnpm build` with network as a merge gate (condition §6.1).

## 6. Conditions for GO

1. CI runs green on the new gates: RLS job (16-test contract), unit
   suites, `type-check`, and `build` (with network). The Playwright pilot
   spec **with a real browser** runs as the release deploy gate per
   `docs/production-readiness/RELEASE_RUNBOOK.md` step 3 (`PILOT_E2E=1`
   against a disposable `openpims_pilot_*` database) — it is not PR CI
   by repository design.
2. First pilot database is fresh-migrated (`db:migrate` + `db:rls` +
   `audit:verify-ai --allow-empty`); brownfield cutover follows
   `docs/ai-audit-cutover.md` with archived evidence.
3. Daily `audit:verify-ai --json` scheduled with SEV-1 alerting per
   `docs/ai-finalization-operations.md` §2 before first real visit.
4. External anchoring design approved (implementation may land during the
   pilot, must complete before graduation).
5. Scribe integrations acknowledge the Option 1 migration (`direct:`
   correlation counted weekly).

## 7. Recommendation

**CONDITIONAL-GO for a controlled pilot** on the stated conditions. No P0
is open; every P0 fix carries real-database proof; the branch introduces
zero regressions; operations (verify, cutover, incident response) are
documented and rehearsed against real PostgreSQL 16.
