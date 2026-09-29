# OpenVPM AI — Arena Sprint: UI Craft Table Consolidation & CI Drift Gate Fix

> **Mission for Arena Agent:** Standardize all PIMS data tables according to ui-craft-dense-dashboard guidelines, fix table hierarchy and excessive padding on /recalls, ensure strict visual consistency with /clients and /patients, and resolve the CI schema drift check failure. All changes must pass pnpm lint, pnpm type-check, vitest run, and maintain 100% i18n symmetry.

---

## 0. DO NOT TOUCH / ALREADY COMPLETED (Read Before Coding)

The following were completed in PR #21 / commit 9031b6d0 — **do not regress or re-implement**:
- **Lint warnings:** Zero ESLint warnings exist in the repo. Do not introduce any new react-hooks/exhaustive-deps warnings or silence with eslint-disable.
- **Lab Results Sticky:** The sticky header on /lab-results cards was intentionally removed. Do NOT re-add sticky top-0 to CardHeader in apps/web/app/(dashboard)/lab-results/page.tsx.
- **Database Indexes:** 9 missing hot-path indexes were committed in packages/db/drizzle/bootstrap/add-missing-indexes.sql using immutable expressions. Do not duplicate or alter unless extending.
- **TV Slides:** listTvSlides (filtered server-side to isActive = true) and listAllTvSlides (admin) are active.
- **Clinical Safety Gates:** Never touch ClinicalDiffConfirmModal, controlled substance zero-prefill, or sympathy gate logic.

---

## 1. Primary UI Craft Task: Table Consolidation & Density Alignment

### 1A. Harmonize /recalls (Vakcinačné pripomienky) Table
**File:** apps/web/app/(dashboard)/recalls/page.tsx
**Problem:** The table currently has py-4 on every cell, unstyled <th> headers (py-3 font-medium), and loose vertical spacing that makes rows balloon to 75px+ height with unnecessary whitespace, failing the dense operator dashboard standard.

**Required Changes:**
1. **Header (<th>):** Standardize to the system table header pattern used in /clients and /patients:
   <th className= h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80>
   Apply to all columns (Checkbox, Pacient / klient, Vakcíny po termíne, Doručenie, Oprávnenosť, Akcia).
2. **Row Padding (<td>):** Reduce vertical padding from py-4 to py-2.5 px-4 (or py-3 px-4).
3. **Typography & Data Alignment:**
   - Patient name: font-medium text-foreground text-sm
   - Owner subtext: text-xs text-muted-foreground mt-0.5
   - Overdue vaccines: text-xs font-medium text-foreground with date in tabular-nums text-muted-foreground
   - Overdue days / badge: format dates consistently with formatDateYmdToDisplay or locale-aware formatter.
   - Status badge (Zablokované, Pripravené): ensure compact text-[11px] px-2 py-0.5 badge.
   - Action column: right-aligned button with size=sm text-xs.
4. **Checkbox Alignment:** Center checkbox vertically with align-middle in a fixed w-10 px-4 cell.

### 1B. Harmonize /vaccinations (Kniha očkovaní)
**File:** apps/web/app/(dashboard)/vaccinations/page.tsx
**Problem:** Uses raw text-xs on the whole table with non-uppercase p-2.5 font-semibold headers, differing from the rest of the application.
**Required Changes:**
- Align table header <th> to use:
   <th className=h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80>
- Keep dense 12px content for high-density clinical registry, but align spacing grid to 4/8px tokens: px-3 py-2 cells.
- Ensure microchip numbers and batch numbers use font-mono tabular-nums text-[11px].

### 1C. Global Table Polish Rules (per ui-craft-dense-dashboard):
- Numeric columns (dates, counts, prices, phone numbers) must have tabular-nums.
- All secondary line info in cells must have truncate or min-w-0 wrappers so long names do not break table layouts on medium viewports.
- Hover states on rows: hover:bg-muted/40 transition-colors.
- No empty spinners: If items query returns [], render <EmptyState> inside the card rather than an empty table.

---

## 2. CI Drift Gate Fix (Check schema matches committed migrations)

**Problem:** The CI job RLS tenant isolation fails at step Check schema matches committed migrations (pnpm --filter @openpims/db db:check-drift).
**Analysis:** In ci.yml, the drift check runs drizzle-kit generate and checks git status --porcelain. If any extension or schema change generates an uncommitted migration SQL, it aborts.
**Fix Strategy:**
1. Inspect packages/db/drizzle and packages/db/scripts/check-drift.ts (or the drift script in package.json).
2. Run pnpm --filter @openpims/db db:check-drift locally.
3. If new extension views (like voiceDictationDurationNumeric in ext_voice.ts) or custom extension tables trigger migration generation:
   - Ensure drizzle-kit config ignores views or extension objects if they are managed via bootstrap, OR
   - Generate the clean migration via pnpm db:generate without breaking journal integrity.
   - Note: Never manually corrupt packages/db/drizzle/meta/_journal.json.

---

## 3. i18n & Quality Checks

- Run: pnpm --filter @openpims/web i18n:scan
- Verify 100% dictionary symmetry between apps/web/messages/en.json and apps/web/messages/sk.json.
- If new keys are needed for table headers or empty states, add them symmetrically to both dictionaries.

---

## 4. Verification Suite

Before submitting the PR, execute and confirm clean exit (code 0) for:
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web test
pnpm --filter @openpims/db type-check

---

## 5. Commit & PR Structure

- Branch name format: arena/<session-id>-openvpm-ai
- Commit messages:
  - fix(ui): harmonize recalls and vaccinations table density with clients/patients design system
  - fix(ci): resolve schema drift check in db migration pipeline
  - feat(i18n): sync table column translations
