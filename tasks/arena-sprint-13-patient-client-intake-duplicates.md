# Arena Sprint 13: Patient & Client Intake + Duplicate Resolution `/patients/new`, `/clients/new`, `/patients/duplicates`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in client onboarding, patient registration, and chart deduplication:
> `apps/web/app/(dashboard)/patients/new/page.tsx` (~535 lines), `apps/web/app/(dashboard)/clients/new/page.tsx` (~515 lines),
> and `apps/web/app/(dashboard)/patients/duplicates/page.tsx` (~568 lines).
> This is a **presentation, data integrity, and UI Kit harmonization sprint**.
> Do not alter deduplication rules, UUID assignment, or cryptographic operation tokens.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Touches strictly `patients/new/page.tsx`, `clients/new/page.tsx`, and `patients/duplicates/page.tsx`.
> Does not touch `patients/page.tsx`, `clients/page.tsx`, `patients/[id]/page.tsx`, or `clients/[id]/page.tsx`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/client-patient-form-ui.test.ts`.
3. Read `apps/web/lib/__tests__/patient-duplicates-ui.test.ts` in full.
4. Facts verified in the repo:
   - `patients/new/page.tsx` and `clients/new/page.tsx` have strict role-gate assertions pinned in `client-patient-form-ui.test.ts` (`canManageClientFormRole`, `canManagePatientFormRole`, `Checking client access...`, `Client actions are read-only`).
   - `patients/duplicates/page.tsx` is pinned in `patient-duplicates-ui.test.ts` (`isAdmin`, `enabled: isAdmin`, `const MERGE_CONFIRMATION = "MERGE"`, `operationId.current ??= crypto.randomUUID()`, etc.).
   - All three pages lack `pageShellClass` and standard `PageToolbar` / `DataTableFrame` structures.
5. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/client-patient-form-ui.test.ts lib/__tests__/patient-duplicates-ui.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Exact Source-Contract Literals from `client-patient-form-ui.test.ts` (Keep Verbatim):**
  - `function canManageClientFormRole`
  - `if (!canManageClientFormRole(session?.user?.role))`
  - `Checking client access...`
  - `Client actions are read-only`
  - `return <NewClientForm firstClinicDay={firstClinicDay} />`
  - `function canManagePatientFormRole`
  - `if (!canManagePatientFormRole(session?.user?.role))`
  - `Checking patient access...`
  - `Patient actions are read-only`
  - `<NewPatientForm />`
- **Exact Source-Contract Literals from `patient-duplicates-ui.test.ts` (Keep Verbatim):**
  - `const isAdmin = session?.user?.role === "admin"`
  - `enabled: isAdmin`
  - `Only practice administrators can review or merge duplicate patient`
  - `trpc.patients.previewMerge.useQuery`
  - `preview.data?.allowed === true`
  - `MERGE_REASON_MIN_LENGTH`
  - `MERGE_REASON_MAX_LENGTH`
  - `const MERGE_CONFIRMATION = "MERGE"`
  - `operationId.current ??= crypto.randomUUID()`
  - `operationId: operationId.current`
  - `disabled={!canMerge}`
  - `Microchip`
  - `External ID`
  - `Prospective work`
  - Matching text for merge warnings and blockers.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Review phone number formatting: Slovak national numbers (`+421 9xx xxx xxx`) vs international standard.
   - Review microchip input validation: 15 numeric digits (ISO 11784/11785), checking for spaces or dashes.
   - Review merge preview confirmation modal in `patients/duplicates`.
2. **Phase 2: Audit & Findings**
   - Audit form validation states: verify clear inline error messages when required fields are missing before submission.
   - Audit race conditions in submission: ensure submit buttons show disabled state + spinner during mutation to prevent double-submit duplicates.
   - Audit mobile responsiveness on intake forms: two-column grids must collapse cleanly to single-column on `< 768px`.
3. **Phase 3: Fix Bugs & Hardening**
   - Prevent accidental submission on Enter in multi-field intake forms.
   - Clean microchip input string (strip leading/trailing whitespace and hyphens).
   - In `patients/duplicates`, prevent modal closure or state reset while merge mutation is executing.
4. **Phase 4: UI Kit Harmonization**
   - Wrap forms and duplicate review tables in `pageShellClass`.
   - Wrap candidates table in `DataTableFrame`.
   - Harmonize headers using `PageHeader` and `PageSectionHeader`.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. `/clients/new/page.tsx`
- Preserve role guard and `NewClientForm firstClinicDay={firstClinicDay}`.
- Harmonize outer layout with `pageShellClass`.
- Ensure all form fields use standard design system input styles with clear focus rings.

### 3B. `/patients/new/page.tsx`
- Preserve role guard and `<NewPatientForm />`.
- Harmonize outer layout with `pageShellClass`.
- Ensure species/breed selector and microchip input have accessible labels.

### 3C. `/patients/duplicates/page.tsx`
- Preserve administrator gate and cryptographic operation ID.
- Wrap duplicate review candidate comparisons in `DataTableFrame`.
- Ensure merge confirmation input requires typing `"MERGE"` and minimum reason length.

---

## 4. Tests

Create `apps/web/lib/__tests__/patient-intake-duplicates-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `patients/duplicates/page.tsx`.
- Existing pinning tests in `client-patient-form-ui.test.ts` and `patient-duplicates-ui.test.ts` remain 100% green.

---

## 5. i18n

- Ensure all Slovak and English intake strings, validation messages, and merge warnings are leaf-symmetric.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/client-patient-form-ui.test.ts lib/__tests__/patient-duplicates-ui.test.ts lib/__tests__/patient-intake-duplicates-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] All client and patient form role gates preserved.
- [ ] Duplicate review security and confirmation literals untouched.
- [ ] Forms and review lists harmonized with `pageShellClass` and `DataTableFrame`.
- [ ] Double-submission race condition prevented with loading state.
- [ ] 100% symmetric i18n keys.
- [ ] All verification tests pass.
