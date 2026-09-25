# Arena Sprint 2: Dashboard UI Kit Harmonization across Recalls, Vaccinations & Controlled Substances

> **Mission for Arena Agent:**
> Harmonize `/recalls` (Vakcinačné pripomienky), `/vaccinations` (Kniha očkovaní), and `/controlled-substances` (Kniha omamných látok) according to the Dashboard UI Kit (`docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`).
> Ensure zero ESLint warnings, 0 type errors, and 100% i18n symmetry.

---

## Architectural Rules (MUST FOLLOW)
1. Follow `docs/UIKIT.md`. List pages must use `PageHeader` + `PageToolbar` + `DataTableFrame` / `KpiGrid` from `apps/web/components/layout/page-kit.tsx`.
2. Do NOT invent per-page table or button chrome.
3. 100% key symmetry between `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
4. Clinical compliance (Zákon 139/1998 Z. z.): Controlled substance balance calculations and manual entry gates must remain strictly intact.

---

## Detailed Requirements

### 1. Harmonize `/recalls` (`apps/web/app/(dashboard)/recalls/page.tsx`)
- Standardize layout to `PageHeader` + `PageToolbar` + `DataTableFrame`.
- Replace loose `py-4` cell padding with dense operator standard `py-2.5 px-4`.
- Standardize `<th>` table headers to:
  `<th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">`
- Use `tabular-nums font-mono text-[11px]` on dates and overdue days count.
- Action buttons in table rows must be compact (`size="sm" text-xs`).

### 2. Harmonize `/vaccinations` (`apps/web/app/(dashboard)/vaccinations/page.tsx`)
- Standardize layout to `PageHeader` + `PageToolbar` + `DataTableFrame`.
- Standardize table headers `<th>` to match the uppercase muted tracking pattern.
- Ensure microchip numbers, batch numbers, and dates use `font-mono tabular-nums`.
- Use design system tokens (`bg-success-muted`, `bg-warning-muted`, `border-border`) rather than hardcoded colors.

### 3. Harmonize `/controlled-substances` (`apps/web/app/(dashboard)/controlled-substances/page.tsx`)
- Refactor top bar to use `PageHeader` and wrap log table in `DataTableFrame`.
- Keep existing movement badges (`received: border-success/40 bg-success-muted text-success-muted-foreground`, etc.).
- Ensure ledger numbers, unit balances, and dates are strictly `font-mono tabular-nums`.

### 4. Verification
- `pnpm lint` — 0 warnings.
- `pnpm type-check` — 0 errors.
- `pnpm test` — all Vitest tests pass (including `statutory-ekasa-consolidation.test.ts`).
