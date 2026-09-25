# Arena Sprint 14: Field Visits & Ambulatory Practice (Hospodárske zvieratá) `/field-visits`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in ambulatory livestock visits, CEHZ ear-tag verification, and drug withdrawal tracking:
> `apps/web/app/(dashboard)/field-visits/page.tsx` (~1,790 lines).
> This is a **presentation, clinical compliance, and UI Kit harmonization sprint**.
> Do not alter withdrawal period math, CEHZ normalization, or server-side controlled substance blocks.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned tests in `field-visits-ui.test.ts` green.

> **Independence:**
> Touches strictly `apps/web/app/(dashboard)/field-visits/page.tsx`.
> Does not touch `server/routers/extensions/field-visits.ts` or `lib/field-visits/policy.ts`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/field-visits-ui.test.ts`.
3. Facts verified in the repo:
   - `field-visits/page.tsx` is pinned in `field-visits-ui.test.ts` (`PageHeader`, `t("fieldVisits.title", "Terénna prax & Farmy")`, `fieldVisits.transcribeVoice`, `earTagQuery`, `min-h-[44px]`, `withdrawal-watch`, `py-2.5 px-3`, `tabular-nums`).
   - The page currently lacks `pageShellClass`, `PageToolbar`, and `DataTableFrame`.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/field-visits-ui.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Exact Source-Contract Literals from `field-visits-ui.test.ts` (Keep Verbatim):**
  - `t("fieldVisits.title", "Terénna prax & Farmy")`
  - `useI18n`
  - `PageHeader` (never hardcode `title="Terénna prax`)
  - `fieldVisits.transcribeVoice`
  - `earTagQuery`
  - `min-h-[44px]` (mobile touch target minimum for barn/field tablets)
  - `withdrawal-watch`
  - `t("fieldVisits.earTagSearch.title"`
  - `py-2.5 px-3`
  - `tabular-nums`
  - `createHerdBatchVisit`
- **Livestock Drug Policies:** Food safety withdrawal rules (Zákon 39/2007 Z. z.) and controlled substance detection (Zákon 139/1998 Z. z.) are legally frozen.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Review the batch treatment workflow: selecting farm, entering CEHZ ear tags (SK + 12 digits), selecting medications, calculating meat/milk withdrawal dates.
   - Review mobile touch targets: field vets use gloves/tablets in barns; buttons must maintain `min-h-[44px]`.
2. **Phase 2: Audit & Findings**
   - Audit table overflow on narrow screens: livestock batch administration logs have many columns; verify horizontal scroll inside `DataTableFrame`.
   - Audit withdrawal date display: verify negative remaining days are clamped to 0 (expired) and highlighted in neutral gray rather than active warning red.
   - Audit empty states: when no active herd visits or withdrawal alerts exist, display clear `EmptyState`.
3. **Phase 3: Fix Bugs & Hardening**
   - Fix table action column clipping on tablet viewports (768px–1024px).
   - Guard against invalid CEHZ ear-tag pasting (auto-strip invalid whitespace or illegal characters).
   - Ensure controlled substance warning banner appears immediately when a forbidden product name is entered.
4. **Phase 4: UI Kit Harmonization**
   - Apply `pageShellClass` to the outer container.
   - Wrap filter bars in `PageToolbar` and `SearchField`.
   - Wrap visit history and withdrawal tables in `DataTableFrame`.
   - Apply `underlineTabsListClass` and `underlineTabsTriggerClass` to tab lists.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. Layout & Navigation
- Wrap page in `pageShellClass`.
- Retain canonical `PageHeader` with title and subtitle.
- Use `underlineTabsListClass` / `underlineTabsTriggerClass` on tabs.

### 3B. Field Tables & Forms
- Wrap all visit lists and withdrawal tracking logs in `DataTableFrame`.
- Ensure all cells maintain `py-2.5 px-3` and numeric columns maintain `tabular-nums`.
- Preserve `min-h-[44px]` touch target sizing on all primary interaction buttons.

---

## 4. Tests

Create `apps/web/lib/__tests__/field-visits-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `field-visits/page.tsx`.
- All tests in `field-visits-ui.test.ts` stay 100% green.

---

## 5. i18n

- Maintain 100% leaf symmetry in `fieldVisits` keys between `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/field-visits-ui.test.ts lib/__tests__/field-visits-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] All pinning literals in `field-visits-ui.test.ts` preserved verbatim.
- [ ] `min-h-[44px]` touch targets preserved for ambulatory workflows.
- [ ] `pageShellClass`, `PageToolbar`, and `DataTableFrame` adopted.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check and lint pass with 0 errors.
