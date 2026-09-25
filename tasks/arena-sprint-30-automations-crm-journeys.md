# Arena Sprint 30: Automations and CRM Journey Builder /automations

> **Mission for Arena Agent:**
> Implement automations hub ~80 line stub. CRM journey list rule builder UI enrollment stats suppression log viewer. Sympathy gate suppression read-only. Do not alter event-bus trigger or suppression write paths.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: automation-journeys.ts automation-events.ts automation-suppression.ts write paths automation-rules.ts trigger logic

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- automation-journeys.ts automation-events.ts automation-suppression.ts write paths automation-rules.ts trigger logic

## 2. Sprint Scope

- pageShellClass + PageHeader icon=Zap title=Automatizacie
- KpiGrid: active journeys enrolled patients sent this week suppressed by sympathy gate
- DataTableFrame journey list with active/paused/draft badge enrollment count last triggered
- PageToolbar: type filter + status filter + New Journey button
- Suppression log panel: read-only DataTableFrame patient reason suppressed-at
- i18n: automations namespace full sweep

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/automations-hub-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.