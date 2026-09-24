# Arena Sprint 8: Billing Ledger `/billing` — Receivables, Invoice List & Inline Detail Harmonization

> **Mission for Arena Agent:**
> Bring the main billing page (`apps/web/app/(dashboard)/billing/page.tsx`, ~2 400 lines) in line with the Dashboard UI Kit (`docs/UIKIT.md`, `apps/web/components/layout/page-kit.tsx`): one spacing system, page-kit KPI / tabs / table primitives, unified header actions, token-only status colours, and consistent dense tables in the invoice list, the expanded invoice detail and the two billing panels.
> This is a **presentation-only** sprint on the most money-critical screen: no change to amounts, statuses, payment/void/waive logic, fiscal (e-Kasa) behaviour or any router.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n symmetry, and every existing billing source-contract test stays green.

> **Independence:** Only `billing/page.tsx` (+ new test + message keys). `/billing/new`, `/billing/pos`, `/billing/ekasa` are a later sprint. Sprints 5, 6 and 7 touch other files and can run before or after this one.

---

## 0. Preflight (do this first)

1. `git status` must be clean on your branch. Report (do not fix) any Sprint 4 leftovers such as `lib/lab/reference-range-status.ts`.
2. Read `AGENTS.md`, `docs/UIKIT.md`, and the real signatures in `apps/web/components/layout/page-kit.tsx`. Verified facts you must respect:
   - `KpiGrid` renders `grid-cols-2 sm:grid-cols-4` by default → for 3 KPIs pass `className="sm:grid-cols-3"`.
   - `KpiCard` props are only `label, value, icon, active, onClick, className` — there is **no tone prop**. Apply tone by styling the `value` node with semantic tokens. Do not extend `KpiCard` in this sprint.
   - `DataTableFrame` takes only `className, children` (no footer slot) — render pagination as the last child inside the frame or as a sibling directly below it, but be consistent.
   - `billing.listInvoices` accepts only `status, isEstimate, patientId, appointmentId, limit, offset`. **There is no text search.** Do not add a router param in this sprint.
3. Reference implementations already merged: `lab-results/page.tsx` (Sprint 4), `recalls/page.tsx`, `vaccinations/page.tsx`, `controlled-substances/page.tsx` (Sprint 2).
4. Baseline — run and confirm green BEFORE editing:
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/wellness-billing-ui.test.ts lib/__tests__/list-empty-states.test.ts lib/__tests__/billing-ui.test.ts lib/__tests__/guide-recipes.test.ts components/help/__tests__/help-content.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Money logic:** `formatCurrency` usage, `getDisplayStatus`, `canManageBillingRole`, `formatBillingDateInput`, `formatBillingInstantDate`, all totals / balance / paid calculations, `billing/policy` helpers. No arithmetic on amounts is added or moved.
- **Mutations and dialogs:** `updateStatus`, `convertEstimate`, `voidInvoice`, waive and legacy-review flows, `ActionConfirmationDialog` usage and their reason inputs. Layout may change, behaviour may not.
- **Fiscal / e-Kasa:** links to `/billing/ekasa` and `/billing/ekasa?tab=closures`, `/billing/pos`, `/billing/new` must remain reachable with the same hrefs. Do not touch anything under `billing/ekasa/`, `billing/pos/`, `billing/new/`, or the e-Kasa driver.
- **Clinical safety gates:** `ClinicalDiffConfirmModal`, controlled-substance zero-prefill, sympathy-gate logic — never modify.
- **Source-contract literals (tests read this file as text — keep byte-identical):**
  - `wellness-billing-ui.test.ts`: `Wellness invoices due`, `Invoice schedule`, `trpc.wellness.listDue.useQuery`, `trpc.wellness.generateDueInvoices.useMutation`, `utils.wellness.listDue.invalidate`, `utils.billing.listInvoices.invalidate`, `const verifiedDueMemberships =`, `const dueMemberships = verifiedDueMemberships ?? []`, `enrollmentIds: dueMemberships.map`, `const dueMembershipsMissing =`, `const dueMembershipsUnavailable =`, `dueMembershipsUnavailable ||`, `const verifiedBillingConfig =`, `const billingSettingsReady = verifiedBillingConfig !== null`, `settingsReady={billingSettingsReady}`, `settingsReady: boolean`, `enabled: settingsReady`, `!settingsReady ||`.
  - `list-empty-states.test.ts`: `const listError = billingConfig.error ?? error`, `const isListLoading = billingConfig.isLoading || isLoading`, `const billingListMissing =`, and the ternary `{listError || billingListMissing ? (` must stay **before** the empty state (error branch exclusive from empty).
  - `guide-recipes.test.ts`: `data-tour="invoice-detail"` stays in this file.
  - Before moving any header action or string, grep `apps/web` tests for its href/label (`help-content.test.ts`, `command-search-ui.test.ts`, `demo-role-switcher.test.ts`, `funnel-analytics.test.ts`, `heavy-client-imports.test.ts`).
- **Removed on purpose elsewhere:** do not add `sticky top-0` to any header.

---

## 2. Architectural Rules (MUST FOLLOW)

1. **UIKIT hierarchy:** `PageHeader` → panels → `KpiGrid` → underline tabs → `PageToolbar` → `DataTableFrame` + dense table → `EmptyState`. Wrapper is `pageShellClass`.
2. **One spacing system.** The page currently mixes `space-y-6` on the root with `mt-6` / `mt-4` on children (KPI grid, tabs, error box, skeleton, table, pagination, `EmptyState className="mt-6"`) → double gaps. Remove every child-level `mt-*` that fights the shell.
3. **Tokens only.** No raw palette classes (`purple-*`, `red-*`, …). No `text-sm` + `px-4 py-3` list tables. Table cells/heads via `tableHeadClass` / `tableCellClass` / `tableRowClass` or `@/components/ui/table`.
4. **Numbers:** amounts, dates, invoice numbers `tabular-nums` (use `font-mono` for document numbers); amount columns right-aligned; never wrap an amount.
5. **100% strict i18n**, nested keys only, `en.json` ↔ `sk.json` leaf-symmetric (`lib/__tests__/i18n-structure.test.ts`). Dynamic status-label keys (``t(`billing.status_${key}`, label)``) must keep resolving.
6. **No horizontal page scroll at 1280×800.** Wide tables scroll inside the frame only.

---

## 3. Detailed Requirements — `/billing` list page

**File:** `apps/web/app/(dashboard)/billing/page.tsx`

**Current problems (verified in code):**
- Header has up to five actions (e-Kasa receipts, Z-report closures, accounting export, Fast POS, New Invoice) and none is `size="sm"`.
- The three receivables blocks (Outstanding / Overdue / Collected this month) are hand-built `div` cards.
- Status tabs are a hand-built underline strip (`border-b-2 -mb-px`) instead of the shared classes.
- Invoice table is a raw `<table className="w-full text-sm">` in `TableScroll`; **five of nine header cells use the new style and four use the old** (`px-4 py-3 text-right font-medium text-muted-foreground`, plus the `w-8 px-2 py-3` expander cell).
- Pagination footer is `text-sm` with its own `mt-4`.
- The expanded row (`<td colSpan={9} className="bg-muted/20 px-8 py-4" data-tour="invoice-detail">`) and both panels contain further `text-sm` tables; the estimate banner uses raw `purple-*` classes (3 occurrences).

### 3A. Header
1. Keep `PageHeader` (icon `ReceiptEuro`); every action `size="sm"`.
2. Primary CTA `New Invoice` stays the only filled button; `Fast Checkout (POS)` stays visible as outline.
3. Group the secondary/rare actions (e-Kasa receipts, Z-report closures, accounting export) so the header is not a wall of five buttons — e.g. one "More" `DropdownMenu` (use the existing `@/components/ui/dropdown-menu`). Hrefs and the accounting-export dialog trigger stay identical. If a test asserts a literal that the move would break, keep those buttons in the header instead and just apply `size="sm"`.

### 3B. Receivables KPIs
Replace the three hand-built cards with `KpiGrid className="sm:grid-cols-3"` + `KpiCard`. Preserve exactly: `arSummary.isError` → `"—"`; loading → the pulse placeholder; `Overdue` value uses the `destructive` token when `Number(arSummary.data.overdue) > 0`. Optional: make `Overdue` a clickable card that switches to the Overdue tab (`active` state) — only if it reuses the existing `setActiveTab` + `setOffset(0)` path.

### 3C. Tabs
Replace the hand-built strip with `underlineTabsListClass` / `underlineTabsTriggerClass`. `STATUS_TABS`, `activeTab`, `isEstimate`, `statusFilter` and the `setOffset(0)` reset stay untouched. Labels keep ``t(`billing.status_${key}`, label)``.

### 3D. Toolbar
Add a `PageToolbar` **only** with what the existing query supports: result count, page-size selector if `limit` is already state, and a refresh button. **Do not add a search field** (router has none) — record "invoice search" as a follow-up in the PR description.

### 3E. Invoice table
1. Wrap in `DataTableFrame`; drop `TableScroll` here only if the frame gives the same horizontal-overflow behaviour (otherwise keep `TableScroll` inside the frame).
2. All nine headers use `tableHeadClass`; numeric headers (Total, Paid) and Actions right-aligned; expander cell fixed `w-8`.
3. Cells via `tableCellClass`/`tableRowClass`; Client `font-medium`; Patient `text-muted-foreground`; long names `truncate` inside `min-w-0` wrappers; Total/Paid/Due/Created `tabular-nums`.
4. Status badges: check `getDisplayStatus` output → map each state to a semantic token badge (`success` paid, `warning` sent/partial, `destructive` overdue/void, `muted` draft). No raw palette classes.
5. Whole-row toggle stays; every inner button/link keeps `stopPropagation`. Row action buttons `h-7 w-7 p-0` ghost (icon-only, with `aria-label`) or `size="sm"`.
6. Pagination: `text-xs`, inside/below the frame with the same gap as sibling blocks; buttons stay `size="sm"`; the "Showing x–y of z" interpolation keeps its existing i18n key and params.

### 3F. Expanded invoice detail (`InvoiceRow`)
Keep `data-tour="invoice-detail"`. Inner line-item and payment tables → page-kit tokens (`text-xs`, `px-3 py-2`); the estimate banner → `border-primary/40 bg-primary-muted text-primary-muted-foreground` (icon and text included). Container padding `px-4 py-3` instead of `px-8 py-4` so it does not push the table wider. No change to the payment-recording form logic or its validation.

### 3G. Panels (`DispenseChargeQueuePanel`, `WellnessBillingPanel`)
Visual alignment only: `rounded-lg border border-border bg-card` shell, panel header with title + one-line description, inner tables via tokens (`text-xs`), buttons `size="sm"`, empty/loading/error states compact and inside the panel. All literals and hooks listed in section 1 remain untouched.

### 3H. States
Loading → `TableSkeleton` inside the frame area; error → the existing destructive box (moved into a card, same ternary order); empty → `EmptyState` inside a card with the existing i18n titles/descriptions/actions (estimates / status-filtered / no invoices variants stay).

---

## 4. Tests

- **New** `apps/web/lib/__tests__/billing-list-ui.test.ts` (source-contract style like `list-empty-states.test.ts`): page imports `PageToolbar`, `DataTableFrame`, `KpiGrid`, `KpiCard`, `pageShellClass`, `underlineTabsListClass` from `@/components/layout/page-kit`; contains no `purple-` / `red-` / `green-` palette classes; contains no `min-w-[` table hacks; no `mt-6` directly on the tab strip / table / empty state; `data-tour="invoice-detail"` present; the error ternary still precedes the `EmptyState`.
- **Must stay green, unchanged:** `wellness-billing-ui.test.ts`, `list-empty-states.test.ts`, `billing-ui.test.ts`, `guide-recipes.test.ts`, `help-content.test.ts`, `command-search-ui.test.ts`, `heavy-client-imports.test.ts`, `i18n-structure.test.ts`, `statutory-ekasa-consolidation.test.ts`.

## 5. i18n

- `pnpm --filter @openpims/web i18n:scan`; fix hardcoded JSX text found in this file.
- New keys (e.g. header "More" menu, toolbar refresh/count labels) go into BOTH `en.json` and `sk.json`, nested, under the existing `billing.page.*` section.

## 6. Manual Verification (attach to PR, local dev DB only — never a shared/production DB)

- Before/after screenshots at 1280×800, light + dark: list with data, Overdue tab, Estimates tab, empty state, error state (stop the API), expanded invoice, expanded estimate banner, both panels.
- Confirm: single consistent gap between blocks, no horizontal page scroll, row toggle works, inner buttons do not toggle the row, keyboard focus visible on tabs and row actions.
- Do not record real payments or void invoices to test — logic is untouched; use existing test data.

## 7. Verification Suite (all exit code 0)

```bash
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web test
pnpm --filter @openpims/web i18n:scan
```

## 8. Commit & PR Structure

- Branch: `arena/<session-id>-openvpm-ai`
- Commits (one logical change each):
  - `feat(ui-kit): harmonize billing ledger header, KPIs and status tabs with page kit`
  - `feat(ui-kit): harmonize billing invoice table, detail row and panels with page kit`
  - `test(ui): add source-contract test for billing list page`
  - `feat(i18n): sync billing page keys (sk/en)`
- PR description: screenshots, follow-ups found (invoice search needs a router param; anything skipped because a test literal blocked it), and any Sprint 4 leftovers noticed in preflight.

## 9. Definition of Done

- [ ] Page follows the UIKIT hierarchy with page-kit primitives; no child-level `mt-*` fighting `space-y-6`; header actions all `size="sm"`.
- [ ] All nine table headers share one style; no `text-sm` list tables in the page, the detail row or the panels.
- [ ] No raw palette colours; status via semantic tokens.
- [ ] Every literal in section 1 unchanged; error-before-empty order unchanged; `data-tour="invoice-detail"` present.
- [ ] New test added; all listed existing tests green; lint 0 new warnings; type-check 0 errors; i18n symmetric.

## 10. Next-sprint candidates (for the planner — not part of this task)

`/billing/pos` + `/billing/new` (Sprint 9; `billing-ui.test.ts` and `service-picker-ui.test.ts` pin `billing/new` source literals) · `/billing/ekasa` (fiscal; guarded by `statutory-ekasa-consolidation.test.ts`) · `/reports` · `/statutory` + `/statutory/kvepis` · invoice search (router + UI) · GT-009 wholesaler import UI.
