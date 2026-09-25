# Arena Sprint 27: Inventory Hardening and Supplier Integration /inventory

> **Mission for Arena Agent:**
> Harden inventory management (~1810 lines). Expiry-date warning badges controlled-substance audit trail PDF invoice import resilience. Do not alter wholesaler import router or audit log write path.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: wholesaler-import.ts medication-oversight.ts audit writes pdf-invoice-parser.ts core logic

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- wholesaler-import.ts medication-oversight.ts audit writes pdf-invoice-parser.ts core logic

## 2. Sprint Scope

- pageShellClass + PageHeader icon=Package title=Sklad
- DataTableFrame with expiry badge <30d amber expired red token
- PageToolbar: category + supplier filter + low-stock toggle
- KpiGrid: total SKUs low stock expiring soon controlled substance count
- PDF invoice import error state with filename and retry button
- i18n: inventory namespace full sweep

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/inventory-hardening-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.