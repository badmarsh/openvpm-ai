# Arena Sprint 20: Practice Hardware Settings & Diagnostics Hub `/settings/ekasa`, `/settings/ai`, `/settings/simulation`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in practice configuration for fiscal e-Kasa registers, AI provider fallback keys, and clinical workflow simulations:
> `apps/web/app/(dashboard)/settings/ekasa/page.tsx` (~324 lines), `apps/web/app/(dashboard)/settings/ai/page.tsx` (~35 lines),
> and `apps/web/app/(dashboard)/settings/simulation/page.tsx` (~55 lines).
> This is a **presentation, configuration safety, and UI Kit harmonization sprint**.
> Do not alter credential encryption at rest, fiscal PKCS#12 verification algorithms, or simulation state machine logic.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned settings tests green.

> **Independence:**
> Touches strictly `settings/ekasa/page.tsx`, `settings/ai/page.tsx`, and `settings/simulation/page.tsx`.
> Does not touch `settings/page.tsx` or `server/routers/extensions/ekasa.ts`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/settings-ui-states.test.ts`.
3. Facts verified in the repo:
   - `settings/ekasa/page.tsx` currently has hardcoded Slovak strings in `COMPLIANCE_ITEMS` without `t()`.
   - `settings/ekasa/page.tsx`, `settings/ai/page.tsx`, and `settings/simulation/page.tsx` lack `pageShellClass`.
   - Settings pages must not expose decrypted API keys or passwords in client logs or inspectable JSX props.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/settings-ui-states.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Security & Encryption Rules (AGENTS.md §1):**
  - Encrypted fields (`gemini_api_key_encrypted`, e-Kasa client certificate) must remain encrypted at rest.
  - Form fields for API keys must use password-masked inputs (`type="password"`) with optional reveal toggles.
- **Back Navigation:**
  - Back links (`href="/settings"`) must remain functional and prominent.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace fiscal e-Kasa settings: DIČ, IČ DPH, Cash register ID (FR SR), API endpoint URL, client PKCS#12 certificate upload status.
   - Trace AI settings and simulation tabs.
2. **Phase 2: Audit & Findings**
   - Audit compliance checklist: verify that required fiscal items (DIČ, Register ID, API URL) display green/amber check indicators based on real configuration state.
   - Audit form state: verify that form submit triggers a loading spinner and success notification without unmounting input fields.
   - Audit empty/missing settings: ensure clean fallback defaults when opening the settings form on a fresh installation.
3. **Phase 3: Fix Bugs & Hardening**
   - Ensure timeout during e-Kasa connection test does not lock the UI in an infinite loading state.
   - Localize all items in `COMPLIANCE_ITEMS` through `useI18n()`.
   - In `settings/simulation`, ensure the external link (`/simulation.html`) retains `rel="noopener noreferrer"`.
4. **Phase 4: UI Kit Harmonization**
   - Apply `pageShellClass` to the outer wrapper of all three pages.
   - Harmonize card borders, badges, and toggle switches with standard UI Kit tokens.
   - Harmonize headers using `PageHeader`.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. `/settings/ekasa/page.tsx`
- Replace raw layout wrapper with `pageShellClass`.
- Retain canonical `PageHeader` with title and subtitle.
- Map all `COMPLIANCE_ITEMS` keys and descriptions through `t(...)`.
- Use standard card styles for compliance status and configuration form.

### 3B. `/settings/ai/page.tsx`
- Replace `min-w-0 w-full max-w-full space-y-6 overflow-hidden` with `pageShellClass`.
- Retain canonical `PageHeader` with back link to `/settings`.
- Render `<AiSettingsTab />` within standard layout rhythm.

### 3C. `/settings/simulation/page.tsx`
- Replace raw wrapper with `pageShellClass`.
- Retain canonical `PageHeader` with back link and external simulation button.
- Render `<SimulationTab />` within standard layout rhythm.

---

## 4. Tests

Create `apps/web/lib/__tests__/settings-hardware-pagekit.test.ts` to assert:
- `pageShellClass` presence in `settings/ekasa/page.tsx`, `settings/ai/page.tsx`, and `settings/simulation/page.tsx`.
- All compliance items in `settings/ekasa/page.tsx` use `t(...)`.

---

## 5. i18n

- Ensure all compliance check labels, fiscal device tooltips, and save notifications exist symmetrically in `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/settings-ui-states.test.ts lib/__tests__/settings-hardware-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] All compliance checklist items mapped through `useI18n()`.
- [ ] Password/API key fields securely masked.
- [ ] `pageShellClass` applied across all three settings pages.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check passes with 0 errors.
