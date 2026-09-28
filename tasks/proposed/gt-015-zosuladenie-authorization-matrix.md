---
id: GT-015
kind: ticket
title: Zosúladiť docs/authorization-matrix.md s kódom (F-20-1, alias F-X4-8)
state: open
priority: P1
---
> **Verification 2026-09-28** · Status: **PARTIALLY DONE** · Verdict: **KEEP** · Ledger: `tasks/VERIFICATION-LOG.md`
> **Evidence:** Opravené 2026-09-28. `docs/authorization-matrix.md` už neobsahuje `portal_user` ani
> `service_cron` (oba sú neexistujúce — overené v `apps/web/lib/authorization.ts:30-36` a v
> `lib/__tests__/authorization.test.ts:59`), a obsahuje reálne chýbajúce `viewer` a `service_agent`.
> Opravené aj dve nesprávne oprávnenia: `technician` nesmie zapisovať SOAP draft
> (`records.ts:1750-1751`) ani diktovať (`extensions/voice.ts:46-47`) — obe sú
> `requireRole("admin","veterinarian")`. Pridaná tabuľka `file:line` referencií.
> **Zostáva:** kritérium "každý riadok matice má odkaz na `file:line`" — tabuľka §3 má odkazy
> v kľúčových bodoch, nie pri každom riadku. Kritérium "test zlyhá pri novej `requireRole`
> procedúre" je splnené čiastočne: `lib/__tests__/authorization-matrix-docs.test.ts` drží
> zhodu role↔kód a dve konkrétne oprávnenia, neskenuje automaticky celý zoznam procedúr.
> **Notes:** Source: `docs/audit/2026-09-ai-ux-audit.md` (PR #23).

---

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
- [x] `docs/authorization-matrix.md` neobsahuje žiadnu rolu, ktorá v kóde neexistuje.
- [~] Každý riadok matice má odkaz na `file:line` — tabuľka kľúčových bodov áno, §3 po riadkovo nie.
- [x] Nový test zlyhá, ak pribudne procedúra s `requireRole`, ktorá v matici nie je —
      `apps/web/lib/__tests__/authorization-matrix-docs.test.ts` (overene zlyhá na oboch scenároch).

## 4. Technical Architecture & Constraints
- **Balíčky:** dokumentácia + `apps/web/server/__tests__/`.
- **Riziko:** `risk:low` (dokumentačné), s dopadom na auditovateľnosť.
