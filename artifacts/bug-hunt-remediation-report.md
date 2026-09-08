# OpenVPM AI — Clinical Veterinary PIMS Bug Hunt & Remediation Report

**Repo:** `badmarsh/openvpm-ai` @ `5e1107c` (== `origin/main`, 444 commits)
**Branch:** `arena/01a07bf4-openvpm-ai`
**Method:** static audit across the directive's five vectors + full Vitest baseline + targeted safety-suite runs + full monorepo type-check.

---

## Follow-up: Focused Task (option b) — responsive tables + test scope

Applied after the initial audit. Sandbox note: no Postgres/browser available, so only non-DB gates ran (per instruction, DB integration suites are CI-owned).

### 1a. Responsive tables — `import-v2` preview (DONE)
Wrapped the four real-DOM preview tables (**patients / clients / vaccinations / visits**) in `apps/web/app/(dashboard)/settings/import-v2/page.tsx` with `<div className="overflow-x-auto">`. Confirmed present (4 wrappers) and verified type-safe.
- **Impact fixed:** on mobile/narrow terminals these wide preview tables (long addresses/emails/IDs, up to 7 columns) were clipped by an ancestor `overflow-hidden` with no horizontal scroll → preview data unreadable during data migration.

### 1b. Test scope refinement — `responsive-tables.test.ts` (DONE)
The previous governance test used a **raw-text scan**: it flagged *every* line containing `<table`, including HTML that lives **inside printable document templates** (e.g. the Slovak statutory register builders in `statutory/page.tsx`, where report HTML is assembled in backtick templates and written via `printWindow.document.write(...)`). That produced false positives: those A4 print tables are *not* dashboard DOM and must never be wrapped in `overflow-x-auto` (it would corrupt printed output).

**Fix:** the scanner now parses each file with the **TypeScript compiler AST** (`ts.createSourceFile`, `ScriptKind.TSX`) and only reports genuine `JsxOpeningElement`s whose intrinsic tag is `table`. Any `<table>` inside a template/string literal is inherently invisible to the AST walk, so printable report tables are ignored by construction. A cheap `sourceText.includes("<table")` pre-filter avoids parsing files with no tables.

**Proof of behavior (both directions):**
- ✅ Passing state: `pnpm --filter @openpims/web test components/layout/__tests__/responsive-tables.test.ts` → **1 passed**, and it no longer reports the `statutory/page.tsx` printable-template lines.
- ✅ Regression detection preserved: temporarily unwrapping the `import-v2` tables makes the test **fail** (offenders reported); restoring the wrappers makes it pass again.

### 2. i18n compliance (DONE)
- The only additions in `import-v2/page.tsx` are structural tags/classnames (`<div>`, `<table>`, `overflow-x-auto`) — **no new user-facing strings** were introduced, so no `useI18n()` wiring was required.
- Verified **100% leaf-key symmetry** between `en.json` and `sk.json` after the changes: EN 4206 == SK 4206, 0 missing each way, 0 branch conflicts. No dictionary edits were needed.

### 3. Verification (Task 3)
- `pnpm --filter @openpims/web type-check` → **0 errors (exit 0)**.
- `pnpm --filter @openpims/db type-check` → **0 errors (exit 0)**.
- `pnpm --filter @openpims/email type-check` → **0 errors (exit 0)**.
- (Monorepo `turbo type-check` was run per-package with `NODE_OPTIONS=--max-old-space-size=3072` because `turbo type-check` OOMs at default heap on this 3.9 GB box, as documented in the repo's own readiness report.)

### Files changed (this follow-up)
- `apps/web/app/(dashboard)/settings/import-v2/page.tsx` — wrap 4 preview tables in `overflow-x-auto`.
- `apps/web/components/layout/__tests__/responsive-tables.test.ts` — AST-based scanner that only checks rendered JSX `<table>` elements (skips printable/template HTML).

---

---

## 0. Environment / verification limits (must be read first)

This sandbox has **no PostgreSQL server, no browser, ~3.9 GB RAM, 2 CPUs**. Consequences for the directive's mandated gates:

| Required gate | Status here |
|---|---|
| `pnpm type-check` (0 errors) | ✅ **pass** — `@openpims/web` tsc `--noEmit`, exit 0 (with `NODE_OPTIONS=--max-old-space-size=3072`) |
| Full `pnpm --filter @openpims/web test` | ⚠️ **49 fail / 4507 pass / 24 skip (4580)** — all 28 failing files are **pre-existing on `main`** and are *source-text / UI-governance* assertion drift, not runtime defects (see §6). |
| Directive-relevant **non-DB** suites | ✅ **73/73 pass** (`templates-safety`, `patients-safety`, `care-reminders-safety`, `automated-reminder-policy`) |
| DB-backed integration (RLS, patient-merge, estimate-conversion, templates double-charge, e-Kasa) | ⚠️ env-gated (`*_DB_INTEGRATION=1`) + need a real Postgres (create db → migrate → RLS); **not runnable** here. These are the only suites that can *prove* Vector B/C/D runtime correctness end-to-end. |
| SSR hydration / Playwright critical path | ⚠️ no browser runtime; static-only review of Vector A |

Everything below that is marked **verified-clean** is backed by the artifacts above or direct source evidence.

---

## 1. Remediation delivered in this pass

### Bug: Raw dashboard `<table>`s in the v2 data-import preview overflow horizontally on small viewports
**File modified:** `apps/web/app/(dashboard)/settings/import-v2/page.tsx`

- **Impact:** On phones/narrow clinic terminals the *patients / clients / vaccinations / visits* import-preview tables (7, 5, 5, 4 columns incl. long addresses/emails/IDs) rendered in a container that is `overflow-hidden` (not `overflow-x-auto`), clipping content with no way to scroll to the off-screen columns → data unreadable and unusable during migration preview.
- **Root cause:** each `<table>` was a direct child of `<div className="border rounded-lg overflow-hidden text-xs">`; nothing provided horizontal scrolling, so wide tables were clipped by the ancestor's `overflow-hidden`.
- **Fix (minimal/surgical):** wrapped all four real-DOM tables in `<div className="overflow-x-auto">`. No logic or markup semantics changed.
- **Proof:** re-ran `responsive-tables.test.ts` — the four `import-v2/page.tsx` offenders (previously lines 311/350/375/400) are **gone** from the offender list. `tsc --noEmit` exit 0.

> Note: `statutory/page.tsx` tables flagged by that same governance test are **false positives** — they live inside `printWindow.document.write(\`…\`)` printable-register HTML strings (A4 report layout, `page-break`, inline `px`/`border` styles), not in the dashboard DOM. They must **not** be wrapped in `overflow-x-auto` (that would corrupt print output). The test's naive scan does not distinguish JSX tags from HTML inside string/template literals — see §6 residual finding.

---

## 2. Vector A — SSR & React 19 hydration mismatches — findings

**Verified-clean patterns (static):**
- Service workers only registered when `process.env.NODE_ENV === "production"` **and** host is not `localhost` (`components/marketing/tv-player.tsx`); `lib/providers.tsx` only **unregisters/purges** on `localhost`/dev. Guardrail 4 satisfied.
- `experimental.optimizePackageImports` is gated behind `NODE_ENV === "production"` in `next.config.js`. ✅
- No locale/timezone-dependent call (`toLocaleDateString/Intl.DateTimeFormat/new Date()`) found rendering synchronously into SSR'd markup without being under a data/loading gate. Date-heavy components (`tv-player`, `waiting-room-tv`, e-Kasa/statutory/voice report builders) either tick via `useEffect` after mount or build print documents on a user action in the client.
- Repo also carries a shared `lib/date-display` helper + `date-display.test.ts`, the extraction intended to centralize hydration-safe formatting.

**Residual risk (recommended follow-up, needs browser):** many pages still call locale formatters directly (`toLocaleDateString("sk-SK")`, etc.) rather than the shared helper. This is not a proven mismatch here (all are under client data gates), but converting them to the shared helper is the durable fix.

---

## 3. Vector B — Multi-tenant RLS leaks & data isolation — findings

**Verified-clean (static + tests):**
- `server/routers/*` consistently scope queries with `eq(<table>.practiceId, ctx.practiceId)`; the extension statutory routers reviewed (`extensions/statutory.ts`) scope every `select/insert` and inner-join by `practiceId`, and resolve patients against the session practice before any write.
- RLS is enforced at the DB layer as a backstop; repo carries an RLS test harness (244 checks documented in the repo's own `production-readiness-report.json`) plus `server/__tests__/patients-safety.test.ts` and `adversarial-tenant-isolation.test.ts` (both pass).
- Signed capability routes have their own route/header handling and dedicated `route.test.ts` (non-DB) suites that pass.

**Not runnable here:** the `openpims_app` DB integration (`db:rls`, `test-rls.ts`, adversarial suite against real Postgres) — requires provisioning.

---

## 4. Vector C — Billing concurrency / inventory double-deduction — findings

**Verified-clean (recent commit + passing suite):**
- The tip commit `5e1107c` is itself the template medication double-charge remediation (`server/routers/templates.ts`): deterministic lock ordering (appointment boundary → invoice row → product rows → source-evidence recheck), advisory locks, and `computeStockDeductions` aggregation in `lib/inventory/dispense.ts` (pure, correct).
- `server/__tests__/templates-safety.test.ts` (32 tests) → **pass**, no DB required.
- `lib/__tests__/care-reminders-safety.test.ts` + `automated-reminder-policy.test.ts` (16 tests) → **pass**, confirm quiet-hours / channel / consent policy is shared and correct.

**Not runnable here:** `billing-estimate-conversion.integration.test.ts` (449 added lines of lock-order/forced-schedule coverage) is gated on `BILLING_CONVERSION_DB_INTEGRATION=1` + Postgres.

---

## 5. Vector D — Patient merge & record integrity — findings

- Merge logic is implemented with pessimistic per-patient row locks, a single serializable tenant transaction, merge-event journaling, and re-parenting that explicitly re-checks active/future appointment & waitlist collisions; `mergeId` self-merge and already-merged guards present (`server/routers/patients.ts`).
- `server/__tests__/patient-merge-transaction.integration.test.ts` encodes the full outer-transaction contract.
- **Not runnable here:** gated on `PATIENT_MERGE_DB_INTEGRATION=1` + Postgres (`create database → migrate → db:rls`). Static review found no dangling-FK or non-transactional path.

---

## 6. Vector E — Dictionary symmetry — **PASS (clean)**

Automated key comparison between `apps/web/messages/en.json` and `apps/web/messages/sk.json`:

- Leaf keys: **EN 4206 == SK 4206** — 0 missing in either direction.
- Branch paths: EN 194 == SK 194, 0 mismatches.
- No path that is an object in one language and a leaf in the other (which would break `t()` lookups).

**Guardrail #2 (100% symmetry) holds.**

---

## 6b. Full-suite residual failures (pre-existing on `main`, out of scope for a runtime fix)

`49 failed | 4507 passed | 24 skipped (4580)` — 28 files. Reproduced **identically at the untouched baseline**; they are not introduced by this branch and are almost entirely **stale source-string/governance assertions** (tests that `readFileSync` a `.tsx` and assert on its literal text after intentional refactors) rather than runtime defects. Prominent examples:

- `responsive-tables.test.ts` — **over-broad**: flags `<table>` tags that live inside *printable HTML string/template literals* (statutory reports). Correctness defect in the test's naive scanner (does not distinguish JSX from HTML inside strings). Recommended fix (not applied here): make the scanner string/template-aware so it only checks genuine JSX `<table>` elements.
- `responsive-shell.test.ts` and ~24 UI-source suites assert on moved component source text.

These were intentionally left unfixed (per repo guidance they are classification "drift", not product bugs) — chasing them would mean editing tests to match churned source, which does not improve product behavior.

---

## 7. Additional genuine observations (not fixed — flagged for product owners)

1. **Statutory/extension routers return hardcoded Slovak TRPC messages** (`extensions/statutory.ts`: "Pacient nebol nájdený", etc.) while the rest of the codebase uses English/`t()`-driven messages — inconsistent with the bilingual UI and dictionary system. Low severity (server error text), flagged.
2. **`settings/import-v2/page.tsx` and statutory report builders contain raw, non-dictionary UI strings** (Slovak literals) bypassing `en/sk` dictionaries — matches residual i18n drift, worth a follow-up i18n pass.
3. **Date/locale formatting duplication** — many components still call `toLocaleDateString/toLocaleString` directly instead of `lib/date-display` (Vector A hardening).

---

## 8. Verification summary

- **Applied fix** (import-v2 responsive): `responsive-tables.test.ts` no longer reports the 4 `import-v2` offenders; `apps/web` `tsc --noEmit` exit 0.
- **Directive-relevant non-DB suites:** 73/73 pass.
- **Full web suite baseline:** 49 pre-existing failures (all non-DB/static-governance drift), unchanged in nature from `main`.
- **Dictionary symmetry:** 4206/4206 leaf keys, 0 mismatches.
- **Type-check (monorepo web):** 0 errors.

### Not executed (sandbox cannot)
DB-backed RLS / merge / billing-conversion / e-Kasa integration suites; Playwright hydration/critical-path. These are the recommended next steps on a CI host with Postgres + browser.