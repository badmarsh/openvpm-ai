# TASK: Poslať `visitContext` do AI draftu SOAP (F-04-3)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie AI, UX · Úsilie **S** · Vlastník: UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-04, register F-04-3

## 1. Context / Why
API `ai.draftSoapNote` prijíma `visitContext` (`server/routers/ai.ts:362`) — dnešné merania, poznámky, dôvod návštevy. UI ho pripravuje (`records/page.tsx:627`, `visitContextKey`), ale **nikto ho neposiela**. AI draft je preto „slepý“: text vyzerá úplne, ale neobsahuje to, čo sa dnes v ordinácii nameralo, čo zvyšuje riziko, že lekár prehliadne chýbajúci údaj.

## 2. Scope
### In Scope
- [x] Poslať `visitContext` z editora nového SOAP aj z encounter obrazovky pri volaní AI draftu.
- [x] Zobraziť používateľovi, **ktoré** údaje z návštevy sa do draftu posielajú (krátky zoznam pred potvrdením).
- [x] Ak kontext nie je k dispozícii, explicitne to uviesť (nie ticho poslať prázdny kontext).
- [x] Test: mutation sa volá s `visitContext` obsahujúcim vitálne funkcie; bez kontextu sa zobrazí upozornenie.

### Out of Scope
- [ ] Vkladanie fotografií/snímok do kontextu draftu.
- [ ] Zmeny promptu nad rámec formátovania kontextu (ohraničenie rieši GT-002).

## 3. Acceptance Criteria (Definition of Done)
- [ ] `grep -rn "visitContext" apps/web/app` ukazuje skutočné odoslanie v UI, nie len deklaráciu.
- [ ] Nové texty v EN + SK.
- [ ] `pnpm --filter @openpims/web test -- lib/ai server` zelené.
- [ ] Manuálne overené: draft obsahuje dnešné merania (UNVERIFIED bod U-14 z reportu sa tým uzavrie).

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (UI + `server/routers/ai.ts` bez zmeny kontraktu).
- **Riziko:** `risk:prod` (lekár musí vidieť, čo ide do modelu).
