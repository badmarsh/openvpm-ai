# TASK: Viditeľná data residency, DPA a automatický fallback v AI nastaveniach (F-17-4, F-17-6)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie SAFETY, DOCS, UX · Úsilie **M** · Vlastník: UI + DOCS
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-17, register F-17-4

## 1. Context / Why
Panel „Klinická a legislatívna bezpečnosť“ v `ai-settings-tab.tsx:926-957` hovorí o HITL, kontrolovaných látkach a sympathy gate, ale **ani slovom o tom, kam dáta odchádzajú** — žiadny región, žiadna retencia, žiadny stav DPA. `docs/ai-evidence/MODEL_CARDS.md:15-22` pritom deklaruje „EU / US“ a odosielanie PHI „po súhlase kliniky“, pričom súhlas nie je nikde evidovaný (`grep consent` v karte vracia prázdno). Resolver navyše ticho prepne na iného poskytovateľa (`ai-config-resolver.ts:141-215`) — pri GDPR je tiché prepnutie sub-procesora neprijateľné.

## 2. Scope
### In Scope
- [x] Zobraziť pri každom providerovi: spoločnosť, región spracovania, či ide o EÚ, odkaz na DPA a či sa dá použiť v klinickom režime (PHI áno/nie).
- [x] Pred odoslaním klinických dát (SOAP, imaging, voice) vyžadovať explicitné potvrdenie kliniky s daným providerom; potvrdenie evidovať (kto, kedy, ktorý provider).
- [x] Ak dôjde k automatickému fallbacku na iného poskytovateľa, zobraziť to v UI pri behu aj v histórii (žiadne tiché prepnutie).
- [x] Ak provider nemá známy región, označiť ho ako „nespôsobilý pre PHI“ — bez výnimky.
- [x] Aktualizovať `MODEL_CARDS.md` tak, aby zodpovedal realite (súvisí s F-17-5).

### Out of Scope
- [ ] Právne posúdenie DPA (dodá vlastník; úloha je zobraziť a evidovať).
- [ ] Presun na vlastné EÚ-only nasadenie.

## 3. Acceptance Criteria (Definition of Done)
- [ ] V UI existuje panel s regiónom/DPA a stavom potvrdenia pre každého nakonfigurovaného providera.
- [ ] Záznam o potvrdení kliniky je dohľadateľný (nová `ext_*` tabuľka alebo existujúci auditný záznam s dostatočným detailom).
- [ ] Fallback poskytovateľa sa zobrazí aspoň raz používateľsky zrozumiteľne (SK/EN).
- [ ] `docs/ai-evidence/MODEL_CARDS.md` bez rozporu s kódom.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (UI, `lib/ai/*`), `packages/db` len ak treba nová `ext_*` tabuľka (spolu s RLS pokrytím — dynamický `DO` blok v `packages/db/rls/enable-rls.sql` ho pokryje, ak tabuľka má `practice_id`).
- **Riziko:** `risk:security`, `risk:prod`.
