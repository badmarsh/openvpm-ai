# Upstream Backport Plan -- openvpm-ai from evangauer/openvpm

> **Typ ulohy:** Infrastrukturny backport, mimo sprintovy cyklus
> **Vytvorene:** 2026-09-28
> **Zdroj analyzy:** .gemini/antigravity/brain/26bfd515.../backport-selection-analysis.md
> **Overene a opravené:** 2026-09-28 -- `git fetch upstream main`, 176 suborov porovnanych
> proti `upstream/main` (tip `f1a3363`). Pozri sekciu [Korekcia planu](#korekcia-planu-preverene-fakty).

---

## ⚠️ Korekcia planu (preverene fakty)

Tato sekcia bola doplnena po overeni planu proti skutocnemu repozitari.
**Najdolezitejsi zaver: plan v podobe, v akej je napisany, nie je vykonatelny tak, ako tvrdi.**

### 1. Faza 1 uz JE aplikovana -- je to no-op

Povodny plan navrhoval Fazu 1 ako "trivialnu kanariu" na overenie cherry-pick pipeliny.
Overenie ukazalo, ze **nie je co picknut**. Vsetok obsah oboch commitov uz v nasom strome je:

| Zmena z #322 / #318 | Nase aktualne umiestnenie | Stav |
|---|---|---|
| `fflate: 0.8.3` override (#322) | `package.json` + `pnpm-lock.yaml` (4 vyskty) | ✅ uz tam |
| fflate 0.8.3 nainstalovany | `node_modules/.pnpm/fflate@0.8.3`, 0 ks 0.8.2 | ✅ |
| tiptap 2.x -> 3.30.5 (#318) | `apps/web/package.json` (core/react/starter-kit/highlight) | ✅ uz tam |
| `@tiptap/extension-underline` odstraneny | uz chybi v src aj v direct deps | ✅ |
| tiptap v3 API v `SoapNoteEditor.tsx` | `immediatelyRender`, `setContent({emitUpdate})` | ✅ subor je **byte-identicky** s upstreamom po c66a1ad3 |
| overrides browserslist / qs 6.16.0 / postcss-selector-parser | `package.json` | ✅ uz tam |
| tiptap bubble/floating-menu overrides | `package.json` | ✅ uz tam |
| `@faker-js/faker` odstraneny | `packages/db/package.json`, 0 vyskyt v lockfile | ✅ |
| `tiptap-attribute-security.test.ts` | existuje | ✅ |
| `soap-editor-ui.test.ts` updatovany | existuje, uz tvrdi "no extension-underline" | ✅ |

Overenie testami: `soap-editor-ui.test.ts` + `tiptap-attribute-security.test.ts` = **22/22 zelene**.

Empiricke overenie cherry-picku (`git cherry-pick --no-commit 0767aff0`):

```
Auto-merging package.json      -> nulovy diff (override uz existuje)
Auto-merging pnpm-lock.yaml    -> CONFLICT
```

Konflikt je **cisto kontextovy a nesuzisy s fflate** -- je to `file-entry-cache@6.0.1`,
teda balik, ktory nema nic spocne c s touto security patchou. Vznikol len tym, ze nase
zavislosti su inaku verzie a historie su nesuvise (pozri bod 2).

### 2. Nase historie a upstream su NESUVISE -- nie je merge base

```
$ git merge-base HEAD upstream/main
(nic)                          # unrelated histories
$ git rev-list --count HEAD
1                              # nas repo je JEDEN squasovany commit
$ git rev-list --count HEAD..upstream/main
403
```

Nas repozitar je squash-import: **1 commit** (`f78fec2`) nes obsahuje celu historiu.
Upstream ma vlastnu, nesuvisiuhistoriu. **Nie je ziadny spoločny predchodca.**

Dôsledky:
- "Upstream ahead 396 commitov" v povodnom plane bolo **správne** (dnes uz 403, upstream pokracuje).
- Ale **ziadny cherry-pick sa nema o co opriet** -- kazdy konflikt je cisto textovy konflikt
  medzi dvoma cudzimi vetvami historie, nie odvodenie od spoločneho base.
- Pôvodný predpoklad, ze konflikt v `pnpm-lock.yaml` je "mechanicky", **neplatí**.

### 3. ⚠️ Krok 2 v plane je DESTRUKTIVNY -- musi sa zmenit

Pôvodný text:
> *"ak conflict v pnpm-lock.yaml, akceptuj upstream verziu a re-run pnpm install"*

**Toto nerobte.** Náš `pnpm-lock.yaml` (410 KB, 115 namiestnenych balíkov) odráža
rozdielnu sadu zavislostí: `next 15.5.24`, `sharp 0.35.4`, `qs 6.16.0`, cele `ext_`
strom a 176 suborov s rozdielnym obsahom. Prevzatie upstream lockfilu by **potichu
nahradil nás dependency graf** cudzou verziou a zlomilo build bez ziadnej chyby
v `git status`.

Správne riešenie konfliktu v lockfile: **nikdy neber cudzí lockfile** -- vyhodit
upstream verziu, nechat `package.json` ako source of truth a lockfile regenerovat
(`pnpm install --lockfile-only`). Overili sme, že nás lockfile je konzistentný:
`pnpm install --frozen-lockfile` prejde bez chyby.

### 4. Plan ma zle oznaceny subor -- `encounters/page.tsx`

Pôvodný text:
> *"encounters/page.tsx | nasa 5938 riadkov vs upstream 4339"*

Overenie:

| Subor | Nase | Upstream |
|---|---|---|
| `apps/web/app/(dashboard)/encounters/page.tsx` | **912** | **neexistuje** |
| `apps/web/app/(dashboard)/encounters/[appointmentId]/page.tsx` | **5938** | 4449 |

Cislo 5938 je spravne, ale patri do `encounters/[appointmentId]/page.tsx`.
`encounters/page.tsx` ma u nas 912 riadkov a **upstream taky subor nema vobec**.
Vsetky tri merge kroky v Faza 4 a Faza 5, ktore hovoria o "encounters page",
v skutocnosti ukazuju na `encounters/[appointmentId]/page.tsx`.
Naopak: ak sa niekedy pokusi merge `encounters/page.tsx`, upstream ma nic co by sa dalo vziat.

### 5. Vsetky markery faz 1-5 uz v nasom strome existuju

Pôvodný plán ich popisuje ako "nove subory" a "nove schemy", ktore treba pridat:

| Faza | Subory, ktore plan vola "nove" | Existuju? |
|---|---|---|
| 2 | `packages/db/schema/portal-sessions.ts` | ✅ existuje (+ `portal_sessions` v RLS) |
| 3 | `backup-runs.ts`, `platform-email-preferences.ts` | ✅ oba existuju |
| 4 | `prescription-inventory-product-picker.tsx`, `unfinished-field-visits.tsx` | ✅ oba existuju |
| 5 | `weight-correction-dialog.tsx`, `patient-document-upload.tsx`, `markup-input.tsx`, `lib/quantity.ts`, `lib/records/prescription-policy.ts` | ✅ vsetky existuju |

### 6. Faza 5 schema zmena je UZ aplikovana -- kolizia 0105 je vyriesena inak

Plan strašuje, že upstream `0105_fractional_medication_quantities` koliduje s našim
`0105_nifty_ultimatum`, a navrhuje ručne upraviť vanilla `.ts` schemy + `pnpm db:push`.

Overenie: **`numeric(13,3)` je už v našich schémach:**

```
prescriptions.ts:50          quantity: numeric("quantity", { precision: 13, scale: 3, mode: "number" })
prescription-events.ts:54    quantity: numeric("quantity", { precision: 13, scale: 3, mode: "number" })
billing.ts:233               quantity: numeric("quantity", { precision: 13, scale: 3, mode: "number" }).notNull().default(1)
dispense-charge-queue.ts:67  quantity: numeric(...)
```

Aplikoval ju **naš** commit `0108_adorable_misty_knight.sql`, nie upstream 0105.
Plan teda navrhuje prácu, ktorá je hotová, a riskuje, že ju pokazi.

### 7. V niektorých súboroch sme MY napred -- cherry-pick by nás znevýhodnil

Najdôležitejší príklad: `apps/web/server/trpc.ts` (nase 908 riadkov, upstream 607).
**Náš je striktný superset.** Upstreamová verzia by pri apply vyčíslila:

- `autonomousProcedure` (celý procedure pre dlhe externe AI/imagery tasky)
- `activeSessionCache` + `practiceBillingCache` (+ ich invalidate funkcie)
- self-healing stale session claims (id aj email fallback)
- `NEXT_PUBLIC_APP_NAME` branding v chybach

Toto sú **naše** funkcie (AI imaging, hosted cloud), nie niečo, čo nám chýba.
Plánovo pravidlo #3 ("nikdy nezmaž naše bloky") tu nestačí -- upstream nemá len
"naše bloky navyše", on **naše bloky vymazuje**.

### 8. Skutočny stav 176 dotknutych suborov

Porovnanie naseho stromu proti `upstream/main` (tip `f1a3363`) pre vsetky subory,
ktore dotknuť uvedenych 15 commitov (bez `pnpm-lock.yaml`):

| Kategoria | Pocet | Vyznam |
|---|---|---|
| **Byte-identicke s upstream tipom** | **102** | backport uz hotovy, neroznicujte |
| **Nas superset** (z upstreamu nema nic co nam chyba) | 11 | nesahte |
| **Ma diff voci upstreamu** | 57 | tu je jediny potencialny material |
| **Chyba u nas** | 6 | pozri nizsie |

Z **6 chybajucich** suborov je 5 upstreamovy vlastny e2e harness
(`e2e/jayne-*.spec.ts`, `playwright.jayne-*.config.ts`, `docs/testing/clinic-followup-workflows.md`)
a 1 je `0105_fractional_medication_quantities.sql`. **Ziadny z nich nie je produktovy
kod** -- je to testovaci harness upstreame a migracia, ktoru sme nahradili vlastnou 0108.

Per-fazovy rozpad (subory priradene prvej faze, ktora ich dotkla):

| Faza | Identicke | Nas superset | Ma diff | Chyba |
|---|---|---|---|---|
| 1. Security | 2 | 0 | 5 | 0 |
| 2. Portal sessions | 57 | 5 | 11 | 0 |
| 3. Identity rotation | 18 | 3 | 10 | 0 |
| 4. Prescription + field | 10 | 0 | 20 | 0 |
| 5. Clinical workflow | 23 | 4 | 39 | 6 |

**Faza 2 je prakticky hotova** (57 z 73 suborov je byte-identickych).
**Faza 1 je hotova cela.** Zo 7 suborov (bez lockfile) su 2 byte-identicke
(`SoapNoteEditor.tsx`, `tiptap-attribute-security.test.ts`). Zvysne 4 maju **1-3 riadkove
rozdiely, ktore nie su bezpecnost** -- overene, co z nich upstream ma a my nemame:

| Subor | Co upstream ma a my nemame | Verdikt |
|---|---|---|
| `package.json` | `verify:oss-release` (my ho mame inak) | formatovanie |
| `packages/db/package.json` | `version: 0.1.0` (my: 0.6.0), `db:studio` | my sme dalej |
| `apps/web/package.json` | 3 riadky -- nase vlastne skripty a zavislosti | my sme dalej |
| `soap-editor-ui.test.ts` | 2 assertiony `currentTab === "soap"` / `"vaccinations"` | refaktor nasej encounters stranky |

**Ziadny z tychto rozdielov nie je chybajuci bezpecnostny patch.**

---

## Journal a kompatibilita s upstream (overene 2026-09-28)

### Kde sa historie lámu presne

Porovnanie `packages/db/drizzle/meta/_journal.json` (nase 115 zaznamov, idx 0-114)
proti upstreamu (106 zaznamov, idx 0-105):

- **idx 0-104: identicke tag AND `when` timestamp.** Tvrdenie planu o zdielanych
  migraciach 0099-0104 je spravne a ide o to najsilnejsiu zhodu, aku dva repozitare
  o migraciach mozu mat.
- **idx 105: prvy bod rozporu.** `0105_nifty_ultimatum` vs `0105_fractional_medication_quantities`
  - iny tag **aj iny `when`**.
- Nase navysok: idx 106-114 (9 migracii). Upstream navysok: ziadny.

### ⚠️ Kolizia 0105 je NOMINALNA, nie STRUKTURALNA

Obe 0105 migracie su **disjoint na urovni DB objektov**:

| | Nasa `0105_nifty_ultimatum` | Upstream `0105_fractional_medication_quantities` |
|---|---|---|
| Typ | cisto **aditivny** | cisto **alteracny** |
| Obsah | ~20 CREATE TYPE + tabulky `ekasa_*`, `ai_imaging_analyses`, `microchip_registrations`, `pet_passports`, `lab_analyzer_reports`, `voice_dictations`, `discharge_reports`, `ext_marketing_*`, `ext_ai_audit_log`, `ext_clinician_confirmations` + indexy + CHECK constraint na `files` | `DROP TRIGGER` + 5x `ALTER COLUMN ... SET DATA TYPE numeric(13,3)` + `CREATE TRIGGER` |
| Kohy sa dotyka | len novych objektov | `prescriptions`, `prescription_events`, `invoice_items`, `products`, `dispense_charge_queue` |

Vsetky tabulky, ktore upstream 0105 alteruje, su vytvorene v **zdielanych** migraciach
(`0000_baseline`, `0048_prescription_lifecycle`, `0049_dispense_charge_queue`).
**Nulovy prienik.** Obe SQL by sa dali aplikovat v lubovolnom poradi bez konfliktu.

Zaver: **"kolizia" je suvisiaca s indexom/tagom v journale, nie s databazou.**

### Tri vrstvy, v ktorych je nekompatibilita realne

1. **Identita migracie v ledgeri.** `drizzle.__drizzle_migrations` (`packages/db/baseline.ts:396`)
   drzi `hash = migrationHash(tag)` a `created_at = entry.when`. Iny `when` na idx 105 = ina
   identita. Kto by pustil `drizzle-kit migrate` s cudzim journalom, pokusil by sa znova
   aplikovat 0105 a stratil stopu o nasich 106-114. `db:baseline` je jednorazovy a **odmietne
   bezat**, ak ledger uz existuje (`assertNoMigrationLedger`).

2. **Schema TS je source of truth, nie journal.** `packages/db/schema/*.ts` + nase `ext_*.ts`
   (eKasa, AI imaging, marketing, KVEPIS...). Upstreamova schema by odstranila ext_ stromy.
   Toto je ta skutocna nekompatibilita -- a preto su `enable-rls.sql` a ext_ discovery
   v globalnych pravidlach planu.

3. **Git guard, ktory uz existuje.** `apps/web/lib/__tests__/migration-journal-integrity.test.ts:550`
   -- `"preserves merge-base migration artifacts byte-for-byte and adds only at the tail"`.
   Robi `git diff --name-status <mergeBase> -- packages/db/drizzle`, vyhodi vsetko co nie je
   `A` (pridanie), a tvrdi *"merge-base SQL and snapshots must remain byte-for-byte identical"*.
   Navyse porovna **raw textove segmenty** journalu: `currentSegments.prefix === baseSegments.prefix`
   a `.suffix === .suffix`. Toto je invariant, ktory by automaticky zamietol vsetko, co by
   prepisalo existujucu migraciu alebo journalovuHistoriu v strede.

**Dobre spravedlivo:** guard nevie nic o `0105_fractional...` oproti `0105_nifty_ultimatum`
-- on totiž porovnava nasu vlastnu historiu s merge-base **naseho repo**, nie s upstreamom.
Zamietne zmenu, nie cudzi obsah.

### Výhrada: tento guard tu dnes nebeží

```ts
it.skipIf(!hasConfiguredMigrationBase)(...)
// hasConfiguredMigrationBase = Boolean(MIGRATION_INTEGRITY_EVENT_NAME || MIGRATION_INTEGRITY_BASE_REF)
```

Spúšťa sa len v CI, kde sú tie env premenne nastavene. V tomto sandboxe je repo **jeden
squasovany commit** a merge base neexistuje, takze test je **preskoceny** -- to je ten
`1 skipped` z vysledku 114 testov. Na skutocnom GitHub repozitari s plnou historiou v CI bezi.

### Overeny stav journalu

```
migration-journal-integrity.test.ts  17 testov (1 skipped)
db-migrations.test.ts                 74 testov
schema-drift.test.ts                  23 testov
                                    -----------------------------
                                    113 passed | 1 skipped
```

### ⚠️ OPRAVA: globalne pravidlo 5 planu je v rozpore s CI

Pôvodný text:
> *"5. Migrácie aplikuj výhradne cez pnpm db:push"*

**Toto je nespravne a nebezpecne.** `drizzle-kit push` mutuje DB priamo a **obída journal** --
zmenu v DB spôsobí bez zápisu do `_journal.json` a bez generovanej migrácie. CI vsak beží:

```yaml
db:migrations:check   # "Verify append-only migration history"
db:migrate            # aplikuje COMMITED migracie (nie push)
db:generate           # drift guard: musi vyplavit "No schema changes", inak schema zbehla bez migracie
```

Aj `tasks/RULES.md` §1.2 hovori `pnpm db:generate` a CI to vynucuje.
Keby sa Faza 5 spravila podla planu (upravit vanilla `.ts` schemy + `pnpm db:push`),
push by zmenil DB bez migracie a drift guard by v CI spadol.

Ironicky je to zbytocne aj tak: `numeric(13,3)` uz je v nasich schemach aj v nasom
commite `0108_adorable_misty_knight.sql`, takze `db:generate` by netrebali nic.

**Spravne pravidlo je:** zmenu schemy spravit v `packages/db/schema/*.ts`, potom
`pnpm db:generate` (nie `push`), a commitnut `drizzle/NNNN_*.sql` + `meta/NNNN_snapshot.json`
+ `meta/_journal.json`. Druhy `db:generate` musi vypisat "No schema changes".

---

## Odporucane dalsie kroky (namiesto puvodneho postupu)

1. **Neprobhaj Fazu 1 ako zmenu.** Nema diff. Ak chcete, mozno ju uzavriet ako
   "overene, uz aplikovane" v `tasks/VERIFICATION-LOG.md` s vysledkami 22/22.
2. **Opravte pravidlo o lockfile** (bod 3) -- je to najnebezpecnejsi krok v povodnom plane.
3. **Faza 2: diff-nahlad** na tych 11 suboroch s diffom. Ak su to len nasi supersety,
   Faza 2 je hotova.
4. **Faza 5: najprv zistit, ci `has diff` su vykonane zmeny alebo refaktor.** 39 suborov
   s diffom v nasom vlaknu zrejme nie su backport ale kazodenne vyvoj. Rozhodnut patri
   vlastnikovi produktu, nie planu.
5. **Kazdu fazu zvazte na "diff" nie na "chybajuce subory"** -- subory uz existuju,
   ide len o to, ci v nich chyba konkretne správanie.

---

## Pôvodný plán (pôvodne napísaný 2026-09-28, zachovaný pre referenciu)

Nasledujúci text je pôvodný obsah súboru. Jeho *fakty* boli opravené vyššie;
*postup* zostáva ako pôvodný návrh, kým sa nerozhodne inak.

---

## Korekcia pôvodnej analýzy

Analýza tvrdí, že migrácie divergujú od indexu 0099. V skutočnosti sú migrácie
**0099-0104 identické** medzi nami a upstreamom. Divergencia nastáva až pri **0105** --
upstream má 0105_fractional_medication_quantities, my máme 0105_nifty_ultimatum
(ext_ schémy pre eKasa, AI imaging, marketing). Portal sessions (0097), identity-key
rotation (0101) a ďalšie infrastruktúrne migrácie sú zdieľané.

## Stav repozitára

| Fakt | Hodnota |
|---|---|
| Upstream ahead | 396 commitov |
| Zdieľané migrácie | 0000--0104 |
| Divergencia | od 0105 |
| Posledná naša migrácia | 0114 |
| encounters/page.tsx | naša 5938 riadkov vs upstream 4339 |
| Naše ext_ rozšírenia | eKasa, AI imaging, marketing, KVEPIS, voice, discharge reports |

---

## Fáza 1 -- Security patches (triviálna)

**Branch:** swarm/backport-security-patches
**Commity:** 0767aff0 (#322 fflate DoS) + c66a1ad3 (#318 dependency isolation)
**Zložitosť:** Triviálna -- 9 súborov, žiadne migrácie, žiadne schema zmeny

### Postup

1. Vytvor branch swarm/backport-security-patches z origin/main
2. git cherry-pick --no-commit 0767aff0 -- ak conflict v pnpm-lock.yaml, akceptuj upstream verziu a re-run pnpm install
3. git cherry-pick --no-commit c66a1ad3 -- ak conflict v pnpm-lock.yaml, re-run pnpm install. Skontroluj SoapNoteEditor.tsx -- merge upstream zmeny (tiptap import) bez straty našich zmien
4. pnpm install na regeneraciu lockfilu
5. pnpm lint && pnpm typecheck && pnpm test
6. Commit a push, vytvor PR do origin/main

### Riziko
Nízke. pnpm-lock.yaml conflict je mechanický.

> **OPRAVENÉ:** body 1--6 sú neplatné. Fáza 1 je už aplikovaná (no-op), konflikt
> v lockfile je kontextový a nesúvisí s fflate, a "akceptuj upstream verziu" je
> destruktívne. Pozri body 1 a 3 vyššie.

---

## Fáza 2 -- Revocable portal sessions (infraštruktúra)

**Branch:** swarm/backport-revocable-sessions
**Commity:** 32157864 + ebb192c3 + 4f758763 + c4fb7ce0
**Zložitosť:** Náročná -- 60+ súborov, nová schema, trpc middleware refactor
**Závislosť:** Žiadna (migrácia 0097 je zdieľaná)

### Postup

1. Vytvor branch z origin/main
2. Pre KAŽDÝ cherry-pick použi --no-commit a VYNECHAJ zmeny v packages/db/drizzle/ a meta/_journal.json
3. Pridaj portal-sessions.ts schema a re-export v packages/db/schema/index.ts
4. Merge clients.ts -- upstream pridáva session-related stĺpce
5. **KRITICKY:** enable-rls.sql merge -- upstream pridáva portal_sessions RLS. ZACHOVAJ naše rozšírenia: ext_ dynamic table discovery, AI audit ledger trigger+REVOKE, clinician confirmations REVOKE DELETE, ::text cast v policy USING/WITH CHECK
6. server/trpc.ts -- merge portal auth middleware
7. server/routers/portal.ts -- merge 502 riadkov zmien, zachovaj naše portal rozšírenia
8. Po cherry-pickoch: pnpm db:push && pnpm db:rls && pnpm db:rls:preflight
9. pnpm lint && pnpm typecheck && pnpm test
10. Commit a push, vytvor PR

### Riziko
Vysoké. Portal router a trpc middleware sú centrálne. RLS merge vyžaduje opatrnosť.

> **OPRAVENÉ:** body 3--7 sú zastaré (`portal-sessions.ts` existuje, RLS je hotový,
> 57/73 súborov je byte-identických). Bod 6 je navyše nebezpečný -- náš `trpc.ts`
> je superset a upstream by vymazal `autonomousProcedure` a billing cache.
> Pozri body 5 a 7 vyššie.

---

## Fáza 3 -- Identity-key rotation + dormant demo schema (#323 + #324)

**Branch:** swarm/backport-identity-rotation
**Commity:** 4225cada (#323) + cc189d67 (#324)
**Zložitosť:** Stredná
**Závislosť:** Žiadna (migrácie 0100 a 0101 sú identické)

### Postup

1. Vytvor branch z origin/main
2. Cherry-pick 4225cada (--no-commit). VYNECHAJ packages/db/drizzle/0100_* a meta zmeny
3. Pridaj backup-runs.ts schema, merge users.ts zmeny, re-export v index.ts
4. enable-rls.sql -- merge upstream #323 zmeny, ZACHOVAJ ext_ rozšírenia
5. Cherry-pick cc189d67 (--no-commit). VYNECHAJ drizzle 0101 zmeny
6. platform-email-preferences.ts schema -- merge 87 riadkov
7. email-preferences.ts + platform-email-preferences.ts lib -- 668 riadkov; opatrný merge
8. Health route -- merge upstream rozšírenia
9. pnpm db:push && pnpm db:rls
10. Plná verifikácia

### Riziko
Stredné. Schema zmeny sú čisté, ale platform-email-preferences.ts je veľký refaktor.

> **OPRAVENÉ:** body 3 a 6 sú zastaré (`backup-runs.ts` aj `platform-email-preferences.ts`
> už existujú). Migrácie 0100/0101 sa vôbec nepreverovali -- naša 0100 je vlastná
> a `_journal.json` patrí našim 115 migráciám.

---

## Fáza 4 -- Prescription pagination + field billing (#321, #325, #326, #333)

**Branch:** swarm/backport-prescription-field-billing
**Commity:** 552a0a86 (#321) + 396c1cc4 (#325) + d6e187a7 (#326) + 4077a890 (#333)
**Zložitosť:** Stredná
**Závislosť:** Žiadna (migrácia 0099 je zdieľaná)

### Postup

1. Vytvor branch z origin/main
2. Cherry-pick POSTUPNE, každý --no-commit. VYNECHAJ drizzle zmeny pre #321
3. prescription-inventory-product-picker.tsx -- nový komponent z #321
4. records/page.tsx -- merge upstream zmeny, zachovaj ext_ rozšírenia
5. encounters/page.tsx -- #333 pridáva 24 riadkov. Manuálne aplikuj hunky do našej 5938-riadkovej verzie. NEPREPIS AI/visitContext/voice zmeny
6. dashboard.ts router + unfinished-field-visits.tsx -- nové subory, čistý add
7. pnpm install na regeneráciu lockfilu
8. pnpm db:push && pnpm db:rls
9. Plná verifikácia

### Riziko
Stredné. Encounters page merge je manuálny, ale #333 pridáva len malé hunky.

> **OPRAVENÉ:** body 3 a 6 sú zastaré (oba subory aj router existujú).
> V bode 5 je nesprávna cesta -- je to `encounters/[appointmentId]/page.tsx`.
> Pozri bod 4 vyššie.

---

## Fáza 5 -- Clinical workflow chain (#336, #337, #339)

**Branch:** swarm/backport-clinical-workflow
**Commity:** a6e65362 (#336) + f20c7f3d (#337) + f1a33632 (#339)
**Zložitosť:** Náročná
**Závislosť:** Fáza 4 (encounters page base state)

### Postup

1. Vytvor branch z origin/main (alebo z výsledku Fázy 4 ak je mergnutá)
2. Cherry-pick a6e65362 (#336) -- --no-commit
   - encounters/page.tsx -- 28 riadkov (weight correction dialog), manuálny merge
   - patients/[id]/page.tsx -- 114 riadkov zmien
   - patient-document-upload.tsx + weight-correction-dialog.tsx -- nové komponenty
3. Cherry-pick f20c7f3d (#337) -- --no-commit
   - **MIGRÁCIA 0105:** VYNECHAJ packages/db/drizzle/0105_*. Namiesto toho:
     - Uprav vanilla schema: billing.ts, prescriptions.ts, prescription-events.ts, dispense-charge-queue.ts -- quantity na numeric(13,3)
     - pnpm db:push vytvorí migráciu 0115 automaticky
     - Trigger invoice_items_validate_dispense_charge re-create pridaj do bootstrap SQL
   - encounters/page.tsx -- 113 riadkov zmien, ŤAŽKÝ merge. ZACHOVAJ AI/visitContext/voice bloky
   - Nové utility: markup-input.tsx, quantity.ts, prescription-policy.ts
4. Cherry-pick f1a33632 (#339) -- --no-commit
   - encounters/page.tsx -- 39 riadkov, posledný merge
   - service-picker.tsx -- 84 riadkov
5. pnpm db:push && pnpm db:rls
6. Plná verifikácia vrátane pnpm test:e2e
7. Commit a push, vytvor PR

### Migrácia 0105 detail

Upstream 0105 mení:
- prescriptions.quantity na numeric(13,3)
- prescription_events.quantity na numeric(13,3)
- invoice_items.quantity na numeric(13,3) + default 1
- products.stock_quantity na numeric(13,3)
- dispense_charge_queue.quantity na numeric(13,3)
- Re-create invoice_items_validate_dispense_charge trigger

Riešenie: upraviť vanilla .ts schémy, pnpm db:push generuje migráciu s našim indexom.

### Riziko
Vysoké. Encounters page má 3x merge. Vanilla schema zmeny (quantity precision) sú legitímne.

> **OPRAVENÉ:** body 3 sú zastaré -- `numeric(13,3)` je už v našich schémach a
> aplikoval ju náš commit `0108_adorable_misty_knight.sql`. Všetky "nové utility"
> z bodov 2--4 už existujú. Pozri bod 6 vyššie.

---

## Globalne pravidlá pre všetky fázy

1. **NIKDY** nemodifikuj packages/db/drizzle/ ani _journal.json manuálne
2. **NIKDY** nezmaž naše ext_ rozšírenia z enable-rls.sql
3. **NIKDY** nezmaž naše bloky z encounters/page.tsx (visitContext, AI draft, voice SOAP, ext_ imports)
4. Vanilla schema zmeny sú povolené IBA ak prichádzajú priamo z upstreamu
5. Migrácie aplikuj výhradne cez pnpm db:push
6. Verifikácia: pnpm lint && pnpm typecheck && pnpm test pred každým PR
7. Ak test failne, oprav príčinu -- neoslabuj assertions

### Doplnené pravidlá (z overenia, 2026-09-28)

8. **NIKDY** nepreberaj cudzí `pnpm-lock.yaml`. Lockfile sa generuje z nášho
   `package.json`. Konflikt vyrieš regeneráciou, nie prevzatím.
9. **NIKDY** nepredpokladaj spoločného predka s upstreamom -- naše historie sú
   nesúvisiace, takže každý konflikt je textový a nič sa nedá odvodiť z base.
10. Pred každým cherry-pickom si over, či ten commit u nás už neprejde ako no-op
    (`git cherry-pick --no-commit <sha>` a pozri `git diff`). Ak diff je prázdny,
    commit je už aplikovaný -- nezakladaj naň nový PR.
11. **NIKDY** nepoužívaj `pnpm db:push` na aplikovanie zmien. `push` obída journal
    a drift guard z CI. Zmeny schemy idú cez `pnpm db:generate` + commit migrácie.

## Paralelizácia

Fázy 1-4 sú **nezávislé** a môžu bežať paralelne.
Fáza 5 závisí na Fáze 4 (encounters/page.tsx base state).

> **OPRAVENÉ:** paralelizácia platí, ale Fázy 1-3 sú už prakticky hotové
> a Fáza 5 závisí od `encounters/[appointmentId]/page.tsx`, nie od `encounters/page.tsx`.

## Súhrn

| Fáza | PRov upstream | Suborov | Migrácie | Riziko | Skutočný stav |
|---|---|---|---|---|---|
| 1. Security | #322, #318 | ~9 | žiadne | Nízke | **hotová (no-op)** |
| 2. Portal sessions | 4 commity | ~60 | 0097 zdieľaná | Vysoké | ~78% identických, zvyšok preveriť |
| 3. Identity rotation | #323, #324 | ~31 | 0100, 0101 zdieľané | Stredné | schémy existujú |
| 4. Prescription + field | #321, #325, #326, #333 | ~25 | 0099 zdieľaná | Stredná | subory existujú |
| 5. Clinical workflow | #336, #337, #339 | ~72 | 0105 KOLÍZIA | Vysoké | schema zmena **už aplikovaná** (0108) |

---

## Ako overiť znovu

```bash
git remote add upstream https://github.com/evangauer/openvpm.git
git fetch upstream main
git merge-base HEAD upstream/main          # prazdne = nesuvise historie
git log --oneline -1 upstream/main        # f1a3363 = tip pouzity v tejto analyze

# Overenie, ze Faza 1 je no-op:
git cherry-pick --no-commit 0767aff0 && git diff --stat   # prazdny diff pre package.json
git cherry-pick --abort 2>/dev/null; git checkout -f HEAD -- pnpm-lock.yaml
```

**Poznámka k prostrediu:** `git config` (a teda remote) sa v tomto sandboxe
neperzistuje medzi turami -- po kazdom resume ho treba znovu pridat.
