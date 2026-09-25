# Arena Sprint 5: Prescriptions & Medication Oversight — Dashboard UI Kit Harmonization

> **Mission for Arena Agent:**
> Harmonize `/prescriptions` (`apps/web/app/(dashboard)/prescriptions/page.tsx`, 551 lines) according to `docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`.
> Transform the medication oversight register into the standard Dashboard Page Kit layout:
> `PageHeader` -> `KpiGrid` -> underline tabs -> `PageToolbar` -> `DataTableFrame` -> `EmptyState`.
> Ensure zero ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n symmetry, and add source-contract tests.

> **Independence:** This sprint touches ONLY `apps/web/app/(dashboard)/prescriptions/page.tsx`, its test suite `apps/web/lib/__tests__/prescriptions-ui.test.ts`, and translation dictionaries (`en.json`, `sk.json`).
> Do NOT touch Sprint 6 (`/whiteboard`) or Sprint 7 (`/encounters`, `/care-reminders`) files.

---

## 0. Preflight (do this first)

1. `git status` must be clean on your branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, and the exports of `apps/web/components/layout/page-kit.tsx` (`pageShellClass`, `PageToolbar`, `SearchField`, `filterControlClass`, `underlineTabsListClass`, `underlineTabsTriggerClass`, `tableHeadClass`, `tableCellClass`, `tableRowClass`, `DataTableFrame`, `KpiGrid`, `KpiCard`). Use their exact prop signatures.
3. Reference implementations: `apps/web/app/(dashboard)/encounters/page.tsx` and `apps/web/app/(dashboard)/care-reminders/page.tsx` (Sprint 7, merged into main).
4. Run baseline type-check: `pnpm --filter @openpims/web type-check`.

---

## 1. DO NOT TOUCH / Safety Invariants

- **Clinical safety gates & Slovak Law (Zákon 39/2007 Z. z. & Zákon 139/1998 Z. z.):**
  - Controlled substances (OPL) detection and safeguards must remain active.
  - Link to `/controlled-substances` must be preserved.
  - Prescription interactions and Clinical Guardian (`summary.criticalAlerts`, `summary.openMedicationAlerts`, guardian evaluation) must remain intact.
- **Backend tRPC queries:**
  - `trpc.extensions.medicationOversight.summary.useQuery(undefined, { refetchInterval: 60_000 })`
  - `trpc.extensions.medicationOversight.list.useQuery({ scope, search, limit: 200, offset: 0 })`
  - Do NOT change backend router contracts or invent new endpoints.
- **Out of scope files:**
  - Do NOT touch `packages/db/schema/*.ts` or migration journals.
  - Do NOT touch other dashboard routes (`/encounters`, `/care-reminders`, `/whiteboard`, `/schedule`, `/records`).

---

## 2. Architectural Rules (MUST FOLLOW)

1. **UIKIT hierarchy, top to bottom:**
   `PageHeader` (icon, title, one-line subtitle, actions `size="sm"`)
   -> `KpiGrid` (4 metrics: Aktívne predpisy · Končia do {days} dní · Po termíne · Strážca liekov)
   -> Underline tabs (`underlineTabsListClass` / `underlineTabsTriggerClass` for scopes: active, ending, overdue, controlled, alerts, all)
   -> `PageToolbar` (`SearchField` + result count + clear button)
   -> `DataTableFrame` (dense table with `tableHeadClass`, `tableCellClass`, `tableRowClass`)
   -> `EmptyState` inside the frame.
2. **Design tokens only:**
   - Active: `border-primary/40 bg-primary-muted text-primary-muted-foreground`
   - Ending soon: `border-warning/40 bg-warning-muted text-warning-muted-foreground`
   - Overdue: `border-destructive/40 bg-destructive-muted text-destructive-muted-foreground`
   - Controlled substances (OPL): `border-destructive/50 bg-destructive-muted text-destructive font-medium`
   - Guardian alerts: semantic `destructive` or `warning` chips.
   - Replace any raw Tailwind palette colors (`text-emerald-*`, `text-amber-*`, `bg-sky-*`) with semantic tokens.
3. **Dense Table Formatting:**
   - Medication name: `font-medium text-foreground text-xs`.
   - Rx number, dosage, frequency, and validity dates in `font-mono tabular-nums text-xs`.
   - Patient name & owner name in secondary line with `truncate` inside `min-w-0`.
   - Actions: compact `size="sm"` or icon-only `h-7 w-7 p-0` ghost buttons.
4. **States:**
   - Loading: `TableSkeleton` INSIDE `DataTableFrame`.
   - Empty: `EmptyState` INSIDE `DataTableFrame` (differentiate "no prescriptions" vs "no results matching search/filter"). Never render an empty table.
5. **Strict 100% i18n:**
   - All user-facing strings through `useI18n()`.
   - Exact key symmetry between `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
   - Professional Slovak veterinary terminology: "Dohľad nad liečivami", "Kniha OPL", "Ochranná lehota", "Dávkovanie".

---

## 3. Test & Verification Requirements

1. **Add unit test file:** `apps/web/lib/__tests__/prescriptions-ui.test.ts`:
   - Assert imports from `@/components/layout/page-kit` (`pageShellClass`, `PageToolbar`, `DataTableFrame`, `KpiGrid`).
   - Assert removal of old hand-built `<Card>` KPI blocks and raw color classes.
   - Assert presence of `underlineTabsListClass` and `DataTableFrame`.
   - Assert loading and empty states render inside the frame.
2. **Verification Gates:**
   - `pnpm --filter @openpims/web type-check` (0 type errors).
   - `pnpm --filter @openpims/web lint` (0 warnings).
   - `pnpm --filter @openpims/web test prescriptions-ui` (all green).
   - `node apps/web/scripts/check-i18n-symmetry.js` (100% dictionary symmetry).
