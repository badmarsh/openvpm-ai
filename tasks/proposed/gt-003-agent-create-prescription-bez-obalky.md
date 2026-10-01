# TASK: Agent `create_prescription` musí rešpektovať klinické brány a obálku potvrdenia (F-18-1)
**[STATUS: PROPOSED]** · Priorita **P0** · Kategórie SAFETY · Úsilie **M** · Vlastník: AI + API + DB
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-06/J-18, register F-18-1 (v J-06 uvedené ako F-06-1)

## 1. Context / Why
Agent tool `create_prescription` (`lib/agent/tools.ts:2894`) zapisuje recept so `status = active`; obálka potvrdenia (`lib/ai/clinician-confirmation.ts`) sa vydáva až **po** INSERT a nikdy sa nespotrebuje. Chýba teda ekvivalent kontroly, akú má klasická cesta (`lib/controlled-substances/policy.ts` — zero-prefill a potvrdenie lekárom). Recept na kontrolovanú látku tak môže vzniknúť z agenta, prípadne cez `POST /api/v1/agent` s kľúčom nesúcim `records:write`, bez klinickej brány.

## 2. Scope
### In Scope
- [x] Pred zápisom receptu vyžadovať **platnú, nespotrebovanú obálku** s rovnakým `entity_type`/`entity_id` a skontrolovať jej revíziu; obálka sa musí spotrebovať v tej istej transakcii (rovnaký vzor ako klasická finalizácia).
- [x] Ak recept obsahuje kontrolovanú látku, sprístupniť tool **len** ak je potvrdenie lekára prítomné a platné (nikdy nie auto-potvrdenie agentom).
- [x] Recept nevytvárať v stave `active` bez potvrdenia; dočasný stav musí byť explicitný (`draft`/`pending_confirmation`) alebo sa má zápis odmietnuť.
- [x] Preskúmať aj ostatné write tools (`book_appointment`, `record_vital_signs`, `record_vitals_from_speech`) na rovnaký vzor a zjednotiť ho.
- [x] Testy: tool odmietne zápis bez obálky; tool odmietne kontrolovanú látku bez potvrdenia; tool prejde s platným potvrdením; cez `/api/v1/agent` sa to správa rovnako.

### Out of Scope
- [ ] Zmena samotných pravidiel pre kontrolované látky (`lib/controlled-substances/policy.ts` sa nesmie oslabiť, iba sa naň napojiť).
- [ ] Nové UI pre potvrdenie zápisu agenta (nad rámec existujúceho modalu).

## 3. Acceptance Criteria (Definition of Done)
- [ ] `pnpm --filter @openpims/web test -- lib/agent lib/ai server/__tests__/ai-clinical-finalization` zelené, s novými testami na 4 scenáre vyššie.
- [ ] Kód neobsahuje žiadnu cestu, ktorá by vytvorila `prescriptions.status = "active"` bez spotrebovanej obálky — overené `grep` + test.
- [ ] V `docs/authorization-matrix.md` je doplnený riadok pre agent write tools s odkazom na brány.
- [ ] `docs/ai-audit-ledger.md` popisuje nový tok (obálka pred zápisom).

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (`lib/agent/tools.ts`, `lib/ai/clinician-confirmation.ts`, `server/routers/agent.ts`, `app/api/v1/agent/route.ts`).
- **Transakcia:** spotreba obálky a zápis receptu musia byť atomické (`withTenant`).
- **Riziko:** `risk:prod`, `risk:security`, `risk:money` (lieky na predpis).
