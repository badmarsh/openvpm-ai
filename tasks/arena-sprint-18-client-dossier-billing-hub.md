# Arena Sprint 18: Client Profile & Patient Dossier Detail Hub `/clients/[id]`, `/clients/[id]/edit`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in client 360° overview, communication history, patient list, and billing records:
> `apps/web/app/(dashboard)/clients/[id]/page.tsx` (~897 lines) and `apps/web/app/(dashboard)/clients/[id]/edit/page.tsx` (~645 lines).
> This is a **presentation, communication reliability, and UI Kit harmonization sprint**.
> Do not alter tenant isolation, auth scopes, or communication logging queries.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned tests in `client-detail-communication-log-ui.test.ts` green.

> **Independence:**
> Touches strictly `clients/[id]/page.tsx` and `clients/[id]/edit/page.tsx`.
> Does not touch `clients/page.tsx` or `patients/[id]/page.tsx`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/client-detail-communication-log-ui.test.ts`.
3. Facts verified in the repo:
   - `clients/[id]/page.tsx` has strict pinning in `client-detail-communication-log-ui.test.ts` (`ClientDetailLoadingPanel`, `if (error || !client)`, `CommunicationLogPanel`, `trpc.communications.getByClient.useQuery`, error-before-loading-before-empty order).
   - `clients/[id]/edit/page.tsx` is pinned in `client-patient-form-ui.test.ts` (`canManageClientFormRole`, `Checking client access...`, `Client actions are read-only`, `return <EditClientForm />`).
   - The page currently lacks `pageShellClass`, `PageToolbar`, and standard `DataTableFrame` structures.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/client-detail-communication-log-ui.test.ts lib/__tests__/client-patient-form-ui.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Exact Source-Contract Literals from `client-detail-communication-log-ui.test.ts` (Keep Verbatim):**
  - `import { EmptyState } from "@/components/common/empty-state"`
  - `AlertCircle`
  - `function ClientDetailLoadingPanel`
  - `return <ClientDetailLoadingPanel />`
  - `if (error || !client)`
  - `router.push("/clients")`
  - `CommunicationLogPanel`
  - `trpc.communications.getByClient.useQuery`
  - `trpc.communications.settings.useQuery`
  - `import { communicationStatusLabel } from "@/lib/communications/status"`
  - `const statusLabel = communicationStatusLabel(message)`
  - `{ clientId }`
  - `const communicationLogError = error ?? settingsError`
  - `const isCommunicationLogLoading = isLoading || settingsLoading`
  - `const communicationSettingsMissing =`
  - `const communicationsMissing =`
  - `const communicationLogMissing =`
  - `{communicationLogError || communicationLogMissing ? (`
  - `Unable to load communication log. Please retry.`
  - `) : isCommunicationLogLoading ? (`
  - "Messages, calls, and portal requests linked to this client will appear here."
- **Exact Source-Contract Literals from `client-patient-form-ui.test.ts` (Keep Verbatim):**
  - `function canManageClientFormRole`
  - `if (!canManageClientFormRole(session?.user?.role))`
  - `Checking client access...`
  - `Client actions are read-only`
  - `return <EditClientForm />`

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace client details: contact info → registered pets list → billing invoice ledger → communication history panel.
2. **Phase 2: Audit & Findings**
   - Audit outstanding balance display: verify that unpaid invoice sums use `useCurrencyFormatter` and do not produce NaN when invoices are empty.
   - Audit client-patient relationship: ensure owners with zero patients display an action button to "Pridať prvého pacienta" linking to `/patients/new?clientId=...`.
   - Audit tab/section layout: verify responsive behavior when viewing long communication transcripts on mobile viewports.
3. **Phase 3: Fix Bugs & Hardening**
   - Ensure the error state precedes the loading state, and the loading state precedes the empty state (as required by the pinning test).
   - In `clients/[id]/edit`, ensure form dirty state prevents accidental navigation.
   - Handle long email addresses and phone numbers with clean truncation / word break.
4. **Phase 4: UI Kit Harmonization**
   - Apply `pageShellClass` to the outer wrapper.
   - Wrap patient lists and invoice summaries in `DataTableFrame`.
   - Harmonize summary metric cards using `KpiGrid` and `KpiCard`.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. Layout & Header
- Apply `pageShellClass` to the outer wrapper.
- Retain canonical `PageHeader` with client name, badge, and actions (Edit Client, Add Patient, Create Invoice).
- Use `KpiGrid` and `KpiCard` for client metrics (Total Pets, Open Balance, Last Visit, Consent Status).

### 3B. Associated Patients & Invoices
- Wrap the client's animal roster in `DataTableFrame`.
- Wrap the client's invoice ledger in `DataTableFrame`.
- Retain `CommunicationLogPanel` with its exact error-loading-empty state sequence.

---

## 4. Tests

Create `apps/web/lib/__tests__/client-detail-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `clients/[id]/page.tsx`.
- All assertions in `client-detail-communication-log-ui.test.ts` remain 100% green.

---

## 5. i18n

- Ensure all client profile labels, balance badges, and communication tooltips exist symmetrically in `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/client-detail-communication-log-ui.test.ts lib/__tests__/client-patient-form-ui.test.ts lib/__tests__/client-detail-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] All communication log sequence assertions preserved verbatim.
- [ ] Role gate in `clients/[id]/edit` untouched.
- [ ] `pageShellClass`, `KpiGrid`, and `DataTableFrame` adopted.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check passes with 0 errors.
