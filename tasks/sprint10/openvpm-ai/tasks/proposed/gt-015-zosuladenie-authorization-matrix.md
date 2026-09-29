# TASK: Zosúladiť `docs/authorization-matrix.md` s kódom (F-20-1, alias F-X4-8)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie DOCS, SAFETY · Úsilie **S** · Vlastník: DOCS (+ API)
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-20, §5.4, register F-20-1

## 1. Context / Why
Dokument je označený ako „Canonical Security Reference“, ale v piatich bodoch nezodpovedá kódu: (1) `technician` vraj môže diktovať draft — `voiceProcedure` ho odmieta (`voice.ts:45-47`); (2) `technician` vraj môže vytvárať/editovať SOAP draft — odmieta ho `records.ts:1738`; (3) `portal_user` ako rola neexistuje (portál ide cez capability tokeny); (4) `service_cron` v kóde nie je; (5) rola `viewer` v matici chýba úplne. Pri bezpečnostnom audite alebo incidente je takýto dokument horší než žiadny.

## 2. Scope
### In Scope
- [x] Doplniť chýbajúce roly (`viewer`, `service_agent`) a odstrániť neexistujúce (`portal_user`, `service_cron`).
- [x] Pri každom riadku uviesť **odkaz na kód** (súbor:riadok), kde je rola vynútená — aby sa dokument nedal odpojiť od reality.
- [x] Pridať automatizovaný test, ktorý aspoň pri kľúčových procedúrach overí zhodu matice a kódu (napr. zoznam procedúr s `requireRole` vs tabuľka).
- [x] Označiť riadky, kde je rozhodnutie vedome iné než matica, ako „odchýlka“ s odôvodnením.

### Out of Scope
- [ ] Zmena rolovej politiky (rozhoduje vlastník; úloha iba dokumentuje).
- [ ] Zmeny v RLS.

## 3. Acceptance Criteria (Definition of Done)
- [ ] `docs/authorization-matrix.md` neobsahuje žiadnu rolu, ktorá v kóde neexistuje.
- [ ] Každý riadok matice má odkaz na `file:line`.
- [ ] Nový test zlyhá, ak pribudne procedúra s `requireRole`, ktorá v matici nie je.

## 4. Technical Architecture & Constraints
- **Balíčky:** dokumentácia + `apps/web/server/__tests__/`.
- **Riziko:** `risk:low` (dokumentačné), s dopadom na auditovateľnosť.
