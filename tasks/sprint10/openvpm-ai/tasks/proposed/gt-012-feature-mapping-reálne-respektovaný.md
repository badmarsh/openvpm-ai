# TASK: Feature mapping musí platiť pre všetky AI funkcie (F-17-3, aliasy F-14-1, F-X2-1)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie AI, DOCS · Úsilie **M** · Vlastník: AI + UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-17/J-14, register F-17-3

## 1. Context / Why
`/settings?tab=ai` ponúka 8 kľúčov feature mappingu (`lib/ai/ai-presets.ts:24-33`, UI `ai-settings-tab.tsx:763-908`). Reálne sa čítajú len `assistant`, `deepThinking`, `voiceSoap`, `imagingRtg`, `imageGeneration`, `videoGeneration`. **`marketingCopy` a `labParser` kód nikdy nečíta** a viaceré cesty obchádzajú resolver cez `configuredModel()`: SOAP flash draft (`soap-draft.ts:153`), prepúšťacia správa (`discharge.ts:139`), transkripcia (`transcription.ts:127`), extrakcia liečby (`treatment-extractor.ts:241`), marketing copy (`composer.ts:106`), recenzie (`marketing.ts:1505`), FAQ (`:4590`), alt-texty (`:4646`). Klinika tak nemá kontrolu nad tým, ktorý poskytovateľ dostane jej texty — čo je pri GDPR podstatné (súvisí s GT-013).

## 2. Scope
### In Scope
- [x] Každé AI volanie musí získať model cez `resolveFeatureConfig`/`resolvePracticeLanguageModel` s príslušným feature kľúčom.
- [x] Doplniť chýbajúce feature kľúče pre cesty, ktoré dnes nemajú vlastný (`discharge`, `labParser` — a rozhodnúť, či `labParser` vôbec má existovať, keďže lab import nie je AI: viď GT-004).
- [x] Ak sa nastavenie nedá rešpektovať, karta v UI sa musí odstrániť alebo označiť ako neaktívna — žiadny fiktívny prepínač.
- [x] Test, ktorý pre každý riadok feature mappingu overí aspoň jeden reálny call site (regresná sieť proti F-17-3).
- [x] Zobraziť v UI, ktorá funkcia používa ktorý provider (proti tichému auto-fallbacku, F-17-6).

### Out of Scope
- [ ] Zmena promptov alebo modelov samotných.
- [ ] Rozdelenie účtovania podľa funkcií (metring je samostatná téma).

## 3. Acceptance Criteria (Definition of Done)
- [ ] `grep -rn "configuredModel()" apps/web/lib/ai apps/web/server/routers apps/web/lib/agent` vracia 0 výskytov v AI cestách **alebo** každý má komentár s odôvodnením a je mimo mappingu podľa rozhodnutia vlastníka.
- [ ] Test `feature-mapping-coverage` (nový) zlyhá, ak pribudne AI volanie bez feature kľúča.
- [ ] Každý feature kľúč z `DEFAULT_PRACTICE_FEATURE_MAPPINGS` má v kóde aspoň jedno reálne použitie alebo je z UI odstránený.
- [ ] Nové texty v EN + SK.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (`lib/ai/*`, `server/routers/*`, `components/settings/ai-settings-tab.tsx`).
- **Riziko:** `risk:prod`, `risk:security`.
