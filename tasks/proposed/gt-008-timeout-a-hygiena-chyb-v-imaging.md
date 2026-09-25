# TASK: Timeout a hygienu chýb pri AI analýze snímky (F-07-2, F-07-3)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie PERF, AI, UX · Úsilie **S** · Vlastník: API
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-07, §5.7, register F-07-2

## 1. Context / Why
`imaging.analyze` (`server/routers/imaging.ts:225-305`) nemá žiadny timeout — ako jediná AI cesta v projekte (SOAP draft 30 s, agent 60 s, transkripcia 60 s). Ak provider neodpovedá, obrazovka visí, presne počas vyšetrenia. Navyše sa pri chybe zobrazí **surový text upstream providera** (`imaging.ts:307`), ktorý môže prezradiť interné detaily a rozhodne nie je pre veterinára zrozumiteľný.

## 2. Scope
### In Scope
- [x] Doplniť `AbortController` s limitom (rovnaký vzor ako `lib/ai/soap-draft.ts:143-145`) a možnosť zrušiť analýzu používateľom.
- [x] Preložiť chyby do zrozumiteľných SK/EN hlásení (timeout, nedostupný provider, neplatný kľúč, príliš veľká snímka) — bez surového textu providera.
- [x] Zapísať do logu technickú príčinu pre podporu (nie do UI).
- [x] Zobraziť počas analýzy stav a uplynulý čas; pri 20 s+ nesmie UI pôsobiť zamrznuto.

### Out of Scope
- [ ] Oprava F-07-1 (klamlivé skóre) — to je GT-004.
- [ ] Oprava F-07-4 (kopírovanie jednotlivého nálezu) — samostatná UI úloha.

## 3. Acceptance Criteria (Definition of Done)
- [ ] `grep` v `imaging.ts` ukazuje timeout konštantu použitú pri volaní modelu.
- [ ] Test: pri simulovanom timeout-e vráti procedúra zrozumiteľnú chybu a UI ju zobrazí.
- [ ] Nové texty v EN + SK.
- [ ] `pnpm --filter @openpims/web test -- server/__tests__/imaging` zelené.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (`server/routers/imaging.ts`, UI panel analýzy).
- **Riziko:** `risk:prod`.
