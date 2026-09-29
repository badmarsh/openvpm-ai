# Arena Sprint 7: Encounters Hub & Care Reminders — Daily Clinical Workflow Harmonization

> **Mission for Arena Agent:**
> Harmonize the two daily-workflow list pages that still ignore the Dashboard UI Kit:
> `/encounters` (`apps/web/app/(dashboard)/encounters/page.tsx`, 833 lines) and
> `/care-reminders` (`apps/web/app/(dashboard)/care-reminders/page.tsx`, ~1100 lines),
> according to `docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n symmetry, and every existing safety test stays green.

> **Independence:** This sprint touches ONLY the two pages above (+ their tests and message keys).
> Sprint 5 (`/prescriptions`) and Sprint 6 (`/whiteboard`) are separate and may run before or after — do not touch their files.

---

## 0. Preflight (do this first)

1. `git status` must be clean on your branch. If `apps/web/lib/lab/reference-range-status.ts` or its test show up as staged/uncommitted leftovers from Sprint 4, do NOT fold them into this sprint — report them in the PR description.
2. Read `AGENTS.md`, `docs/UIKIT.md` and the exports of `apps/web/components/layout/page-kit.tsx` (`pageShellClass`, `PageToolbar`, `SearchField`, `filterControlClass`, `underlineTabsListClass`, `underlineTabsTriggerClass`, `tableHeadClass`, `tableCellClass`, `tableRowClass`, `DataTableFrame`, `KpiGrid`, `KpiCard`). Use their real prop signatures — do not guess.
3. Use `apps/web/app/(dashboard)/lab-results/page.tsx` (Sprint 4, merged) as the reference implementation for structure.
4. Baseline: run `pnpm --filter @openpims/web exec vitest run lib/__tests__/care-reminders-safety.test.ts server/__tests__/care-reminders-dismissal.test.ts` and confirm green BEFORE editing.

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Clinical safety gates:** `ClinicalDiffConfirmModal`, controlled-substance zero-prefill, sympathy-gate suppression logic. Never modify.
- **Care-reminder outreach flow:** Layout may change, logic may not. Keep `trpc.careReminders.sendOutreach.useMutation`, `outreachRequestId.current ??= crypto.randomUUID()`, the `clientSmsConsent` handling, and the "never sends an email or text automatically" notice. `lib/__tests__/care-reminders-safety.test.ts` asserts these as **source-text literals** (e.g. `Template preview`, `generated server-side`, `Email suppression, SMS consent, sender, and quiet-hour`) — keep the exact wording and do not move them into a helper/constant file.
- **Completion / dismissal semantics:** `setCompleted`, `setDismissed`, dismissal reason (max 100 chars) — no behavioural change.
- **`/lab-results` sticky header:** intentionally removed; do not re-add `sticky top-0` anywhere in this sprint.
- **Status badges on `/encounters`:** live statuses (`checked_in`, `in_exam`, `confirmed`, `scheduled`) already use `StatusPulseBadge`, terminal statuses use `Badge`. Keep that split; only adjust tokens/sizing if UIKIT requires it.
- **Out of scope files:** `encounters/[appointmentId]/page.tsx` (5.4k lines, see proposed ticket GT-017), `records/**`, `schedule/**`, all routers, all `packages/db/schema/*.ts`, `_journal.json`.

---

## 2. Architectural Rules (MUST FOLLOW)

1. **UIKIT hierarchy, top to bottom:** `PageHeader` (icon, title, one-line subtitle, actions `size="sm"`) → underline tabs → `PageToolbar` → optional `KpiGrid` → `DataTableFrame` + dense table → `EmptyState`. Page wrapper is `pageShellClass`; no mixed `mt-4` / `mt-6` between sibling blocks.
2. **No per-page table or button chrome.** No `text-sm` + `px-4 py-3` list tables, no `min-w-[800px]` hacks, no pill-style tab strip for page sections (pill `TabsList` only for tiny in-card switches).
3. **Design tokens only.** Replace raw `text-emerald-*`, `text-amber-*`, `bg-emerald-500` etc. with the semantic tokens (`success`, `warning`, `destructive`, `primary`, `*-muted`, `*-muted-foreground`).
4. **Clinical language (UIKIT):** the doctor's unit of work is **vyšetrenie**. Normalize strings on these two pages to Otvoriť vyšetrenie / Nové vyšetrenie; do not mix návšteva / termín / stretnutie / exam room within the same page. Scheduling context (`/schedule`) keeps its own vocabulary — do not rename outside these pages; list leftovers in the PR description instead.
5. **100% strict i18n:** every string through `useI18n()`; nested JSON only; keep `apps/web/messages/en.json` and `sk.json` leaf-symmetric (guarded by `lib/__tests__/i18n-structure.test.ts`).
6. **No horizontal page scroll at 1280×800.** Wide tables scroll inside `DataTableFrame`; the page body never does.

---

## 3. Detailed Requirements — `/encounters`

**File:** `apps/web/app/(dashboard)/encounters/page.tsx`

**Current problems (verified in code):** wrapper is a raw `space-y-6` div; the four KPI blocks are hand-built `Card`s with raw emerald/amber colours; the tab switcher is a pill strip (`bg-muted/40 p-1` + `bg-primary` active state); search/date/status/doctor filters live in a bespoke `rounded-xl border bg-card/50 p-4` container; `formatTime` uses `toLocaleTimeString([], …)` (browser locale, not app locale).

1. **Page shell:** wrap in `pageShellClass`. Keep `PageHeader` (icon `Stethoscope`) but tighten the title to the UIKIT vocabulary (e.g. `Vyšetrenia`) and keep actions `size="sm"`.
2. **KPI row:** replace the four hand-built cards with `KpiGrid` + `KpiCard` (Dnes celkovo · V ambulancii / čakárni · Čakajúce kontroly · Ukončené dnes). Counts that change the filter (in-clinic, follow-ups) should be clickable and switch the active tab. Tone via tokens (`success` for in-clinic > 0, `warning` for follow-ups > 0, muted at 0) — `KpiCard` has no tone prop (props: `label, value, icon, active, onClick, className`), so style the `value` node with the semantic tokens; do not extend `KpiCard` in this sprint. `KpiGrid` defaults to `sm:grid-cols-4`, which fits the four encounters KPIs.
3. **Tabs:** replace the pill strip with `underlineTabsListClass` / `underlineTabsTriggerClass` (keep the existing tabs and `TabKey` values: today / active / all, plus follow-ups if it is a tab today). Keep the count chips; the in-clinic chip may keep its pulse.
4. **Toolbar:** move search, date picker (only on "Všetky"), status filter and doctor filter into ONE `PageToolbar` using `SearchField` and `filterControlClass` (`h-9`, `text-xs`). Show a result count. Add a "Clear filters" ghost button that appears only when a filter is active.
5. **Appointments table:** wrap in `DataTableFrame`; use `tableHeadClass` / `tableCellClass` / `tableRowClass`.
   - Time, weight, and any numeric column: `font-mono tabular-nums text-xs`.
   - Whole-row click opens the vyšetrenie; inner links/buttons call `stopPropagation`.
   - Secondary lines (owner, doctor, appointment type) use `truncate` inside `min-w-0` wrappers.
   - Row actions: icon-only `h-7 w-7 p-0` ghost, or `size="sm"` text buttons.
6. **Time formatting:** replace `toLocaleTimeString([], …)` with the app-locale formatter (check `@/lib/date-display` / `@/lib/date-input` for an existing helper; only add a new one if none fits, with a unit test).
7. **Follow-ups section:** same treatment as (5) — `DataTableFrame` + tokens; due/overdue state as a semantic badge (`warning-muted` due today, `destructive-muted` overdue), dates via `formatDateYmdToDisplay`.
8. **States:** loading → `TableSkeleton` INSIDE the frame. Empty → `EmptyState` inside the card, with two variants: "no data today" (with primary CTA `Nové vyšetrenie` → `/schedule`) and "no results for filters" (with clear-filters action). Never render an empty table.
9. **Polling:** keep the 15 s / 30 s `refetchInterval`s; do not introduce layout shift on refetch (keep previous data while fetching).

---

## 4. Detailed Requirements — `/care-reminders`

**File:** `apps/web/app/(dashboard)/care-reminders/page.tsx`

**Current problems (verified in code):** list renders `<table className="w-full min-w-[800px] text-sm">` with per-page chrome; wrapper is a raw `space-y-6` div; `EmptyState` exists at two places but must be verified to sit inside a card.

1. **Layout:** `pageShellClass` → `PageHeader` (verify icon, one-line subtitle, actions `size="sm"`) → status tabs (open · completed · dismissed, underline style) → `PageToolbar` (search + whichever filters exist today, plus count) → `KpiGrid` (open · due today · overdue — derive only from data the page already loads; no new endpoints) → `DataTableFrame`.
2. **Table:** replace the `text-sm` / `min-w-[800px]` table with page-kit tokens. Due dates in `formatDateYmdToDisplay` + `tabular-nums`; overdue = `destructive-muted` badge, due today = `warning-muted`, completed = `success-muted`, dismissed = muted outline. Patient name `font-medium`, owner as `text-xs text-muted-foreground` secondary line with `truncate`.
3. **Row actions:** complete / dismiss / send outreach as compact `size="sm"` or icon `h-7 w-7` buttons. Dismiss keeps the reason input and its 100-char limit.
4. **Outreach panel/dialog:** visual alignment only (spacing, tokens). All literals asserted in `care-reminders-safety.test.ts` must remain byte-identical.
5. **States:** loading skeleton inside the frame; both empty states (no reminders at all vs. no results for filters) use `EmptyState` inside a card with an i18n title + subtitle.
6. **Hooks hygiene:** any `query.data ?? []` derived value used in a `useMemo`/`useEffect` must itself be memoized (no new `react-hooks/exhaustive-deps` warnings; no `eslint-disable`).

---

## 5. Tests

Follow the repo's source-contract test style (`readFileSync` on the page + assertions), as in `lib/__tests__/care-reminders-safety.test.ts` and `lib/__tests__/encounter-workspace-ui.test.ts`.

1. **New** `apps/web/lib/__tests__/encounters-hub-ui.test.ts` — asserts the page imports `PageToolbar`, `DataTableFrame`, `KpiGrid`, `pageShellClass` from `@/components/layout/page-kit`; contains no `toLocaleTimeString(`; contains no raw `text-emerald-` / `text-amber-` / `bg-emerald-` classes; contains no `<Card` KPI blocks; still uses `StatusPulseBadge` for live statuses.
2. **New** `apps/web/lib/__tests__/care-reminders-ui.test.ts` — asserts page-kit imports, no `min-w-[800px]`, no `text-sm` on the list table, `EmptyState` present.
3. **Unchanged and must stay green:** `care-reminders-safety.test.ts`, `care-reminders-dismissal.test.ts`, `encounters-closeout.test.ts`, `encounter-workspace-ui.test.ts`, `heavy-client-imports.test.ts`, `i18n-structure.test.ts`.
4. If you add a date/time helper, add a unit test with both `sk` and `en` locales.

## 6. i18n

- Run `pnpm --filter @openpims/web i18n:scan`; fix any hardcoded JSX text introduced or found in the two files.
- New keys go into BOTH `apps/web/messages/en.json` and `sk.json`, nested (no flat dotted root keys), under the existing `encounters.hub.*` and `careReminders.*` sections.
- Slovak: use **vyšetrenie** consistently on these pages (see rule 4). English: "encounter" / "exam" — pick one per page and stay consistent.

## 7. Manual Verification (attach to PR)

- Before/after screenshots of `/encounters` (all tabs) and `/care-reminders` at 1280×800, light and dark theme.
- Confirm: no horizontal page scroll, whole-row click works, inner buttons do not trigger row navigation, empty and filtered-empty states render, in-clinic pulse still animates.

## 8. Verification Suite

Confirm clean exit (code 0) for:

```bash
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web test
pnpm --filter @openpims/web i18n:scan
```

## 9. Commit & PR Structure

- Branch: `arena/<session-id>-openvpm-ai`
- Commits (one logical change each):
  - `feat(ui-kit): harmonize encounters hub with dashboard page kit`
  - `feat(ui-kit): harmonize care reminders with dashboard page kit`
  - `test(ui): add source-contract tests for encounters hub and care reminders`
  - `feat(i18n): sync encounters and care reminders keys (sk/en)`
- PR description must include: screenshots (section 7), the list of leftover návšteva/termín terminology found OUTSIDE these two pages (report only, do not fix), and any Sprint 4 leftovers noticed in preflight.

## 10. Definition of Done

- [ ] Both pages follow the UIKIT hierarchy with page-kit primitives only; no per-page table/tab chrome remains.
- [ ] No raw colour utilities for status — semantic tokens only.
- [ ] Empty, filtered-empty and loading states render inside cards/frames.
- [ ] All care-reminder safety literals and outreach logic byte-identical to baseline.
- [ ] New UI-contract tests added; all listed existing tests green.
- [ ] Lint 0 new warnings, type-check 0 errors, full `pnpm --filter @openpims/web test` green, i18n scan clean, en/sk symmetric.

## 11. Next-sprint candidates (for the planner — not part of this task)

`/billing` + `/billing/pos` + `/billing/ekasa` (largest money-critical surface without page-kit) · `/reports` · `/statutory` + `/statutory/kvepis` (keep print surfaces untouched) · wholesaler import UI (GT-009, ROADMAP v0.7 gap) · GT-017 tablet usability of `encounters/[appointmentId]`.
