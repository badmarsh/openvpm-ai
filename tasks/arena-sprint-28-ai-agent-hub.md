# Arena Sprint 28: AI Agent Hub /agent

> **Mission for Arena Agent:**
> Harmonize AI agent hub landing page (~808 lines). KpiGrid session stats navigation cards to sub-agents recent sessions DataTableFrame. All AI outputs advisory. Do not alter AgentOS session API.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: imaging.ts voice.ts discharge.ts AgentOS session management API calls

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- imaging.ts voice.ts discharge.ts AgentOS session management API calls

## 2. Sprint Scope

- pageShellClass + PageHeader icon=Bot with AI BETA badge
- KpiGrid: active sessions completed today avg response time SOAP drafts pending
- Navigation cards to Voice / Imaging / Discharge with live status indicators
- DataTableFrame: recent AI sessions type badge duration status draft/confirmed/expired
- Advisory banner: all AI outputs require vet confirmation before clinical use
- i18n: agent namespace

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/ai-agent-hub-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.