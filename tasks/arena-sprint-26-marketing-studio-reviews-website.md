# Arena Sprint 26: Marketing Studio Part 2 Reviews and Website /marketing/reviews /marketing/website

> **Mission for Arena Agent:**
> Harmonize marketing reviews (~1313 lines) and clinic website CMS (~877 lines). Sympathy gate suppresses review requests for deceased patients. Do not alter webhook security or AI reply generation.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: marketing.ts review triggers automation-suppression.ts write paths webhook signature verification

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- marketing.ts review triggers automation-suppression.ts write paths webhook signature verification

## 2. Sprint Scope

- pageShellClass + PageHeader icon=Star reviews / icon=Globe website
- DataTableFrame review list with sentiment badges positive/neutral/negative
- PageToolbar: platform filter + date range
- Website CMS DataTableFrame page sections with preview chip
- Sympathy gate: deceased patient suppression indicator in review queue
- i18n: marketing.reviews and marketing.website namespaces

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/marketing-reviews-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.