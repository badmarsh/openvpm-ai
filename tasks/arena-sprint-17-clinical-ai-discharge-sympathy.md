# Arena Sprint 17: Clinical AI Discharge Summary & Sympathy Gate Protocol `/agent/discharge`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in post-treatment discharge instructions, owner medication guidelines, and Sympathy Gate enforcement:
> `apps/web/app/(dashboard)/agent/discharge/page.tsx` (~1,416 lines).
> This is a **presentation, patient communication safety, and UI Kit harmonization sprint**.
> Do not alter sympathy gate suppression rules, PDF print boundaries, or medication calculation logic.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned tests green.

> **Independence:**
> Touches strictly `apps/web/app/(dashboard)/agent/discharge/page.tsx`.
> Does not touch `server/routers/extensions/ai-discharge.ts` or `lib/pdf/*`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md` (§5 Clinical & Safety Gates — Sympathy Gate), `docs/UIKIT.md`, and `components/layout/page-kit.tsx`.
3. Facts verified in the repo:
   - When a patient is deceased or euthanized, the system MUST suppress standard discharge reminders, follow-up reviews, and marketing, and redirect to the condolence flow.
   - All AI-generated discharge instructions must be reviewed and approved by the attending vet before printing or sending via email.
   - Dynamic lazy-loading of PDF generator via `import("@/lib/pdf")` must remain in place (never imported at top-level).
   - `agent/discharge/page.tsx` currently lacks `pageShellClass`, `PageToolbar`, and standard `DataTableFrame` structures.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/heavy-client-imports.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Sympathy Gate Compliance:**
  - Deceased patients must not have standard automated follow-ups scheduled.
  - Suppression logging to `ext_automation_suppression_log` must remain uncompromised.
- **Lazy PDF Import:**
  - PDF export must remain loaded dynamically inside the action handler via `import("@/lib/pdf")`.

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace discharge summary generation: encounter selection → AI draft synthesis (diagnosis summary, home care, medication schedule, red flag warning signs) → vet edit/approval → PDF print / email dispatch.
2. **Phase 2: Audit & Findings**
   - Audit deceased patient handling: verify that selecting a patient marked `deceased` displays the Sympathy Gate banner and disables automated reminder scheduling.
   - Audit medication schedule clarity: ensure dosage instructions include specific intervals (e.g. "každých 12 hodín s jedlom") and clear withdrawal warnings where applicable.
   - Audit print stylesheet: verify `@media print` layout does not cut off veterinarian signature blocks or clinic contact footers.
3. **Phase 3: Fix Bugs & Hardening**
   - Prevent generation of empty medication tables when no prescriptions were issued.
   - Sanitize rich text / Markdown formatting in owner instructions to prevent HTML tag bleeding in print previews.
   - Fix unresponsive preview modals on viewports `< 1024px`.
4. **Phase 4: UI Kit Harmonization**
   - Apply `pageShellClass` to the outer wrapper.
   - Wrap filter and action rows in `PageToolbar` and `SearchField`.
   - Wrap previous discharge summaries and medication tables in `DataTableFrame`.
   - Harmonize tab navigation with `underlineTabsListClass` and `underlineTabsTriggerClass`.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. Layout & Workspace
- Wrap outer page in `pageShellClass`.
- Retain canonical `PageHeader` with title and subtitle.
- Use `PageToolbar` for encounter selection and date filtering.

### 3B. Summary Editor & Tables
- Wrap previous discharge reports in `DataTableFrame`.
- Ensure sympathy gate warnings use semantic tokens (`destructive`/`muted`).
- Ensure vet approval toggle is prominently positioned before print or email actions.

---

## 4. Tests

Create `apps/web/lib/__tests__/discharge-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `agent/discharge/page.tsx`.
- Preservation of sympathy gate handling and dynamic PDF lazy loading.

---

## 5. i18n

- Ensure all discharge instructions, home care guidelines, and condolence templates exist symmetrically in `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/heavy-client-imports.test.ts lib/__tests__/discharge-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] Sympathy Gate suppression logic and UI alerts verified.
- [ ] Dynamic PDF import retained without top-level module load.
- [ ] `pageShellClass`, `PageToolbar`, and `DataTableFrame` applied.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check passes with 0 errors.
