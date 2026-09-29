# TASK: Progres, zrušenie a timeout pri čakaní na AI (F-X7-1)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie UX, PERF · Úsilie **M** · Vlastník: UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §5.7, register F-X7-1

## 1. Context / Why
Pri AI odpovedi (5–20 s v režime `flash`, minúty v `pro`) používateľ vidí iba spinner a text „Drafting...“ (`records/new-soap/[patientId]/page.tsx:1029-1038`) — bez progresu, bez možnosti zrušiť a bez informácie o časovom limite. Presne počas vyšetrenia to vyzerá ako zamrznutá aplikácia. Pomalá sieť je v ambulancii realita (a §5.7 ukazuje, že niektoré AI cesty nemajú timeout vôbec — tie rieši GT-008).

## 2. Scope
### In Scope
- [x] Indikovať **fázu** behu (odosielanie → model → spracovanie odpovede) a uplynulý čas.
- [x] Tlačidlo „Zrušiť“ dostupné najneskôr po 3 s; zrušenie musí ukončiť request (`AbortController`) a nechať koncept bez zmeny.
- [x] Po prekročení limitu zobraziť zrozumiteľnú správu a ponuku „Skúsiť znova“ / „Napísať ručne“.
- [x] Rovnaké chovanie na všetkých AI povrchoch (SOAP, imaging, discharge, agent).
- [x] Prístupnosť: stav oznámený čítačkám (`aria-live`), tlačidlo dosiahnuteľné klávesnicou.

### Out of Scope
- [ ] Streamovanie odpovede po tokenoch (možné pokračovanie).
- [ ] Zmena promptov alebo modelov.

## 3. Acceptance Criteria (Definition of Done)
- [ ] Manuálne overené pri umelo spomalenom providerovi: používateľ vidí fázu, čas a môže zrušiť.
- [ ] Zrušenie neuloží čiastočný AI text.
- [ ] Nové texty v EN + SK (vrátane `aria-label`).
- [ ] `pnpm --filter @openpims/web test -- lib/ai` zelené.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (UI komponenty + zdieľaný hook/komponent pre AI stav).
- **Riziko:** `risk:prod` (lekár musí zostať pánom situácie).
