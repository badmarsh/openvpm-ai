# Arena Sprint 4: Laboratory Results & Diagnostic Reference Range Flags

> **Mission for Arena Agent:**
> Harmonize `/lab-results` (`apps/web/app/(dashboard)/lab-results/page.tsx`) according to the Dashboard UI Kit (`docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`).
> Implement reference range status badges, species-specific filtering, and dense tabular numerical formatting.
> Ensure zero ESLint warnings, 0 type errors, and 100% bilingual (SK/EN) i18n symmetry.

---

## Architectural Rules (MUST FOLLOW)
1. **Follow `docs/UIKIT.md`:** Use `PageHeader` + `PageToolbar` + `DataTableFrame` / `KpiGrid` from `apps/web/components/layout/page-kit.tsx`.
2. **Vanilla Schema Immutability:** Never modify upstream schema files in `packages/db/schema/*.ts`.
3. **100% Strict i18n:** All UI text must go through `useI18n()`. Maintain 100% key symmetry between `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
4. **Clinical Safety:** Lab interpretations must remain advisory.

---

## Detailed Requirements

### File: `apps/web/app/(dashboard)/lab-results/page.tsx`
1. **Layout Harmonization:**
   - Replace custom header and wrapper with `PageHeader` and `pageShellClass`.
   - Wrap the main results table in `DataTableFrame`.
   - Standardize search and filter controls inside `PageToolbar`.
2. **Reference Range Badges:**
   - Display clear status badges using design system tokens:
     - `NORMAL`: `border-success/40 bg-success-muted text-success-muted-foreground`
     - `LOW` / `HIGH`: `border-warning/40 bg-warning-muted text-warning-muted-foreground`
     - `CRITICAL`: `border-destructive/40 bg-destructive-muted text-destructive-muted-foreground font-semibold`
3. **Typography & Formatting:**
   - Parameter values, reference ranges, and test dates must use `font-mono tabular-nums text-xs`.
   - Table headers must match standard tracking:
     `h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
4. **Verification:**
   - `pnpm lint`, `pnpm type-check`, `pnpm test`.
