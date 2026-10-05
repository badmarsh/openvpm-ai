---
name: i18n-pair
description: Authoring and verifying symmetric, natural EN/SK i18n keys and preventing unlocalized JSX text.
---

# i18n-pair Skill

Maintains 100% dictionary symmetry between English and Slovak translations and enforces zero unlocalized JSX strings.

## Rules
1. **Dictionary Symmetry:** Every key added to `apps/web/messages/en.json` must be added to `apps/web/messages/sk.json` at the identical nested path.
2. **Nested Objects Only:** Use nested JSON objects, never dotted root strings (`"nav": { "dashboard": "..." }`, not `"nav.dashboard": "..."`).
3. **Independent Authorship:**
   - Write Slovak text naturally for a Slovak veterinarian (e.g. "Kniha ošetrení", "ochranná lehota", "očkovací preukaz").
   - Write English text naturally for an English-speaking vet.
   - For complex translation passes, refer to the `prelozit` skill.
4. **Zero Hardcoded JSX:** All user-facing strings must use `const { t } = useI18n();`.
5. **Validation:**
   ```bash
   pnpm --filter @openpims/web i18n:scan
   ```
