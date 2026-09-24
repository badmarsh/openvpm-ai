# Arena Sprint 5: Prescriptions & Controlled Medication Safeguards

> **Mission for Arena Agent:**
> Harmonize `/prescriptions` (`apps/web/app/(dashboard)/prescriptions/page.tsx`) according to the Dashboard UI Kit (`docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`).
> Enforce prescription lifecycle states (active, dispensed, cancelled, expired), human-in-the-loop signing flow, and dense mono formatting.
> Ensure zero ESLint warnings, 0 type errors, and 100% bilingual (SK/EN) i18n symmetry.

---

## Architectural Rules (MUST FOLLOW)
1. **Follow `docs/UIKIT.md`:** Use `PageHeader` + `PageToolbar` + `DataTableFrame` / `KpiGrid` from `apps/web/components/layout/page-kit.tsx`.
2. **Clinical Safety & Slovak Law (Zákon 39/2007 Z. z. & Zákon 139/1998 Z. z.):**
   - Controlled substances (opiates, ketamine, etc.) require explicit manual entry and vet confirmation.
   - Prescriptions cannot be dispensed without licensed veterinarian signature check.
3. **100% Strict i18n:** All UI text through `useI18n()`. Key symmetry between `en.json` and `sk.json`.

---

## Detailed Requirements

### File: `apps/web/app/(dashboard)/prescriptions/page.tsx`
1. **Layout Harmonization:**
   - Standardize to `PageHeader` with title, subtitle, and primary action (`+ Nový recept` / `+ New Prescription`).
   - Wrap prescription list in `DataTableFrame`.
   - Add status filter pills: `all`, `active`, `dispensed`, `cancelled`, `expired`.
2. **Status Badges & Tokens:**
   - `active`: `border-primary/40 bg-primary-muted text-primary-muted-foreground`
   - `dispensed`: `border-success/40 bg-success-muted text-success-muted-foreground`
   - `expired`: `border-muted bg-muted text-muted-foreground`
   - `cancelled`: `border-destructive/40 bg-destructive-muted text-destructive-muted-foreground`
3. **Dense Table Formatting:**
   - Rx number, dosage units, and validity dates in `font-mono tabular-nums text-xs`.
   - Compact action buttons (`size="sm" text-xs`).
4. **Verification:**
   - `pnpm lint`, `pnpm type-check`, `pnpm test`.
