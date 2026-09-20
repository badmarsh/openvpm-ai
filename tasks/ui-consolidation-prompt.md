# UI Consolidation Prompt — VET.IS (OpenVPM AI)

## Objective

Systematically unify the visual consistency of the VET.IS dashboard UI without flattening every page into identical layout. Pages may differ in content and structure, but **typographic scale, spacing tokens, component sizing, component selection, and UX patterns must be predictable** — a user moving between Patients, Billing, Wellness, and Settings should feel they're in the same application.

---

## Scope

**In scope:** `apps/web/app/(dashboard)/**` pages and their supporting components in `apps/web/components/**`.

**Out of scope:** Auth pages (`(auth)`), portal pages (`portal/`), standalone pages (`legal/`, `sms/`, `clinic-fit/`, `capture/`, `sign/`, `book/`, `api-docs/`), and any `ext_*` database schema files.

---

## Audit Findings — What's Broken

The codebase has a well-defined component system (shadcn/ui + Tailwind + `PageHeader`/`PageSectionHeader` + `EmptyState` + `formatCurrency` + `formatDateYmdToDisplay`) but **most pages bypass it** and hand-roll their own patterns. This creates the visual inconsistency the user reports across **five layers**:

---

### LAYER 1: Typography & Layout Components

#### 1.1 Page Headings — 3 heading levels, 4 sizes, 2 weights

The canonical `PageHeader` component (`apps/web/components/layout/page-header.tsx:29`) renders:
```
h1 → font-heading text-2xl font-bold tracking-tight sm:text-3xl
```

Only **7** of 20+ dashboard pages use it. The rest fall into:

| Group | Pages | What they do wrong |
|---|---|---|
| Raw h1 without `PageHeader` | wellness, vaccinations, automations, marketing/consents, marketing/website, statutory, statutory/kvepis, settings/ekasa | Missing `font-heading`, missing `sm:text-3xl`, some use `font-semibold` instead of `font-bold` |
| Raw h1 at wrong size | settings/import-v2 | Uses `text-3xl` instead of `text-2xl sm:text-3xl` |
| Raw h1 with `font-semibold` | lab-results, encounters/[appointmentId], records/replace-soap | Uses `font-semibold` instead of `font-bold` |
| **Wrong heading level (h2 as page title)** | clients, recalls, care-reminders, inbox, reports, inventory, controlled-substances | Uses `h2` at `text-xl font-semibold` — wrong semantic level AND different visual size |

#### 1.2 Section Headers — `PageSectionHeader` exists but is NEVER used

The component at `page-header.tsx:66` renders: `h2 → font-heading text-lg font-semibold text-foreground`. Zero import references. Instead, sections use at least **12** distinct visual styles:
- h2 at `text-xl font-semibold` (most common — contradicts component's `text-lg`)
- h2 at `text-2xl font-semibold`, `text-sm font-semibold`
- h3 at `text-lg`, `text-2xl`, `text-base`, `text-sm`
- h3 with `text-muted-foreground` (looks like body text)
- Bare `font-medium` or `font-semibold` with no size class

#### 1.3 Tables — Two incompatible header patterns

**Canonical pattern** (shadcn `TableHead` in `apps/web/components/ui/table.tsx`):
```
th → h-10 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80
td → p-3 text-sm
```

**Inline tables** use raw `<table>` with different padding (`px-4` vs `px-3`, `py-3` vs `p-3`):
- patients, billing, inventory

**Other pages** deviate further:
- `vaccinations/page.tsx:296` — `p-2.5 font-semibold` (no uppercase, no text-xs)
- `care-reminders/page.tsx` — `py-3 pr-4 font-medium` (no uppercase)
- `statutory/page.tsx` — `p-3` only
- Billing/inventory money columns — bare `font-medium` (drops uppercase + text-xs)

#### 1.4 Tabs — Four different visual styles, inconsistent sizing

| Style | Used by |
|---|---|
| shadcn `Tabs` (pill container) | inbox |
| Underline tabs (`border-b-2`) | billing, inventory |
| Pill tabs with separate container | encounters |
| Grid pill tabs | automations, agent/*, marketing/consents |

- `vaccinations/page.tsx:198` overrides `TabsTrigger` to `text-xs` — all others use `text-sm`
- Agent sub-pages use fixed `w-[280px]` while others use `max-w-md`
- Gap varies: `gap-1.5` vs `gap-2`

#### 1.5 CardTitle — 5 different size classes

Default: `font-heading text-lg font-semibold leading-tight tracking-tight`

Overrides found: `text-base font-semibold`, `text-sm font-semibold`, `text-base` (no semibold), `text-base font-semibold uppercase` (unique). CardHeader padding ranges from `pb-2` to `p-6` with 8+ distinct patterns including `border-sky-100` (chromatic border).

---

### LAYER 2: Status Badges & Clinical Indicators

#### 2.1 Three incompatible badge systems

| System | Component | Variants | Usage |
|---|---|---|---|
| A | `Badge` (`components/ui/badge.tsx`) | default, secondary, destructive, outline, success, warning, info | ~317 locations |
| B | `StatusPulseBadge` (`components/ui/status-pulse-badge.tsx`) | online, offline, confirmed, failed, pending, waiting, in_exam, finished, deceased, quarantine, rabies, urgent, neutral | 14 locations |
| C | `ClinicalStatusBadge` (`components/clinical/clinical-status-badge.tsx`) | ai_draft, administrative_draft, authorized | 5 locations |

#### 2.2 Same semantic status → different visual badge depending on page

| Domain | List/Hub Page | Detail/Workspace Page |
|---|---|---|
| Patient status | `Badge variant="success"/"secondary"/"warning"` (patients/page.tsx) | `StatusPulseBadge variant="online"/"offline"/"deceased"` (patients/[id]/page.tsx) |
| Appointment status | `StatusPulseBadge` colored (encounters/page.tsx) | `Badge variant="outline"` plain (encounters/[appointmentId]/page.tsx) |
| Clinical record | `ClinicalStatusBadge` (records/page.tsx) | Not displayed at all in encounter workspace |

#### 2.3 Hardcoded badge color overrides

Each domain invents its own color scheme via className overrides:
- Waiting room TV: `bg-emerald-600`, `bg-amber-600`, `bg-violet-600`
- Statutory panels: `bg-rose-50 text-rose-700 border-rose-300`
- Marketing review: `bg-amber-100 text-amber-800`
- AI settings: `bg-emerald-600 text-[10px]`
- eKasa receipt: `bg-emerald-600`

No centralized status color map exists.

---

### LAYER 3: Data Display & Formatting

#### 3.1 Date/time — 12h vs 24h drift, duplicated formatters

- **Schedule page** uses `toLocaleTimeString("en-US", { hour12: true })` → AM/PM format
- **Whiteboard** uses `hour12: true`
- **Waiting Room TV** correctly uses `hour12: false` (24h)
- **Recalls page** uses `toLocaleDateString("en-US")` while vaccination page uses `toLocaleDateString("sk-SK")`

The central utilities `formatDateYmdToDisplay`/`formatDateTimeLocalToDisplay` in `lib/date-display.ts` exist, but **duplicate local `formatDate`/`formatDateTime` functions** are defined inline in:
- `vaccinations/page.tsx:42`
- `statutory/page.tsx:66-79`
- `components/statutory/withdrawal-period-panel.tsx:32-48`

`date-fns` is **not used** anywhere in the app (0 imports).

#### 3.2 Currency — hardcoded € in e-Kasa dialog

`formatCurrency()` (`lib/locale/format.ts`) is the central formatter and is well-adopted. But e-Kasa receipt dialog bypasses it:
```
e-Kasa receipt: {Number(receipt.amountTotal).toFixed(2)} €  (manual hardcode)
```

#### 3.3 Phone numbers — no display formatting

Phone numbers are rendered as raw DB strings with no formatting utility:
- `clients/page.tsx`: `client.phone || "—"` (raw string)
- `patients/[id]`: `tel:` link with raw phone
- No `formatPhone()` or E.164-to-display normalization exists

#### 3.4 Prescriptions — inconsistent detail between list and patient snapshot

- `records/page.tsx`: Full table with Medication, Dosage, Frequency, Inventory, Status, Refills
- `patients/[id]/page.tsx`: **Only medication names**, no dose/frequency — `activePrescriptions.map(p => p.medicationName).join(", ")`

#### 3.5 Species/Breed — duplicated emoji+text pattern

No shared species badge component. The same inline emoji + text pattern is copy-pasted across patients list, patient detail, client detail, and schedule.

---

### LAYER 4: Modals, Dialogs & Confirmation UX

#### 4.1 Modal fragmentation

| Pattern | Count | Examples |
|---|---|---|
| shadcn `Dialog` | ✅ Most common | clinical-guardian-confirm, client-automations, wholesaler-import, brand-kit-tab, new-brief-modal |
| Hand-rolled `fixed inset-0 z-50` | 6 | whiteboard, schedule, ekasa-receipt-dialog, action-confirmation-dialog, clinical-diff-confirm-modal, welcome-provider |
| Radix `DialogPrimitive.*` directly | 1 | clinical-correction-control (bypasses shadcn wrapper) |

#### 4.2 `window.confirm()` — 19 locations

Used in: recalls, schedule, clients/[id], clients/[id]/edit, marketing/reviews, marketing/media, marketing/consents, admin (5 places), agent/voice/history-list, settings/services-tab, settings/messaging-tab, waiting-room-tv, sms-recovery-console (4 places)

`window.confirm()` is not accessible, not stylable, and not localizable.

#### 4.3 Dialog footer inconsistency

Three different footer patterns in shadcn Dialogs:
1. `justify-between` (destructive left, primary right) — clinical-guardian-confirm
2. `gap-2 sm:gap-0` right-aligned — client-automations, wholesaler-import
3. `pt-2 gap-2 sm:gap-0` right-aligned — new-brief-modal

---

### LAYER 5: Loading, Empty States & Navigation

#### 5.1 Empty states — 10 custom bypasses of `EmptyState`

The shared `EmptyState` component (`components/common/empty-state.tsx`) is used 91 times. But 10 custom empty states found:

| File | Issue |
|---|---|
| wellness/page.tsx:262 | `rounded-xl`, `bg-muted/20`, no `bg-card` |
| lab-results/page.tsx:443 | `p-10` instead of `p-8` |
| marketing/reviews/page.tsx:708 | `rounded-xl`, `p-12`, `bg-card/50` |
| marketing/handouts/page.tsx:347 | `rounded-2xl`, `p-12`, no icon |
| marketing/media/page.tsx:198 | `rounded-2xl`, `p-12` |
| encounters/[appointmentId] L4298,5218 | `p-4`, `rounded-md`, `<p>` not `<div>`, no icon |
| migration-archive/page.tsx:653 | `p-3`, no centering |
| marketing/website/page.tsx:722 | `p-12`, `rounded-xl`, `bg-muted/10` |
| agent/imaging/page.tsx:1068 | `border-2`, `rounded-xl` |

Marketing module is the primary offender; core clinical pages consistently use `EmptyState`.

#### 5.2 Loading skeletons — two competing `TableSkeleton` components

| Component | Path | Used by |
|---|---|---|
| `TableSkeleton` | `components/common/loading.tsx:24` | Patients, Clients, Billing |
| `TableSkeleton` | `components/ui/content-skeletons.tsx:8` | Records page |

Same name, different markup and styling. Dashboard home also defines local `KpiSkeleton()`/`ChartSkeleton()`/`AppointmentRowSkeleton()` functions instead of reusing shared ones.

#### 5.3 No breadcrumbs

Zero breadcrumb components exist. Navigation relies on:
- `TopBar` section label (shows only parent section, not sub-page title)
- Ad-hoc `ArrowLeft` back buttons on detail pages (6 pages each rolled independently)

The `TopBar` route label map has 27 entries but derives labels from `basePath` only — no sub-page awareness.

#### 5.4 Primary action button sizes — inconsistent

| Page | Button | Size |
|---|---|---|
| Top bar | "New" dropdown | `size="sm"` |
| Patients list | "New Patient" | `size="default"` + custom `h-11 sm:h-10` |
| Encounters hub | "New Appointment" | `size="sm"` |
| Schedule | "New Appointment" | `size="sm"` |
| Billing | "New Invoice" | `size="default"` |
| Encounter workspace | "Check in" / "Start exam" | `size="default"` |

Icon-text spacing varies: `mr-1` (4px), `mr-2` (8px), `gap-1` (4px), `gap-1.5` (6px).

---

## Rules for Consolidation

### Rule 1: Use `PageHeader` for every page-level heading

Every dashboard page MUST render its top-level heading via `<PageHeader title={...} />`.

- Replace all raw `<h1>` and page-level `<h2>` with `PageHeader`.
- No icon by default. Icons on page headers allowed only as functional affordances (filter icon in actions slot), not decoration.

### Rule 2: Use `PageSectionHeader` for section headings

Replace all hand-rolled section `<h2>` / `<h3>` with `<PageSectionHeader title={...} />` (renders `h2 → font-heading text-lg font-semibold`).

- Sub-sections below a `PageSectionHeader`: use `<h3 className="font-heading text-base font-semibold">`.

### Rule 3: Use the shadcn `Table` component for all data tables

Replace raw `<table>` markup with shadcn `<Table>`, `<TableHeader>`, `<TableHead>`, `<TableBody>`, `<TableRow>`, `<TableCell>`.

- Numeric columns: `<TableHead className="text-right">` / `<TableCell className="text-right">` — no font-size/weight override.
- Wrap in `<TableScroll>` where horizontal scroll is needed.

### Rule 4: Use the shadcn `Tabs` component for all tab bars

Replace all custom underline, pill, and grid tab implementations with shadcn `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>`.

- **Never override `TabsTrigger` text size** — always default `text-sm`.
- Width: `max-w-md` where constrained. No fixed `w-[280px]`.
- Full-width: `w-full grid grid-cols-N`.
- Icon gap: always `gap-1.5`.

### Rule 5: CardTitle / CardHeader — restricted override set

- Default `CardTitle`: `font-heading text-lg font-semibold` — use as-is.
- **Only allowed override:** `text-base font-semibold` for compact cards (AI sub-panels, dense clinical forms).
- **Forbidden:** `text-sm`, `uppercase`, removing `font-semibold`/`font-heading`.
- `CardHeader` padding: default `p-6` or `pb-3`. No `pb-2`, `pb-4`. No chromatic borders (no `border-sky-100`).

### Rule 6: Typography scale

| Semantic Level | Element | Classes |
|---|---|---|
| Page title | h1 (`PageHeader`) | `font-heading text-2xl font-bold tracking-tight sm:text-3xl` |
| Section title | h2 (`PageSectionHeader`) | `font-heading text-lg font-semibold` |
| Sub-section | h3 | `font-heading text-base font-semibold` |
| Card title | h3 (`CardTitle`) | `font-heading text-lg font-semibold leading-tight tracking-tight` |
| Compact card title | h3 | `font-heading text-base font-semibold leading-tight tracking-tight` |
| Body text | p / span | `text-sm` (default), `text-base` for emphasis |
| Table header | th (`TableHead`) | `text-xs font-semibold uppercase tracking-wide text-muted-foreground/80` |
| Table cell | td (`TableCell`) | `text-sm` |
| Small/label | span | `text-xs text-muted-foreground` |

**Never use** `font-bold` below h1 level. `font-semibold` is the maximum weight for h2–h6.

### Rule 7: Status badges — use `StatusPulseBadge` for all live entity status

- Patient status → `StatusPulseBadge` on ALL pages (replace `Badge` in patients list).
- Appointment status → `StatusPulseBadge` on ALL pages (replace plain `Badge` in encounter workspace).
- Clinical record status → `ClinicalStatusBadge` on ALL pages including encounter workspace.
- Do NOT hardcode color classes on `Badge` (no `bg-emerald-600`, `bg-rose-50`, `bg-amber-100`, etc.). Use the built-in variants or extend them via the component's CVA, not via className override.

### Rule 8: Use the shared `EmptyState` component

All empty states MUST use `<EmptyState icon={...} title={...} description={...} />`. No hand-rolled `border border-dashed` divs.

### Rule 9: Use shadcn `Dialog` for all modals

Replace all hand-rolled `fixed inset-0 z-50` modals (whiteboard, schedule, ekasa-receipt-dialog, action-confirmation-dialog, clinical-diff-confirm-modal, welcome-provider) with shadcn `Dialog`.

- Dialog footer: standardize on `<DialogFooter className="gap-2 sm:gap-0">` (right-aligned). For destructive+primary split, use `sm:justify-between`.

### Rule 10: Replace all `window.confirm()` with `ActionConfirmationDialog`

All 19 `window.confirm()` calls → use `ActionConfirmationDialog` component (`components/common/action-confirmation-dialog.tsx`). The component supports title, description, confirm/cancel labels, confirmVariant, and optional reason textarea.

### Rule 11: Unify date/time formatting

- Delete all local `formatDate`/`formatDateTime` functions copy-pasted in page/component files.
- Use `formatDateYmdToDisplay` and `formatDateTimeLocalToDisplay` from `lib/date-display.ts` for all date display.
- Change schedule and whiteboard time display from `hour12: true` (`en-US`) to `hour12: false` — Slovak clinic uses 24h.
- Change all `toLocaleDateString("en-US")` calls to `toLocaleDateString("sk-SK")` or use the central formatters.
- The schedule uses a local `useDebounce` hook — extract to `lib/hooks/use-debounce.ts` and import from there.

### Rule 12: Use `formatCurrency` everywhere — no manual `€` concatenation

e-Kasa receipt dialog and thermal receipt drawer must use `formatCurrency()` instead of `toFixed(2) + " €"`.

### Rule 13: Unify prescription display

Patient detail page MUST show the same dose/frequency information as the records page. Create a `<PrescriptionSummary>` component that renders medication name + dose + frequency + status badge, and use it in both places.

### Rule 14: Unify species/breed display

Create a `<SpeciesBadge>` component (emoji + localized species name + optional breed) and use it in patients list, patient detail, client detail, and schedule. Remove the copy-pasted inline patterns.

### Rule 15: Unify primary action button sizes

All page-level primary CTA buttons ("New X") use `size="default"`. All toolbar/header CTAs use `size="sm"`. Icon-text gap: always `gap-1.5`.

### Rule 16: Unify loading skeletons

Consolidate the two `TableSkeleton` implementations into one canonical version in `components/common/loading.tsx`. Move dashboard-local `KpiSkeleton`/`ChartSkeleton` there too. Delete the duplicate in `components/ui/content-skeletons.tsx` and update all imports.

### Rule 17: Permitted exceptions

- **Settings page** — vertical sidebar navigation instead of horizontal tabs (standard UX pattern).
- **Dashboard/widgets** — KPI cards may use `font-heading text-2xl font-semibold` for metric numbers.
- **Dialog titles** — use `DialogHeader` / `DialogTitle` (own sizing, not in scope here).
- **Encounter detail page** — dense clinical form layout may use compact card titles (`text-base font-semibold`).
- **Marketing sub-pages** — may use `PageHeader` with subtitle.

---

## Execution Order

1. **Foundation** — Unify `formatDate`/`formatTime`/`formatCurrency` formatters (Rules 11, 12). Centralize useDebounce.
2. **`PageHeader` + `PageSectionHeader`** — Adopt across all pages (Rules 1, 2).
3. **Table + Tab migration** — shadcn components (Rules 3, 4).
4. **CardTitle / CardHeader cleanup** — Remove forbidden overrides (Rule 5).
5. **Status badges** — Unify onto `StatusPulseBadge` + `ClinicalStatusBadge` (Rule 7).
6. **Empty states + Loading** — Adopt `EmptyState`, unify skeletons (Rules 8, 16).
7. **Modals + Confirmations** — shadcn `Dialog` + `ActionConfirmationDialog` (Rules 9, 10).
8. **Data display** — `SpeciesBadge`, `PrescriptionSummary`, phone formatter, primary button sizes (Rules 13, 14, 15).
9. **Final sweep** — Search for remaining `text-2xl`, `text-xl`, `font-bold`, `uppercase`, `hour12: true`, `window.confirm`, `toLocaleDateString("en-US")`, hardcoded `€`, raw `<table>`, raw `<h1>`/`<h2>`, chromatic utility classes.

After each phase: `pnpm typecheck && pnpm lint`. Spot-check 3–4 pages with `pnpm dev`.

---

## File Reference

| Component | Path |
|---|---|
| `PageHeader` + `PageSectionHeader` | `apps/web/components/layout/page-header.tsx` |
| `Table`, `TableHead`, `TableCell` | `apps/web/components/ui/table.tsx` |
| `Tabs`, `TabsList`, `TabsTrigger` | `apps/web/components/ui/tabs.tsx` |
| `Card`, `CardHeader`, `CardTitle` | `apps/web/components/ui/card.tsx` |
| `Badge` | `apps/web/components/ui/badge.tsx` |
| `StatusPulseBadge` | `apps/web/components/ui/status-pulse-badge.tsx` |
| `ClinicalStatusBadge` | `apps/web/components/clinical/clinical-status-badge.tsx` |
| `EmptyState` | `apps/web/components/common/empty-state.tsx` |
| `ActionConfirmationDialog` | `apps/web/components/common/action-confirmation-dialog.tsx` |
| `Dialog` | `apps/web/components/ui/dialog.tsx` |
| `TableScroll` | `apps/web/components/common/table-scroll.tsx` |
| `TableSkeleton`, `PageLoading` | `apps/web/components/common/loading.tsx` |
| Skeleton components | `apps/web/components/ui/skeleton.tsx`, `apps/web/components/ui/content-skeletons.tsx` |
| Date formatters | `apps/web/lib/date-display.ts`, `apps/web/lib/date-input.ts` |
| Currency formatter | `apps/web/lib/locale/format.ts` |
| Tailwind config | `apps/web/tailwind.config.ts` + `packages/config/tailwind.config.ts` |
| CSS tokens | `apps/web/styles/globals.css` |
| `cn()` utility | `apps/web/lib/utils.ts` |

---

## Constraints

- **Do not change any `ext_*` schema files.**
- **Do not modify shadcn primitive components** (`components/ui/*.tsx`) unless adding a variant to an existing CVA config — change pages that consume them.
- **Do not add new npm dependencies.**
- **Preserve all i18n keys and `useI18n()` calls** — only change element structure and Tailwind classes.
- **Do not alter business logic, tRPC router calls, or data-fetching hooks.**
- **Keep the monochrome Vercel-style aesthetic** — no chromatic utility classes (`emerald-*`, `sky-*`, `amber-*`, `rose-*`, `violet-*`). All color must come from CSS custom properties or built-in component variants.