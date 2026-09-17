# OpenVPM AI — Audit dát, schémy, RLS a GUI prepojenia

**Dátum:** 2026-09-17 · **Vykonané:** Arena agent (senior full-stack / QA dátový architekt)
**Rozsah:** PostgreSQL schéma + relačná integrita + RLS · tRPC vrstva · GUI/i18n
**Vetva:** `arena/01a0b082-openvpm-ai` (commit `98e92fa` s `schema.sql`, `openvpm-ai-verification.sql`, `verification-out.txt`)

---

## 0. Ako bol audit vykonaný (a prečo nie proti živej DB)

### 0.1 Živé prostredie z „GROUND TRUTH“ nie je z tohto sandboxu dosiahnuteľné

| Pokus | Výsledok |
|---|---|
| TCP `dev.significa.sk:5434` | connect prejde, **`ConnectionResetError` pri prvých bytoch** (SSLRequest aj StartupMessage) |
| TCP `dev.significa.sk:443` (GUI `vet.dev.significa.sk`) | `curl: (35) SSL_ERROR_SYSCALL` — reset počas TLS handshaku, 3× za sebou |
| Porty 22 / 80 / 443 / 5434 / 8080 / 3000 | všetky „OPEN“ → **middlebox/SYN-proxy**, žiadna reálna služba |
| Kontrola `93.184.216.34:5434` | tiež „OPEN“ → sandbox má **egress allowlist** (prepúšťa github.com, registry.npmjs.org, pypi.org; ostatné končí resetom) |

Záver: tvrdenie „spojenie je priamo otestované, aktívne“ sa nedá v tomto prostredí zopakovať. **Audit sme preto presunuli na najsilnejšiu dostupnú formu offline verifikácie** — nie čítanie textu dumpu, ale **skutočné spustenie schémy v reálnom PostgreSQL 16** (PGlite/WASM), vrátane nasadenia testovacích dát a testov RLS, a **spustenie produkčného kódu** (modul času, analyzátor stromu tRPC procedúr).

Doklady (v `evidence/`):

| Súbor | Čo obsahuje |
|---|---|
| `01-structure.txt` | 178 tabuliek / 174 RLS / 189 politík / 606 FK / 801 indexov / 145 enum — DDL sa nahrá **bez jedinej chyby** |
| `02-rls.txt` | 18 exekučných testov izolácie + integrity (výstup nižšie, § 3.3) |
| `03-brief-sql.txt` | pôvodné SQL zo zadania presne prepísané a spustené voči reálnej schéme |
| `04-tz-date-input-tests.txt` | 19/19 test `apps/web/lib/date-input.ts` vrátane prechodu na letný/zimný čas |
| `05-i18n-symmetry.txt` | symetria 6 483 kľúčov, siroty, nenatranslatované hodnoty |
| `06-trpc-wiring.txt` | 36 routerov / 618 procedúr vs. všetky `trpc.*` volania v UI |
| `07-live-checks-validation.txt` | **18/18** SQL inštrukcií z `live-checks.sql` validovaných voči schéme |

### 0.2 Pôvod artefaktu je v rozpore so zadaním

`verification-out.txt` § 1 hlási `database_name = **openvpm_ai**`, kým DATABASE_URL v zadaní má `…/openpims`.
Podľa zadania je pritom `openvpm_ai` **lokálna dev databáza**. Artefakt bol teda s najvyššou pravdepodobnosťou vygenerovaný z lokálnej DB, nie zo sandboxu na 5434. Číselne je vnútorne konzistentný (178/801/145 sedí na schema.sql, 408 = súčet stavov termínov), ale **nie je dôkazom stavu testovacej inštancie**.

---

## 1. Executive summary

**Skóre pripravenosti: 78 / 100**

| Oblast | Váha | Skóre | Odôvodnenie |
|---|---:|---:|---|
| Dátový model & RLS (schéma) | 30 % | **92** | 174/178 tabuliek s RLS, fail-closed, 0 tabuliek s RLS bez politiky, DDL bezchybný. Výhrady: `FORCE ROW LEVEL SECURITY` nikde (0×), 6 tabuliek s NULL practice_id, 6 bez FK na practices. |
| Dáta pilotnej kliniky | 20 % | **62** | 2 185 klientov / 2 952 pacientov / 6 665 SOAP záznamov sedí. Ale: **0 riadkov v `drug_interactions`** (Clinical Guardian je inertný), 0 v zákonných registroch (besnota, ochranné lehoty), 0 v `ext_ai_audit_log`; 408 termínov bez akéhokoľvek dôkazu o „dnešných“. |
| tRPC / backend | 20 % | **86** | 0 nedostupných volaní UI→router, tenant GUC v transakcii (pool-safe), dešifrovanie API kľúčov všade ošetrené. Výhrady: duplikované a mŕtve procedúry, reporty s off-by-one o jeden deň, chýbajúci most predpis→omamné látky. |
| GUI & lokalizácia | 20 % | **84** | i18n 100 % symetria (6 483/6 483), `/clients` pod `/patients`, KPI počítané zo SQL, prázdne stavy aj chybové panely. Výhrady: TZ dupla-filtr na `/encounters`, Guardian widget sa pri chybe schová, skratky dní v kalendári ignorujú EN. |
| Auditovateľnosť & nástroje | 10 % | **45** | SQL v zadaní je proti schéme neplatné, verifikačný skript neobsahuje žiadnu kontrolu „dnes“, `check-i18n-symmetry.js` kontroluje len 109 z 6 483 kľúčov a nie je v CI. |

**Stav GUI a dátovej integrácie:** dôležité obrazovky (whiteboard, dashboard, karta pacienta, SOAP editor, formulár klienta) sú **napojené na reálne SQL**, nevideli sme žiadne „natvrdo 0“. Hlavné riziko nie je vizuál, ale **kvalita referenčných dát a časové pásmo nastavené klinike**.

**Najvyššie riziko:** nasadenie beží na vlastníckej DB role (`openpims`) → všetky RLS politiky sú na takejto konekcii **nečinné** a kontrola (`assertHostedRlsRoleOnce`) sa spustí len pri `HOSTED_BILLING_ENABLED` + `NODE_ENV=production`.

---

## 2. Nálezy podľa severity

### P0 — Blocker

**P0-1 · Auditné prostredie nie je overiteľné (uzavretý okruh)**
Port 5434 aj HTTPS GUI odpovedajú resetom. Kým sandbox nie je na allowliste, žiadny „živý“ audit nie je vykonateľný a artefakty nemožno považovať za dôkaz o testovanej inštancii.
*Oprava:* (a) povoliť egress IP sandboxu, alebo poslať `pg_dump --schema-only` + `verification-out.txt` priamo z 5434; (b) **rotovať heslo `openpims_secure_pass_2026`** — je verejne v zadaní.

**P0-2 · RLS je na konekcii z zadania efektívne vypnuté**
`schema.sql`: `relforcerowsecurity = false` na všetkých 174 tabuľkách → **vlastník tabuliek RLS obchádza**. `packages/db/rls/enable-rls.sql` to dokumentuje („The table OWNER bypasses RLS (we do NOT use FORCE)“) a `.env.example:2` má ako default `DATABASE_URL=…openpims…` — teda **presne tú rolu, ktorá izoláciu nevynucuje**. Exekučne potvrdené:
```
PASS  RLS-8  OWNER role (openpims) sees every tenant — RLS inert on owner connections   (n=2 z 2 praktík)
```
Ochranná poistka `apps/web/lib/rls-assertion.ts:16-23` beží len ak `HOSTED_BILLING_ENABLED` je zapnutý a `NODE_ENV=production`; inak ticho povolí štart.
*Dopad:* pri reálnych medicínskych dátach pilotnej kliniky na verejnom porte = jednovrstvová ochrana (len `practiceId` filtre v kóde).
*Oprava:* (i) `ALTER TABLE … FORCE ROW LEVEL SECURITY` pre tenant tabuľky (alebo aspoň pre 30 kritických), (ii) `DATABASE_URL` na `openpims_app`, (iii) spustiť `assertHostedRlsRole` **vždy**, nie len pri billing režime.

### P1 — Critical

**P1-1 · `drug_interactions` je prázdna → Clinical Guardian je inertný**
`apps/web/server/routers/records.ts:897-913` načíta **celú referenčnú tabuľku** a vyhodnocuje interakcie v kóde. V artefakte chýba medzi 116 neprázdnych tabuľkách → 0 riadkov. Žiadna migrácia ani seed tabuľku neplní (hľadaním `INSERT INTO drug_interactions` v `packages/db` a `apps/web/scripts` → 0 výskytov).
*Dopad:* hláška „žiadne interakcie“ je pri prázdnom katalógu nerozoznateľná od „všetko v poriadku“ — pri opioidoch a psychotropách priamo klinické riziko.
*Oprava:* nahrať slovenský referenčný katalóg (min. NSAID+steroid, ketamín+opiáty, xylazín/atipamezol, makrolidy…), doplniť `guardrail` — ak je katalóg prázdny, GUI musí ukázať „interakčná databáza nie je inicializovaná“, nie zelenú.

**P1-2 · Zákonné registre sú prázdne, hoci dáta existujú**
`ext_rabies_notifications` 0, `ext_rabies_observations` 0, `ext_withdrawal_periods` 0, `ext_carcass_disposals` 0 — pri 1 375 vakcináciách. Kniha besnoty sa v aplikácii stavia **deriveom z `vaccination_records`**, a to LIKE heuristikou (pozri P1-3).

**P1-3 · `reports.rabiesRegister` vyhľadáva vakcínu proti besnote reťazcami**
`apps/web/server/routers/reports.ts:403-410`:
```sql
lower(vaccine_name) LIKE '%rab%' OR '%besnot%' OR '%biocan r%' OR '%rabisin%' OR '%nobivac r%' OR '%defensor%'
```
Akýkoľvek iný obchodný názov (Imrab, Eurican R, Anibody Rabies, Vanguard RI…) **v legálnom registri chýba**. Chýba deterministický znak (enum/kód vakcíny), hoci `vaccination_records` má `product_name`, `rabies_tag_number`.
*Oprava:* pridať `is_rabies boolean GENERATED/derived` alebo odkaz na číselník ŠVVS; heuristiku nechať len ako pomôcku pri importe a takto určené záznamy v registri označiť.

**P1-4 · Reporty vyradia posledný deň rozsahu**
`reports.ts:415,418` a `reports.ts:522,525`:
```ts
gte(vaccinationRecords.administeredAt, new Date(input.startDate))   // 00:00 UTC
lte(vaccinationRecords.administeredAt, new Date(input.endDate))     // ⇒ 00:00 UTC, celý posledný deň preč
```
Pri `endDate = YYYY-MM-DD` sa porovnáva s polnocou → **všetky záznamy posledného dňa zmiznú** (+ posun oproti `Europe/Bratislava`). Správny vzor je v `appointments.ts:229-240` (`dateInputDayUtcRange(value, tz)` + `end − 1 ms`).
*Oprava:*
```ts
const range = {
  start: dateInputDayUtcRange(input.startDate, timezone).start,
  end:   new Date(dateInputDayUtcRange(input.endDate, timezone).end.getTime() - 1),
};
whereConds.push(gte(vaccinationRecords.administeredAt, range.start),
                lte(vaccinationRecords.administeredAt, range.end));
```

**P1-5 · 6 tenant tabuliek má `practice_id` bez NOT NULL → riadky sú pre každého tenanta neviditeľné**
`audit_log`, `funnel_events`, `stripe_events`, `sms_provider_events`, `sms_delivery_event_history`, `sms_provider_event_resolutions`. Politiky sú fail-closed (`practice_id = app_current_practice_id()`), takže rad s NULL practice_id **nikto neuvidí** — a `audit_log` má pritom 346 riadkov, `funnel_events` 151.
*Oprava:* `… practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE` + backfill; dočasne kontrola `SELECT count(*) … WHERE practice_id IS NULL` (v `live-checks.sql` § 5a).

**P1-6 · 6 tabuliek má `practice_id NOT NULL`, ale bez FK na `practices`**
`ext_support_sessions`, `visit_treatment_plan_revisions`, `visit_treatment_plan_revision_lines`, `visit_treatment_plan_responses`, `visit_treatment_plan_response_lines`, `visit_treatment_plan_presentations` → dangling tenant odkazy sú možné.

**P1-7 · Chýba zložený FK — dáta môžu byť „parentované“ cez kliniky (exekučne potvrdené)**
```
FAIL INT-6 cross-practice FK (patient of P2 owned by P1 client) → ACCEPTED
```
`patients.client_id → clients(id)` je jednostranné FK na `clients(id)`, nie `(clients.id, clients.practice_id)`. Import z PIMS/ClinicData tak môže vytvoriť pacienta kliniky P2 pod majiteľom P1 — RLS to neodhalí ani z jednej strany.
*Oprava:* pridať `UNIQUE (id, practice_id)` na `clients`/`patients` a zložené FK na `patients(client_id, practice_id)`, `appointments(client_id, practice_id)`, `invoices(client_id, practice_id)`, `soap_notes(patient_id, practice_id)`.

**P1-8 · Časové pásmo: GUI si „dnes“ počíta samo a v inom pásme ako server**
`apps/web/app/(dashboard)/encounters/page.tsx:40,74`:
```ts
const todayStr = useMemo(() => formatDateInputLocal(), []);          // pásmo prehliadača, memo raz
… formatDateInputLocal(new Date(apt.startTime)) === todayStr          // dupla-filtr klientsky
```
Zároveň server (`appointments.ts:300-311`) používa **pásmo kliniky** (`practices.timezone`). Ak sa líšia, KPI „Dnes celkovo“ aj záložka *Dnešné vyšetrenia* ukážu **0**, hoci query vrátilo riadky. `useMemo(…, [])` znamená, že sa hodnota po polnoci nikdy neobnoví — tabuľa otvorená cez noc zobrazuje „včera“. Dashboard (`page.tsx:227`) to má správne (`formatDateInputForTimeZone(today, dashboardTimeZone)`) — **nesúrodosť je dôkaz, že na `/encounters` išlo o chybu, nie zámer**.
K tomu: stĺpec `practices.timezone` má DB default `'America/New_York'` a `country 'US'`, `currency 'usd'`, `tax_rate_percent 8.00` — ak migračné ETL nenastavilo SK hodnoty, deň kliniky sa posúva o 6 hodín a sadzba DPH je nesprávna. `lib/date-input.ts:148-151` pri neplatnom pásme **ticho padne na runtime pásmo (UTC v Dockeri)**.
*Oprava:* (a) odstráňte klientsky dupla-filtr, spoľahnite sa na serverové okno; (b) `todayStr` obnovovať podľa `whiteboard.settings.timezone` a aktualizovať pri zmene dňa (tick/`refetchInterval`); (c) pri `!timezone || !isSupportedPracticeTimezone(timezone)` hádzať `PRECONDITION_FAILED` namiesto tichého fallbacku; (d) SQL na kontrolu: `live-checks.sql` § 5d.

**P1-9 · Šifrovanie AI kľúčov môže byť odvodené od verejne známeho reťazca**
`apps/web/lib/ai/ai-crypto.ts:28`:
```ts
const secretSource = process.env.NEXTAUTH_SECRET || "openvpm-dev-ai-settings-default-secret-seed";
```
`AI_SETTINGS_ENCRYPTION_KEY` **nie je vôbec v `.env.example`**. Kto má dump DB + prístup ku repozitáru, dešifruje API kľúče providerov. Samotné dešifrovanie je ošetrené správne — pozri kap. „Čo je naopak v poriadku“.
*Oprava:* hard-fail pri chýbajúcom `AI_SETTINGS_ENCRYPTION_KEY` v production, dokumentovať do `.env.example`, pridať rotáciu (encrypt-at-rest version `v2` + re-encrypt on read).

**P1-10 · „Dnešné vyšetrenia“ nie sú v artefakte vôbec podložené a 25 % termínov sa v toku dňa nezobrazí**
`openvpm-ai-verification.sql` neobsahuje jediný dotaz na `CURRENT_DATE` (62 SELECT-ov, žiadny na „dnes“), teda tvrdenie „synchronizované … a dnešnými vyšetreniami“ nie je doložené. Zároveň `whiteboard.ts:174-179` berie len `confirmed | checked_in | in_exam | checked_out` → **102 termínov v stave `scheduled` (25 %) sa na tabuli ani v KPI „V čakárni“ neobjaví** a nie je to nijako zdokumentované v UI.

**P1-11 · `ext_support_session_audit` je bez RLS**
Jedna zo 4 tabuliek bez RLS nie je auth-token, ale **audit záznamov podporných relácií** — obsahuje citlivé dáta naprieč tenantmi bez akejkoľvek izolácie. (Ostatné 3: `auth_tokens`, `sessions`, `verification_tokens` — tie sú lookup-by-token, v poriadku.)

### P2 — Minor

| # | Nález | Miesto |
|---|---|---|
| P2-1 | `appointments.getToday` **neexistuje** (zadanie ho vyžaduje); realita je `whiteboard.getActive` + `appointments.list` + `dashboard.getStats/getDashboard` | `server/routers/appointments.ts` |
| P2-2 | SQL zo zadania je voči schéme neplatné: `records`, `medical_records`, `encounters` neexistujú; SOAP = `soap_notes` (**6 665**, nie 6 664); „29 kritických tabuliek“ vs. realita **174** | `evidence/03-brief-sql.txt` |
| P2-3 | `dashboard.getStats` a `dashboard.getCharts` nikto z UI volá — dashboard používa `getDashboard`, ktorý ich logiku duplicuje (riziko driftu) | `server/routers/dashboard.ts:138,220,393` |
| P2-4 | Guardian widget sa pri chybe **schová** (`return null`) — bezpečnostný prvok ticho zmizne | `components/dashboard/clinical-guardian-widget.tsx:70-72` |
| P2-5 | Chýbajúci most predpis → omamné látky: `prescriptions` nemá `is_controlled` ani odkaz na `controlled_substance_log`; register sa vedie ručne na inej obrazovke. V SOAP editore **nie je ochranný modal** (brief ho očakáva); jediná obrana je interakčný check, ten je inertný (P1-1) | `schema.sql`, `app/(dashboard)/records/new-soap/[patientId]/page.tsx` |
| P2-6 | V legálnom registri SR sa používa americký `dea_schedule varchar(10)`; `controlled_substance_log.patient_id` môže byť NULL (záznam bez pacienta prejde) | `schema.sql` |
| P2-7 | `clinical_notes` — mŕtva tabuľka (0 riadkov): nikde sa do nej nezapisuje, ale stále ju číta kontrola pri zlúčení pacienta | `server/routers/patients.ts:364` |
| P2-8 | 193 z 438 FK vedúcich stĺpcov nemá index → sekvenčné skeny pri kontrole reštrikcií (pri 10 492 `legacy_financial_documents` a raste) | `evidence/01-structure.txt` |
| P2-9 | `whiteboard.getActive` má `.limit(100)` bez pagination — ak je v dni viac ako 100 termínov, odpoveď sa skráti bez varovania | `server/routers/whiteboard.ts:183` |
| P2-10 | i18n: polia (array) v katalógu sa nedajú načítať — `getNestedValue` vracia iba reťazce, takže `t("marketing.calendar.dayNamesShort.0","Po")` **vždy** padne na fallback. V EN móde tak kalendár obsahu ukazuje **slovenské** skratky dní | `lib/i18n/context.tsx:31-43`, `components/marketing/content-calendar-tab.tsx:168-174` |
| P2-11 | Orphanované katalógy: `messages/parts/*.json` a `messages/{sk,en}_automations.json` sa do behu nikde nespájajú; `track1-*.json` je **binárne identická kópia** `records-*.json` (zhodné MD5) → ~300 KB mŕtveho bremena; 4 kľúče v `*_automations.json` chýbajú v `sk/en.json` (zatiaľ nevadia, lebo sa nikde nepoužívajú) | `apps/web/messages/` |
| P2-12 | `scripts/check-i18n-symmetry.js` v skutočnosti kontroluje **len `settings.booking`** (109 kľúčov) a nie je napojený v CI ani v `package.json` scripts. Reálna symetria je OK, ale nič ju nevynucuje | `apps/web/scripts/check-i18n-symmetry.js` |
| P2-13 | ~12 hodnot v sk.json je nenatranslatovaných (pre brandy a skratky je to v poriadku, menej pre: `Audit`, `Editor`, `Offline`, `Online`, `Sync`, `Trigger`, `Interval`, `Program`, `Model`, `Branding`, `Logo`, `Desktop`) | `evidence/05-i18n-symmetry.txt` |
| P2-14 | Server hádza používateľské hlášky natvrdo v slovenčine → v EN lokalite anglické UI so slovenskou chybovou hláškou | `server/routers/extensions/ai-settings.ts:284,390` |
| P2-15 | V produkčnej ceste je default `http://127.0.0.1:8080/v1` (aliproxy) — v kontajneri neexistuje; zlyhanie AI sa ukáže až pri samotnom requeste | `lib/ai/ai-config-resolver.ts:158-169`, `extensions/ai-settings.ts:294` |
| P2-16 | `GET /clients` neagreguje pacientov — zoznam majiteľov nemá stĺpec „počet zvierat“ (agregácia je len v `getById`) | `server/routers/clients.ts:198-260`, `app/(dashboard)/clients/page.tsx:157-175` |
| P2-17 | Formátovanie/lint: 25 procedúr v `extensions/marketing.ts` začína na stĺpci 0 (nulové odsadenie); `patients.ts` 1 987 riadkov, `records.ts` 4 932, stránka pacienta **4 287 riadkov**; `db: any` v `lib/ai/ai-crypto`-klientoch a `applySympathyGate(db: Database \| any, …)` | viacero |
| P2-18 | SK pravopis: „**Pre** zaznamenanie súhlasu zadajte platné číslo mobilu.“ (čechizmus, správne „Na zaznamenanie…“) | `messages/sk.json` → `clients.form.smsValidNumberRequired` |
| P2-19 | Popisok vs. katalóg: v kóde je label „Klienti“, ale `sk.json/nav.clients` = „**Majitelia**“ → v UI je správne „Majitelia“, ale fallback sa líši (ľahký drift) | `components/layout/sidebar.tsx:103-108` |

### Čo je naopak v poriadku (overené, nie len prečítané)

- **RLS funkčne drží:** 10 exekučných testov — deny-by-default, izolácia čítania, tichý 0-row cross-tenant UPDATE, `WITH CHECK` odmietne cross-tenant INSERT, `practices` self-only.
- **`withTenant` nastavuje GUC ako `set_config(..., true)` vnútri transakcie** → odolné voči prepájaniu pooled konekcií; `publicProcedure`/`portalProcedure` explicitne `withSystem`.
- **Integrita:** `patients.client_id` NOT NULL + FK, `soap_notes.patient_id` FK, `appointments.patient_id` FK — siroty sú vylúčené na úrovni DDL (briefové `SELECT … WHERE client_id IS NULL` je preto vždy 0 a nie je dôkazom kvality dát). Hard-DELETE pacienta s anamnézou schéma **odmietne** (RESTRICT) → mäkké zmazanie (`deleted_at`) je jediná cesta, čo GUI rešpektuje.
- **Ošetrenie dešifrovania API kľúčov:** `ai-config-resolver.ts:109-117` (`tryDecrypt` → varovanie + fallback), `extensions/ai-settings.ts:70-77` (`safeDecrypt`), mutation `262-290`/`370-398` → `TRPCError BAD_REQUEST`. Žiadna fatálna cesta, aplikácia nepadá.
- **SOAP editor:** `finalizeSoapNote` je transakčný, s `expectedRevision` (optimistické zamykanie), obmedzené na role `admin|veterinarian`, webhook až po commite; AI draft má 30 s abort a graceful `SoapDraftUnavailableError`.
- **Časový modul** `lib/date-input.ts`: 19/19 testov, vrátane 23-h/25-h dňa pri prechode na letný/zimný čas a odmietnutia neexistujúceho času v „dziere“.
- **SQL injection:** `sqlStringLiteral()` zdvojnásobuje úvodzovky `'` a `practices.timezone` prechádza `isSupportedPracticeTimezone` → OK; zvyšok ide cez parametre.
- **GUI→tRPC wiring:** 0 rozbitých odkazov na 618 procedúr; alias `visitTreatmentPlans` (deprecated) funguje.
- **`/clients/new`:** adresné polia plne po slovensky — *Ulica a číslo* / *Mesto* / *Okres / Kraj* / *PSČ* so slovenskými placeholdermi; GDPR poučenie o SMS + potvrdenie súhlasu + história súhlasov prítomné.
- **Počítadlá dashboardu a obrazovky vyšetrení** nie sú natvrdo 0 — `dashboard.ts:138-220` a `encounters/page.tsx:71-93` počítajú z reálnych dotazov; prázdne stavy (`EmptyState`) a chybové panely sú implementované.

---

## 3. Akčný zoznam

### 3.1 Okamžite (1. deň, bez migrácie)

| # | Úkon | Súbor / riadok |
|---|---|---|
| 1 | Zmeniť DB connect pilotnej inštancie na `openpims_app` a **rotovať** heslo `openpims…` | deployment env; `packages/db/apply-rls.ts:33-51` |
| 2 | Spúšťať RLS aserciu aj bez billing režimu | `apps/web/lib/rls-assertion.ts:16-23` → `return !envFlagEnabled("SKIP_RLS_BOOT_ASSERTION") && (NODE_ENV==='production' \|\| !isDev)` |
| 3 | Odstrániť klientsky dupla-filtr a memo na „dnes“ | `app/(dashboard)/encounters/page.tsx:40,71-77` |
| 4 | Fix konca dátumového rozsahu v oboch zákonných výstupoch | `server/routers/reports.ts:415-418`, `522-525` (kód v P1-4) |
| 5 | Guardian: pri `error` zobraziť varovanie, nie `null` | `components/dashboard/clinical-guardian-widget.tsx:70-72` |
| 6 | Pridať `AI_SETTINGS_ENCRYPTION_KEY` do `.env.example` + hard-fail v prod | `lib/ai/ai-crypto.ts:14-29` |
| 7 | Spustiť `live-checks.sql` na 5434 a priložiť výstup | `artifacts/data-rls-gui-audit-2026-09-17/live-checks.sql` (18/18 validovaných) |

### 3.2 Migrácie (2.–3. deň)

```sql
-- (A) vynútiť RLS aj pre vlastníka (po prepnutí na openpims_app!)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.relname FROM pg_class c
            JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
             AND EXISTS (SELECT 1 FROM pg_attribute a
                          WHERE a.attrelid=c.oid AND a.attname='practice_id')
  LOOP EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.relname); END LOOP;
END $$;

-- (B) žiadny pacient bez majiteľa / rad bez kliniky
ALTER TABLE patients      ALTER COLUMN client_id  SET NOT NULL;
ALTER TABLE audit_log     ALTER COLUMN practice_id SET NOT NULL;   -- po backfill-i
ALTER TABLE funnel_events ALTER COLUMN practice_id SET NOT NULL;

-- (C) zabrániť krížovému parentovaniu (P1-7)
ALTER TABLE clients  ADD CONSTRAINT clients_id_practice_uq  UNIQUE (id, practice_id);
ALTER TABLE patients ADD CONSTRAINT patients_id_practice_uq UNIQUE (id, practice_id);
ALTER TABLE patients ADD CONSTRAINT patients_client_practice_fk
  FOREIGN KEY (client_id, practice_id) REFERENCES clients (id, practice_id) DEFERRABLE INITIALLY DEFERRED;

-- (D) FK na practices tam, kde chýba (P1-6)
ALTER TABLE visit_treatment_plans        ADD FOREIGN KEY (practice_id) REFERENCES practices(id);
ALTER TABLE visit_treatment_plan_revisions ADD FOREIGN KEY (practice_id) REFERENCES practices(id);
-- (rovnaký vzor pre *_revision_lines / *_responses / *_response_lines / *_presentations / ext_support_sessions)

-- (E) indexy pre FK bez indexu (193, top 20 podľa objemu)
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx     ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS appointments_client_id_idx      ON appointments (client_id);
CREATE INDEX IF NOT EXISTS soap_notes_appointment_id_idx   ON soap_notes  (appointment_id);
CREATE INDEX IF NOT EXISTS clinical_record_corrections_patient_id_idx ON clinical_record_corrections (patient_id);

-- (F) omamné látky napojené na predpis
ALTER TABLE prescriptions ADD COLUMN is_controlled boolean NOT NULL DEFAULT false;
ALTER TABLE prescriptions ADD COLUMN controlled_log_id uuid REFERENCES controlled_substance_log(id);
ALTER TABLE controlled_substance_log ALTER COLUMN patient_id SET NOT NULL;

-- (G) referenčný katalóg interakcií (in else je Guardian slepý)
INSERT INTO drug_interactions (drug_a, drug_b, severity, description) VALUES
  ('ketamine','morphine','critical','útlm dýchania — vyžaduje monitoring'),
  ('meloxicam','prednisolone','major','NSAID + kortikosteroid: riziko GI ulcerácie'),
  ('xylazine','atipamezole','info','reverzácia xylazínu — monitoruj dýchanie');
```

### 3.3 Reprodukované výsledky testov izolácie (PGlite / PostgreSQL 16.15)

```
PASS RLS-1  deny-by-default when app.current_practice_id is unset        (patients visible = 0)
PASS RLS-2  tenant sees exactly its own rows                              (n=1)
PASS RLS-3  tenant join patients↔clients intact
PASS RLS-4  other tenant cannot read clinical notes                      (n=0)
PASS RLS-5  cross-tenant UPDATE silently matches 0 rows (no leak)
PASS RLS-6  cross-tenant INSERT rejected by WITH CHECK
PASS RLS-7  app.rls_bypass=on exposes ALL tenants (pool-leak blast radius)
PASS RLS-8  OWNER role (openpims) sees every tenant — RLS inert          ← podklad pre P0-2
PASS RLS-9  users table readable only in tenant ctx (login musí ísť cez withSystem)
PASS RLS-10 practices policy = self only
PASS INT-1..INT-5, INT-7  NOT NULL + FK vylučujú siroty, hard-delete pacienta odmietnutý
FAIL INT-6  cross-practice mis-parenting ACCEPTED                        ← podklad pre P1-7
PASS INT-0  bez lokality nemožno vytvoriť termín (trigger RAISE)         ← riziko pri onboardingu novej kliniky
PASS TZ-1   UTC-cast okno ≠ Bratislava okno                              ← podklad pre P1-8
```

### 3.4 Nástroje, ktoré treba doplniť, aby sa audit dal opakovať

1. `apps/web/scripts/check-i18n-symmetry.js` — prepísať na celú katalógovú symetriu (6 483 kľúčov) + kontrola, že každý `t("…")` kľúč existuje; zaradiť do CI (`.github/workflows/*` momentálne **žiaden** i18n job nemá).
2. Do `openvpm-ai-verification.sql` pridať sekciu **„Today (practice-local)“** — SQL je v `live-checks.sql` § 2a/2b; pridať sekciu „empty required seeds“ (§ 6).
3. `drug_interactions.row_count = 0` a `ext_clinical_guardian_alerts = 0` nechať failnúť ako **chyba**, nie ako warning.
4. `patients` merge kontrola: odstrániť OR nad `clinical_notes` (mŕtva) alebo tabuľku zrušiť.

---

## 4. Odporúčaný postup overenia (čo má urobiť človek hneď)

```bash
# 1) otvoriť egress pre sandbox (alebo spustiť z prostredia, ktoré má povolené 5434)
psql "postgresql://openpims_app@dev.significa.sk:5434/openvpm_ai" \
     -f artifacts/data-rls-gui-audit-2026-09-17/live-checks.sql \
     -o live-checks.out

# 2) porovnať s artefaktom
grep -E "^ *[0-9]+ " live-checks.out | head -40   # 2185 / 2952 / 6665 ?

# 3) GUI — 4 obrazovky, ktoré rozhodnú
#    /            → KPI "Dnešné termíny" > 0 ?  Guardian dlaždice viditeľná ?
#    /encounters  → "Dnes celkovo" sedí s /schedule na ten istý deň ?  (test P1-8)
#    /patients/<id> → anamnéza, očkovanie, prílohy (RTG/mikr.), PDF potvrdenie
#    /clients/new → slovenské adresné polia + SMS poučenie
```

Ak `live-checks.out` § 5d ukáže `timezone_wrong_for_sk = true` alebo `currency_not_eur = true`, P1-8 je **aktívny defekt** pilotnej kliniky, nie len riziko.
