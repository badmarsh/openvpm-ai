# TASK: UI pre import dodacích listov od veľkoobchodníka (F-12-1)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie UX, DOCS · Úsilie **L** · Vlastník: UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-12, register F-12-1

## 1. Context / Why
Parser (`apps/web/lib/inventory/wholesaler-import.ts`) aj tRPC procedúry (`server/routers/extensions/wholesaler-import.ts`) existujú, ale **UI neexistuje** — `ROADMAP.md` to priznáva v bode 9. Recepcia dnes nemá ako doplniť sklad z dodacieho listu inak než SQL, čo je pre používateľa slepá ulička a pre prax reálna strata času pri každej dodávke.

## 2. Scope
### In Scope
- [x] Jednoduchý tok: nahrať súbor → zobraziť rozpoznané položky → potvrdiť (so zvýraznením neistôt).
- [x] Podpora existujúcich formátov parseru (Cymedica, Pharmos, Samohýl, Henry Schein).
- [x] Ukázať, čo sa zmení v sklade (pôvodný stav → nový stav), aby recepcia videla dopad pred potvrdením.
- [x] Roly: kto môže import potvrdiť (návrh: admin + technik; čítanie recepcia) — v súlade s `inventory.ts:143-147`.
- [x] Prázdne a chybové stavy: nerozpoznaný formát, prázdny súbor, duplicitný import.
- [x] i18n SK + EN.

### Out of Scope
- [ ] Automatické objednávanie od dodávateľa.
- [ ] Prepojenie skladu na spotrebu OPL (F-06-3/F-12-2).

## 3. Acceptance Criteria (Definition of Done)
- [ ] V `/inventory` existuje viditeľný vstup pre import (tlačidlo v hlavnej lište).
- [ ] Nahranie reálneho dodacieho listu (aspoň 1 vzor od dodávateľa) prejde celým tokom a zmení stav skladu.
- [ ] Testy: minimálne integračný test toku (upload → potvrdenie → sklad).
- [ ] `ROADMAP.md` aktualizovaný (bod 9 presunutý do „hotovo“).
- [ ] Bez zmien v `packages/db/schema/*.ts` (upstream) nad rámec potreby.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (UI) + existujúce routery.
- **Bezpečnosť:** žiadne nové externé služby; súbor spracovať v pamäti.
- **Riziko:** `risk:data`.
