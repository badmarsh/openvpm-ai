# Arena Sprint 25: Encounter Detail and SOAP Editor /encounters/appointmentId

> **Mission for Arena Agent:**
> Implement encounter detail from stub 0 lines. Patient banner SOAP editor tabs vital signs AI-draft panel advisory medication plan discharge link. Clinical safety gates apply.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: ClinicalDiffConfirmModal controlled-substance zero-prefill clinical-register.ts internals

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- ClinicalDiffConfirmModal controlled-substance zero-prefill clinical-register.ts internals

## 2. Sprint Scope

- Patient banner: name species breed owner last visit chip
- Underline tabs: SOAP / Vitalne / Lieky / Prilohy / Prepustenie
- AI draft panel: advisory badge + ClinicalDiffConfirmModal + draft-to-confirmed workflow
- Medication plan: controlled-substance zero-prefill enforcement
- Link to /agent/discharge for discharge summary

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/encounter-detail-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.