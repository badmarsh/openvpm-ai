# Arena Sprint 1: Command Palette Smart Ranking & Contextual Actions

> **Mission for Arena Agent:**
> Implement smart ranking, cross-lingual matching (Slovak / English), and contextual priority in the Command Palette (`apps/web/components/common/command-search.tsx`).
> Ensure zero ESLint warnings, 0 type errors, and 100% i18n symmetry.

---

## Architectural Rules (MUST FOLLOW)
1. **Zero-Conflict Upstream Sync:** Do NOT modify `packages/db/schema/*.ts` or `_journal.json`.
2. **Strict i18n:** All UI text through `useI18n()`. Key symmetry between `messages/en.json` and `messages/sk.json`.
3. **Clinical Safety Gates:** Never touch `ClinicalDiffConfirmModal` or controlled substance zero-prefill.

---

## Detailed Requirements

### File: `apps/web/components/common/command-search.tsx`

1. **Keep Quick Actions & Navigation Visible When Typing:**
   - Currently, when `hasQuery` is true, Quick Actions and Navigation items disappear completely and only DB search results (patients/clients) are shown.
   - When `hasQuery` is true, filter `quickActionItems` and `navigationItems` in JavaScript against the resolved i18n label (both Slovak and English) and optional `searchAliases`.
   - Add `searchAliases?: string[]` to `CommandItemConfig` (e.g. `["návšteva", "objednať", "termín", "vyšetrenie", "faktúra", "pokladňa", "recept"]`).
   - Matching logic must be case-insensitive and diacritic-insensitive.
   - Display matching items in a new group **above** the DB results:
     - Group heading: `t("nav.actions", "Akcie")` / `Actions`.
     - Limit to max 5 items to keep the palette clean.

2. **Context-Aware No-Query Ordering:**
   - Read active route using `usePathname()`.
   - Boost relevant actions when the search query is empty:
     - On `/patients` or `/clients`: boost "Nový pacient", "Nový klient".
     - On `/schedule` or `/encounters`: boost "Nová návšteva", "Nový termín".
     - On `/billing` or `/billing/pos`: boost "Pokladňa POS", "Nová faktúra".
     - On `/inventory`: boost "Príjem tovaru", "Nový produkt".

3. **Verification:**
   - Run `pnpm lint`, `pnpm type-check`, and `pnpm test`.
