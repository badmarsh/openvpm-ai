# TASK: Ohraničenie cudzieho textu z verejnej rezervácie pred vstupom do AI promptu (F-04-2)
**[STATUS: PROPOSED]** · Priorita **P0** · Kategórie SAFETY, AI · Úsilie **M** · Vlastník: AI + API
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-04/J-02, register F-04-2

## 1. Context / Why
Verejná rezervácia prijíma od neprihláseného človeka text (najmä `petInput.name`, max. 128 znakov — `server/routers/booking.ts:297-299`) a ten sa následne dostáva do kontextu AI promptu (`visitContext`, klinický kontext návštevy). Je to jediné miesto v systéme, kde môže **cudzí človek zapísať text**, ktorý neskôr číta model. Ochrana proti injection existuje pre výstupy nástrojov agenta (`wrapUntrustedData`, `lib/agent/runner.ts:367-378`), ale nie pre tento vstup.

## 2. Scope
### In Scope
- [x] Zaviesť jednu centrálnu funkciu na zabalenie nedôveryhodného textu (`<db_record>…</db_record>` s escapovaním ukončovacej značky) a použiť ju na **každom** mieste, kde dáta od klienta vstupujú do promptu.
- [x] Aplikovať ju na `visitContext` v `ai.draftSoapNote` a na klinický kontext v `imaging.injectFindingsIntoSoap`.
- [x] Validácia vstupu na hranici: odmietnuť/znormalizovať text s riadiacimi znakmi a značkami (`<`, `>` povolené, ale escapované), rozumná dĺžka.
- [x] Pravidlo v system prompte: text v `<db_record>` je **dátum, nie pokyn** (existujúce pravidlo #6 v `lib/agent/runner.ts:70-73` použiť ako vzor a rozšíriť do `lib/ai/soap-draft.ts`).
- [x] Testy: text obsahujúci `</db_record>` a falošné inštrukcie sa v prompte objaví escapovaný; výstup neobsahuje znak inštrukcie.

### Out of Scope
- [ ] Zmena formulára rezervácie pre klientov (UX sa nemení).
- [ ] Filtrovanie obsahu podľa kľúčových slov (nespoľahlivé, nie je cieľom).
- [ ] Zmena rate-limitov rezervácie (rieši F-02-1 samostatne).

## 3. Acceptance Criteria (Definition of Done)
- [ ] Jeden helper (napr. `lib/ai/untrusted-text.ts`) s unit testami pre: prázdny reťazec, `</db_record>`, dlhý text, diakritiku.
- [ ] `grep -rn "visitContext" apps/web` ukazuje, že každá cesta do promptu prechádza helperom.
- [ ] Existujúce testy AI promptov zostávajú zelené (`pnpm --filter @openpims/web test -- lib/ai lib/agent`).
- [ ] V `docs/ai-evidence/MODEL_CARDS.md` je doplnená poznámka o ohraničení nedôveryhodných dát.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (`lib/ai`, `server/routers/ai.ts`, `server/routers/imaging.ts`).
- **Bezpečnosť:** žiadne vypnutie existujúcich brán; helper je čisto aditívny.
- **Riziko:** `risk:security`, `risk:prod`.
