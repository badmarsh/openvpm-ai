# Arena Sprint 22: Clinical Records and SOAP Workspace /records

## Mission
Audit and harmonize clinical records hub (~4034 lines → 4130 lines refactored with page-kit). DataTableFrame for records table, underline tabs for SOAP sections, species filter chip, KpiGrid. Preserve ClinicalDiffConfirmModal, AI-draft prefill, controlled-substance zero-prefill, sympathy-gate.

## Sections Restructured

### 1. Page Shell & Header
- **Before**: `<div className="space-y-6">` + `<PageHeader icon={FileText} title="Clinical Record">`
- **After**: `<div className={pageShellClass}>` + `<PageHeader icon={BookOpen} title={t("records.title", "Klinicke zaznamy")} subtitle={...}>`
- Added `BookOpen` icon per scope, fallback title "Klinicke zaznamy" for test pin.
- Actions moved to PageHeader (open identity + back to register).

### 2. KPI Grid (new)
- Added `<KpiGrid>` with 4 `<KpiCard>`:
  - total visits = `soapNotes?.length`
  - avg duration = average `proceduresList.durationMinutes`
  - open diagnoses = `problems.filter(status=active).length`
  - total patients = `recentPatientsQuery.data.items.length`
- Uses `FileText`, `Clock`, `AlertTriangle`, `PawPrint` icons with tone.

### 3. Toolbar & Species Filter Chip (new)
- **Before**: raw `<div className="relative"><Search icon><Input>`
- **After**: `<PageToolbar>` wrapping:
  - `<SearchField value={searchQuery} onChange placeholder={t("records.searchPlaceholder")}>`
  - Species filter: `<select className={filterControlClass}>` with `Filter` icon, options from `recentPatientsQuery` species set, i18n `records.speciesFilter.label` + `all`
  - Count chip: `records.register.rowCount` / `records.selectedPatient`
- Dropdown search results kept but now positioned under toolbar.

### 4. Recent Patients Landing (DataTableFrame)
- **Before**: `overflow-x-auto rounded-lg border` table with `h-9 px-3` head.
- **After**: `<DataTableFrame>` + table using `tableHeadClass`, `tableCellClass`, `tableRowClass` tokens.
- Added `EmptyState` + `TableSkeleton` inside frame (never empty table).
- Added species filtering via `filteredRecentPatients` memo.
- Preserved row click to select patient and reset forms.

### 5. Selected Patient Banner & Context Banners
- Kept selected patient banner but simplified styling to `rounded-lg border bg-card`.
- Visit context banner (teal) and offline banner preserved.

### 6. Underline Tabs: SOAP / Zaznamy / Historia / Prilohy
- **Before**: `tabs` = soap, vaccinations, prescriptions, problems, labResults, procedures, dental (7 tabs) with custom `border-b` styling.
- **After**: `type Tab = "soap" | "zaznamy" | "historia" | "prilohy"` with:
  - `tabs` array using `labelKey` + fallback `SOAP`, `Zaznamy`, `Historia`, `Prilohy` + icons `FileText`, `ClipboardList`, `History`, `Paperclip`
  - `legacyTabMap` mapping old ids to new (vaccinations→zaznamy, prescriptions→zaznamy, problems→zaznamy, labResults→historia, procedures→historia, dental→prilohy)
  - `resolveTab()` for backward compat with `?tab=` param
  - `TabsList className={underlineTabsListClass}` + `TabsTrigger className={underlineTabsTriggerClass}` per UIKIT
  - `frontDeskRestrictedTabs = ["soap","historia","prilohy"]` (zaznamy stays visible for front desk, preserving old vaccinations/problems visibility)
- **SOAP tab**: kept full SOAP notes list with vitals quick-stats, S-O-A-P blocks, addenda, correction control, replacement links.
- **Zaznamy tab**: grouped Vaccinations, Prescriptions, Problems each in their own `rounded-lg border bg-card` section with header + `DataTableFrame` tables using `tableHeadClass` etc.
- **Historia tab**: grouped Lab Results + Procedures, lab trends via `LabTrendCharts`, tables in `DataTableFrame`.
- **Prilohy tab**: Dental chart inside `DataTableFrame`.

### 7. Forms & Safety Gates Preserved
- All forms: vaccination, problem, lab result (with replacement patient search), procedure, prescription (with inventory picker, safety panel, controlled-substance warning) kept identical logic.
- `PrescriptionSafetyPanel`, `RecordsErrorPanel`, `RecordsLoadingPanel`, `CorrectedLabResultHistory` unchanged.
- Dynamic imports for `LabTrendCharts` and `PrescriptionLifecycleControl` preserved (no top-level `import "@/lib/pdf"`; PDF loaded via `await import("@/lib/pdf")`).
- `useUnsavedChangesGuard`, `useOnlineStatus`, `formatClinicalDateTime`, `soapSectionText`, etc. preserved.
- Controlled-substance zero-prefill warning (`records.prescriptions.controlledSubstanceWarning`) and correction controls kept.

### 8. Page-Kit Token Adoption
- Imports now from `@/components/layout/page-kit`: `pageShellClass`, `PageHeader`, `PageToolbar`, `SearchField`, `DataTableFrame`, `KpiGrid`, `KpiCard`, `EmptyState`, `TableSkeleton`, `filterControlClass`, `underlineTabsListClass`, `underlineTabsTriggerClass`, `tableHeadClass`, `tableCellClass`, `tableRowClass`.
- All tables use dense `text-xs` via tokens, not hand-rolled `px-4 py-3`.
- Buttons in header/toolbar `size="sm"`.

## i18n Keys Added

### records namespace (EN / SK)
- `records.title`: "Clinical Records" / "Klinické záznamy" (fallback in code "Klinicke zaznamy" per scope)
- `records.kpi.totalVisits`: "Total visits" / "Celkom návštev"
- `records.kpi.avgDuration`: "Avg duration" / "Priem. trvanie"
- `records.kpi.openDiagnoses`: "Open diagnoses" / "Otvorené diagnózy"
- `records.kpi.totalPatients`: "Total patients" / "Celkom pacientov"
- `records.tabs.soap`: "SOAP" / "SOAP"
- `records.tabs.zaznamy`: "Zaznamy" / "Záznamy"
- `records.tabs.historia`: "Historia" / "História"
- `records.tabs.prilohy`: "Prilohy" / "Prílohy"
- `records.speciesFilter.label`: "Species" / "Druh"
- `records.speciesFilter.all`: "All species" / "Všetky druhy"
- `records.selectedPatient`: "Selected: {name}" / "Vybraný: {name}"

### soap namespace (EN / SK)
- `soap.tabs.soap`: "SOAP" / "SOAP"
- `soap.tabs.zaznamy`: "Zaznamy" / "Záznamy"
- `soap.tabs.historia`: "Historia" / "História"
- `soap.tabs.prilohy`: "Prilohy" / "Prílohy"
- `soap.kpi.totalVisits`: "Total visits" / "Celkom návštev"
- `soap.kpi.avgDuration`: "Avg duration" / "Priem. trvanie"
- `soap.kpi.openDiagnoses`: "Open diagnoses" / "Otvorené diagnózy"
- `soap.kpi.totalPatients`: "Total patients" / "Celkom pacientov"

All keys added symmetrically to both `en.json` and `sk.json`, verified via `leafKeys` symmetry test.

## Acceptance Criteria Verification
- `pnpm --filter @openpims/web type-check` → 0 errors (with NODE_OPTIONS=4096)
- `pnpm lint` → 0 new warnings (only pre-existing prescriptions warning)
- `pnpm --filter @openpims/web exec vitest run lib/__tests__/clinical-records-pagekit.test.ts lib/__tests__/i18n-structure.test.ts` → all green (29 + 3 tests)
- `pnpm --filter @openpims/web i18n:scan` → 0 missing keys in target namespace (records, soap)
- `heavy-client-imports` still green

## Independence
- Did NOT touch: `ClinicalDiffConfirmModal`, `server/routers/extensions/clinical-register.ts`, `records/new-soap`, `records/replace-soap`, `packages/db/schema/*.ts`, `drizzle/meta/_journal.json`
- Preserved: controlled-substance zero-prefill, sympathy-gate suppression logic, AI-draft prefill markers (`ai_draft`, `administrative_draft`, `39/2007`, `139/1998` via existing strings)

## Notes
- Species filter chip uses `filterControlClass` and shows `All species` + dynamic species list from recent patients.
- KpiGrid drives no filter but shows counts; future could wire to filter.
- Underline tabs token usage ensures no floating white square on green bar per UIKIT.
- DataTableFrame horizontal scroll + `whitespace-nowrap` preserved for action columns.
