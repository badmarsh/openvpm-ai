# Arena Sprint 10: Billing — e-Kasa Fiscal Registers `/billing/ekasa`

> **Mission for Arena Agent:**
> Bring the fiscal cash-register screen in line with the Dashboard UI Kit:
> `apps/web/app/(dashboard)/billing/ekasa/page.tsx` (~1187 lines, 3 tabs: Doklady / Uzávierky / Pre účtovníka).
> This is a **presentation-only sprint**. No change to amounts, VAT math, receipt numbering, OKP/PKP signing,
> storno rules, daily-closure logic, or any tRPC router/input. Zero new ESLint warnings, 0 type errors,
> 100% bilingual (SK/EN) i18n symmetry, all existing e-Kasa and statutory tests green.

> **Independence:** touches only `billing/ekasa/page.tsx`. Sprint 8 owns `billing/page.tsx`; Sprint 9 owns
> `billing/pos` and `billing/new`; `components/ekasa/thermal-receipt-drawer.tsx` and
> `app/(dashboard)/settings/ekasa/page.tsx` are separate files, not touched. No file overlap with any
> unimplemented sprint.

---

## 0. Preflight

1. `git status` clean on your branch; report (don't fix) leftovers such as the staged
   `lib/lab/reference-range-status.ts` and any `.patch` files.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, `components/layout/page-header.tsx`
   (`PageHeader`/`PageSectionHeader` props), and `lib/__tests__/statutory-ekasa-consolidation.test.ts` in full.
3. Facts verified in the repo (rely on them, re-check if in doubt):
   - `apps/web/app/(dashboard)/billing/ekasa/page.tsx` has **zero** page-kit imports today
     (`git grep -c "page-kit" apps/web/app/\(dashboard\)/billing/ekasa/page.tsx` → 0).
   - `page-kit.tsx` real exports: `pageShellClass` (string `"space-y-6"`), `PageToolbar({className,children})`,
     `SearchField({value,onChange,placeholder,maxLength,className,inputClassName})`, `filterControlClass` (string),
     `underlineTabsListClass` / `underlineTabsTriggerClass` (strings, apply as `className` on the *existing*
     shadcn `TabsList`/`TabsTrigger`), `tableHeadClass`/`tableCellClass`/`tableRowClass` (strings),
     `DataTableFrame({className,children})` — wraps children in `TableScroll` (adds `overflow-x-auto` +
     right-edge fade). **No footer/caption slot** — do not invent one. `KpiGrid({className,children})` →
     `grid grid-cols-2 gap-3 sm:grid-cols-4`. `KpiCard({label,value,icon,active,onClick,className})` — **no
     `tone` prop**; `value` accepts `React.ReactNode` so a two-line amount can be composed inside it, but
     there is no separate caption/footer slot either.
   - `trpc.extensions.ekasa.getReceipts` input is `{ limit, offset, status? }` only — **no text search**. Do
     not add a `SearchField` wired to this query.
   - Reference merged pages to copy exact patterns from (all already page-kit'd):
     `vaccinations/page.tsx` L191-213 (Tabs + `underlineTabsListClass`/`underlineTabsTriggerClass` on the
     existing `Tabs`/`TabsList`/`TabsTrigger`), `recalls/page.tsx` L298-318 (`KpiGrid`/`KpiCard`),
     `controlled-substances/page.tsx` L745-769 (documented order: `PageSectionHeader` → `PageToolbar` →
     `DataTableFrame`, all as siblings — do not nest a section header inside `DataTableFrame`),
     `inventory/page.tsx` L1331-1558 (pagination footer is the **last child inside** `DataTableFrame`, after
     `</Table>` — that is the real precedent, not a sibling below it).
4. Baseline — green BEFORE editing:
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/statutory-ekasa-consolidation.test.ts lib/__tests__/i18n-structure.test.ts components/help/__tests__/help-content.test.ts lib/ekasa/__tests__/ekasa-service.test.ts lib/ekasa/__tests__/fiscal.test.ts lib/ekasa/__tests__/driver-void.test.ts lib/accounting/__tests__/export.test.ts lib/__tests__/regulatory-acceptance-scenarios.test.ts app/api/cron/ekasa-daily-closure/route.test.ts app/api/cron/ekasa-retry/route.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Section 2 non-negotiables:** never modify `ClinicalDiffConfirmModal`, controlled-substance zero-prefill,
  sympathy-gate logic, `packages/db/schema/*.ts`, `packages/db/drizzle/meta/_journal.json`.
- **Fiscal logic is frozen, full stop:** `lib/ekasa/*` (OKP/PKP signing, `processEkasaReceipt`,
  `calculateMultiVatReceipt`, offline-store/replay), the e-Kasa router (`server/routers/extensions/ekasa.ts`) —
  every query/mutation and its input shape (`getReceipts`, `getDailyClosureSummary`, `getDailyClosures`,
  `getAccountantExport`, `retryReceipt`, `stornoReceipt`, `performDailyClosure`, `printReceipt`, `getConfig`).
  No new params, no new endpoints. Storno confirmation modal's legal-notice copy, the 3-character minimum
  reason-length guard, and `correctionType: "STORNO"` stay byte-identical.
- **`components/ekasa/thermal-receipt-drawer.tsx`** — separate file, not part of this sprint. It is already
  independently checked by the pinning test (§ below); do not open or edit it.
- **`app/(dashboard)/settings/ekasa/page.tsx`** — also lacks page-kit, but it is a config form, not a
  fiscal register; a different future sprint, not this one.
- **`VAT_LABEL`, `PAYMENT_LABEL`, `STATUS_CONFIG`, `VERIFICATION_VARIANT`, `verificationStateOf()`,
  `MONTH_KEYS`/`MONTH_FALLBACKS`, `PAGE_SIZE`** — vocabulary/logic constants, not styling. Leave as-is.
- **Exact source-contract literals from `lib/__tests__/statutory-ekasa-consolidation.test.ts`** (this file
  `readFileSync`s the page as text — copy every one of these byte-identical):
  - `<PageHeader` present, and `from "@/components/layout/page-header"` imported — keep `PageHeader`, do not
    replace the module heading with a raw `<h1 className="text-lg|xl|2xl|3xl">`.
  - `from "@/components/ui/table"` still imported — `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell`
    stay shadcn primitives; only their *outer wrapper div* may change to `DataTableFrame`.
  - `px-3 py-2.5` dense cell padding must remain on table cells.
  - `from "@/components/ui/tabs"` still imported — `Tabs`/`TabsList`/`TabsTrigger` stay as-is; only add
    `className={underlineTabsListClass}` / `className={underlineTabsTriggerClass}`. Must NOT match
    `/activeTab === "receipts"\s*\?\s*"bg-background/` (i.e. never replace the shadcn `Tabs` with a
    hand-rolled button-group compared against `activeTab`).
  - `ekasa.page.verification.${verification}` template literal, `case "CONFIRMED":` → `return "valid"`,
    `case "OFFLINE_STORED":` → `return "offline"`, and the literal `"ekasa.page.verification.storno"` —
    all inside `verificationStateOf()` / its call site; do not touch.
  - `useCurrencyFormatter` imported and used; `formatAmount(r.amountTotal)` call kept verbatim.
  - At least one className combining `text-right` and `tabular-nums` on the same element (regex
    `/text-right[^"]*tabular-nums/`) — already present on the amount cell; do not drop it while restyling.
  - Every `<StatusPulseBadge` in this page must keep a `label={t(...)}` prop (badge count == labelled count).
    Today there are exactly **2**: the receipts-table verification badge and the closures-history status
    badge. If you add any new `StatusPulseBadge`, it must also carry a translated `label`.
  - `<EmptyState` present and `action={{` present at least once (there are 3 `EmptyState`s on this page;
    2 of the 3 already pass an `action`).
  - No `toLocaleString("sk-SK"|"en-US"...)` / `toLocaleDateString(...)` anywhere on this page — dates already
    go through `formatDate`/`formatDateTime` from `lib/locale/format`; keep it that way.
- **`components/help/__tests__/help-content.test.ts`** expects `getHelpContent("/billing/ekasa").title` to
  contain `"e-Kasa"` — keep that substring in the page title translation's `en`/`sk` fallback text.

---
## 2. Architectural Rules (MUST FOLLOW)

1. **UIKIT baseline:** root `pageShellClass`; every filter/action row that isn't a KPI grid or a table goes
   in `PageToolbar`; both `<Table>` blocks get `DataTableFrame` as their outer wrapper; the two simple
   stat grids (see 3D/3E) become `KpiGrid`/`KpiCard`; tabs get the underline classes. No per-page chrome
   invented where a page-kit primitive already exists for it.
2. **Money/VAT display is presentation-only:** every amount continues to flow through `formatAmount`
   (`useCurrencyFormatter`) exactly where it does today; no new arithmetic, no new formatting helper.
3. **Semantic tokens, not raw palette classes** — the page already uses `warning`/`success`/`destructive`
   tokens; keep that, don't introduce `bg-amber-50` etc.
4. **100% i18n** — every string stays through `t()`; if a class swap needs a new `aria-label` (e.g. on the
   tab list, or the month/year `<select>`s), add a nested key under `ekasa.page.*` in **both**
   `messages/en.json` and `messages/sk.json`. Do not rename or remove any existing key used elsewhere
   (`ekasa.page.status.*` is also read by `STATUS_CONFIG`-driven filter pills — verify before renaming).
5. **No horizontal page scroll at 1280×800.** The 8-column receipts table (`Číslo dokladu, Dátum, Suma,
   DPH, Platba, Overenie, UID, Akcie`) has no scroll affordance today (plain `overflow-hidden` div, no
   `overflow-x-auto`); `DataTableFrame` fixes this via `TableScroll`'s fade-edge scroll — verify it actually
   scrolls at 1024×768 instead of clipping the `Akcie` column.
6. **Verification suite is presentation-only:** the daily-closure "Denná uzávierka" quick-action banner and
   the pre-certification warning banner keep their exact legal/compliance wording; only their container
   markup may move to page-kit tokens if a primitive fits (most likely it stays a bespoke bordered `div` —
   page-kit has no "banner" primitive, don't invent one).

---

## 3. Detailed Requirements — `/billing/ekasa`

**File:** `apps/web/app/(dashboard)/billing/ekasa/page.tsx` (~1187 lines)

**Current problems (verified in code):**
- Zero page-kit imports; every table wrapper, toolbar row and stat grid is hand-rolled and drifts from the
  tokens used by the merged registers (`controlled-substances`, `recalls`, `vaccinations`, `lab-results`).
- `TabsList`/`TabsTrigger` (receipts / closures / accountant) render with shadcn's default styling — never
  switched to the underline treatment the rest of the harmonized app uses.
- Receipts-tab filter row (status pills + "Obnoviť" refresh) is a bare
  `<div className="flex flex-wrap items-center justify-between gap-2">`, not `PageToolbar`.
- Receipts table and closures-history table are each wrapped in an ad hoc
  `<div className="rounded-xl border bg-card shadow-xs overflow-hidden">...<Table>...` — not
  `DataTableFrame` — and have no horizontal-scroll affordance (see rule 5 above).
- Closures tab nests its `<PageSectionHeader title="História denných uzávierok">` **inside** that same
  bordered wrapper div (with an extra `border-b border-border/60 px-4 py-3` divider) instead of as a
  sibling above the table card, unlike `controlled-substances/page.tsx`'s documented order.
- Closures tab's "Daily stats grid" (4 cards: total today / cash / card / VAT-23 base-and-tax) is a
  hand-rolled `grid grid-cols-2 gap-3 sm:grid-cols-4` of `rounded-lg border border-border bg-muted/30 p-3`
  divs — structurally identical to `KpiGrid`/`KpiCard` but not using them.
- Accountant tab's "Monthly Totals" grid (4 cards: total / cash / card / transfer) is the same pattern,
  hand-rolled again with `rounded-xl border border-border bg-card p-4 shadow-xs`.
- Accountant tab's month/year `<select>` elements use a bespoke class
  (`"h-9 rounded-md border border-input bg-background px-3 text-sm"`) missing the focus-visible ring that
  `filterControlClass` provides, and use `text-sm` where the design system's filter controls use `text-xs`.

---
### 3A. Tabs
Keep `<Tabs value={activeTab} onValueChange={...}>` exactly as-is (it already lives in `PageHeader`'s
`actions`). Add `className={underlineTabsListClass}` to `<TabsList>` and `className={underlineTabsTriggerClass}`
to each `<TabsTrigger>`, matching `vaccinations/page.tsx` L196-213. Keep each tab's icon
(`ReceiptEuro`/`Lock`/`FileSpreadsheet`) and label unchanged.

### 3B. Receipts tab — toolbar
Wrap the status-pill filter row and the "Obnoviť" refresh button in `<PageToolbar>` (import from
`@/components/layout/page-kit`), replacing the bare flex `div`. Keep the pill `Button`s (variant/size/rounded-full
classes) and the refresh `Button` exactly as they are today — only the outer container changes.

### 3C. Receipts tab — table
Replace the `<div className="rounded-xl border bg-card shadow-xs overflow-hidden">` wrapper around the
receipts `<Table>` with `<DataTableFrame>`. The loading skeleton, the `EmptyState` branch and the pagination
footer div (`"Zobrazené záznamy od..."` + Previous/Next buttons) all stay **inside** `DataTableFrame` as
trailing children after `</Table>` — same shape as `inventory/page.tsx` L1519-1558 (table → pagination div →
close). Do not split them into a separate wrapper below `DataTableFrame`; there is no footer slot to use
instead.

### 3D. Closures tab
1. Hoist `<PageSectionHeader title={t("ekasa.page.closures.history", ...)} />` out of the bordered wrapper
   so it sits as a sibling **above** the table card, dropping the now-redundant
   `<div className="border-b border-border/60 px-4 py-3">` divider — mirrors
   `controlled-substances/page.tsx`'s `{/* Ledger: section header → toolbar → DataTableFrame */}` order
   (there is no toolbar needed here, so it becomes section header → `DataTableFrame`).
2. Replace that same wrapper `div` around the closures-history `<Table>` with `<DataTableFrame>` (loading
   spinner and `EmptyState` branches stay inside, same pattern as 3C; this table has no pagination footer
   today — don't add one).
3. Replace the "Daily stats grid" (4 cards) with `<KpiGrid><KpiCard .../> × 4</KpiGrid>`. Map: total today
   → `label` "Celková tržba dňa" + `value` `formatAmount(...)` with the `{count} dokladov` line composed as
   a second `<span>` inside the same `value` node (KpiCard has no caption slot); cash and card → straight
   label/value; VAT-23 → `value` composed as `base / vat` exactly like today (`formatAmount(base)} / {…}`
   inside one `<span>` pair). Pick one Lucide icon per card matching the existing section's iconography
   (e.g. `Coins`, `Banknote`/`CreditCard`, `Percent` — verify each icon is already imported or add the
   import; do not reuse `Lock` since that's the tab's own icon).

### 3E. Accountant tab
1. Month/year `<select>` elements: replace the bespoke class with `filterControlClass` from page-kit. Keep
   `aria-label`, `value`, `onChange`, and the option lists (`MONTH_KEYS`/`MONTH_FALLBACKS`, `[2025,2026,2027]`)
   untouched. Wrap the whole controls row (month/year selects + download button) in `<PageToolbar>`,
   replacing its current bespoke `flex ... rounded-xl border border-border bg-card p-4 shadow-xs` div.
2. Replace the "Monthly Totals" 4-card grid with `KpiGrid`/`KpiCard`, same composition approach as 3D.3
   (the first card's `{closures}/{receipts}` sub-line goes inside `value`).
3. Leave the **VAT Breakdown card** (4 cells for 23/19/5/0%, each with its own rate label plus two
   base/vat lines) exactly as it is — its shape (a label that is itself the rate name, plus two data rows)
   does not map cleanly onto `KpiCard`'s label+value contract; forcing it would invent a layout `KpiCard`
   doesn't support. Note this as a follow-up (§10), do not attempt it in this sprint.

### 3F. Out of scope inside this file
The pre-certification warning banner, the "Denná uzávierka" quick-action banner, the `ThermalReceiptDrawer`
usage, and the storno confirmation modal keep their current markup untouched — no page-kit primitive
applies to a warning banner or a confirmation dialog, and their content is legally/compliance-sensitive.

---
## 4. Tests

- **New** `apps/web/lib/__tests__/billing-ekasa-ui.test.ts` (source-contract style, same technique as
  `statutory-ekasa-consolidation.test.ts`): asserts the page imports `pageShellClass`, `PageToolbar`,
  `DataTableFrame`, `KpiGrid`, `KpiCard`, `underlineTabsListClass`, `underlineTabsTriggerClass` from
  `@/components/layout/page-kit`; still imports `Table` from `@/components/ui/table` and `Tabs` from
  `@/components/ui/tabs`; no longer contains the literal
  `"rounded-xl border bg-card shadow-xs overflow-hidden"` (the old ad hoc table wrapper) anywhere in the
  file; `PageSectionHeader` for the closures history is not nested inside a `div` that also contains
  `<Table` (regex check on ordering); month/year `<select>` use `filterControlClass`.
- **Must stay green, unchanged:** `lib/__tests__/statutory-ekasa-consolidation.test.ts` (re-verify every
  literal in §1 above after your edit), `lib/__tests__/i18n-structure.test.ts`,
  `components/help/__tests__/help-content.test.ts`, and the fiscal/backend suite listed in the §0 baseline
  command (unaffected by a presentation-only page change, but confirm nothing in `lib/ekasa/*` was touched).

## 5. i18n

`pnpm --filter @openpims/web i18n:scan` must report nothing new beyond any `aria-label` keys you add under
`ekasa.page.*`. No key renames. `en.json`/`sk.json` stay leaf-symmetric.

## 6. Manual Verification (attach to PR)

- **FISCAL SAFETY:** do not press "Vykonať dennú uzávierku", "Odoslať"/retry, or "Potvrdiť storno" against
  any database with a real, non-sandbox e-Kasa configuration. Verify tab/layout changes by navigating the
  three tabs and the new source-contract test; only exercise mutations against a local dev DB with a
  stub/sandbox e-Kasa config.
- Screenshots before/after, light + dark, 1280×800 and 1024×768: receipts tab (empty, one status filter
  active, populated with pagination visible), closures tab (open day, closed day, empty history), accountant
  tab (month with data, month with none).
- Confirm the receipts table scrolls horizontally with a fade edge at 1024×768 instead of clipping columns.

## 7. Verification Suite (all exit code 0)

```bash
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web test
pnpm --filter @openpims/web i18n:scan
```

## 8. Commit & PR Structure

- Branch `arena/<session-id>-openvpm-ai`; one logical change per commit:
  - `feat(ui-kit): harmonize e-Kasa tabs, toolbar and table wrappers with page kit`
  - `feat(ui-kit): replace hand-rolled e-Kasa stat grids with KpiGrid/KpiCard`
  - `test(ui): add source-contract test for billing/ekasa page-kit adoption`
- PR description: screenshots, and explicitly call out that the VAT-breakdown card (§3E.3) was left
  untouched and why.

---
## 9. Definition of Done

- [ ] Tabs, receipts toolbar, both tables and both simple stat grids use page-kit primitives; VAT-breakdown
      card explicitly left alone with a note in the PR.
- [ ] `Table` still from `@/components/ui/table`, `Tabs` still from `@/components/ui/tabs`; no new router
      calls, no new query params, no text-search field added.
- [ ] Every literal listed in §1 still present verbatim; `statutory-ekasa-consolidation.test.ts` green
      without modification.
- [ ] Receipts table has a working horizontal-scroll affordance at 1024×768.
- [ ] i18n scan clean; no renamed keys; `en.json`/`sk.json` symmetric.
- [ ] Zero new lint warnings; type-check 0 errors; full listed test suite green.

## 10. Next-sprint candidates

1. **P1 fiscal (highest priority next):** `trpc.extensions.ekasa.createPosSale` has no idempotency key —
   a lost response or manual retry from `/billing/pos` can create two invoices and two signed fiscal
   receipts for one sale. See the proposed ticket this sprint's recon produced
   (`tasks/proposed/gt-018-*.md`). This should be Sprint 11.
2. VAT-breakdown card (§3E.3) — a bespoke `KpiCard`-adjacent layout, or a small extension to `KpiCard`
   (e.g. an optional secondary line) if the same shape recurs elsewhere; needs a design decision first.
3. `app/(dashboard)/settings/ekasa/page.tsx` — also lacks page-kit; separate, lower-priority sprint (config
   form, not a daily-use register).
4. Then: `reports` (974 lines) + `wellness` (270 lines), per the writer prompt's suggested order.
