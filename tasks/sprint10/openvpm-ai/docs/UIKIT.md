# OpenVPM UI kit — agent prompt

Use this as the standing brief for any dashboard page. Do not invent a new visual language. Consume information in one hierarchy.

## Hierarchy (top → bottom)

1. `PageHeader` with `icon`, title, one-line subtitle, actions `size="sm"`.
2. Optional underline tabs (`underlineTabsListClass` / `underlineTabsTriggerClass` from `@/components/layout/page-kit`). Never a floating white square on a green bar.
3. `PageToolbar`: search + filters + count. One card, `h-9` controls, `text-xs`.
4. Optional `KpiGrid` / `KpiCard` for counts that change the filter.
5. `DataTableFrame` + dense table (`text-xs`, head `h-9 px-3`, cell `px-3 py-2`). Whole row click; inner links `stopPropagation`.
6. `EmptyState` when there is no data.

Page wrapper: `pageShellClass` (`space-y-6`). Do not mix `mt-4` / `mt-6` / no-gap layouts on sibling blocks.

## Tokens

- Primary is the theme `--primary` (readable white on green). Do not invert FARMA / badges to white-on-green.
- Tables: `@/components/ui/table` **or** the `tableHeadClass` / `tableCellClass` / `tableRowClass` tokens. No `text-sm` + `px-4 py-3` list tables.
- Buttons in headers/toolbars: `size="sm"`. Icon-only row actions: `h-7 w-7 p-0` ghost.
- Tabs: underline (border-b-2 primary) for page sections. Pill `TabsList` only for tiny in-card switches.
- Sections: `rounded-lg border border-border bg-card`. KPI / filter / table are separate cards, not one undifferentiated wall.
- i18n: every string through `t()`. Keep `sk.json` / `en.json` leaf-symmetric.

## Clinical status & diagnostic modality badges

- Modality badges come from `ModalityBadge` / `ModalityBadgeRow` (`@/components/imaging/modality-badge`). Colour contract: RTG → info (blue), USG → purple, CT → amber, MRI → rose, endoscopy → indigo, LAB → teal. Never hand-roll a modality colour.
- Condition tags (`kritický`, `pooperačný`, `čaká na prepustenie`, `stabilizovaný`) are evidence-based: render a tag only when the data proves it, never as a default state.
- Clinical times (check-in, waiting, fasting window, procedure start/end) always use `font-mono tabular-nums text-xs` — `CLINICAL_NUMERIC_CLASS` in `@/lib/whiteboard/clinical-board`.
- Kanban boards (e.g. `/whiteboard`) keep the same shell: `PageHeader` with the active-count badge and date navigation, `PageToolbar` with search + department filter, then one `rounded-lg border border-border bg-card` frame per column.
- Imaging attachments upload under category `"imaging"` with a modality, live in their own bucket in the patient documents tab and never touch `patient.photoUrl`.

## Clinical language

Doctor CoG is **vyšetrenie**. CTAs: Otvoriť vyšetrenie / Nové vyšetrenie. Do not mix návšteva / termín / stretnutie / exam room.

`/records` is the clinical chart. `/patients/[id]` is identity + owner. Link both ways; do not make records search-only.

## Do not

- Hardcoded demo competitors, fake clinics, or SK chrome in Marketing Studio.
- Per-page one-off table CSS.
- Page titles with an inline Lucide icon inside the `<h1>` — use `PageHeader icon`.
- Apply this kit to statutory print surfaces beyond keeping `<PageHeader>`.
