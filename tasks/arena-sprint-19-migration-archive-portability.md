# Arena Sprint 19: Legacy PIMS Migration Archive & Data Portability `/migration-archive`, `/settings/import-v2`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in historical PIMS record lookup (WinVet, Vetis), imported document archives, and import validation:
> `apps/web/app/(dashboard)/migration-archive/page.tsx` (~726 lines) and `apps/web/app/(dashboard)/settings/import-v2/page.tsx` (~638 lines).
> This is a **presentation, data safety boundary, and UI Kit harmonization sprint**.
> Do not alter immutable HMAC archive verification, tenant isolation, or historical record write-protection.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned tests in `migration-archive-ui.test.ts` green.

> **Independence:**
> Touches strictly `migration-archive/page.tsx` and `settings/import-v2/page.tsx`.
> Does not touch `server/routers/migration-archive.ts`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/migration-archive-ui.test.ts`.
3. Facts verified in the repo:
   - `migration-archive/page.tsx` has strict accessibility and safety assertions pinned in `migration-archive-ui.test.ts` (`Source-attributed history from a prior system`, `do not silently create live`, `role="tablist"`, `role="tab"`, `aria-selected`, `href={item.fileUrl}`, `Open document`, `Needs review`, `Never restored automatically`).
   - The archive page currently lacks `pageShellClass`, `PageToolbar`, and standard `DataTableFrame` structures.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/migration-archive-ui.test.ts lib/__tests__/review-access-safety.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Exact Source-Contract Literals from `migration-archive-ui.test.ts` (Keep Verbatim):**
  - `Source-attributed history from a prior system`
  - `do not silently create live`
  - `role="tablist"`
  - `role="tab"`
  - `aria-selected={section === item.id}`
  - `Search ${activeSection.label.toLowerCase()}`
  - `Previous`
  - `Next`
  - `href={`/patients/${item.patientId}`}`
  - `href={`/clients/${item.clientId}`}`
  - `href={item.fileUrl}`
  - `Open document`
  - `rel="noopener noreferrer"`
  - `Needs review`
  - `Never restored automatically`
  - `messaging consent`
  - `stock counts require a fresh`
- **Safety Boundary:** Legacy records must remain strictly read-only and never be automatically converted into live operational appointments or active medical records without explicit vet review.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace archive browsing: section selection (Appointments, Lab Reports, Prescriptions, Financial Docs) → search query → paginated results → document viewer.
2. **Phase 2: Audit & Findings**
   - Audit large archive pagination: verify that page index does not reset unexpectedly when searching or filtering.
   - Audit external attachment links: ensure historical PDF/image links validate URL security and open in a new tab with `rel="noopener noreferrer"`.
   - Audit empty states: when an imported archive section contains zero records, display clear informative guidance explaining that no legacy data of that type was found.
3. **Phase 3: Fix Bugs & Hardening**
   - Fix table horizontal clipping on mobile/tablet viewports when viewing wide legacy billing ledgers.
   - Prevent search input debounce lag when querying large client phone/name records.
   - In `settings/import-v2`, verify CSV parsing handles Windows-1250 / UTF-8 encoding differences without crashing.
4. **Phase 4: UI Kit Harmonization**
   - Apply `pageShellClass` to the outer wrapper.
   - Wrap search and filter controls in `PageToolbar` and `SearchField`.
   - Wrap historical record tables in `DataTableFrame`.
   - Apply `underlineTabsListClass` and `underlineTabsTriggerClass` to tab lists while preserving `role="tablist"` and `role="tab"`.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. Layout & Header
- Apply `pageShellClass` to the outer wrapper.
- Retain canonical `PageHeader` with title and explanation of the non-operational safety boundary.
- Preserve all pinned accessibility attributes on tabs and pagination controls.

### 3B. Historical Tables
- Wrap archive tables in `DataTableFrame`.
- Ensure all rows keep dense padding (`px-3 py-2`) and right-aligned numeric amounts.
- Preserve document links with `rel="noopener noreferrer"`.

---

## 4. Tests

Create `apps/web/lib/__tests__/migration-archive-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `migration-archive/page.tsx`.
- All assertions in `migration-archive-ui.test.ts` remain 100% green.

---

## 5. i18n

- Ensure all migration section headers, safety warnings, and status badges exist symmetrically in `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/migration-archive-ui.test.ts lib/__tests__/migration-archive-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] All safety boundary and accessibility assertions preserved verbatim.
- [ ] Document URLs keep `rel="noopener noreferrer"`.
- [ ] `pageShellClass`, `PageToolbar`, and `DataTableFrame` adopted.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check passes with 0 errors.
