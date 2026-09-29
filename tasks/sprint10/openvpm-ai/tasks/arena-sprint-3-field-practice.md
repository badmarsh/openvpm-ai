# Arena Sprint 3: Ambulatory Field Practice & CEHZ / KVEPIS Sync Resilience

> **Mission for Arena Agent:**
> Polish the ambulatory field visit flow (`/encounters/new` & `apps/web/components/field-visits/`), improve offline/low-connectivity fallback handling, ensure CEHZ ear tag validation format, and verify withdrawal period monitoring display.
> Ensure zero ESLint warnings, 0 type errors, and 100% i18n symmetry.

---

## Architectural Rules (MUST FOLLOW)
1. **Zákon 39/2007 Z. z. & ŠVPS SR:**
   - CEHZ ear tags (centrálny register hospodárskych zvierat) format: `SK` + 8 digits or standard ISO country code + 12 digits.
   - Farm IČO must be 8 digits with checksum validation.
   - Ochranná lehota (withdrawal period) must highlight warning badges for meat/milk before visit closeout.
2. **Strict i18n:**
   - 100% key symmetry between `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
   - Slovak veterinary terminology: "Kniha ošetrení hospodárskych zvierat", "ochranná lehota", "ušné číslo".

---

## Detailed Requirements

### 1. Field Visit Quick Form (`apps/web/components/field-visits/`)
- Ensure voice dictation button (`mic-button.tsx`) has graceful fallback and loading state when microphone is denied or offline.
- Add clear withdrawal period indicator on farm animal medications in treatment lines.
- Ensure CEHZ animal ear tag entry validates format and provides quick copy action.

### 2. KVEPIS / ŠVPS Statutory Ledger Sync
- In `apps/web/components/statutory/kvepis-panel.tsx`:
  - Standardize error display when UPVS / KVEPIS submission is pending or rejected.
  - Wrap submissions table in `DataTableFrame`.

### 3. Verification
- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
