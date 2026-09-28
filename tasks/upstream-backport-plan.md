# Upstream Backport Plan -- openvpm-ai from evangauer/openvpm

> **Typ ulohy:** Infrastrukturny backport, mimo sprintovy cyklus
> **Vytvorene:** 2026-09-28
> **Zdroj analyzy:** .gemini/antigravity/brain/26bfd515.../backport-selection-analysis.md

---

## Korekcia povodnej analyzy

Analyza tvrdi, ze migracie diverguju od indexu 0099. V skutocnosti su migracie **0099-0104 identicke** medzi nami a upstreamom. Divergencia nastava az pri **0105** -- upstream ma 0105_fractional_medication_quantities, my mame 0105_nifty_ultimatum (ext_ schemy pre eKasa, AI imaging, marketing). Portal sessions (0097), identity-key rotation (0101) a dalsie infrastrukturne migracie su zdielane.

## Stav repozitara

| Fakt | Hodnota |
|---|---|
| Upstream ahead | 396 commitov |
| Zdielane migracie | 0000--0104 |
| Divergencia | od 0105 |
| Posledna nasa migracia | 0114 |
| encounters/page.tsx | nasa 5938 riadkov vs upstream 4339 |
| Nase ext_ rozsirenia | eKasa, AI imaging, marketing, KVEPIS, voice, discharge reports |

---

## Faza 1 -- Security patches (trivialna)

**Branch:** swarm/backport-security-patches
**Commity:** 0767aff0 (#322 fflate DoS) + c66a1ad3 (#318 dependency isolation)
**Zlozitost:** Trivialna -- 9 suborov, ziadne migracie, ziadne schema zmeny

### Postup

1. Vytvor branch swarm/backport-security-patches z origin/main
2. git cherry-pick --no-commit 0767aff0 -- ak conflict v pnpm-lock.yaml, akceptuj upstream verziu a re-run pnpm install
3. git cherry-pick --no-commit c66a1ad3 -- ak conflict v pnpm-lock.yaml, re-run pnpm install. Skontroluj SoapNoteEditor.tsx -- merge upstream zmeny (tiptap import) bez straty nasich zmien
4. pnpm install na regeneraciu lockfilu
5. pnpm lint && pnpm typecheck && pnpm test
6. Commit a push, vytvor PR do origin/main

### Riziko
Nizke. pnpm-lock.yaml conflict je mechanicky.

---

## Faza 2 -- Revocable portal sessions (infrastruktura)

**Branch:** swarm/backport-revocable-sessions
**Commity:** 32157864 + ebb192c3 + 4f758763 + c4fb7ce0
**Zlozitost:** Narocna -- 60+ suborov, nova schema, trpc middleware refactor
**Zavislost:** Ziadna (migracia 0097 je zdielana)

### Postup

1. Vytvor branch z origin/main
2. Pre KAZDY cherry-pick pouzi --no-commit a VYNECHAJ zmeny v packages/db/drizzle/ a meta/_journal.json
3. Pridaj portal-sessions.ts schema a re-export v packages/db/schema/index.ts
4. Merge clients.ts -- upstream pridava session-related stlpce
5. **KRITICKY:** enable-rls.sql merge -- upstream pridava portal_sessions RLS. ZACHOVAJ nase rozsirenia: ext_ dynamic table discovery, AI audit ledger trigger+REVOKE, clinician confirmations REVOKE DELETE, ::text cast v policy USING/WITH CHECK
6. server/trpc.ts -- merge portal auth middleware
7. server/routers/portal.ts -- merge 502 riadkov zmien, zachovaj nase portal rozsirenia
8. Po cherry-pickoch: pnpm db:push && pnpm db:rls && pnpm db:rls:preflight
9. pnpm lint && pnpm typecheck && pnpm test
10. Commit a push, vytvor PR

### Riziko
Vysoke. Portal router a trpc middleware su centralne. RLS merge vyzaduje opatrnost.

---

## Faza 3 -- Identity-key rotation + dormant demo schema (#323 + #324)

**Branch:** swarm/backport-identity-rotation
**Commity:** 4225cada (#323) + cc189d67 (#324)
**Zlozitost:** Stredna
**Zavislost:** Ziadna (migracie 0100 a 0101 su identicke)

### Postup

1. Vytvor branch z origin/main
2. Cherry-pick 4225cada (--no-commit). VYNECHAJ packages/db/drizzle/0100_* a meta zmeny
3. Pridaj backup-runs.ts schema, merge users.ts zmeny, re-export v index.ts
4. enable-rls.sql -- merge upstream #323 zmeny, ZACHOVAJ ext_ rozsirenia
5. Cherry-pick cc189d67 (--no-commit). VYNECHAJ drizzle 0101 zmeny
6. platform-email-preferences.ts schema -- merge 87 riadkov
7. email-preferences.ts + platform-email-preferences.ts lib -- 668 riadkov; opatrny merge
8. Health route -- merge upstream rozsirenia
9. pnpm db:push && pnpm db:rls
10. Plna verifikacia

### Riziko
Stredne. Schema zmeny su ciste, ale platform-email-preferences.ts je velky refactor.

---

## Faza 4 -- Prescription pagination + field billing (#321, #325, #326, #333)

**Branch:** swarm/backport-prescription-field-billing
**Commity:** 552a0a86 (#321) + 396c1cc4 (#325) + d6e187a7 (#326) + 4077a890 (#333)
**Zlozitost:** Stredna
**Zavislost:** Ziadna (migracia 0099 je zdielana)

### Postup

1. Vytvor branch z origin/main
2. Cherry-pick POSTUPNE, kazdy --no-commit. VYNECHAJ drizzle zmeny pre #321
3. prescription-inventory-product-picker.tsx -- novy komponent z #321
4. records/page.tsx -- merge upstream zmeny, zachovaj ext_ rozsirenia
5. encounters/page.tsx -- #333 pridava 24 riadkov. Manualne aplikuj hunky do nasej 5938-riadkovej verzie. NEPREPIS AI/visitContext/voice zmeny
6. dashboard.ts router + unfinished-field-visits.tsx -- nove subory, cisty add
7. pnpm install na regeneraciu lockfilu
8. pnpm db:push && pnpm db:rls
9. Plna verifikacia

### Riziko
Stredne. Encounters page merge je manualny, ale #333 pridava len male hunky.

---

## Faza 5 -- Clinical workflow chain (#336, #337, #339)

**Branch:** swarm/backport-clinical-workflow
**Commity:** a6e65362 (#336) + f20c7f3d (#337) + f1a33632 (#339)
**Zlozitost:** Narocna
**Zavislost:** Faza 4 (encounters page base state)

### Postup

1. Vytvor branch z origin/main (alebo z vysledku Fazy 4 ak je mergnuta)
2. Cherry-pick a6e65362 (#336) -- --no-commit
   - encounters/page.tsx -- 28 riadkov (weight correction dialog), manualny merge
   - patients/[id]/page.tsx -- 114 riadkov zmien
   - patient-document-upload.tsx + weight-correction-dialog.tsx -- nove komponenty
3. Cherry-pick f20c7f3d (#337) -- --no-commit
   - **MIGRACIA 0105:** VYNECHAJ packages/db/drizzle/0105_*. Namiesto toho:
     - Uprav vanilla schema: billing.ts, prescriptions.ts, prescription-events.ts, dispense-charge-queue.ts -- quantity na numeric(13,3)
     - pnpm db:push vytvori migraciu 0115 automaticky
     - Trigger invoice_items_validate_dispense_charge re-create pridaj do bootstrap SQL
   - encounters/page.tsx -- 113 riadkov zmien, TAZKY merge. ZACHOVAJ AI/visitContext/voice bloky
   - Nove utility: markup-input.tsx, quantity.ts, prescription-policy.ts
4. Cherry-pick f1a33632 (#339) -- --no-commit
   - encounters/page.tsx -- 39 riadkov, posledny merge
   - service-picker.tsx -- 84 riadkov
5. pnpm db:push && pnpm db:rls
6. Plna verifikacia vratane pnpm test:e2e
7. Commit a push, vytvor PR

### Migracia 0105 detail

Upstream 0105 meni:
- prescriptions.quantity na numeric(13,3)
- prescription_events.quantity na numeric(13,3)
- invoice_items.quantity na numeric(13,3) + default 1
- products.stock_quantity na numeric(13,3)
- dispense_charge_queue.quantity na numeric(13,3)
- Re-create invoice_items_validate_dispense_charge trigger

Riesenie: upravit vanilla .ts schemy, pnpm db:push generuje migraciu s nasim indexom.

### Riziko
Vysoke. Encounters page ma 3x merge. Vanilla schema zmeny (quantity precision) su legitimne.

---

## Globalne pravidla pre vsetky fazy

1. **NIKDY** nemodifikuj packages/db/drizzle/ ani _journal.json manualne
2. **NIKDY** nemazni nase ext_ rozsirenia z enable-rls.sql
3. **NIKDY** nemazni nase bloky z encounters/page.tsx (visitContext, AI draft, voice SOAP, ext_ imports)
4. Vanilla schema zmeny su povolene IBA ak prichadzaju priamo z upstreamu
5. Migracie aplikuj vyhradne cez pnpm db:push
6. Verifikacia: pnpm lint && pnpm typecheck && pnpm test pred kazdym PR
7. Ak test failne, oprav pricinu -- neoslabuj assertions

## Paralelizacia

Fazy 1-4 su **nezavisle** a mozu bezat paralelne.
Faza 5 zavisi na Faze 4 (encounters/page.tsx base state).

## Suhrn

| Faza | PRov upstream | Suborov | Migracie | Riziko |
|---|---|---|---|---|
| 1. Security | #322, #318 | ~9 | ziadne | Nizke |
| 2. Portal sessions | 4 commity | ~60 | 0097 zdielana | Vysoke |
| 3. Identity rotation | #323, #324 | ~31 | 0100, 0101 zdielane | Stredne |
| 4. Prescription + field | #321, #325, #326, #333 | ~25 | 0099 zdielana | Stredne |
| 5. Clinical workflow | #336, #337, #339 | ~72 | 0105 KOLIZIA -> 0115 | Vysoke |