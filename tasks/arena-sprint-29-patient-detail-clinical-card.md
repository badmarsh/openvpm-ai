# Arena Sprint 29: Patient Detail and Clinical Card /patients/id /patients

> **Mission for Arena Agent:**
> Implement patient detail page stub 0 lines and harmonize patient list ~360 lines. Tabbed clinical card visit history vaccines prescriptions imaging owner. Sympathy gate for deceased patients.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: duplicate-shield.ts ClinicalDiffConfirmModal ext_automation_suppression_log write path

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- duplicate-shield.ts ClinicalDiffConfirmModal ext_automation_suppression_log write path

## 2. Sprint Scope

- Patient list: pageShellClass + PageHeader icon=Users DataTableFrame species/status filter
- Patient detail banner: name species breed DOB chip owner contact
- Underline tabs: Klinicka karta / Ockovania / Predpisy / Zobrazovacie / Majitel
- Sympathy gate: deceased/euthanized condolence banner + suppression badge logged to ext_automation_suppression_log
- i18n: patients namespace full sweep

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/patient-detail-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.