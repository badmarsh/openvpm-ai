# Arena Sprint 11: Reports & Financial Analytics + Wellness Plan Performance `/reports`, `/wellness`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in practice reporting and wellness subscription tracking:
> `apps/web/app/(dashboard)/reports/page.tsx` (~1,031 lines) and `apps/web/app/(dashboard)/wellness/page.tsx` (~271 lines).
> This is a **presentation, analytics reliability, and UI Kit harmonization sprint**.
> Zero change to underlying fiscal/accounting formulas, raw DB aggregations, or export algorithms.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned export tests green.

> **Independence:**
> Touches strictly `apps/web/app/(dashboard)/reports/page.tsx` and `apps/web/app/(dashboard)/wellness/page.tsx`.
> Does not touch `billing/page.tsx`, `billing/ekasa/page.tsx`, or `server/routers/reports.ts`.

---

## 0. Preflight

1. `git status` clean on your working branch; ensure no dirty working tree.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/reports-export-ui.test.ts` in full.
3. Facts verified in the repo:
   - `reports/page.tsx` currently defines its own hand-rolled `KpiCard` component (lines 82–100) instead of importing `KpiCard` from `@/components/layout/page-kit`.
   - `tabs` in `reports/page.tsx` currently has hardcoded English labels (`"Revenue"`, `"Appointments"`, `"Services"`, `"Inventory"`).
   - `reports/page.tsx` uses standard shadcn tabs without `underlineTabsListClass` / `underlineTabsTriggerClass`.
   - `wellness/page.tsx` uses a raw `"space-y-6"` div instead of `pageShellClass`, has hardcoded Slovak strings without `t()` in toast handlers and section titles, and lacks `PageToolbar` and `DataTableFrame`.
   - The test `apps/web/lib/__tests__/reports-export-ui.test.ts` reads `reports/page.tsx` using `readFileSync` and enforces exact source literals. Every asserted string must stay byte-identical.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/reports-export-ui.test.ts lib/__tests__/heavy-client-imports.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Heavy Client Import Guarantees (`heavy-client-imports.test.ts`):**
  - Dynamic chunking of `RevenueLineChart` and `ServicesCountChart` via `dynamic(() => import("@/components/reports/report-charts")...)` must remain.
  - `ReportChartChunkLoading` must remain defined and used as the loading placeholder.
  - No top-level `import ... from "@/lib/pdf"`. PDF generation must stay lazy-loaded inside action handlers via `import("@/lib/pdf")`.
- **Exact Source-Contract Literals from `reports-export-ui.test.ts` (Keep Verbatim):**
  - `function ReportExportButtons`
  - `import("@/lib/pdf")`
  - `generateReportPdf`
  - `Export CSV`
  - `Export PDF`
  - `title: "Revenue Report"`
  - `title: "Appointments Report"`
  - `title: "Services Report"`
  - `title: "Inventory Alerts Report"`
  - `filename: reportFilename("revenue", data.range, "pdf")`
  - `filename: reportFilename("appointments", data.range, "pdf")`
  - `filename: reportFilename("services", data.range, "pdf")`
  - `filename: reportFilename("inventory", undefined, "pdf")`
  - `if (data.items.length === 0)` inside `ServicesTab`
  - `onCsv={exportServices}` inside `ServicesTab`
  - `No service data available` inside `ServicesTab`
  - `trpc.reports.settings.useQuery`
  - `const reportSettings = settingsQuery.data`
  - `defaultClientReportDateRange(new Date(), reportSettings.timezone)`
  - `const reportSettingsReady =`
  - `!needsDateRange || Boolean(reportSettings && !settingsQuery.error)`
  - `const canRenderDateRangeControls =`
  - `needsDateRange && dateRange && reportSettings && !settingsQuery.error`
  - `timeZone={reportSettings.timezone}`
  - `onChange(reportPresetDateRange(preset, new Date(), timeZone))`
  - `const dateRangeError = needsDateRange ? settingsQuery.error : null`

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace the date range flow from `reportPresetDateRange` through the tRPC queries.
   - Review currency formatting: all money values must pass through `formatAmount` from `useCurrencyFormatter`.
2. **Phase 2: Audit & Findings**
   - Audit division by zero: check average ticket calculations (e.g. total revenue / invoice count) when count is 0 to ensure no `NaN` or `Infinity` is displayed.
   - Audit empty states: ensure each tab has an empty state that retains the ability to export or change filter presets.
   - Audit responsive viewport behavior at 1280×800 and 1024×768: verify chart containers and summary tables do not blow out horizontal width.
3. **Phase 3: Fix Bugs & Hardening**
   - Replace any raw `NaN` display with fallback `€0.00` or `—`.
   - Fix hardcoded English strings in tab headers and table captions by mapping them through `useI18n()`.
   - In `wellness/page.tsx`, localize hardcoded toast messages and form validation alerts.
4. **Phase 4: UI Kit Harmonization**
   - Replace local `KpiCard` with `KpiGrid` and `KpiCard` from `@/components/layout/page-kit`.
   - Apply `underlineTabsListClass` and `underlineTabsTriggerClass` to tab lists.
   - Wrap tabular lists in `DataTableFrame`.
   - Use `pageShellClass` as the root wrapper.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check, and verify zero regressions.

---

## 3. Detailed Requirements

### 3A. `/reports/page.tsx`
- Replace local `function KpiCard` with `@/components/layout/page-kit`'s `KpiCard`. Compose sub-labels into `value` or `label` without violating prop signatures.
- Standardize the tab bar with `underlineTabsListClass` and `underlineTabsTriggerClass`.
- Localize tab labels: `revenue` → `t("reports.tabs.revenue", "Tržby")`, `appointments` → `t("reports.tabs.appointments", "Objednávky")`, `services` → `t("reports.tabs.services", "Výkony")`, `inventory` → `t("reports.tabs.inventory", "Sklad")`.
- Guard all calculations against division by zero (e.g., `invoicesCount > 0 ? total / invoicesCount : 0`).

### 3B. `/wellness/page.tsx`
- Replace raw `<div className="space-y-6">` with `className={pageShellClass}`.
- Replace manual filter and action buttons with `PageToolbar` and `filterControlClass`.
- Wrap the benefit redemptions table in `DataTableFrame`.
- Replace hardcoded Slovak strings in `toast.success`, `toast.error`, and headings with `t(...)` calls. Add symmetric keys to both `messages/en.json` and `messages/sk.json`.

---

## 4. Tests

Create a new source-contract test: `apps/web/lib/__tests__/reports-wellness-pagekit.test.ts`:
- Asserts that `reports/page.tsx` imports from `@/components/layout/page-kit` (`KpiGrid`, `pageShellClass`, `underlineTabsListClass`).
- Asserts that `wellness/page.tsx` imports `pageShellClass` and `DataTableFrame`.
- Asserts that `heavy-client-imports.test.ts` and `reports-export-ui.test.ts` pass without errors.

---

## 5. i18n

- Add any missing keys under `reports.*` and `marketing.wellness.*` symmetrically to `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
- Enforce: 0 missing keys, nested JSON only.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/reports-export-ui.test.ts lib/__tests__/heavy-client-imports.test.ts lib/__tests__/i18n-structure.test.ts lib/__tests__/reports-wellness-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] Pinned source strings in `reports-export-ui.test.ts` are 100% preserved.
- [ ] Local hand-rolled `KpiCard` in `reports/page.tsx` removed and replaced with UI Kit primitives.
- [ ] `wellness/page.tsx` adopts `pageShellClass`, `PageToolbar`, and `DataTableFrame`.
- [ ] Zero unhandled `NaN` on 0-invoice or 0-patient reporting periods.
- [ ] 100% symmetric leaf translations in `en.json` and `sk.json`.
- [ ] All verification commands exit with code 0.
