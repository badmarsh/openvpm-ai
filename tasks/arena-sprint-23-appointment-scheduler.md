# Arena Sprint 23: Appointment Scheduler and Calendar /schedule

> **Mission for Arena Agent:**
> Harmonize appointment scheduler (~3495 lines). PageToolbar with date-range picker and provider filter DataTableFrame for list view. Do not alter recurring-appointment logic SMS triggers or drag-drop engine.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: server/routers/extensions/automation-events.ts lib/sms.ts recurrence rule logic calendar engine

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- server/routers/extensions/automation-events.ts lib/sms.ts recurrence rule logic calendar engine

## 2. Sprint Scope

- pageShellClass + PageHeader icon=CalendarDays title=Rozvrh
- PageToolbar: date navigator + provider selector + Add Appointment button
- DataTableFrame agenda/list view with appointment status badges
- Underline tabs: Den / Tyzden / Mesiac / Zoznam
- i18n: schedule namespace full sweep

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/scheduler-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.