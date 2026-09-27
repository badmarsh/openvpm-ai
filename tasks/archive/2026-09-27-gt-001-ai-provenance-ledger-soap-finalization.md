> **Verification 2026-09-27** · Status: **DONE** · Verdict: **ARCHIVE** · Ledger: `tasks/VERIFICATION-LOG.md`  
> **Evidence:** sprint 32 PR #74 — `ext_soap_ai_provenance` receipts (migration `0114_regular_doctor_doom`) + `soap_note_finalized` ledger event in `lib/records/soap-lifecycle.ts`; contract `server/__tests__/soap-ai-provenance.contract.test.ts` live.  
> **Origin:** `tasks/proposed/gt-001-ai-provenance-ledger-soap-finalization.md` · first committed 2026-09-21 (`b8ea08f7`)

---

# TASK: Dôkazný záznam AI pôvodu pri finalizácii SOAP (F-04-1)
**[STATUS: DONE]** · Priorita **P0** · Kategórie SAFETY, DATA · Úsilie **M** · Vlastník: API + DB
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-04, §5.6, register F-04-1

## 1. Context / Why
SOAP poznámka, ktorá vznikla z AI draftu (`ai.draftSoapNote`) alebo do ktorej sa vložili nálezy AI analýzy snímky (`imaging.injectFindingsIntoSoap`), sa dnes **finalizuje bez zápisu do `ext_ai_audit_log`**. Vzniká tak karta, kde nie je možné preukázať, ktoré vety navrhol model a ktoré napísal lekár. Pri spore s klientom, pri kontrole ŠVPS alebo pri rekonštrukcii incidentu je to nepreukázateľné.

## 2. Scope
### In Scope
- [x] Zapísať AI udalosť do ledgera pri finalizácii SOAP, ak aspoň jeden úsek pochádza z AI návrhu alebo z AI analýzy snímky.
- [x] Evidencia: `entity_type = "soap_note"`, `entity_id`, `patient_id`, `model`, `provider`, `prompt_version`/`feature_key`, `confirmed_by_user_id`, `created_at`.
- [x] Zapísať aj pôvod (provenance) na úrovni úseku (subjective/objective/assessment/plan) — stačí pole v auditnej udalosti, nie nová tabuľka.
- [x] Doplniť chýbajúce entity types z `lib/ai/draft-safety.ts:129-135` tak, aby zoznam deklarovaných typov zodpovedal realite (F-20-3).
- [x] Testy: finalizácia AI draftu zapisuje záznam; manuálne napísaný SOAP nezapisuje; existujúci `scripts/verify-ai-audit-trail.ts` označí záznam ako platný v reťazi.

### Out of Scope
- [ ] Retroaktívne doplnenie záznamov pre už existujúce SOAP.
- [ ] Zmena hash-chain algoritmu (`lib/ai/audit-chain.ts`) — iba pridanie nových záznamov.
- [ ] Akákoľvek zmena `ClinicalDiffConfirmModal` alebo `lib/ai/clinician-confirmation.ts` (brány sa nemenia, iba sa o nich viac zapisuje).

## 3. Acceptance Criteria (Definition of Done)
- [ ] `pnpm --filter @openpims/web test -- lib/ai server` zelené, nové testy pokrývajú 3 scenáre (AI draft, AI imaging vloženie, manuálny zápis).
- [ ] `node scripts/verify-ai-audit-trail.ts` (v CI: `tsx`) prejde nad databázou s novo vytvoreným AI-finalizovaným SOAP.
- [ ] V `docs/ai-audit-ledger.md` je doplnená tabuľka „ktoré povrchy zapisujú“ so stavom 100 % pre AI cesty.
- [ ] Každá nová i18n fráza v EN aj SK (ak sa v UI niečo zobrazí).
- [ ] Žiadna zmena v `packages/db/schema/*.ts` (upstream) — ak treba stĺpec, iba v `ext_*`.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (trpc routery `ai.ts`, `imaging.ts`, `records.ts`), `packages/db` (len ak treba index).
- **Audit:** existujúci `appendAiAuditEvent` (`lib/ai/audit-ledger.ts`) — žiadna nová tabuľka, žiadny nový hash formát.
- **RLS:** záznam musí dostať `practice_id`; tabuľka `ext_ai_audit_log` má append-only granty (`packages/db/rls/enable-rls.sql:125-138`) — dodržať.
- **Riziko:** `risk:prod` (klinická evidencia), `risk:data`.
