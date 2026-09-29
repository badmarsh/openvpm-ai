# Arena Sprint 6: Clinical Whiteboard & Diagnostic Imaging Modalities

> **Mission for Arena Agent:**
> Harmonize `/whiteboard` (`apps/web/app/(dashboard)/whiteboard/page.tsx`) and patient imaging attachments according to the Dashboard UI Kit (`docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`).
> Enforce diagnostic modality tagging (RTG, USG, CT, Endoskopia), high-contrast clinical status, and strict imaging category containment.
> Ensure zero ESLint warnings, 0 type errors, and 100% bilingual (SK/EN) i18n symmetry.

---

## Architectural Rules (MUST FOLLOW)
1. **Medical Imaging Guardrail:** Imaging attachments belong strictly under category `"imaging"` — NEVER overwrite `patient.photoUrl`.
2. **Follow `docs/UIKIT.md`:** Use `PageHeader`, `PageToolbar`, `DataTableFrame` or dense card grid from `page-kit.tsx`.
3. **100% Strict i18n:** All UI text through `useI18n()`. Key symmetry between `en.json` and `sk.json`.

---

## Detailed Requirements

### File: `apps/web/app/(dashboard)/whiteboard/page.tsx`
1. **Layout Harmonization:**
   - Standardize to `PageHeader` with active patient count badge and date navigation.
   - Use `PageToolbar` with search and department filter (Chirurgia, Hospitalizácia, Ambulancia).
   - Use clean card frames with tokenized borders (`border-border`, `bg-card`).
2. **Modality & Status Badges:**
   - Imaging badges: `RTG` (blue/info), `USG` (purple), `CT` (amber), `LAB` (teal).
   - Patient condition tags: `stabilizovaný`, `kritický`, `pooperačný`, `čaká na prepustenie`.
3. **Typography & Times:**
   - Check-in time, fasting duration, and surgery timestamps in `font-mono tabular-nums text-xs`.
4. **Verification:**
   - `pnpm lint`, `pnpm type-check`, `pnpm test`.
