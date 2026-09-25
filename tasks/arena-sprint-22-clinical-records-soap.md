# Arena Sprint 22: Clinical Records and SOAP Workspace /records

> **Mission for Arena Agent:**
> Audit and harmonize clinical records hub (~4034 lines). DataTableFrame for records table underline tabs for SOAP sections. Do not alter ClinicalDiffConfirmModal or AI-draft prefill.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: ClinicalDiffConfirmModal server/routers/extensions/clinical-register.ts records/new-soap records/replace-soap

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- ClinicalDiffConfirmModal server/routers/extensions/clinical-register.ts records/new-soap records/replace-soap

## 2. Sprint Scope

- pageShellClass + PageHeader icon=BookOpen title=Klinicke zaznamy
- DataTableFrame for visit list with species filter chip
- Underline tabs: SOAP / Zaznamy / Historia / Prilohy
- i18n: records and soap namespaces
- KpiGrid: total visits avg duration open diagnoses

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/clinical-records-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.