## Context / Why
The fiscal cash-register screen (`apps/web/app/(dashboard)/billing/ekasa/page.tsx`) used ad-hoc card wrappers, non-standard KPI blocks, and raw styling. This PR brings `/billing/ekasa` (Doklady, Uzávierky, Pre účtovníka tabs) into full alignment with the **Dashboard UI Kit** (`docs/UIKIT.md`, `@/components/layout/page-kit`).

## Changes
- **Page Kit Hierarchy:** Replaced ad-hoc wrapper containers with `DataTableFrame`, `KpiGrid`, `KpiCard`, `PageToolbar`, and `PageHeader`.
- **Underline Tabs:** Replaced legacy tab buttons with `underlineTabsListClass` and `underlineTabsTriggerClass` on existing shadcn primitives.
- **Accountant Filter Controls:** Applied `filterControlClass` on month and year selects.
- **Zero Fiscal/Contract Regression:** 100% frozen fiscal math, signing (OKP/PKP), storno rules, daily closure logic, and tRPC endpoints.
- **New Test Suite:** Added `apps/web/lib/__tests__/billing-ekasa-ui.test.ts` verifying all Page Kit and statutory constraints.

## Verification
- ✅ `pnpm --filter @openpims/web exec vitest run lib/__tests__/billing-ekasa-ui.test.ts lib/__tests__/statutory-ekasa-consolidation.test.ts` (14/14 passed)
- ✅ All 11 e-Kasa & statutory test suites (68/68 tests passed)
- ✅ `pnpm --filter @openpims/web type-check` (`tsc --noEmit` clean, exit 0)
