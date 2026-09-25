# Arena Sprint 15: Clinical AI Diagnostics & DICOM Imaging Hub `/agent/imaging`

> **Mission for Arena Agent:**
> Analyze, audit, improve, and fix bugs in clinical imaging review, DICOM window/level canvas controls, and AI diagnostic assistance:
> `apps/web/app/(dashboard)/agent/imaging/page.tsx` (~1,859 lines).
> This is a **presentation, diagnostic viewer reliability, and UI Kit harmonization sprint**.
> Do not alter MinIO attachment schemas, raw DICOM parser math, or human-in-the-loop signing requirements.
> Zero new ESLint warnings, 0 type errors, 100% bilingual (SK/EN) i18n leaf symmetry, all pinned imaging tests green.

> **Independence:**
> Touches strictly `apps/web/app/(dashboard)/agent/imaging/page.tsx`.
> Does not touch `app/api/upload/route.ts` or `lib/imaging/modality.ts`.

---

## 0. Preflight

1. `git status` clean on your working branch.
2. Read `AGENTS.md`, `docs/UIKIT.md`, `components/layout/page-kit.tsx`, and `apps/web/lib/__tests__/imaging-modality.test.ts`.
3. Facts verified in the repo:
   - Modality categories are pinned in `imaging-modality.test.ts` (`rtg`, `usg`, `ct`, `endoscopy`, `mri`, `photo`).
   - Category MUST be `"imaging"`; never overwrite `patient.photoUrl`.
   - AI findings must strictly remain in `draft` status until authorized by a veterinarian (`ClinicalDiffConfirmModal`).
   - The imaging page currently lacks `pageShellClass`, `PageToolbar`, and standard `DataTableFrame` structures.
4. Baseline test command (must pass BEFORE editing):
   `pnpm --filter @openpims/web exec vitest run lib/__tests__/imaging-modality.test.ts lib/__tests__/i18n-structure.test.ts`

---

## 1. DO NOT TOUCH / ALREADY COMPLETED

- **Standard non-negotiables:** Never modify `ClinicalDiffConfirmModal`, controlled substances zero-prefill, sympathy-gate suppression, `packages/db/schema/*.ts`, or `_journal.json`.
- **Medical Imaging Rules (AGENTS.md §5):**
  - Imaging attachments belong strictly under category `"imaging"`.
  - Never overwrite `patient.photoUrl`.
  - All AI diagnostic descriptions must carry the statutory advisory disclaimer (Zákon 39/2007 Z. z. §3).

---

## 2. Architectural Rules (Analyze → Audit → Improve → Fix Bugs → Verify)

1. **Phase 1: Analyze & Recon**
   - Trace the DICOM / image viewer lifecycle: study selection → thumbnail strip → canvas viewport → window/level adjustment → AI advisory findings panel.
2. **Phase 2: Audit & Findings**
   - Audit viewport resizing: ensure canvas aspect ratio does not stretch or clip on window resize or full-screen toggle.
   - Audit error handling: check corrupt image or unsupported DICOM transfer syntax handling (show user-friendly error card rather than white screen of death).
   - Audit human sign-off: verify AI-generated radiological findings cannot be written to final encounter notes without vet confirmation.
3. **Phase 3: Fix Bugs & Hardening**
   - Fix canvas container overflow on screens narrower than 1280px.
   - Clean up WebGL / 2D canvas context on component unmount to prevent memory leaks during rapid study switching.
   - Ensure all preset buttons (Bone, Soft Tissue, Lung, Brain) update window/level state consistently.
4. **Phase 4: UI Kit Harmonization**
   - Wrap the outer layout in `pageShellClass`.
   - Wrap study list and filter toolbar in `PageToolbar` and `SearchField`.
   - Wrap findings and measurement tables in `DataTableFrame`.
   - Harmonize buttons and toolbars with design tokens.
5. **Phase 5: Verification**
   - Run Vitest suite, scan i18n, type-check.

---

## 3. Detailed Requirements

### 3A. Layout & Workspace
- Wrap page in `pageShellClass`.
- Retain canonical `PageHeader` with title and modality tags.
- Use `PageToolbar` for modality filters (`RTG`, `USG`, `CT`, `MRI`, `Endoskopia`).

### 3B. Study Viewer & Findings Table
- Ensure canvas viewport maintains correct aspect ratio with responsive scaling.
- Wrap study index and measurement summaries in `DataTableFrame`.
- Ensure AI analysis panel displays clear `DRAFT` status badge until signed off.

---

## 4. Tests

Create `apps/web/lib/__tests__/imaging-pagekit.test.ts` to assert:
- `pageShellClass` and `DataTableFrame` presence in `agent/imaging/page.tsx`.
- All modality assertions in `imaging-modality.test.ts` remain 100% green.

---

## 5. i18n

- Ensure all imaging viewer strings, DICOM presets, and error states exist symmetrically in `en.json` and `sk.json`.

---

## 6. Verification Suite

Run:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/imaging-modality.test.ts lib/__tests__/imaging-pagekit.test.ts
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web i18n:scan
```

---

## 7. Definition of Done

- [ ] Imaging category isolation and modality tags preserved.
- [ ] Canvas aspect ratio and memory leak prevention verified.
- [ ] AI findings strictly gated with advisory status.
- [ ] `pageShellClass`, `PageToolbar`, and `DataTableFrame` applied.
- [ ] 100% bilingual leaf symmetry.
- [ ] Type-check passes with 0 errors.
