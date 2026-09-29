# Arena Sprint 9: Billing Entry Surfaces — POS Checkout `/billing/pos` & New Invoice `/billing/new`

> **Mission for Arena Agent:**
> Bring the two screens where money is *entered* in line with the Dashboard UI Kit and basic accessibility, and close their i18n and role-gating gaps:
> `apps/web/app/(dashboard)/billing/pos/page.tsx` (~700 lines, fiscal counter checkout) and `apps/web/app/(dashboard)/billing/new/page.tsx` (~750 lines, invoice/estimate form).
> This is a **presentation, i18n, a11y and client-side-validation sprint**. No change to what is sent to the server, to totals math, VAT logic, e-Kasa/fiscal behaviour, or any router.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n symmetry, all existing billing tests green.

> **Independence:** Sprint 8 edits only `billing/page.tsx`; Sprints 5–7 edit other pages. No file overlap — order does not matter. `/billing/ekasa` is a later sprint.

---

## 0. Preflight

1. `git status` clean on your branch; report (don't fix) leftovers such as the staged `lib/lab/reference-range-status.ts`.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `page-kit.tsx` (incl. `SearchField` and `PageHeader` props in `components/layout/page-header.tsx` — check whether it has an icon/back-link prop before inventing one).
3. Facts verified in the repo (rely on them, re-check if in doubt):
   - `trpc.extensions.ekasa.createPosSale` input: `items[]` = `{ productId?: uuid, description: string.min(1), quantity: int ≥ 1, unitPrice: string /^\d+(\.\d{1,2})?$/, vatRate: ZERO|REDUCED_5|REDUCED_19|STANDARD_23, discountPercent: 0–100 }`, `paymentMethod: CASH|CARD`, `clientId?`, `patientId?`, `paperWidth: 58mm|80mm`. Roles: `admin`, `veterinarian`, `front_desk`. **There is no idempotency key.**
   - `formatCurrency(amount, currency = "eur", country?)` in `@/lib/locale/format` defaults to EUR / SK locale.
   - `EmptyState` props: `icon, title, description?, action?, className`. `ActionConfirmationDialog` props: `open, title, description, confirmLabel, isPending?, onConfirm` (read the file for the rest). `@/components/ui/{tabs,select,switch,label,table}` exist.
   - `messages/*.json` `billing.pos` currently has only 5 keys (`discount, subtotal, totalDue, scannerAdded, scannerNotFound`).
4. Baseline — green BEFORE editing:
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/billing-ui.test.ts lib/__tests__/service-picker-ui.test.ts lib/billing/__tests__/pos-calculations.test.ts lib/billing/__tests__/use-barcode-scanner.test.ts components/help/__tests__/help-content.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Fiscal / e-Kasa:** the `createPosSale.mutate({ items, paymentMethod, clientId, paperWidth })` payload shape and field mapping, `EkasaReceiptDialog` and the `setCompletedReceipt({...})` mapping, `paperWidth` values, `CASH`/`CARD`, VAT enum values and the category→default-VAT rule in `addToCart`. Nothing under `billing/ekasa/`, the e-Kasa router or driver.
- **Math and hooks:** `computePosTotals` (`lib/billing/pos-calculations`), `useBarcodeScanner` (`lib/billing/use-barcode-scanner`), `quantityLineTotalCents`, `moneyToCents`, `centsToMoney`, `tryCalculateInvoiceTaxTotals`, `lib/billing/policy`. Do not add new arithmetic on amounts; new displays must call these helpers.
- **Routers and schema:** no edits (idempotency and Slovak-only server messages are follow-ups, see §11).
- **`ServicePicker`** (`components/billing/service-picker.tsx`) and its test.
- **Clinical gates:** `ClinicalDiffConfirmModal`, controlled-substance zero-prefill, sympathy-gate logic — never modify.
- **Sprint 8's file** `billing/page.tsx` and the `/billing/pos`, `/billing/new` hrefs (`help-content.test.ts` lists `/billing/pos`).
- **`billing/new` source-contract literals** (`billing-ui.test.ts` and `service-picker-ui.test.ts` read this file as text). Read both test files in full — the list below is NOT exhaustive because some multi-line assertions were truncated when this brief was written. Keep byte-identical: `maxLength={BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH}`, `min={BILLING_INVOICE_LINE_QUANTITY_MIN}`, `max={BILLING_INVOICE_LINE_QUANTITY_MAX}`, `max={BILLING_UNIT_PRICE_MAX}`, `const canAddItem =`, `items.length < BILLING_INVOICE_MAX_ITEMS`, `const canSubmitInvoice =`, `isBillingInvoiceSubtotalValid(items)`, `disabled={!canAddItem}`, `description: trimmedItemDescription`, `unitPrice: itemUnitPrice.trim()`, `function defaultDueDate(timeZone?: string | null)`, `formatDateInputForTimeZone`, `setDueDateTouched(true)`, `const taxConfig = taxConfigQuery.data`, `const taxConfigReady = …`, `Loading practice date settings...`, `function InlineQueryMessage`, `isClientSearchInputValid(clientSearch)`, `maxLength={CLIENT_SEARCH_MAX_LENGTH}`, `const clientResultsMissing =`, `clientOptions.map((client)`, `patientOptions.map((patient)`, `<ServicePicker`, `services={serviceOptions}`, `Unable to search clients. Please retry.`, `Unable to load client patients. Please retry.`, `Unable to load billing services`, `Unable to load billing services. Please retry.`, `Searching clients...`, `Unable to load practice tax settings`, `Preview totals omit tax`, `Loading practice tax settings...`, `function canManageBillingRole`, `function NewInvoiceForm()`, `Billing actions are read-only`, and the ordering "client error branch before `No clients found`". The unit-price `<Input>` must keep the attribute order `type="number"` → `step="0.01"` → `min={0}` → `max={BILLING_UNIT_PRICE_MAX}` → `placeholder={t("billing.new.unitPricePlaceholder"` (regex-pinned; extra attributes elsewhere are fine). Must NOT appear: `taxConfigQuery.data?.timezone|taxRatePercent|currency|country`, `formatDateInputLocal`, `toISOString().split("T")[0]`, `clientResults.data?.map`, `patientResults.data?.map`, `servicesQuery.data?.map|find`, `Select a service...`.

---

## 2. Architectural Rules (MUST FOLLOW)

1. **UIKIT:** `pageShellClass` wrapper, `PageHeader` with `icon` (no inline icon or badge component inside `<h1>`), sections as `rounded-lg border border-border bg-card`, dense tokens (`h-9`, `text-xs`), tables via `tableHeadClass`/`tableCellClass`/`tableRowClass`, `EmptyState` for empty lists. No per-page chrome, no `text-sm` list tables, no raw palette classes (`border-gray-300`, …).
2. **POS is a touch-first counter surface.** It is exempt from the `h-9` control height only for cart controls and payment buttons: quantity ± and remove targets ≥ 40 px (`h-10 w-10`), payment buttons stay `h-12`. Everything else follows the kit.
3. **Money display** always through `formatCurrency` + `tabular-nums`; never hand-built `x.toFixed(2) + " €"`.
4. **100% strict i18n** — no Slovak or English literals in JSX, toasts, placeholders, `aria-label`s or constant option lists; nested keys only; `en.json` ↔ `sk.json` symmetric.
5. **Accessibility baseline:** every input has an associated label (`htmlFor`/`id`, `Label`, or `aria-label`); every icon-only button has `aria-label`; invalid inputs set `aria-invalid`.
6. **No horizontal page scroll at 1280×800 and 1024×768.**

---

## 3. Part A — `/billing/pos`

**File:** `apps/web/app/(dashboard)/billing/pos/page.tsx`

**Current problems (verified in code):**
- `useSession()` is called but `session` is never used: **no role gate**. The mutation requires `admin | veterinarian | front_desk`; any other role builds a whole cart and only gets a FORBIDDEN toast at checkout.
- Dozens of hardcoded Slovak strings bypass `useI18n` (toasts, header title/subtitle/badge, back link, "Tlačiareň:", search placeholder, "Voľná položka", "Všetok tovar", empty texts, "Sklad: n ks", customer block, cart title/empty/clear, "Hotovosť", "Platobná karta", the default line description "Pultová položka / Služba", and the `VAT_RATE_OPTIONS` labels). Only 5 strings use `t()`.
- Money is shown as `x.toFixed(2) + " €"` (no locale formatting, no `tabular-nums`).
- Unit price is a free-text `<input type="text">`; the server rejects anything outside `^\d+(\.\d{1,2})?$` only after the click. Description input is borderless with no label; quantity ±, remove and clear buttons have no `aria-label` and 12–14 px targets.
- "Vyprázdniť" empties the cart instantly, with no confirmation.
- `any` casts: `products.map((p: any)`, `(p as any).stockQuantity`, `(p as any).category`, `e.target.value as any`.
- Root is `space-y-4` with a stand-alone back button above the header; header title is a `<span>` with a badge inside; `PageHeader` has no `icon`; `className="border-b … pb-4"` override.
- Catalog and cart use fixed `max-h-[520px]` / `max-h-[300px]`; empty catalog and empty cart are plain text divs (no `EmptyState`); client picker dropdown is silent on loading/error and has no listbox semantics.

### 3A. Access gate
Mirror the `NewInvoicePage` → `NewInvoiceForm` split from `billing/new` (session loading → inline message; forbidden role → read-only `EmptyState` with a back link; otherwise render the form component, so hooks are never called conditionally). Allowed roles must equal the **server's** list (`admin`, `veterinarian`, `front_desk`) — verify against `requireRole` in the e-Kasa router; do NOT reuse the `admin`/`front_desk`-only helper from `billing/page.tsx`. Remove the unused `session` variable.

### 3B. Shell, header, i18n
1. `pageShellClass` wrapper; `PageHeader` with an `icon`; plain-string translated title and subtitle; the "e-Kasa" badge moves out of the title (subtitle line or actions). One consistent back-link treatment shared with `billing/new` (use a `PageHeader` prop if one exists, otherwise a single ghost `size="sm"` link in `actions`). Drop the border/padding override.
2. Paper-width switch (58 / 80 mm) becomes the shared pill `Tabs`/`TabsList` (a legitimate "tiny in-card switch"), translated label, `aria-label` on the group.
3. Move **every** literal into `billing.pos.*` (nested, both files): header/subtitle/badge/back, printer label, search placeholder, custom-item button and default description, category "all", catalog empty variants, stock strings (`{count}` interpolation), customer block, cart title (`{count}`), clear, empty cart, pay buttons, VAT labels (one key per `VAT_RATE_OPTIONS` value), all toasts (success, empty cart, mutation error fallback). Keep the current Slovak wording as the `sk` value; write natural English for `en`. Keep the existing `{name}` / `{code}` interpolation style.

### 3C. Catalog
Search via `SearchField` (`h-9`); category pills use tokens (keep behaviour); product tiles typed from the `inventory.list` output (remove all `any`; if `stockQuantity`/`category` are missing from the inferred type, fix the typing at the call site, not the router). Price via `formatCurrency` + `tabular-nums`; low-stock badge keeps the `warning-muted` tokens; `stock <= 0` gets a `destructive-muted` "sold out" badge but **remains addable** (do not block — report in the PR whether the server rejects it). Loading → skeleton tiles (not a lone spinner); empty → `EmptyState` (icon `Package`) with two variants (no products / no search results). Replace `max-h-[520px]` with a viewport-relative height so catalog and cart scroll independently and the pay buttons are visible without page scroll at 1280×800.

### 3D. Cart
1. Description: labelled input (`aria-label`), `maxLength={BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH}`, visible focus style (no `focus:ring-0` borderless trap).
2. Unit price: `inputMode="decimal"`, `aria-invalid`, destructive border when invalid. Validate with `isBillingCurrencyAmountInputValid` from `lib/billing/policy` **after confirming it accepts exactly what the server regex accepts** (e.g. `"0"`, `"12.5"`, `"12.50"`; rejects `"12.345"`, `""`, `"-1"`). While any line is invalid or has an empty description, both pay buttons are disabled and a translated hint says why. The server stays authoritative; the payload is unchanged.
3. Quantity ± and remove: `h-10 w-10`, `aria-label` (with the item name), quantity shown `tabular-nums`. VAT selector → `@/components/ui/select` (or token-styled native `select`, `h-9 text-xs`) with translated labels.
4. Per-line total shown `tabular-nums`, computed by calling the existing `computePosTotals` with that single line (no new formulas).
5. "Vyprázdniť" → `ActionConfirmationDialog` when the cart has items. Automatic clearing after a successful sale stays instant (no dialog).
6. Empty cart → compact `EmptyState`.

### 3E. Totals and payment
Subtotal / discount / total via `formatCurrency` + `tabular-nums` (values still from `computePosTotals`). The right column is `lg:sticky lg:top-4 lg:self-start` so totals and pay buttons never scroll away. Pay buttons keep `h-12`, show the method and the amount (translated, `{amount}` interpolation), keep the `isPending` spinner and add `aria-busy`. Button order, variants, `handleCheckout("CASH" | "CARD")` and the double-submit guard stay.

### 3F. Client picker
Keep `trpc.clients.list` and the `length >= 2` rule. Add `maxLength={CLIENT_SEARCH_MAX_LENGTH}` (from `lib/clients/policy`), loading / error / "no results" rows inside the dropdown, `role="listbox"` / `role="option"`, closing on Escape and on outside click. Selected client chip uses tokens.

### 3G. After a sale
Receipt dialog and its data mapping are untouched. When the dialog closes, focus returns to the catalog search field. Do not alter the barcode hook; if you notice it fires while an `<input>` is focused, record it in the PR (report only).

---

## 4. Part B — `/billing/new`

**File:** `apps/web/app/(dashboard)/billing/new/page.tsx` — read §1 first; this page is the most heavily source-pinned in the repo.

**Current problems (verified in code):**
- Shell is `mx-auto max-w-3xl` + a hand-built back button + `mt-6 space-y-4`; `PageHeader` has no `icon`; the estimate toggle is a raw checkbox with `border-gray-300`.
- Labels are plain `<label className="block text-sm font-medium mb-1">` with no `htmlFor`; the add-line row has placeholders only (no labels); the patient `<select>` is `h-10 … text-sm`.
- Add-line grid is `grid-cols-12` with spans 4 / 3 / 1 / 2 / 2: at `max-w-3xl` the quantity field (`step="0.001"`) is ~56 px wide.
- Line-items table is `text-sm`, `py-2`, remove button icon-only with no `aria-label`.
- **Line total is `fmt(item.quantity * parseFloat(item.unitPrice))` (float math)** while the subtotal comes from `quantityLineTotalCents(moneyToCents(…))` (cents) — displayed line totals can diverge from the displayed subtotal.
- `const currency = … : "usd"` and `country … : "US"` fallbacks mean amounts render as USD / US format until the tax config loads.
- Two error messages bypass `t()`: `` `Unable to load client patients. ${…message}` `` and `` `Unable to load billing services. ${…message}` ``. The unit-price placeholder default is Slovak (`"Jednotková cena"`) while every other default on the page is English.

### 4A. Shell and sections
Keep the centered narrow form width but use `pageShellClass` inside it; same back-link treatment as POS; `PageHeader` gets an `icon`. Group into cards (`rounded-lg border border-border bg-card p-4`): client & patient · line items · totals · due date & actions. Estimate toggle → `@/components/ui/switch` with `Label` in the header actions (state `isEstimate` unchanged). No `mt-*` fighting the shell.

### 4B. Labels and controls
Associate every label (`Label` + `htmlFor`/`id`) for client search, patient select, due date and all add-line inputs; add **visible** small labels above description / qty / unit price (placeholders remain). Patient select → `@/components/ui/select` or token-styled native select (`h-9 text-xs`); the `patientOptions.map((patient)` literal must survive. Remove-line button: `h-7 w-7` ghost with translated `aria-label` including the description.

### 4C. Add-line layout
Make the row responsive (e.g. `grid-cols-2 sm:grid-cols-6 lg:grid-cols-12` with quantity ≥ 2 columns, or two stacked rows below `lg`) so no field is narrower than ~80 px at 1024 px. Keep every pinned attribute and the unit-price attribute order (§1). `ServicePicker` is used as-is.

### 4D. Line-items table
`tableHeadClass` / `tableCellClass` / `tableRowClass`, `text-xs`, numeric columns right-aligned `tabular-nums`. **Display line totals with the same helpers as the subtotal:** `centsToMoney(quantityLineTotalCents(moneyToCents(item.unitPrice), item.quantity))` (all three already imported). Add a unit test with several quantity/price pairs (including 3-decimal quantities) asserting the displayed line totals add up to the displayed subtotal; if you cannot reproduce a divergence with the old float formula, still switch — consistency is the goal, and say so in the PR. No items yet → a small translated empty line instead of rendering nothing.

### 4E. Currency before config loads
Keep the `currency` / `country` variables and every pinned `taxConfig*` literal. Change only what is *displayed*: while `!taxConfigReady`, `fmt(...)` returns `"—"` (or the amount cells show a skeleton) instead of formatting in USD. Totals block behaviour and its three error/loading messages stay.

### 4F. i18n leaks
Route both concatenated error messages through `t()` with `{message}` interpolation, keeping the literal substrings `Unable to load client patients` / `Unable to load billing services` in the English defaults (tests pin them). Change the unit-price placeholder default to English and put the Slovak wording in `sk.json`; keep the key `billing.new.unitPricePlaceholder`. Add any new keys nested under `billing.new.*` in both files.

### 4G. States
`InlineQueryMessage` keeps its name and three kinds but uses `text-xs` and semantic tokens (`destructive`, `muted`). Read-only branch (`Billing actions are read-only`) unchanged.

---

## 5. Tests

- **New** `apps/web/lib/__tests__/billing-pos-ui.test.ts` (source-contract style): page uses `pageShellClass`, `formatCurrency`, `ActionConfirmationDialog`, `SearchField`; role gate mentions `admin`, `veterinarian`, `front_desk` and no unused `session`; no `as any` / `: any`; no `.toFixed(2)`; no raw `toast.success("` / `toast.error("` string literals (regex on `toast\.(success|error)\(\s*["'`]`); pay buttons' `disabled` includes the invalid-line guard; `createPosSale.mutate({` still contains exactly `items`, `paymentMethod`, `clientId`, `paperWidth`.
- **New** `apps/web/lib/__tests__/billing-new-ui.test.ts`: no `item.quantity * parseFloat`; labels have `htmlFor`; no `border-gray-`; no `` `Unable to load billing services. ${ `` template; `InlineQueryMessage` still declared.
- **New** unit test for the line-total consistency (4D).
- **Must stay green, unchanged:** `billing-ui.test.ts`, `service-picker-ui.test.ts`, `pos-calculations.test.ts`, `use-barcode-scanner.test.ts`, `help-content.test.ts`, `i18n-structure.test.ts`, `statutory-ekasa-consolidation.test.ts`, `heavy-client-imports.test.ts`.

## 6. i18n

`pnpm --filter @openpims/web i18n:scan` must report nothing new for both pages. New keys nested (`billing.pos.*`, `billing.new.*`), both files, leaf-symmetric.

## 7. Manual Verification (attach to PR)

- **FISCAL SAFETY:** never press *Hotovosť* / *Platobná karta* against a database or environment that has an active real e-Kasa configuration. Verify the payment path only with a local dev DB whose e-Kasa config is a stub/sandbox, or via the unit/UI-contract tests. Do not create real invoices on shared or production data.
- Screenshots before/after, light + dark: POS at 1280×800 and 1024×768 (empty cart, cart with 3 lines, invalid price, sold-out tile, clear-cart dialog, forbidden role), New Invoice at 1280×800 and 1024×768 (empty, with lines, estimate mode, tax-config-loading state).
- Keyboard-only pass on both pages: tab order follows visual order, every control reachable, dialogs trap and restore focus.

## 8. Verification Suite (all exit code 0)

```bash
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web test
pnpm --filter @openpims/web i18n:scan
```

## 9. Commit & PR Structure

- Branch `arena/<session-id>-openvpm-ai`; one logical change per commit:
  - `feat(ui-kit): harmonize POS checkout layout, catalog and cart with page kit`
  - `fix(pos): gate POS by role and validate cart prices client-side`
  - `feat(i18n): move POS and new-invoice literals to messages (sk/en)`
  - `feat(ui-kit): harmonize new invoice form with page kit and a11y labels`
  - `fix(billing): display invoice line totals from cents helpers; no USD fallback before tax config`
  - `test(ui): add source-contract and line-total tests for POS and new invoice`
- PR description: screenshots, follow-ups (§11), what was skipped because a pinned literal blocked it.

## 10. Definition of Done

- [ ] POS role-gated with the server's role list; no unused `session`; no `any`.
- [ ] Zero hardcoded literals on both pages; both message files symmetric; i18n scan clean.
- [ ] Money displayed only via `formatCurrency`/helpers with `tabular-nums`; line totals on `/billing/new` from cents helpers; no USD flash.
- [ ] All inputs labelled, icon buttons have `aria-label`, invalid price blocks both pay buttons, clear-cart is confirmed.
- [ ] `createPosSale` payload, `computePosTotals`, receipt dialog, barcode hook, `ServicePicker` and every pinned literal untouched; all listed tests green; lint 0 new warnings; type-check 0 errors.

## 11. Follow-ups to record (NOT part of this task)

1. **P1 fiscal:** `createPosSale` has no idempotency key — a network retry or double request can issue two fiscal receipts. Needs router + client change and its own ticket (`tasks/proposed/`).
2. `createPosSale` validation messages (item description required, invalid `unitPrice`, empty cart) are Slovak-only literals in the router (partly without diacritics) and reach the UI raw via `err.message` — they should be error codes translated on the client.
3. Barcode scanner behaviour while an input is focused (report what you observe).
4. Whether the server rejects sold-out items; POS cart persistence across reload; invoice-line editing on `/billing/new` (currently add/remove only).
5. Next: `/billing/ekasa` (fiscal registers, guarded by `statutory-ekasa-consolidation.test.ts`).
