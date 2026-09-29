# OpenVPM AI — Úloha: Komplexná lokalizácia a preklad nepreložených EN textov (i18n Audit & Translation)

> **Použitie:** Skopírujte text tohto promptu do novej session AI agenta s prístupom k repozitáru `openvpm-ai`, prípadne použite ako striktné zadanie pre audit a lokalizáciu všetkých hardkódovaných anglických textov v aplikácii podľa pravidiel skillu `openvpm-ai`.

---

Si hlavný softvérový inžinier a lokalizačný architekt pre veterinárny informačný systém **OpenVPM AI** (pilotná klinika: MVDr. Martin Sýkora, Rimavská Sobota). Tvojou úlohou je vykonať systematický preklad všetkých nepreložených anglických textov v používateľskom rozhraní do slovenčiny, pričom musíš striktne dodržať architektonické a bezpečnostné mantinely špecifikované v skille `openvpm-ai`.

---

## 1. ZÁKLADNÉ ARCHITEKTONICKÉ MANTINELY (SKILL OPENVPM-AI §2)

Pri akejkoľvek lokalizácii MUSÍŠ bezpodmienečne rešpektovať:

1. **Zákaz prepisovania URL ciest (No Route Rewriting):**
   - V žiadnom prípade nepridávaj jazykové prefixy ako `app/[locale]/...`.
   - Všetky URL cesty musia zostať čisté a kanonické (`/admin`, `/schedule`, `/billing`, `/patients`, `/records`, `/marketing/automations`).
2. **100% slovníková symetria (Dictionary Symmetry):**
   - Medzi `apps/web/messages/sk.json` a `apps/web/messages/en.json` musí zostať **100 % kľúčová symetria** (každý kľúč v `sk.json` musí existovať v `en.json` a naopak).
   - Validácia symetrie:
     ```bash
     node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); const a=Object.keys(en); const b=Object.keys(sk); console.log(a.length === b.length ? 'Symmetry OK: ' + a.length : 'MISMATCH: en=' + a.length + ' sk=' + b.length);"
     ```
3. **Striktne vnorená JSON štruktúra (Nested JSON):**
   - Kľúče ukladaj VŽDY ako vnorené JSON objekty (napr. `admin: { kpi: { practices: "Ambulancie" } }`).
   - **NIKDY** neukladaj bodkové reťazce na najvyššej úrovni (`"admin.kpi.practices": "Ambulancie"`), pretože prekladač slovníka (`context.tsx` / `getNestedValue`) zlyhá.
   - Pre bezpečné pridanie nových kľúčov využi existujúci projektový skript:
     ```bash
     node apps/web/scripts/i18n-add-keys.mjs <subor_s_klucmi.json>
     ```
4. **Povinný `useI18n()` hook a zákaz obchádzania (Anti-Bypass Rule):**
   - Žiadny používateľsky viditeľný text nesmie byť napevno napísaný v JSX ako surový anglický reťazec (`<p>Overview</p>`, `placeholder="Search..."`, `title="Status"`).
   - Všetky texty musia volať `t("kluc.cesta", "Fallback text")` z hooku `const { t } = useI18n();`.
5. **Varovanie pred slepými miestami (Blind Spots):**
   - Testy slovníkovej symetrie overujú len zhodu medzi `sk.json` a `en.json`, ale **neodhalia hardkódovaný anglický text priamo v JSX komponentoch**.
   - Typickými slepými miestami prevzatými z upstreamu sú:
     - `apps/web/app/(dashboard)/admin/page.tsx`
     - `apps/web/components/admin/clinic-pilot-console.tsx`
     - `apps/web/components/admin/sms-recovery-console.tsx`
     - `apps/web/components/demo/demo-conversion-bar.tsx`
     - `apps/web/components/demo/demo-role-switcher.tsx`
     - `apps/web/lib/demo-role-switcher.ts`
     - `apps/web/components/onboarding/*`
     - `apps/web/app/(auth)/login/*` a `apps/web/app/(auth)/register/*`
6. **Štandardizovaná slovenská nomenklatúra rolí a terminológia:**
   - `admin` ➔ **Správca praxe** (alebo Správca kliniky)
   - `veterinarian` ➔ **Veterinárny lekár**
   - `technician` ➔ **Veterinárny asistent / technik**
   - `front_desk` ➔ **Recepcia**
   - `viewer` ➔ **Prehliadajúci**
   - `client` ➔ **Klient**
7. **Ochrana krehkých unit testov (Brittle Regression Tests):**
   - Staršie unit testy (napr. `demo-conversion-ui.test.ts`) môžu obsahovať assertions na pôvodné surové anglické reťazce (napr. `toContain("Start my clinic")`).
   - Pri lokalizácii takýchto komponentov vždy uprav aj prislúchajúce testy, aby kontrolovali lokalizačné kľúče alebo preložené reťazce a nerozbili testovaciu sadu.
8. **Chybové hlášky servera (tRPC API):**
   - tRPC serverové routery hádžu štandardné technické hlášky v angličtine (`"Patient not found"`, `"Unauthorized"`). Lokalizácia pre používateľa sa rieši na klientovi cez `useI18n()`.

---

## 2. AUDITNÝ ROZSAH A KĽÚČOVÉ MODULY NA LOKALIZÁCIU

### Modul A: Celá sekcia Platform Admin (`/admin`)
Centrálny riadiaci pult platformy je v súčasnosti takmer kompletne v angličtine:
1. **Hlavná stránka `apps/web/app/(dashboard)/admin/page.tsx`:**
   - Nadpisy, podnadpisy, chybové a prázdne stavy (`EmptyState`: "Unable to load platform admin", "Retry").
   - KPI panely: Názvy metrík (Practices ➔ Ambulancie, Est. MRR ➔ Odhad MRR, Active trials ➔ Aktívne skúšobné verzie, Active ➔ Aktívne predplatné, Past due ➔ Po splatnosti).
   - Blok SMS operations health: "SMS operations health", "Read-only carrier, provider-profile...", stavy carrier profilov, tabuľky logov a prevádzkových udalostí.
   - Hosted SMS configuration: popisy stavov kľúčov, webhookov, poskytovateľov (Telnyx/Twilio).
   - Správa ambulancií (Practices table): hlavičky stĺpcov, stavy fáz (Candidate, Pilot Week, Graduation Review, Completed).
   - Modálne okná, potvrdenia akcií a chybové toast hlásenia.
2. **Konzola pilotu kliniky `apps/web/components/admin/clinic-pilot-console.tsx`:**
   - `qualificationLabels`:
     - `supportedClinicType` ➔ "Podporovaný typ kliniky"
     - `supportedJurisdictionConfirmed` ➔ "Slovenská pilotná jurisdikcia potvrdená"
     - `singleLocation` ➔ "Jedno pracovisko"
     - `connectedModeAccepted` ➔ "Online cloudový režim odsúhlasený"
     - `parallelRunAccepted` ➔ "Paralelná testovacia prevádzka (shadow-run) odsúhlasená"
     - `championConfirmed` ➔ "Klinický garant (MVDr.) potvrdený"
     - `supportedWorkflowConfirmed` ➔ "Cieľové klinické workflowy podporované"
     - `noUnsupportedMustHave` ➔ "Žiadne nepodporované kritické požiadavky"
   - `readinessLabels`:
     - `rolesAndDevicesValidated` ➔ "Roly personálu a hardvérové zariadenia overené"
     - `migrationPlanAccepted` ➔ "Migračný plán dát schválený"
     - `sampleValidationAccepted` ➔ "Klinická vzorka dát validovaná lekárom"
     - `firstVisitScheduled` ➔ "Prvá reálna návšteva naplánovaná"
     - `exportAndRollbackConfirmed` ➔ "Zálohy, export a rollback plán potvrdené"
     - `supportCadenceConfirmed` ➔ "Režim dennej podpory odsúhlasený"
   - `blockerLabels`: Preklad všetkých prevádzkových prekážok (Workflow fit, Data import, Staff training, Record accuracy, Billing, Payments, Email, SMS, Permissions, Device/connectivity, Backup/export, Support coverage).
   - Tlačidlá a akčné dialógy: "Advance Stage", "Add Blocker", "Resolve", "Edit Notes".
3. **SMS Recovery konzola `apps/web/components/admin/sms-recovery-console.tsx`:**
   - Názvy frontov (Missing Provider Result, Outcome Unknown, Identity Conflict, Unmatched).
   - Akčné tlačidlá: "Reconcile Attempt", "Retry Delivery", "Resolve Conflict", "Refresh Queues".
   - Filtre, vysvetľujúce popisy prevádzkového auditu a stavové odznaky.

---

### Modul B: Demo & Marketing Infrastructure ("Blind Spot")
Tieto komponenty boli prebraté z upstreamu a obchádzajú `useI18n()`:
1. `apps/web/components/demo/demo-conversion-bar.tsx` — texty propagačného pruhu, tlačidlá na registráciu praxe.
2. `apps/web/components/demo/demo-role-switcher.tsx` a `apps/web/lib/demo-role-switcher.ts` — prepínač rolí demo režimu (Správca praxe, Veterinárny lekár, Asistent, Recepcia).
3. `apps/web/components/onboarding/*` — sprievodca prvým nastavením praxe, uvítacie kroky, výber typu ambulancie.

---

### Modul C: Autentifikácia & Formuláre
1. `apps/web/app/(auth)/login/*` — prihlasovací formulár, štítky, zabudnuté heslo, chybové hlášky.
2. `apps/web/app/(auth)/register/*` — registrácia novej ambulancie, výber časového pásma, zadanie IČO/názvu.
3. `apps/web/app/(auth)/forgot-password/*` a `/reset-password/*` — obnova hesla.

---

### Modul D: Globálne dialógy, EmptyStates a Toast notifikácie
1. Všetky inštancie `<EmptyState />`, ktoré používajú surový reťazec `title="..."` a `description="..."`.
2. Všetky potvrdenia akcií (`ActionConfirmationDialog`), kde sú tlačidlá "Cancel" / "Confirm" namiesto "Zrušiť" / "Potvrdiť".
3. Toast notifikácie (`toast.success(...)`, `toast.error(...)`) s anglickými správami.

---

## 3. ŠTANDARDIZOVANÝ SLOVNÍK TERMINOLÓGIE (SKILL OPENVPM-AI)

Pri preklade dôsledne používaj tieto slovenské ekvivalenty:

| Anglický termín | Štandardizovaný slovenský preklad | Kontext v systéme |
|---|---|---|
| Platform Admin / Operator | **Správa platformy / Operátor platformy** | Nadradená administrácia tenantov |
| Cross-tenant operations | **Medziinštitučný prevádzkový prehľad** | Správa viacerých praxí |
| Practice / Clinic | **Veterinárna ambulancia / klinika** | Pracovisko |
| Champion | **Klinický garant praxe** | MVDr. zodpovedný za pilot |
| Shadow-run / Parallel run | **Paralelná testovacia prevádzka** | Beh popri VetSoftware v2 |
| Carrier / Provider profile | **Operátorský profil SMS brány** | Telnyx / Twilio nastavenie |
| Delivery evidence | **Dôkaz o doručení správy** | Audit doručiteľnosti SMS |
| Blocker | **Prevádzková prekážka** | Dôvod pozastavenia pilotu |
| Rollback plan | **Návratový plán (Rollback)** | Obnova v prípade zlyhania |
| Suture check | **Kontrola stehov** | Pooperačná starostlivosť |
| Rabies register | **Kniha besnoty** | Zákonný register ŠVPS SR |
| Treatment diary | **Kniha ošetrení** | Záznam o podaných liekoch |
| Withdrawal period | **Ochranná lehota** | Potravinové zvieratá |
| Controlled substances | **Omamné a psychotropné látky (OPL)** | Zákon č. 139/1998 Z. z. |
| Fiscal cash register | **Fiškálna pokladnica (e-Kasa)** | Zákon č. 289/2008 Z. z. |
| Daily closure (Z-report) | **Denná uzávierka (Z-správa)** | e-Kasa uzávierka |

---

## 4. TECHNICKÝ POSTUP IMPLEMENTÁCIE (KROK ZA KROKOM)

1. **Analýza komponentu:**
   - Otvor cieľový súbor a identifikuj všetky statické anglické texty v JSX, atribútoch (`placeholder`, `title`, `aria-label`) a stavových objektoch.
2. **Príprava kľúčov:**
   - Navrhni logickú hierarchiu kľúčov (napr. `admin.pilotConsole.*`, `admin.smsRecovery.*`, `auth.login.*`).
   - Priprav JSON štruktúru s prekladmi pre `sk` aj `en`:
     ```json
     {
       "admin.kpi.practices": {
         "sk": "Ambulancie",
         "en": "Practices"
       },
       "admin.kpi.activeTrials": {
         "sk": "Aktívne skúšobné verzie",
         "en": "Active trials"
       }
     }
     ```
3. **Zlúčenie do slovníkov cez skript:**
   - Spusti skript `node apps/web/scripts/i18n-add-keys.mjs <subor.json>` na bezpečné doplnenie do `apps/web/messages/sk.json` a `apps/web/messages/en.json`.
4. **Refaktoring komponentu:**
   - Importuj `useI18n`:
     ```tsx
     import { useI18n } from "@/lib/i18n";
     // ...
     const { t } = useI18n();
     ```
   - Nahraď hardkódovaný reťazec volaním `t("kluc", "Predvolený text")`.
   - Pri dynamických hodnotách použi parametre `t("kluc", "Text {hodnota}", { hodnota })`.
5. **Overenie krehkých testov:**
   - Ak existujú unit testy viazané na daný komponent, skontroluj ich a aktualizuj očakávané hodnoty.

---

## 5. OVEROVACIE KRITÉRIÁ (DEFINITION OF DONE)

Po každej sérii úprav spusti verifikačný balík:

1. **100% i18n slovníková symetria:**
   ```bash
   node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); const a=Object.keys(en); const b=Object.keys(sk); console.log(a.length === b.length ? 'Symmetry OK: ' + a.length : 'MISMATCH: en=' + a.length + ' sk=' + b.length);"
   ```
2. **Regresné a i18n testy:**
   ```bash
   pnpm --filter @openpims/web test config/__tests__/custom-nav-i18n.test.ts components/help/__tests__/help-content.test.ts
   ```
3. **TypeScript kontrola bez chýb:**
   ```bash
   pnpm --filter @openpims/web type-check
   ```
4. **Čistý produkčný build:**
   ```bash
   pnpm --filter @openpims/web build
   ```

---

## 6. FORMÁT VÝSTUPNÉHO REPORTU

Po vykonaní prekladov odovzdaj štruktúrovaný report v tvare:

```markdown
## Výsledok lokalizačného auditu a prekladu EN textov

### 1. Preložené komponenty a súbory
- [x] `apps/web/app/(dashboard)/admin/page.tsx` (X nových kľúčov)
- [x] `apps/web/components/admin/clinic-pilot-console.tsx` (X nových kľúčov)
- [x] `apps/web/components/admin/sms-recovery-console.tsx` (X nových kľúčov)
- [x] `apps/web/components/demo/...` (X nových kľúčov)

### 2. Aktualizácia slovníkov (`messages/`)
- Novopridané kľúče celkovo: X kľúčov
- Stav symetrie: 100% zhoda (X / X kľúčov)

### 3. Technická validácia
- TypeScript type-check: OK (0 chýb)
- Unit & i18n testy: PASSED
- Next.js build: OK
```
