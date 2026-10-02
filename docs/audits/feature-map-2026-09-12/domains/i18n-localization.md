# Domain: i18n & Localization
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **Custom i18n system** (`I18nProvider`, `useI18n`, `t()`) | `lib/i18n/index.ts` (barrel), `lib/i18n/context.tsx` (provider), `lib/i18n/loader.ts` (dictionary loader) | All roles | None (client-side React context + localStorage/cookie) | Complete | [VERIFIED: lib/i18n/context.tsx:1-160, lib/i18n/loader.ts:1-62] |
| **Dictionary resolution & fallback chain** | `t(key, fallback, params)` — resolves dotted paths via `getNestedValue`; fallback chain: active locale → English → Slovak → fallback string → key | All roles | None | Complete — 4-level fallback with `{param}` interpolation | [VERIFIED: lib/i18n/context.tsx:97-115] |
| **Locale persistence** | Cookie `NEXT_LOCALE` (1-year max-age) + `localStorage("openvpm_locale")` + `document.documentElement.lang` update | All roles | None | Complete | [VERIFIED: lib/i18n/context.tsx:54-70, 88-99] |
| **Code-split dictionary loading** | `sk.json` bundled in initial payload; `en.json` dynamically imported via `import("@/messages/en.json")` on `loadDictionary("en")` | All roles | None | Complete | [VERIFIED: lib/i18n/loader.ts:22-49] |
| **Message catalogs** (sk.json / en.json) | `messages/sk.json` (334 KB), `messages/en.json` (305 KB) — 46 top-level namespaces each, fully symmetric | All roles | None | Complete — structural parity verified | [VERIFIED: messages/sk.json, messages/en.json; node symmetry check: 46 top-level keys identical] |
| **Language switcher UI** | `components/i18n/language-switcher.tsx` — popover with Slovak/UK flags, pre-fetches non-default dictionary on open | All roles | None | Complete | [VERIFIED: components/i18n/language-switcher.tsx:1-120] |
| **Sidebar navigation i18n** | `components/layout/sidebar.tsx` — every nav item uses `t(item.i18nKey, item.label)`; section titles use `t(section.titleKey, section.titleFallback)` | All roles | None | Complete — 26 vanilla + 19 custom nav items all i18n-keyed | [VERIFIED: sidebar.tsx:276, 310, 350] |
| **Top-bar page title i18n** | `components/layout/top-bar.tsx` — `routeLabels` map with `{label, i18nKey}` per route; resolved via `t(route.i18nKey, route.label)` | All roles | None | Complete — ~40 route labels | [VERIFIED: top-bar.tsx:23-67, 115] |
| **custom-nav.ts i18n key declarations** | `config/custom-nav.ts` — 19 items, each with both `label` (hardcoded Slovak) and `i18nKey` (e.g., `nav.marketing`, `nav.agentImaging`) | All roles | None | Complete | [VERIFIED: config/custom-nav.ts:1-168] |
| **PDF bilingual rendering** | `lib/pdf.ts` — `resolvePdfLocale()`, `sanitizeForPdf()`, `formatPdfDate()`, `isSk` boolean flag for SK/EN label selection across invoice, prescription, medical summary, vaccination certificate generators | All roles | None | Complete — but `sanitizeForPdf` strips Slovak diacritics (č→c, ď→d, etc.) | [VERIFIED: lib/pdf.ts:61-100, 166-1620] |
| **i18n component adoption** | `useI18n()` used across ~300+ locations in ~100+ `.tsx` files (sidebar, top-bar, all dashboard pages, auth, feature components) | All roles | None | Complete | [VERIFIED: grep for `useI18n` in `*.tsx`: 313 matches] |
| **i18n symmetry checker** | `scripts/check-i18n-symmetry.js` — checks `settings.booking` subtree only | Developer tool | None | Partial — not a full-catalog checker | [VERIFIED: scripts/check-i18n-symmetry.js:1-20] |
| **i18n key adder** | `scripts/i18n-add-keys.mjs` — merges `{ "dot.key": { sk, en } }` into both dictionaries | Developer tool | None | Complete | [VERIFIED: scripts/i18n-add-keys.mjs:1-78] |
| **i18n architecture documentation** | `docs/I18N.md` — goals, non-goals, core concepts, 5-PR migration path, Italian localization boundary | Developer | None | Complete — written for Italian seed, applies equally to sk/en | [VERIFIED: docs/I18N.md:1-120] |

## B. Import / Export specifics

1. **No i18n dictionary import/export UI** — There is no admin screen or tRPC endpoint to import/export translation files. The message catalogs (`sk.json`, `en.json`) are plain JSON files edited directly or via `scripts/i18n-add-keys.mjs`. [VERIFIED: no `messages/import` or `messages/export` routes in codebase; grep for "import.*translation" / "export.*dictionary": 0 matches]

2. **Orphan `messages/parts/` directory** — Contains 8 JSON files (`records-en.json`, `records-sk.json`, `schedule-en.json`, `schedule-sk.json`, `track1-en.json`, `track1-sk.json`, `track3-en.json`, `track3-sk.json`; total ~356 KB) with flat key structures identical to the main dictionaries. **No `.ts/.tsx/.js` file references `messages/parts/`** — these are unused artifacts from a prior iteration (possibly a modular catalog experiment). [VERIFIED: `grep "messages/parts/" apps/web` — 0 matches across all source files; `dir /s messages/parts/` — 8 files present]

3. **`i18n-add-keys.mjs`** — The only tooling for adding keys. Takes a JSON input with `{ "dot.key": { sk: "...", en: "..." } }` shape, nests under first segment, and writes both `sk.json` and `en.json`. Supports `--force` to overwrite. [VERIFIED: scripts/i18n-add-keys.mjs]

4. **`check-i18n-symmetry.js`** — Only validates `settings.booking` subtree symmetry. Not a full-catalog checker. [VERIFIED: scripts/check-i18n-symmetry.js:14-15 `keys(en.settings.booking, "settings.booking")`]

## C. Integration specifics

| External system / concern | Protocol / integration | Certification reality | Source tag |
|---|---|---|---|
| **No Next.js i18n routing** | No `[locale]` route segments, no `Accept-Language` detection, no `/sk/` or `/en/` paths | Client-side only — locale is managed via React context, `NEXT_LOCALE` cookie, and `localStorage` | [VERIFIED: middleware.ts has no locale logic; next.config.js has no `i18n` section] |
| **No third-party i18n library** | Custom-built system — no `next-intl`, `react-intl`, `i18next`, or `FormatJS` | Inferred from package.json — no i18n dependencies found | [INFERRED: no i18n packages in dependencies] |
| **PDF WinAnsi encoding** | `sanitizeForPdf()` strips Central European characters (č→c, ď→d, ľ→l, ň→n, ť→t, ŕ→r, š→s, ž→z, ĺ→l, Ľ→L, Ď→D, Ť→T, Ň→N, Ŕ→R, Š→S, Ž→Z) to prevent PDF glyph artifacts | Functional but lossy — Slovak diacritics cannot render in PDFs | [VERIFIED: lib/pdf.ts:86-98] |
| **HTML lang attribute** | `<html lang="sk" suppressHydrationWarning>` in root layout; `I18nProvider` updates `document.documentElement.lang` on client mount | SSR always emits `lang="sk"` regardless of user's saved locale; client-side fix occurs after hydration | [VERIFIED: app/layout.tsx `<html lang="sk">`; lib/i18n/context.tsx:80-82] |

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| **docs/I18N.md: "Keep English as the canonical source language and fallback"** | **IMPLEMENTED-PARTIAL** | The fallback chain in `t()` does fall back to English (step 2: `locale !== "en" → getDictionary("en")`), but the *default locale* is Slovak (`DEFAULT_LOCALE = "sk"`), and `sk.json` is eagerly bundled while `en.json` is lazy-loaded. So Slovak is the *operational* baseline, not English. English is the *fallback* for missing keys when the active locale is Slovak — but since `sk.json` is the primary bundle, this path rarely triggers. [VERIFIED: lib/i18n/context.tsx:99-103; lib/i18n/loader.ts:11 `DEFAULT_LOCALE = "sk"`] |
| **docs/I18N.md: "Support UI translation without changing routing or business behavior"** | **IMPLEMENTED-VERIFIED** | No locale-based routing exists. Middleware has no locale logic. All locale switching is client-side via context. [VERIFIED: middleware.ts; lib/i18n/context.tsx:88-99] |
| **docs/I18N.md: "Resolve dates, times, numbers, and currencies through explicit locale-aware formatting helpers"** | **IMPLEMENTED-PARTIAL** | PDF formatting uses `formatPdfDate()` which only handles `DD.MM.YYYY` for Slovak, passes through for English. No shared `Intl`-based date/number/currency helpers exist for the UI layer — `lib/locale/format.ts` was mentioned in the architecture doc but does not exist at that path. [VERIFIED: lib/pdf.ts:100-105; grep for `lib/locale/format.ts` — file not found] |
| **docs/I18N.md: "Keep language, formatting locale, country, terminology, and regulatory capabilities separate"** | **IMPLEMENTED-PARTIAL** | Language and formatting are somewhat separated (locale string vs. `isSk` boolean in PDFs), but country is not modeled at all — only `sk` and `en` locales exist, no country code abstraction. Terminology is embedded directly in JSON files without a separate glossary. [INFERRED] |
| **docs/I18N.md: "Avoid route restructuring" (PR 3)** | **IMPLEMENTED-VERIFIED** | Confirmed — no `/sk/` or `/en/` route prefixes. Locale switching is purely client-side. [VERIFIED: app/ directory has no `[locale]` segment; middleware.ts has no locale routing] |
| **docs/I18N.md: "Introduce a minimal message catalog pattern with English as the complete baseline" (PR 4)** | **IMPLEMENTED-VERIFIED** | Both `sk.json` and `en.json` exist with 46 symmetric top-level namespaces. The pattern is fully implemented, though the catalog is far from "minimal" — both files are 300+ KB. [VERIFIED: node symmetry check: 46 top-level keys identical in both files] |
| **docs/I18N.md: "Allow country-specific features to be added later as opt-in capabilities"** | **ASPIRATIONAL-ONLY** | No country abstraction exists in the codebase. The `Locale` type is `"sk" | "en"` with no country dimension. [VERIFIED: lib/i18n/loader.ts:3 `export type Locale = "sk" | "en"`] |
| **README / docs mention Italian localization seed (PR 5)** | **STALE-OR-CONTRADICTED-BY-CODE** | The docs are written around Italian as the target language, but the actual implementation is Slovak/English. The `I18N.md` references "Italian localization boundary" and "Italian veterinary terminology" but the codebase has `sk.json` and `en.json` only. [VERIFIED: docs/I18N.md lines 95-120; messages/ directory contains only sk.json and en.json] |

## E. Friction / "doesn't make sense" notes

### E.1 — `custom-nav.ts` hardcoded Slovak labels: `label` is the fallback, `i18nKey` controls the UI display

**Description:** Every item in `custom-nav.ts` declares both a `label` (hardcoded Slovak string) and an `i18nKey` (dot-path into the dictionary). The sidebar resolves these via `{item.i18nKey ? t(item.i18nKey, item.label) : item.label}` — meaning `i18nKey` is the **primary display mechanism** and `label` serves only as the `fallback` argument to `t()`. When the `i18nKey` exists in the dictionary (which it does for ~12 of 19 custom-nav items), the dictionary value is shown. When the key is **missing** from both dictionaries, the hardcoded Slovak label is displayed as fallback.

**Evidence:** [VERIFIED: sidebar.tsx:348 `item.i18nKey ? t(item.i18nKey, item.label) : item.label`; custom-nav.ts items all have both fields]

**12 of 19 custom-nav keys are MISSING from both dictionaries** (both sk.json and en.json):

| i18nKey | Hardcoded Slovak label (used as fallback) | Dictionary coverage |
|---|---|---|
| `nav.marketingPlan` | Plán obsahu | **MISSING** in both |
| `nav.marketingHandouts` | Letáky | **MISSING** in both |
| `nav.marketingMessages` | Správy & SMS | **MISSING** in both |
| `nav.marketingWebsite` | Web kliniky | **MISSING** in both |
| `nav.waitingRoomTv` | Čakáreň TV | **MISSING** in both |
| `nav.marketingAutomations` | Automatizácie | **MISSING** in both |
| `nav.marketingConsents` | Súhlasy & skripty | **MISSING** in both |
| `nav.marketingWellness` | Wellness balíčky | **MISSING** in both |
| `nav.remoteSupport` | Vzdialená Podpora | **MISSING** in both |
| `nav.adminSupport` | Admin Podpora | **MISSING** in both |
| `nav.collapseMenu` | Zbaliť menu | **MISSING** in both |
| `nav.expandMenu` | Expand menu | **MISSING** in both |

**Recommendation:** Run `scripts/i18n-add-keys.mjs` with entries for all 12 missing keys. Alternatively, remove `i18nKey` from items that will never be translated and rely on the raw `label` — but this breaks the consistent pattern and makes future translation harder.

### E.2 — Top-bar `routeLabels` have mixed-language fallback strings

**Description:** The `routeLabels` map in `top-bar.tsx` uses English fallback labels for vanilla routes ("Dashboard", "Patients", "Schedule") but **Slovak fallback labels** for custom/marketing routes ("Plán obsahu", "Recenzie", "Letáky", "Správy a SMS fronta", "Webstránka kliniky", etc.). When the `i18nKey` resolves, the dictionary value is shown — but when it doesn't (e.g., during initial load before the dictionary is ready, or if a key is missing), the fallback string is displayed, producing mixed-language output.

**Evidence:** [VERIFIED: top-bar.tsx:23-67 — lines 23-35 use English fallbacks ("Dashboard", "Patients"), lines 36-57 use Slovak fallbacks ("Plán obsahu", "Recenzie", etc.)]

**Recommendation:** Standardize all fallback labels to English (matching the docs/I18N.md principle that English is the canonical baseline). This ensures consistent behavior when keys are missing.

### E.3 — Brand header hardcoded Slovak text (not i18n-keyed)

**Description:** The sidebar brand header displays `"MVDr. Martin Sýkora"` and `"Súkromná veterinárna ambulancia"` as hardcoded text, not routed through `t()`. These strings also appear in the `<Link title>` attribute. When the user switches to English, the brand header remains in Slovak.

**Evidence:** [VERIFIED: sidebar.tsx:470-480 `<span> MVDr. Martin Sýkora</span>` and `<span> Súkromná veterinárna ambulancia</span>`]

**Recommendation:** Either add i18n keys for these strings or accept that the clinic name and tagline are brand identity that should remain Slovak regardless of UI language.

### E.4 — `<html lang="sk">` hardcoded in SSR, fixed client-side

**Description:** The root layout hardcodes `<html lang="sk">`. The `I18nProvider` updates `document.documentElement.lang` on client mount, but server-rendered HTML always has `lang="sk"`. This causes a hydration mismatch when the user's saved locale is `"en"` and affects accessibility (screen readers, SEO).

**Evidence:** [VERIFIED: app/layout.tsx `<html lang="sk" suppressHydrationWarning>`; lib/i18n/context.tsx:80-82 `document.documentElement.lang = detected`]

**Recommendation:** Implement server-side locale detection via `NEXT_LOCALE` cookie in the layout, or pass `initialLocale` to `I18nProvider` from the server. The `suppressHydrationWarning` attribute masks the mismatch rather than fixing it.

### E.5 — PDF `sanitizeForPdf()` strips all Slovak diacritics

**Description:** The `sanitizeForPdf()` function maps all Central European characters to their Latin ASCII equivalents before writing to PDF. This means PDFs cannot render authentic Slovak text — "očkovanie" becomes "ockovanie", "Súkromná" becomes "Sukromna". This is a WinAnsi encoding limitation of the PDF library (jspdf).

**Evidence:** [VERIFIED: lib/pdf.ts:86-98 — maps č→c, ď→d, ľ→l, ň→n, ť→t, ŕ→r, š→s, ž→z, ĺ→l, and their uppercase equivalents]

**Recommendation:** Consider switching to a PDF library that supports UTF-8 encoding (e.g., pdf-lib, pdfkit with custom fonts) to render proper Slovak diacritics in generated documents.

### E.6 — `messages/parts/` directory is dead weight

**Description:** The `messages/parts/` directory contains 8 JSON files (~356 KB total) with flat key structures matching the main dictionaries. **No source file imports or references these files.** They appear to be artifacts from a modular catalog experiment that was never completed.

**Evidence:** [VERIFIED: `grep "messages/parts/"` across all `apps/web` source files — 0 matches; files are 63-70 KB each]

**Recommendation:** Delete `messages/parts/` or document its purpose if it serves a build-time or external process.

### E.7 — Docs/I18N.md references Italian but codebase is Slovak/English

**Description:** The architecture document (`docs/I18N.md`) was clearly written with Italian as the target language for the localization seed. It references "Italian localization", "Italian veterinary terminology", and "Italian fiscal or regulatory integrations" throughout. The actual implementation is Slovak/English.

**Evidence:** [VERIFIED: docs/I18N.md lines 95-120 — "Italian localization boundary", "Italian UI translations", "Italian date, time, number, and currency formatting"]

**Recommendation:** Update `docs/I18N.md` to use Slovak as the example language, or generalize the examples to be language-agnostic. The architecture principles remain valid regardless of the target language.

### E.8 — `check-i18n-symmetry.js` only validates `settings.booking` subtree

**Description:** The symmetry checker script only compares `settings.booking` keys between sk.json and en.json. It does not validate the full catalog. With 46 top-level namespaces and hundreds of keys, this provides very limited coverage.

**Evidence:** [VERIFIED: scripts/check-i18n-symmetry.js:14-15 `keys(en.settings.booking, "settings.booking")`]

**Recommendation:** Expand the script to check full-catalog symmetry or integrate it into CI. A full check would flag the 12 missing keys identified in E.1.

### E.9 — Top-bar `routeLabels` has entries not in sidebar or custom-nav

**Description:** `top-bar.tsx` defines `routeLabels` for `/marketing/scripts` (`nav.marketingScripts`) and `/marketing/competitors` (`nav.marketingCompetitors`), but these routes do not appear in `custom-nav.ts` or the sidebar. Both keys are **MISSING** from both dictionaries.

**Evidence:** [VERIFIED: top-bar.tsx:52-55; grep for `/marketing/scripts` and `/marketing/competitors` in custom-nav.ts — 0 matches; node key check: both keys MISSING]

**Recommendation:** Either add these routes to `custom-nav.ts` (if they exist as pages) or remove the route label entries from `top-bar.tsx` (if the pages don't exist).

## F. Proposed user-manual section(s)

### Personas served
- **Admin** — managing translation files, adding new languages, reviewing key symmetry
- **All roles** — switching UI language, understanding what does/doesn't translate

### Complexity assessment
**Short help format.** The i18n system is user-facing in two ways: (1) the language switcher button in the top bar (simple UI action), and (2) the admin responsibility for maintaining translation files (operational detail). This fits well as a short section in the Settings/Admin chapter of the user manual, with a reference-style appendix for the translation file format if admin users need to add keys manually.

### Recommended section structure

```
## Changing Display Language
- How to switch between Slovenčina and English (top-bar language button)
- What translates (navigation, buttons, labels) and what doesn't (clinic name, PDF diacritics)
- Where your preference is saved (browser)

## Translation Coverage
- Current languages: Slovak (default), English
- How to report missing translations

## For Administrators: Adding Translation Keys
- Message catalog location (messages/sk.json, messages/en.json)
- Using the i18n-add-keys script
- Key naming convention (dot-separated paths: nav.patients, chrome.newInvoice)
```

### Cross-domain links needed
- → [Admin Settings](admin-settings.md) — translation key management
- → [Core Clinical](core-clinical.md) — PDF generation language selection
- → [Statutory Compliance](statutory-compliance.md) — e-Kasa receipt language
- → [Marketing Communications](marketing-communications.md) — marketing page translations