# Arena Sprint 21: Practice Settings Master Hub /settings

> **Mission for Arena Agent:**
> Analyze audit and improve the settings master page (~6008 lines). UI Kit harmonization i18n audit pageShellClass DataTableFrame per panel. Do not alter credential storage PKCS12 or encryption paths.
> Zero new ESLint warnings, 0 type errors, 100% bilingual SK/EN i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Does not touch: settings/ekasa/page.tsx settings/ai/page.tsx settings/simulation/page.tsx lib/crypto.ts

---

## 0. Preflight

1. git status clean on your working branch.
2. Read AGENTS.md, docs/UIKIT.md, components/layout/page-kit.tsx.
3. Baseline tests BEFORE editing:
   pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts

## 1. DO NOT TOUCH

- ClinicalDiffConfirmModal, controlled-substance zero-prefill, sympathy-gate suppression logic.
- packages/db/schema/*.ts upstream vanilla or packages/db/drizzle/meta/_journal.json.
- settings/ekasa/page.tsx settings/ai/page.tsx settings/simulation/page.tsx lib/crypto.ts

## 2. Sprint Scope

- pageShellClass + PageHeader icon=Settings title=Nastavenia
- underlineTabsListClass + DataTableFrame per settings panel
- i18n sweep: all missing keys under settings namespace
- Fix no-explicit-any and exhaustive-deps warnings
- Lazy PDF import pattern preserved - no top-level import

## 3. Acceptance Criteria

- pnpm --filter @openpims/web type-check -> 0 errors.
- pnpm lint -> 0 new warnings.
- pnpm --filter @openpims/web exec vitest run lib/__tests__/settings-master-pagekit.test.ts lib/__tests__/i18n-structure.test.ts -> all green.
- pnpm --filter @openpims/web i18n:scan -> 0 missing keys in target namespace.
- PR description must list every section restructured and every i18n key added.