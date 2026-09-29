# OpenVPM AI — Reorganizácia: Karta pacienta & Klinická karta (Modul 1)

> **Zadanie pre Arena Agenta:** Tento task rieši najväčšiu UX a architektonickú schizofréniu systému: oddelenie pasívneho detailu pacienta (`/patients/[id]`) a aktívneho klinického zápisníka (`/records`). Úlohou je konsolidovať rozťahané záložky karty pacienta do moderného, hustého klinického rozhrania (podľa `ui-craft-dense-dashboard`), odstrániť mätúce presmerovania, premenovať navigáciu na „Klinická karta“ a opraviť prenos kontextu vyšetrenia do AI draftu (GT-005).

---

## 0. Architektonické a bezpečnostné mantinely (NEPORUŠITEĽNÉ)

1. **Vanilla DB Schema Immutability:** Nikdy neupravuj súbory v `packages/db/schema/*.ts` (iba `ext_*.ts`). Žiadne nové migračné zásahy do vanilla tabuliek.
2. **Clinical Safety Gates (Zákon 39/2007 Z. z.):**
   - Všetky AI generované klinické výstupy musia byť vždy v stave `draft`, kým ich lekár nepotvrdí.
   - Nulový AI prefill pre omamné a psychotropné látky (Zákon 139/1998 Z. z. – opiáty, ketamín, propofol, fentanyl).
   - Sympathy Gate: Uhynuté / eutanazované zvieratá nesmú byť cieľom žiadnych automatizácií.
3. **i18n Symetria:** 100% zhodnosť kľúčov medzi `apps/web/messages/en.json` a `sk.json`. Používaj výhradne vnorený JSON (nested keys) a hook `useI18n()`. Žiadny hardcoded text v JSX.
4. **Databáza pri testoch:** V lokálnom prostredí vždy výhradne `-d openvpm_ai` (port 5434), nikdy `-d openpims`.

---

## 1. GUI & UX: Reorganizácia záložiek v Karta Pacienta (`/patients/[id]`)

### Problém
Aktuálne má `/patients/[id]` až 11 rozťahaných záložiek:
`overview`, `clinical` (len lab + vitals), `preventive` (vakcíny + procedúry), `records` (SOAP), `prescriptions`, `documents`, `appointments`, `invoices`, `weight`.
Lekár musí neustále preklikávať medzi záložkami a pri pokuse niečo zapísať (recept, procedúra, labák) vidí tlačidlo *"Otvoriť v Záznamoch"*, ktoré ho prehodí preč.

### Riešenie: Zjednotenie do 6 kompaktných klinických celkov
Uprav `apps/web/app/(dashboard)/patients/[id]/page.tsx` a komponenty v `apps/web/components/patients/sections/`:

1. **Prehľad (Overview):**
   - Rýchly sumár: plemeno, vek, mikročip, majiteľ, telefón, status poistenia.
   - Integrovaný mini-widget váhy (`WeightHistoryTab`) priamo do prehľadu — váha patrí k základnému statusu zvieraťa, nepotrebuje samostatnú záložku.
   - Posledné vitálne funkcie a aktívne zdravotné problémy (alergie, chronické diagnózy).
2. **Klinická história (Medical Records):**
   - SOAP záznamy s časovou osou.
   - Rýchle fulltextové vyhľadávanie v histórii pacienta (`PatientHistorySearch`).
   - Tlačidlo **„Nový klinický zápis“** vedúce priamo do `/records/new-soap/[patientId]`.
3. **Diagnostika & Vitálne funkcie (Diagnostics & Vitals):**
   - Zlúčenie výsledkov laboratórnych testov (`LabResultsTab`) a vývoja životných funkcií (`VitalsTab`).
   - Zobrazenie trendov (teplota, tep, dych, CRT, glykémia).
   - Tlačidlo **„Pridať laboratórny výsledok“** s priamym predvyplnením pacienta.
4. **Vakcinácie & Procedúry (Vaccinations & Procedures):**
   - Zlúčený pohľad na preventívnu starostlivosť: očkovací kalendár, šarže, expirácie, certifikát na stiahnutie + vykonané chirurgické a terapeutické zákroky.
   - Tlačidlá na rýchly zápis vakcíny a procedúry.
5. **Predpisy & Terapia (Prescriptions):**
   - Samostatná záložka pre medikáciu a recepty (kvôli legislatívnej prehľadnosti a kontrole KVL SR).
   - Aktívne vs. ukončené lieky, dávkovanie, skladové väzby.
   - Tlačidlo **„Vystaviť predpis“** s priamym predvyplnením pacienta.
6. **Dokumenty & Vyúčtovanie (Admin & Files):**
   - Súhlasy majiteľa (`ConsentSign`), fotodokumentácia (`CapturePhotos`), priložené PDF nálezy.
   - História vystavených faktúr a stav úhrad.

---

## 2. Navigácia & Informačná architektúra: Premenovanie

### Problém
Názov položky v menu **„Záznamy“** (`/records`) je nejasný a mätúci. Lekár nevie, či ide o archív, alebo o pracovnú plochu.

### Riešenie
1. V `apps/web/config/custom-nav.ts` a `apps/web/components/layout/sidebar.tsx`:
   - Zmeň label položky `/records` z *„Záznamy“* na **„Klinická karta“** (SK) / **„Clinical Record“** (EN).
   - Kľúč: `nav.records`.
2. V `apps/web/messages/sk.json` a `en.json`:
   - `"nav": { "records": "Klinická karta" }` (SK)
   - `"nav": { "records": "Clinical Record" }` (EN)
3. Aktualizuj breadcrumbs a titulok stránky v `apps/web/components/layout/top-bar.tsx` a `apps/web/app/(dashboard)/records/page.tsx`.

---

## 3. Bugfix & AI Integrácia: GT-005 (`visitContext` do AI draftu)

### Súčasný stav
V `apps/web/server/routers/ai.ts` procedúra `draftSoapNote` očakáva parameter `visitContext`:
- Dôvod návštevy (chief complaint z appointment)
- Dnešné namerané vitálne funkcie (teplota, hmotnosť, tep)
- Poznámky z recepcie/čakárne
V UI (`records/new-soap/[patientId]/page.tsx` a `records/page.tsx`) sa tento kontext buď neskladá optimálne, alebo chýba vizuálna indikácia pre lekára.

### Úlohy:
1. Skontroluj volanie `trpc.ai.draftSoapNote.useMutation` v `records/new-soap/[patientId]/page.tsx` a uisti sa, že ak existuje naviazaná návšteva (`appointmentId`), vytiahnu sa jej vitálne hodnoty a poznámky do `visitContext`.
2. Pridaj do UI pred spustením AI draftu vizuálny banner/badge:
   - Zoznam dát, ktoré AI model získa ako kontext (napr. *"Kontext: Hmotnosť 12.4kg, Teplota 38.6°C, Dôvod: Kašeľ"*).
   - Ak kontext chýba (pacient nemá dnešné merania ani termín), zobraz upozornenie: *"Bez kontextu návštevy – AI vygeneruje všeobecnú štruktúru"*.
3. Pridaj i18n kľúče pre tieto stavy do oboch slovníkov (`en.json` a `sk.json`).

---

## 4. Testy, Verifikácia & QA Gate

Pred odovzdaním a vytvorením PR musí prebehnúť kompletná kontrola:

1. **Lint & Code Style:**
   ```bash
   pnpm lint
   ```
   Musí prejsť s 0 chybami a 0 varovaniami (nepridávaj `eslint-disable`).
2. **Type-check:**
   ```bash
   pnpm --filter @openpims/web type-check
   ```
   Musí skončiť bez akejkoľvek TypeScript chyby.
3. **i18n Symmetry:**
   ```bash
   pnpm --filter @openpims/web exec vitest run server/__tests__/i18n-structure.test.ts
   ```
   Slovníky musia byť 100% symetrické.
4. **AI & Clinical Tests:**
   ```bash
   pnpm --filter @openpims/web exec vitest run server/__tests__/ai-draft-safety.test.ts
   pnpm --filter @openpims/web exec vitest run lib/__tests__/consult-companion-ui.test.ts
   ```
5. **Git Workflow:**
   - Vytvor novú branch `swarm/patient-clinical-reorg`.
   - Commit s konvenciou: `feat(clinical): consolidate patient tabs, rename records to clinical card, inject visitContext into AI draft`.
   - Vytvor Pull Request do `main`.
