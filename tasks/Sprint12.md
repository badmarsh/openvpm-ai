# Arena Sprint 12: Statutory & Regulatory Hub + KVEPIS Integration `/statutory`, `/statutory/kvepis`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in state regulatory registers and KVEPIS reporting:
> `apps/web/app/(dashboard)/statutory/page.tsx` (~1,715 lines) and `apps/web/app/(dashboard)/statutory/kvepis/page.tsx` (~637 lines).
> This is a **presentation, compliance reliability, and UI Kit harmonization sprint**.
> Non-negotiable statutory print layouts, XML/XSD export generators, and legal certification data structures are frozen.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all existing regulatory pinning tests green.

> **Independence:**
> Touches strictly `apps/web/app/(dashboard)/statutory/page.tsx` and `apps/web/app/(dashboard)/statutory/kvepis/page.tsx`.
> Does not touch `controlled-substances/page.tsx` or `billing/ekasa/page.tsx`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/statutory-ekasa-consolidation.test.ts`.
3. Facts verified in the repo:
   - `statutory/page.tsx` and `statutory/kvepis/page.tsx` lack `DataTableFrame` and `PageToolbar`.
   - `statutory/page.tsx` has pinned literals in `statutory-ekasa-consolidation.test.ts` (PageHeader contract, shadcn Table primitives with `px-3 py-2.5`, specific tab keys `"statutory.tabs.crszChip"`, `"statutory.tabs.infectious"`, `"statutory.tabs.kvepis"`).
   - Test rule: `statutory/page.tsx` and `statutory/kvepis/page.tsx` MUST NOT contain raw `<div className="overflow-x-auto">` (they must use `DataTableFrame` which encapsulates `TableScroll`).
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/statutory-ekasa-consolidation.test.ts lib/__tests__/regulatory-acceptance-scenarios.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Exact Source-Contract Literals from `statutory-ekasa-consolidation.test.ts` (Keep Verbatim):**
  - `<PageHeader` present and `from "@/components/layout/page-header"` imported.
  - No `<h1 className="text-(lg|xl|2xl|3xl)"`.
  - `from "@/components/ui/table"` imported and `px-3 py-2.5` on table cells.
  - MUST NOT contain `<div className="overflow-x-auto">` (use `DataTableFrame`).
  - `"statutory.tabs.crszChip"`
  - `"statutory.tabs.infectious"`
  - `"statutory.tabs.kvepis"`
- **Print surfaces:** Statutory print views and physical export layouts for ŠVPS SR / KVL inspectors are legally standardized — do not alter their typography, page breaks, or field sequences.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Review the tab routing between CRSZ chip records, infectious disease notifications, and KVEPIS batch transmissions.
   - Inspect the state machine of batch export: `PENDING` → `GENERATED` → `SENT` → `CONFIRMED` / `ERROR`.
2. **Phase 2: Audit & Findings**
   - Audit chip number inputs: verify 15-digit ISO microchip format display (Luhn check, Slovak national code prefix 703).
   - Audit table overflow on narrow screens: tables with 8+ columns currently have no graceful scroll affordance without clipping action buttons.
   - Audit empty states: ensure each statutory register displays a dedicated `EmptyState` when zero records match the date filter.
3. **Phase 3: Fix Bugs & Hardening**
   - Fix table action cell wrapping on viewports under 1280px.
   - Guard against invalid date parameters in register search queries.
   - Ensure error banners on failed KVEPIS transmissions include actionable retry instructions and clear failure codes.
4. **Phase 4: UI Kit Harmonization**
   - Wrap statutory registers in `DataTableFrame`.
   - Harmonize filter bars with `PageToolbar`, `SearchField`, and `filterControlClass`.
   - Apply `underlineTabsListClass` and `underlineTabsTriggerClass` to tab lists.
5. **Phase 5: Verification**
   - Run Vitest suite, verify zero regressions in `statutory-ekasa-consolidation.test.ts`.

---

## 3. Detailed Requirements

### 3A. `/statutory/page.tsx`
- Retain canonical `PageHeader` with title and tabs.
- Apply `underlineTabsListClass` and `underlineTabsTriggerClass` to the tab strip.
- Replace bespoke table containers with `DataTableFrame`.
- Ensure all column headers and cells keep `px-3 py-2.5` density.
- Do NOT insert raw `<div className="overflow-x-auto">`.

### 3B. `/statutory/kvepis/page.tsx`
- Replace bespoke toolbar elements with `PageToolbar`.
- Wrap the transmission logs table in `DataTableFrame`.
- Retain all KVEPIS status keys (`statutory.kvepis.sendStateSent`, etc.).
- Ensure retry and export actions provide visual loading indicators during tRPC execution.

---

## 4. Tests

Existing tests in `apps/web/lib/__tests__/statutory-ekasa-consolidation.test.ts` and `apps/web/lib/__tests__/regulatory-acceptance-scenarios.test.ts` must pass without modifications.
Create `apps/web/lib/__tests__/statutory-pagekit.test.ts` to assert `DataTableFrame` and `pageShellClass` usage.

---

## 5. i18n

- Ensure all user-facing labels in filter toolbars, error states, and badges exist symmetrically in `apps/web/messages/en.json` and `apps/web/messages/sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/statutory-ekasa-consolidation.test.ts lib/__tests__/regulatory-acceptance-scenarios.test.ts lib/__tests__/statutory-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] All statutory-ekasa-consolidation pinning assertions remain green.
- [ ] No raw `<div className="overflow-x-auto">` introduced; `DataTableFrame` utilized.
- [ ] `PageToolbar` and `filterControlClass` applied across statutory filters.
- [ ] Tab navigation styled with `underlineTabsListClass` and `underlineTabsTriggerClass`.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check and lint pass with 0 errors.
