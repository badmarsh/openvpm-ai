# TASK: Doplniť kontrolu roly na `controlledSubstances.list` (F-06-2)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie SAFETY, DOCS · Úsilie **S** · Vlastník: API
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-06, §5.4, register F-06-2

## 1. Context / Why
`docs/authorization-matrix.md:35` zakazuje technikovi a recepcii čítanie knihy kontrolovaných látok, ale procedúra `controlledSubstances.list` (`server/routers/controlled-substances.ts:344`) nemá **žiadnu** kontrolu roly — `protectedProcedure` znamená, že ju zavolá aj `viewer`. Kniha OPL je jedným z najcitlivejších registrov v praxi.

## 2. Scope
### In Scope
- [x] Doplniť `requireRole` na všetky čítacie procedúry knihy OPL podľa `docs/authorization-matrix.md` (lekár + admin; prípadne asistent podľa matríc).
- [x] Zosúladiť maticu s kódom v oboch smeroch — ak má matica pravdu, opraví sa kód; ak kód, opraví sa matica (rozhodne vlastník klinických rolí).
- [x] Doplniť test, ktorý pre každú chránenú procedúru overí `FORBIDDEN` pre rolu `viewer`/`technician`.
- [x] Skontrolovať, či obmedzenie neblokuje legitímne toky (napr. výdaj lieku) — bez oslabenia klinických brán.

### Out of Scope
- [ ] Zmeny v evidencii kontrolovaných látok (zero-prefill, svedkovia) — nedotýkať sa.
- [ ] Nová UI pre knihu OPL.

## 3. Acceptance Criteria (Definition of Done)
- [ ] Nový test v `server/__tests__/` (rolová matica) pokrýva minimálne 5 procedúr OPL.
- [ ] `docs/authorization-matrix.md` bez rozporu s kódom v časti kontrolované látky.
- [ ] `pnpm --filter @openpims/web test -- server` zelené.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` routery + testy; dokumentácia.
- **Riziko:** `risk:prod`, `risk:security`.
