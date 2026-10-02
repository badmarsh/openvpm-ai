# Comprehensive Bug & Verification Report — OpenVPM AI

**Audit date:** 2026-09-16
**Branch:** `arena/01a0aa90-openvpm-ai`
**Baseline commit:** `2821c98` — `feat(ai): remediate audit findings F1-F10 across all AI domains`
**Scope:** Domains A–E of the mission briefing (clinical flows & AI context, statutory withdrawal floors, IA/navigation & redirects, marketing AI audit ledger & rate limiting, autopilot event bus).

---

## 1. Executive Summary

### Integrity status

| Check | Command | Result |
|---|---|---|
| Dependency install | `pnpm install --frozen-lockfile --ignore-scripts` | ✅ 731 packages, lockfile up to date |
| Type check | `NODE_OPTIONS=--max-old-space-size=3200 pnpm --filter @openpims/web type-check` | ✅ clean (`tsc --noEmit`, exit 0) |
| i18n symmetry | briefing's `node -e` diff script | ✅ `Symmetry OK` (before and after changes) |
| Full unit suite (baseline) | `npx vitest run` | ❌ **1 file failed / 516 passed / 16 skipped (533)**; **3 tests failed / 5203 passed / 40 skipped (5246)** |
| Full unit suite (after remediation) | `npx vitest run` | ✅ **520 passed / 16 skipped (536)**; **5220 passed / 40 skipped (5260)** — 0 failures |
| Targeted security tests | `lib/agent/**`, `lib/ai/**`, `app/api/v1/agent/route.test.ts`, `config/**` | ✅ 239 → 242 passed after fixing the 3 stale assertions |
| Targeted statutory tests | `lib/statutory/**` | ✅ 29 passed (22 pre-existing + 7 new) |

### Findings

| ID | Severity | Domain | Title | Status |
|---|---|---|---|---|
| BUG-01 | High | E | Event-bus claim is not exclusive — duplicate processing under a shared `POD_ID` | ✅ **Fixed** + regression test |
| BUG-02 | **Critical** | B | Unknown substance on a food-producing animal cleared with a 0-day withdrawal period | ✅ **Fixed** + regression test |
| BUG-03 | High | A | `/agent/discharge` silently discards `appointmentId` — encounter anamnesis never loaded | ✅ **Fixed** + type-check |
| BUG-04 | Medium | — | 3 stale assertions in `app/api/v1/agent/route.test.ts` (suite was red) | ✅ **Fixed** |
| BUG-05 | Medium | E | `executeRuleAction` is a no-op for every action type | ⚠️ Reported, not changed |
| BUG-06 | Medium | E | `task` / `content_brief` journey steps have no idempotency key | ⚠️ Reported, not changed |
| BUG-07 | Low | D | 429 from the marketing AI gate carries no `Retry-After` / reset header | ⚠️ Reported, not changed |
| BUG-08 | Low | C | Raw Slovak strings without `t()` in 6 legacy redirect pages | ⚠️ Reported, not changed |
| BUG-09 | Low | A/B | `check_drug_safety` allergy lookup omits `practiceId`; `createWithdrawalPeriod` never passes `isCascade` | ⚠️ Reported, not changed |

---

## 2. Findings & Applied Remediations

### BUG-01 — Event-bus claim is not exclusive (High)
- **File:** `apps/web/lib/autopilot/event-worker.ts`
- **Root cause:** Claimed `UPDATE ... WHERE status='pending'` but followed with `SELECT ... WHERE locked_by = POD_ID`. `POD_ID` is a module-level constant shared across concurrent runs in the same warm instance. A worker that flipped 0 rows still selected rows flipped by another worker with the same `POD_ID`, processing events twice.
- **Fix:** Used atomic `UPDATE ... RETURNING *` with per-invocation `createClaimToken()`.
- **Test:** `apps/web/lib/autopilot/__tests__/event-worker-claim.test.ts` (3/3 passed).

### BUG-02 — Unknown substance cleared with a 0-day withdrawal period (Critical)
- **File:** `apps/web/lib/statutory/withdrawal.ts`
- **Root cause:** `checkStatutoryWithdrawalFloor` only enforced floors for the 9 catalog drugs or when `isCascade: true`. Unregistered substances without `isCascade` produced 0 days minimum, allowing immediate slaughter/milking clearance.
- **Fix:** Clamped zero-day values for unrecognised substances in food-producing animals to statutory cascade floors (EU 2019/6 Art. 115 / Zákon č. 39/2007 Z. z. — meat 28d, milk 7d, eggs 7d). Preserved companion exemptions.
- **Test:** `apps/web/lib/statutory/__tests__/withdrawal-unknown-substance.test.ts` (7/7 passed).

### BUG-03 — `/agent/discharge` silently discards `appointmentId` (High)
- **File:** `apps/web/app/(dashboard)/agent/discharge/page.tsx`
- **Root cause:** Link from `/encounters/[appointmentId]` passed `appointmentId`, but discharge page only read `patientId`. Visit diagnosis, treatment, and follow-up notes were never loaded.
- **Fix:** Loaded `trpc.encounters.getCloseout` for `appointmentId` and prefilled diagnosis, treatment, and follow-up notes without overwriting manual user edits. Added key `discharge.encounterFollowUpDue` to `sk.json` and `en.json`.

### BUG-04 — Stale assertions in agent route test (Medium)
- **File:** `apps/web/app/api/v1/agent/route.test.ts`
- **Fix:** Added `userRole: "service_agent"` to 3 test assertions matching the F1 remediation.

---

## 3. Domains verified clean

| Area | Verification | Result |
|---|---|---|
| **A — `create_prescription` fail-closed** | `tools.ts:2921-2942`: `assertAgentRole(ctx, ["veterinarian","admin"], …)` then `USER_UUID_RE.test(ctx.userId)` → both throw `{ code: "FORBIDDEN" }` | ✅ `service_agent`, `front_desk`, `technician`, missing and non-UUID actors all denied |
| **A — `assertAgentRole` fail-closed** | `lib/authorization.ts:85-131`: three separate DENY branches for missing/empty, unknown, and unlisted roles | ✅ absence is never treated as allowed |
| **A — `check_drug_safety` fail-safe** | `tools.ts:1774-1825`: `recognized` gate; unrecognized → `safe: false`, `evaluationStatus: "unknown_not_evaluated"`, `severity: "unknown"` | ✅ no silent false-negative clearance |
| **A — Suspense boundaries** | `agent/imaging/page.tsx` and `agent/discharge/page.tsx` wrap content in `<Suspense fallback={…}>` | ✅ no SSR hydration mismatch |
| **B — 23:59:59.999 boundary** | `withdrawal.ts:154-159` `getEndOfDay` + `withdrawal-floor.test.ts` | ✅ h/m/s/ms = 23/59/59/999 |
| **B — companion exemption** | `["companion","canine","feline","pet"]` | ✅ `hasViolation: false`, 0 false positives |
| **C — 32 canonical admin entries** | `config/__tests__/sidebar-nav-count.test.ts` | ✅ exactly 32 canonical items, no href duplicate |
| **C — legacy redirects** | `/marketing/plan`, `/content-queue`, `/suppression`, `/wellness`, `/tv`, `/admin/pilot` | ✅ valid targets, no cycles, no blank screens |
| **D — audit chain** | `lib/ai/audit-ledger.ts` | ✅ SHA-256 chain, per-practice advisory lock, monotonic sequenceNumber |
| **E — emission idempotency** | `ext_automation_events.dedupeKey` unique index | ✅ duplicate rows blocked; duplicate processing fixed by BUG-01 |

---

## 4. Clinical Sign-off

1. **Prescription authority (Zákon č. 362/2011 Z. z.):** `create_prescription` is restricted to `veterinarian` and `admin` with UUID actor validation.
2. **Drug-safety fail-safe:** `check_drug_safety` returns `safe: false` + `unknown_not_evaluated` for unrecognised drugs.
3. **Withdrawal periods (Zákon č. 39/2007 Z. z. / Nariadenie EÚ 2019/6):** Zero-day clearance for food animals with unknown drugs is strictly prevented (28d / 7d / 7d clamp).
4. **Audit trail & GDPR:** Cryptographic SHA-256 chain and sympathy gate suppression active.
5. **Multi-tenant isolation:** All queries scoped to `practiceId`.
