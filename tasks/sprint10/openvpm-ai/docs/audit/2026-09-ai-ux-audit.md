# OpenVPM AI — Audit AI funkcií, user journeys & use cases

**Dátum:** 2026-09-20
**Auditor:** Arena agent (read-only audit)
**Rozsah:** `badmarsh/openvpm-ai`, branch `arena/01a0c13c-openvpm-ai`, baseline commit `51f8d99`
**Typ výstupu:** auditný report + prioritizovaný backlog. **Žiadna zmena v `apps/`, `packages/`, `e2e/`.**

> **Metodika.** Každé zistenie má dôkaz `súbor:riadok` alebo konkrétnu route/procedúru. Čo sa nedalo overiť
> v tomto prostredí (chýba `pnpm`, `node_modules`, bežiaca DB, reálne provider kľúče), je výslovne
> označené `UNVERIFIED` v sekcii 8. Klinické bezpečnostné brány sa auditujú, nie prepisujú — návrhy
> smerujú výhradne k sprísneniu alebo k lepšej komunikácii.

---

## 1. Executive summary

OpenVPM AI je **nadpriemerne dobre postavený systém na úrovni AI governance jadra** — potvrdenie lekárom
(one-time envelope), hash-chain audit, zero-prefill pre kontrolované látky, sympathy gate a RLS s dynamickým
pokrytím `ext_*` tabuliek sú implementované skutočne, nie iba deklarované. Slabina nie je v jadre, ale
v **napojení jadra na produkt**: najpoužívanejší AI povrch (SOAP draft v editore) governance vrstvu
obchádza, jeden agent tool obchádza gate kontrolovaných látok a niektoré klinické povrchy predstierajú
“AI”, hoci sú deterministické (a zobrazujú vymyslené confidence skóre).

**Celkové skóre zrelosti AI: 3 / 5.**
*(1 = experiment, 3 = použiteľné v pilotnej ambulancii s dohľadom, 5 = plne dôveryhodný klinický systém)*
Odôvodnenie: jadro governance je na úrovni 4–5, produktové napojenie a merateľnosť 2, evals neoverujú reálne
modely (deterministické grading nad ručne napísanými kandidátmi). Trojka = „pilot-ready, nie battle-tested“,
čo presne zodpovedá vlastnému `ROADMAP.md` a `RISK_REGISTER.md` projektu.

### 5 najväčších rizík

| # | ID | Riziko | Prečo je to riziko |
|---|---|---|---|
| 1 | F-04-1 | AI text z `ai.draftSoapNote` a `imaging.injectFindingsIntoSoap` sa dostane do **finalizovaného** SOAP záznamu **bez jediného záznamu v `ext_ai_audit_log`** (potvrdzovacia obálka sa síce vyžaduje, ale AI pôvod sa do ledgera nezapíše — ochrana je, dôkaz nie) | Dokumenty `confirmation-protocol.md` a `ai-audit-ledger.md` tvrdia úplnosť („every clinician confirmation of AI-generated clinical content“). Pri inšpekcii je tvrdenie nepravdivé pri najpoužívanejšej AI funkcii. |
| 2 | F-18-1 | Agent tool `create_prescription` zapisuje **`status: "active"` recept** bez screeningu kontrolovaných látok; envelope sa vydáva až **po** INSERT a nikdy sa nespotrebuje | Priamy obchvat pravidla „Zero AI prefill pre opiáty/ketamín/propofol/fentanyl“ z `AGENTS.md` §5, a to aj cez API kľúč (`agent:write` + `records:write`). |
| 3 | F-04-2 | **Prompt injection z verejnej rezervácie:** `booking.book` (publicProcedure) zapíše meno pacienta od neautentifikovaného človeka a to sa vkladá do promptu SOAP draftu bez boundary tagov | Útočník z internetu seeduje inštrukciu do promptu lekára. Agent runner má `<db_record>` ohraničenie, draft-tool nie. |
| 4 | F-07-1 | Lab import je označený ako **„AI OCR / AI Copilot“** a v klinickom potvrdzovacom modáli zobrazuje **vymyslené confidence skóre** (0,65 / 0,72 / 0,84 / 0,94 podľa počtu nájdených riadkov) | Falošný dôveryhodnostný signál priamo v HITL bráne — ničí „informed“ charakter ľudskej kontroly. |
| 5 | F-17-4 | **Data residency nie je nikde v UI** a `feature_mappings` je mŕtvy nástroj pre 2 z 8 funkcií (F-17-3); `MODEL_CARDS.md` pritom deklaruje EÚ regióny a modely, ktoré kód nepoužíva | Ambulancia nemá ako splniť GDPR článok 28/30 (sub-procesori) ani rozhodnúť, kde jej PHI tečie. Nadväzuje na R-P1-006 v existujúcom risk registri. |

### 5 najväčších príležitostí

1. **Zapojený `visitContext`** (F-04-3) — 5 sekúnd písania lekára premení generický draft na použiteľný záznam. Najvyšší pomer hodnota/práca v celom audite.
2. **Zjednotenie provenance** (F-04-1 + F-04-4) — jeden `ai_provenance` marker na `soapNotes` + volanie `appendAiAuditEvent` pri finalizácii dá hash-chainu reálnu úplnosť.
3. **Reálne evals** — `lib/ai/evals` dnes negraduje modelové výstupy, iba ručne napísaných kandidátov (`metrics.ts` neobsahuje žiadne volanie LLM). Offline beh proti uloženým odpovediam modelov je najlacnejší spôsob, ako dostať benchmark do CI.
4. **Konzistentný provider resolver** (F-17-3) — jedna zmena `configuredModel()` → `resolvePracticeLanguageModel()` na 4 miestach sprístupní klinike reálnu kontrolu nad tým, kde končí jej text.
5. **Verejný booking** — dnes zdroj injection rizika, po sanitizácii aj najsilnejší onboarding kanál (klient si zapíše dôvod návštevy, ktorý sa dá použiť v prompte).

### Čo je nadštandardné (a nemá sa oslabiť)

- `lib/ai/clinician-confirmation.ts` — one-time envelope s TTL, revision bindingom a hashmi draftu aj potvrdeného obsahu; spotreba v tej istej transakcii ako zápis (`_safety.ts:8-31`).
- `lib/ai/audit-chain.ts` + `lib/ai/audit-ledger.ts` — practice-scoped SHA-256 reťaz s advisory lockom, detekciou gaps/predecessor mismatch, driftu `updated_at` a soft-delete; explicitne dokumentované limity (nie WORM). `scripts/verify-ai-audit-trail.ts` existuje.
- Zero-prefill pre kontrolované látky v `ClinicalDiffConfirmModal` (`clinical-diff-confirm-modal.tsx:63-77`) + `CONTROLLED_SUBSTANCES_PATTERNS` (`treatment-extractor.ts:20-46`).
- Sympathy gate je implementovaný na viacerých vrstvách vrátane segmentačného SQL (`segmentation-engine.ts:320-355`) a `consent-gate.ts:71-78`.
- RLS: dynamický DO blok (`enable-rls.sql:62-113`) pridáva `tenant_isolation` policy **automaticky každej** verejnej tabuľke s názvom `ext_%` / `ekasa_%` alebo z explicitného zoznamu, ktorá má stĺpec `practice_id`. Všetkých 17 `ext_*` tabuliek mimo tohto zoznamu je pokrytých (viď §5.5).
- Deterministický fallback pri výpadku AI v `discharge.generate` (`discharge.ts:135-175`) — AI je vylepšenie, nie kritická cesta.

---

## 2. Mapa modulov a rolí

Roly v kóde (`apps/web/server/trpc.ts:25-31`): `admin`, `veterinarian`, `technician`, `front_desk`, `viewer`.
Agent pridáva `service_agent` pre API-bežania bez ľudského aktéra (`authorization.ts:26-32`).
`requireRole()` je fail-closed middleware (`trpc.ts`), `assertAgentRole()` je fail-closed v tool vrstve
(`authorization.ts:60-90`). `requireFeature("agent")` = hosting gating; na self-hoste je no-op.

| Route / obrazovka | tRPC router | Rola (server) | AI áno/nie |
|---|---|---|---|
| `/` dashboard | `dashboard.*` | všetci staff (`protectedProcedure`, bez `requireRole`) | nie |
| `/schedule` | `appointments.*`, `waitlist.*` | admin/vet/tech/front_desk (nie `viewer`) | nie |
| `/clients`, `/clients/new` | `clients.*`, `extensions.duplicateShield.*` | admin/vet/tech/front_desk | nie (deterministické porovnanie) |
| `/patients/*` | `patients.*`, `records.searchPatientHistory` | admin/vet/tech/front_desk; search čítajú aj `viewer` (`records.ts:1337`) | nie (presné fulltextové hľadanie) |
| `/waiting-room` (public path) | `whiteboard.getActive` (volá TV komponent) | session | nie |
| `/whiteboard` | `whiteboard.*` + SSE `/api/whiteboard/stream` | admin/vet/tech/front_desk | nie |
| `/encounters/[appointmentId]` | `encounters.*` | podľa akcie admin/vet/tech/front_desk | indirektne (odkaz na `/records/new-soap`) |
| `/records/new-soap/[patientId]` | `records.saveSoapDraft`, `records.finalizeSoapNote`, **`ai.draftSoapNote`** | admin/vet + `requireFeature("agent")` | **ÁNO** |
| `/agent/voice` | `extensions.voice.*` | **admin/vet ONLY** (`voice.ts:45-47`) | **ÁNO** |
| `/agent` | `agent.status`, `agent.run` | admin/vet + feature gating (`agent.ts:39-41`) | **ÁNO** |
| `/agent/imaging` | `extensions.imaging.*` | admin/vet + feature gating | **ÁNO** |
| `/agent/discharge` | `extensions.discharge.*` | admin/vet/tech/front_desk + feature gating (`discharge.ts:44-46`) | **ÁNO** |
| `/controlled-substances` | `controlledSubstances.*` | list: všetci staff; create/listWitnesses: admin/vet (`controlled-substances.ts:324,449`) | nie |
| `/records` (preskripcie) | `records.*` | admin/vet | nie |
| `/lab-results` | `extensions.labImport.*` | admin/vet/tech/front_desk | **deklarované ÁNO, reálne NIE** (F-07-1) |
| `/vaccinations`, `/recalls` | `patients.*`, `vaccination*`, `marketing.getRecallSchedule` | admin/vet/tech/front_desk | nie |
| `/statutory`, `/statutory/kvepis` | `extensions.statutory`, `extensions.kvepis` | admin/vet/tech (`kvepis.ts:21`) | nie |
| `/care-reminders`, `/wellness` | `careReminders.*`, `wellness.*` | admin/vet/tech/front_desk; wellness manage: admin/front_desk | nie |
| `/billing`, `/billing/pos`, `/billing/ekasa` | `billing.*`, `extensions.ekasa.*` | väčšina `admin`; e-Kasa pokladňa admin/vet/front_desk | nie |
| `/inventory` | `inventory.*` | admin/vet/tech/front_desk; úpravy admin/vet | nie |
| `/inbox` | `communications.*`, `messaging.*` | staff | **NIE** — bez AI odpovedí (dobré z hľadiska injection) |
| `/marketing/*` (14 podstránok) | `extensions.marketing.*`, `automation-*`, `crm-segments` | admin/vet pre schvaľovanie; front_desk pre obsah | **ÁNO** (copy, obrázky, video, FAQ, alt-texty, odpovede na recenzie) |
| `/marketing/website` | `marketing.getWebsiteConfig/updateWebsiteSections/publishWebsite` | admin/vet | **ÁNO** (`suggestWebsiteFaq`) |
| `/automations` | `automation-*` | admin/vet (suppression aj front_desk) | nepriamo (AI obsah pre journeys) |
| `/reports` | `reports.*` | admin/vet (`reports.ts:35`) | nie |
| `/onboarding` | `settings.*`, `agent.status/run` (krok „vyskúšaj AI“) | admin | **ÁNO** (krátka ukážka) |
| `/settings?tab=ai` | `extensions.aiSettings.*` | **`getSettings` bez role gate**, ostatné `admin` | konfigurácia AI |
| `/migration-archive`, `/settings/import-v2` | `migrationArchive.*`, `v2-import` | `migrationArchive.*` bez `requireRole` (iba session) | nie |
| `/support` | `extensions.support.*` | všetci staff, bez role gate | nie (screenshare stub) |
| `/admin` | `admin.*` | `platformAdminProcedure` = e-mailový allowlist `PLATFORM_ADMIN_EMAILS` (`platform-admin.ts:14`) | nie |
| `/portal/*`, `/book/[slug]`, `/capture/*`, `/sign/*` | `portal.*`, `booking.*` | capability/portal token; `booking.*` = `publicProcedure` | nie (ale je vstupom do promptu, F-04-2) |
| `/vet-intel` | — | — | **redirect na `/marketing?tab=competitors`** (`vet-intel/page.tsx:11-13`) |

---

## 3. Inventár AI funkcií

Legenda stĺpcov: **Rola & gating** · **Vstup (PHI)** · **Prompt & model** · **Výstup & validácia** · **Audit stopa** · **Failure modes** · **UX** · **Hodnota / Riziko** (1–5).
Strojovo čitateľná verzia so všetkými poľami: [`ai-feature-inventory.csv`](./ai-feature-inventory.csv).

| # | AI funkcia (vstupný bod) | Rola & gating | Vstup do promptu (PHI) | Prompt & model | Výstup & validácia | Audit stopa | Failure modes | UX | Hodnota / Riziko |
|---|---|---|---|---|---|---|---|---|---|
| A01 | **SOAP draft v editore** — `ai.draftSoapNote` (`ai.ts:356`), `lib/ai/soap-draft.ts` | `requireRole(admin,veterinarian)` + `requireFeature("agent")`; `aiNotConfigured` → `AgentNotConfiguredError` → `PRECONDITION_FAILED` (`ai.ts:527`) | meno, druh, plemeno, pohlavie, dátum nar., alergie, problem list, posledné vitálne funkcie, `visitContext` (voliteľný, ≤2000 znakov, `soap-draft.ts:13`) | `SOAP_DRAFT_SYSTEM_PROMPT` (`soap-draft.ts:15-21`) **nie je verzovaný**; model = `configuredModel()` alebo practice `deepThinking` pri móde „pro“ (`ai.ts:502`); `temperature: 0`, `maxOutputTokens: 1024` | `parseSoapDraft()` toleruje markdown fence a prózu okolo JSON (`soap-draft.ts:105-137`); každá sekcia orezaná na `SOAP_SECTION_MAX_LENGTH`; prázdny výsledok → `SoapDraftUnavailableError`; **výstup sa nevracia cez zodpovedajúcu schému, iba cez ručný parser** | ❌ **žiadna** — `appendAiAuditEvent` sa v tejto procedúre nevolá (porovnaj `ai.ts:326`) | 30 s timeout (`soap-draft.ts:145`), rate limit 10/min **per aktér** (`ai.ts:374-385`), `INTERNAL_SERVER_ERROR` „Could not draft the note. Try again.“ — bez retry a bez rozlíšenia príčin | „Draft with AI“ tlačidlo + Flash/Pro prepínač; výsledok **prepíše všetky 4 sekcie naraz** (`new-soap/.../page.tsx:441`); jediná poistka je `window.confirm`, ak už niečo napísal; žiadny badge „AI“ v editore ani po uložení | **5 / 4** — najvyššia klinická hodnota, najvyššie riziko (F-04-1, F-04-2, F-04-3, F-04-4) |
| A02 | **Externý AI scribe** — `ai.createSoapFromAI` (`ai.ts:225`) | admin/veterinarian, session cookie (nie API kľúč) | celé 4 SOAP sekcie odovzdané volajúcim + `source` | žiadny prompt — OpenVPM len prijíma | `optionalClinicalTextInput` + `hasSoapContent` + `hasUnresolvedSoapTemplatePrompts`; `clinicianConfirmed` je `z.literal(true)` **alebo** envelope (`draft-safety.ts:45-52`) | ✅ `appendAiAuditEvent` (`ai.ts:326`) v tej istej transakcii; `assertAndConsumeDirectConfirmation` s `direct:createSoapFromAI` (`ai.ts:314`) | `SoapLifecycleError` → kód z chyby; duplicitný POST = CONFLICT vďaka `pg_advisory_xact_lock` (`ai.ts:288-292`) | žiadne UI — iba `/api-docs/ai`; potvrdenie je **boolean v requeste**, nie klik v UI | **4 / 3** — dokumentovaná transitional výnimka (Option 2), zmiernená nemennosťou záznamu |
| A03 | **Hlasová diktácia → SOAP** — `extensions.voice.uploadAndProcess` (`voice.ts:59`), `process` (`:280`), `formatTextToSoap` (`:428`) | admin/veterinarian + `requireFeature("agent")` (`voice.ts:45-47`); `resolvePracticeLanguageModel(..., "voiceSoap")` (`voice.ts:166,342,460`) | audio blob (≤25 MB) + prepis + kontext pacienta | `STT_SYSTEM_PROMPT` (`transcription.ts:9-31`, rozsiahly SK prompt s terminológiou a liekmi) + 3 `soap-formatter` prompty (standard/detailed/concise, `soap-formatter.ts:22-90`) — **SK text v kóde, nie v i18n** | prepis = plain text; formátovač = **zod schéma** `soapSectionsSchema` (`soap-formatter.ts:5-11`), parsuje JSON z odpovede | ✅ pri finalizácii: `saveAsSoapNote` → `consumeClinicianConfirmation` + `appendAiAuditEvent` (`voice.ts:770,808`) | 60 s timeout (`transcription.ts:53`); proxy fallback so 3 kandidátskymi modelmi (`transcription.ts:63-70`); bez AI → `uploadAndProcess` ukončí diktát bez SOAP | najlepší HITL flow v systéme: `ClinicalDiffConfirmModal` + `prepareConfirmation`/`saveAsSoapNote`, audio retencia 24 h (`voice/retention.ts`) | **5 / 2** — vzor pre ostatné AI povrchy |
| A04 | **Extrakcia spoplatniteľných položiek** — `voice.extractBillableItems` (`voice.ts:922`) → `lib/voice/treatment-extractor.ts` | admin/veterinarian + feature gating | `plan`, `assessment`, `rawTranscript` z diktátu | heuristické katalógy `KNOWN_SERVICES_CATALOG` (18 úkonov), `KNOWN_MEDICATIONS_CATALOG` (15 liekov) **+** LLM volanie `configuredModel()` (`treatment-extractor.ts:241`) | zod `billExtractionSchema` (`treatment-extractor.ts:49-58`); `CONTROLLED_SUBSTANCES_PATTERNS` (11 vzorov) označí látku `requiresManualNarcoticProtocol` (`:20-46`) | ❌ žiadna (vytvorenie faktúry je `voice.createBillFromExtractedItems`, `voice.ts:966`) | deterministický `fallbackExtraction()` keď AI zlyhá | lekárov výber položiek pred fakturáciou = HITL; ceny v katalógu sú **hardcoded SK ceny**, nie cenník kliniky | **4 / 2** |
| A05 | **AI analýza obrazu** — `extensions.imaging.analyze` (`imaging.ts:150`) | admin/veterinarian + feature; `autonomousProcedure` (nie v jednej DB transakcii počas volania) | obrázok ako data URL + `userPrompt` (≤2000, `imaging.ts:129`) | 6 modality promptov SK/EN (`imaging.ts:60-130`); model = `imagingRtg` mapping, fallback `configuredModel()` (`imaging.ts:233-237`); `providerOptions.google.thinking.budgetTokens: 2048` | `update aiImagingAnalyses.status = COMPLETED/FAILED` (`imaging.ts:267-300`); **výsledok nie je schematicky validovaný** | ✅ `appendAiAuditEvent` až pri `confirmAnalysis` (`imaging.ts:836`) | **žiadny `abortSignal`/timeout** (komentár hovorí 10–60 s, `imaging.ts:225`); chyba sa vracia ako `INTERNAL_SERVER_ERROR` **s raw textom upstream chyby** (`imaging.ts:307`) | `prepareConfirmation` → `confirmAnalysis` → voliteľne `injectFindingsIntoSoap`; disclaimer v prompte | **4 / 3** |
| A06 | **AI nálezy → SOAP** — `imaging.injectFindingsIntoSoap` (`imaging.ts:574`) | admin/veterinarian + feature | AI text rádiológie | — (žiadny nový prompt) | `assertAiMayWriteToSoapNote` povoľuje zápis **len do draftu**; prefix `[AI Rádiológia … – návrh na overenie lekárom]` | ❌ žiadna (finalizácia prejde cez `records.finalizeSoapNote`) | CONFLICT pri súbežnej zmene (`imaging.ts:637`) | nález je v `objective` s viditeľným AI prefixom — dobré | **3 / 3** (súčasť F-04-1) |
| A07 | **Prepúšťacia správa** — `extensions.discharge.generate` (`discharge.ts:83`), `generateSmsAndSchedule` (`:683`) | admin/veterinarian/technician/**front_desk** + feature (`discharge.ts:44-46`) | diagnóza, liečba, follow-up zadané lekárom (≤5000 znakov) | `DISCHARGE_SYSTEM_PROMPT_SK/EN` (`discharge.ts:48-80`); `configuredModel()` (`:139`); `temperature: 0` | `optionalClinicianConfirmationInput` + `resolveAiRecordStatus` (`draft-safety.ts:97-107`); `prepareConfirmation` envelope (`:210`) | ✅ `appendAiAuditEvent` v `save` (`:517`) aj `generateSmsAndSchedule` (`:869`) | **deterministický šablónový fallback** keď AI nie je (`:135-175`) — vzorové správanie | `usedAi` flag v odpovedi; sympathy gate pred volaním | **4 / 2** |
| A08 | **Clinical Guardian** — `extensions.clinicalGuardian.*` (`clinical-guardian.ts:24-250`), `lib/ai/clinical-guardian.ts` | admin/veterinarian/**technician** (`clinical-guardian.ts:14-16`) | alergie, problem list, lab results, preskripcie, ochranné lehoty, besnota, mikročipy | **ŽIADNY LLM** — deterministické keyword sety (NSAID, kortikosteroidy, nefrotoxické, renálne zlyhanie) a SQL pravidlá | `ext_clinical_guardian_alerts` (severity/status), `resolveAlert`/`dismissAlert` s dôvodom | ❌ žiadna AI stopa (nie je to AI) — ale alert dismiss/resolve je v `audit_log` cez mutation middleware | alert sa zapíše aj keď beží `runAuditNow` cron | zobrazuje sa v `/records/new-soap` cez `checkMedications`+`recordAlerts` (`new-soap/.../page.tsx:191-192`) | **4 / 1** — najlepší pomer signál/šum v projekte; **ale marketing ho nazýva „AI“** (F-X2-1) |
| A09 | **Agent** — `agent.run` (`agent.ts:90`), `lib/agent/runner.ts:441` | admin/veterinarian + `requireFeature("agent")`; API kľúč s `agent:run` (+`agent:write`) (`api/v1/agent/route.ts:74,89-90`) | celý číselník: klienti, pacienti, termíny, faktúry, lab trendy, vitálne funkcie, OPL log | `SYSTEM_PROMPT` (`runner.ts:41-73`) vrátane `<db_record>` pravidla a SK legislatívy; `buildAgentSystemPrompt` pridáva presný dátum/čas (`runner.ts:75-101`); model = practice `assistant`/`deepThinking` (`agent.ts:128-132`) | AI SDK tool schémy (zod), `stopWhen: stepCountIs(12)`, `maxOutputTokens: 4096` | ❌ **žiadny AI audit event**; iba `console.info` pri `allowWrites` (`agent.ts:115-119`); mutácie idú do `audit_log` (`trpc.ts`) | 60 s timeout, 2 rate-limit buckety (20/min aktér, 120/min prax, `runner.ts:37-39`), proxy-format fallback + `buildFallbackSummary` (`runner.ts:520-620`) | checkbox „povoliť zápisy“ s potvrdením; `agent.status` dáva jasné prázdne stavy a retry | **5 / 4** (F-18-1, F-18-2) |
| A10 | **Marketing copy** — `marketing.generatePost` (`marketing.ts:323`), `lib/marketing/composer.ts` | admin/veterinarian/front_desk (`marketing.ts:324`) | fakty o klinike, sezónne tipy, meno pacienta ak je povolené (`allowName`) | `configuredModel()` (`composer.ts:106`) — **ignoruje `marketingCopy` mapping**; `localCompose()` deterministický fallback | `validateMarketingText()` (block/warn) pred publikáciou; `autoFixContentItem` (`:2213`) | ✅ `appendAiAuditEvent` pre `marketing_content` (`:583`, `:1567`) s `entityType` rozšíreným o `marketing_content` v `audit-ledger.ts:37-38` | lokálny composer ako plnohodnotný fallback | social approval queue (`approveContentItem` `:658`, `createContentBatch`/`approveContentBatch` `:2092`/`:2107`) — obsah nejde von bez schválenia | **4 / 2** |
| A11 | **Odpoveď na recenziu** — `marketing.generateReviewReply` (`:1485`), `saveAiReviewDraft` (`:1322`), `approveReviewReply` (`:1282`) | admin/veterinarian/front_desk | text recenzie **z externého zdroja** (Google ap.) — cudzí vstup | inline prompt v routeri | uloží sa ako draft; `approveReviewReply` je samostatná akcia | ✅ `appendAiAuditEvent` (`:1567`) | — | dvojstupňové schválenie (draft → approve) | **3 / 3** (prompt injection z recenzného textu je možný, viď F-X3-2) |
| A12 | **FAQ webu** — `marketing.suggestWebsiteFaq` (`:4580`) | admin/veterinarian | texty sekcií webu | inline prompt (`:4590`) | text vrátený do editora, bez validácie | ✅ `:4696` | — | používateľ vloží ručne | **2 / 2** |
| A13 | **Alt-text médií** — `marketing.suggestMediaAltText` (`:3401`) | admin/veterinarian/front_desk | caption/kontext fotky pacienta | inline prompt (`:4646`) | text | ✅ `:4696` | — | „navrhni“ tlačidlo, editovateľné | **2 / 1** (prístupnosť) |
| A14 | **Competitor analysis** — `marketing.runCompetitorAnalysis` (`:3661`), `lib/marketing/competitors.ts` | admin/veterinarian | verejné dáta konkurencie (nie PHI) | `configuredModel()` (`competitors.ts:144`) | snapshot do `ext_marketing_competitor_snapshots` | ❌ žiadna | — | `/marketing/competitors` (sem presmerúva aj `/vet-intel`) | **2 / 1** |
| A15 | **Generovanie obrázkov** — `marketing.generateImage` (`:812`), `generateImageForPost` (`:496`) | admin/veterinarian/front_desk; `assertHostedAiGate` | prompt (≤1000 znakov), žiadne PHI | `resolveFeatureConfig(..., "imageGeneration")` → **Alibaba/Aliproxy lokálne** (`marketing.ts:824`) | URL/b64, žiadna validácia obsahu; `validateMarketingText` na prompt | ✅ pre `marketing_media` | keď je proxy offline → **tichý fallback na kurovaný stock obrázok s rovnakým tvarom odpovede** (`:850-869`) | badge „generované“; fallback sa tvári ako AI výstup | **3 / 2** |
| A16 | **Generovanie videa** — `marketing.submitVideo` (`:869`)/`pollVideo` (`:904`) | admin/veterinarian/front_desk | prompt | `videoGeneration` mapping | taskId + polling | ✅ | — | asynchrónne, UI musí pollovať | **2 / 2** (náklady) |
| A17 | **Procedurálna ilustrácia** — `marketing.generateIllustration` (`:3514`), `lib/marketing/illustration.ts` | admin/veterinarian/front_desk | prompt (≤200) | **ŽIADNY model** — deterministické SVG v brand farbách | `validateMarketingText` blokuje Rx tvrdenia; alt text „Ilustrácia (generovaná)“ | ❌ (nie je AI) | — | UI sa volá „AI Canvas“, `meta.generated: true` | **2 / 1** — čestné označenie, ale názov „AI“ je marketing |
| A18 | **Lab PDF/obraz import** — `extensions.labImport.parsePdfOrImageReport` (`lab-import.ts:46`) | admin/veterinarian/technician/front_desk | base64 súboru → `buffer.toString("utf-8")` + `autoDetectAndParse` | **ŽIADNY model.** `labParser` mapping sa v kóde nikdy nečíta | heuristické `confidenceScore` 0.65/0.72/0.84/0.94 podľa **počtu** výsledkov (`lab-import.ts:81-89`); `requiresVetApproval: true` | ❌ žiadna | binárne PDF/JPEG → UTF-8 smetí → 0 výsledkov bez varovania | záznam má `deviceModel: "PDF Laboklin/IDEXX AI OCR"` a note „AI Copilot PDF import (confidence: 94 %)“ | **1 / 5** — **F-07-1, P0** |
| A19 | **„AI dashboard“ procedúry** — `ai.dailySummary` (`ai.ts:719`), `ai.patientsOverdueVaccinations` (`:546`), `ai.patientsNeedingFollowUp` (`:615`) | `protectedProcedure` — **bez `requireRole`**, takže aj `viewer` a `front_desk` | agregáty + mená pacientov a klientov (`SELECT` z DB) | **ŽIADNY LLM** — čisté SQL agregácie | return type zod nie je (query bez schémy) | ❌ | — | `dailySummary` nemá žiadne UI (používa ho len `/api-docs/ai`); e-Kasa používa vlastný `ekasa.dailySummary` | **2 / 2** — F-X2-1 (mýtus „AI“), F-X4-1 (gating) |
| A20 | **Onboarding ukážka AI** — `agent.status` + `agent.run` v kroku 5 (`components/onboarding/steps/try-agent.tsx:57-58`) | admin (onboarding) | otázka používateľa | rovnaký agent | rovnaké | ako A09 | ošetrené prázdne stavy vrátane `hosted`/`needsBillingSetup` | najlepší príklad prázdnych stavov v projekte | **3 / 2** |


---

## 4. Journey cards (J-01 … J-21)

> Každá karta uvádza rolu, pre ktorú je hodnotená. Počet klikov je odhad z kódu (nie meranie v bežiacej
> aplikácii) a je označený ako odhad. Testy: `unit` = `apps/web/**/__tests__`, `e2e` = `e2e/`.

### J-01 · Nový klient + nový pacient (front_desk)
**Vstup:** `/clients/new` → `/patients/new` (alebo z `ScribeWidget` na `/agent/voice`)
**Cieľ používateľa:** zapísať nového klienta a pacienta za < 90 s, bez duplicity a s GDPR súhlasmi.
**Kroky (as-is):**
1. `/clients/new` → `clients.create` (`routers/clients.ts`), rola admin/vet/tech/front_desk (`clients.ts:111`).
2. Duplicitný majiteľ: `extensions.duplicateShield.checkClient` (`extensions/duplicate-shield.ts:21`) — hľadá podľa `ilike(email)` a normalizovaného telefónu + `regexp_replace(...) LIKE %last9%` (`:45-51`); rola admin/vet/tech/front_desk (`:8-10`).
3. Pacient: `/patients/new` → `patients.create` (rola ako pri klientoch, `patients.ts:100`).
4. Duplicitný pacient: `/patients/duplicates` + `patients.merge` (serializable transakcia, `trpc.ts`) + `patient_merge_events`.
5. Súhlasy: SMS opt-in (`sms_consent_events`), e-mail preferencie (`/api/email-preferences`), GDPR článok v `settings.requestAccountDeletion`/`data.*` (admin-only, `data.ts:77`).
**Miesta vstupu AI:** žiadne. `duplicate-shield` je deterministické porovnanie, nie fuzzy AI — a je tak aj komunikované.
**Bezpečnostné brány:** `requireRole` na všetkých mutáciách; `patients.merge` beží v `serializable` izolácii a má vlastný error mapper (`trpc.ts`).
**Stavy chýb / prázdne stavy:** `checkClient` pri chýbajúcom e-mail/telefóne vracia `{found:false}` bez chyby (`:31-33`) — čistý prázdny stav.
**Počet klikov / prepnutí kontextu:** ~8–10 (odhad z kódu; `client → patient → consents`).
**Trenie & zistenia:**
- F-01-1 [P2][UX] Telefónne číslo sa hľadá cez `LIKE %last9%`, čo pri slovenskom formáte čísla nájde aj nesúvisiace zhody (napr. krátke interné klapky) a vyžaduje ručný výber. Dôkaz: `duplicate-shield.ts:44-51`.
- F-01-2 [P2][DATA] Duplicitný pacient sa kontroluje iba na samostatnej obrazovke `/patients/duplicates`; pri zakladaní pacienta neexistuje ekvivalent `checkClient` pre pacienta (mikročip/číslo pasu). Dôkaz: `duplicate-shield.ts` obsahuje iba `checkClient` (grep `name: "check` v súbore vracia len jednu procedúru).
- F-01-3 [P3][I18N] `/patients/duplicates` a merge tok patria medzi 153 súborov s hardcoded textami (1016 reťazcov, §5.3).
**Čo funguje dobre:** Duplicate Shield je rýchly, fail-open pri chýbajúcich vstupoch (nevracia falošný alert) a pokrytý testom `server/__tests__/extensions-duplicate-shield.test.ts`.
**Pokrytie testami:** unit ✅ (`extensions-duplicate-shield.test.ts`, `clients-safety.test.ts`, `patients-safety.test.ts`, `patient-merge-transaction.integration.test.ts`), e2e ❌ (nie je dedikovaný spec).
**Otvorené otázky / UNVERIFIED:** či `/clients/new` zobrazuje Duplicate Shield výsledok pred uložením (komponent som nečítal) — `UNVERIFIED`, treba otvoriť `app/(dashboard)/clients/new/page.tsx`.

### J-02 · Objednanie termínu (front_desk + klient)
**Vstup:** `/schedule` (interné) · `/book/[slug]` (verejné) · `/portal/[token]/book` (portál)
**Cieľ používateľa (Zuzana):** nájsť voľný slot a zapísať klienta bez prepínania okien; **Cieľ klienta:** rezervovať online bez telefonátu.
**Kroky (as-is):**
1. Interné: `appointments.*` — mutácie majú `requireRole("admin","veterinarian","front_desk")` (`appointments.ts:777,1794,1882,2165`), check-in/check-out pridáva `technician` (`:855,1038,1504`).
2. Čakacia listina: `waitlist.*` (`manageRole = admin/vet/front_desk`, `waitlist.ts:16`).
3. Online: `/book/[slug]` → `booking.getPage` → `booking.availableSlots` (`booking.ts:363`) → `booking.book` (**`publicProcedure`, `booking.ts:470`**).
4. Portál: `portal.requestAppointment` (`portal.ts:1227`, `portalProcedure` = capability token).
5. Pripomienky: `app/api/cron/reminders`, `lib/automated-reminder-policy.ts`, SMS suppression (`sms_suppressions`), sympathy gate (`lib/autopilot/consent-gate.ts:71-78`).
**Miesta vstupu AI:** žiadne v rezervačnom toku. **AI vstupuje nepriamo:** `booking.book` zapisuje `pet.name` (≤128 znakov) a `reason` do DB, ktoré neskôr vstupujú do promptu SOAP draftu (→ F-04-2).
**Bezpečnostné brány:** honeypot pole `website` (`booking.ts:476-486`), IP + slug rate limity (`booking.ts:61-70`), `takeAppointmentSchedulingLock` (per-practice transakčný zámok proti dvojitému zápisu, `booking.ts:545`), `assertBookingBillingAccess`.
**Stavy chýb / prázdne stavy:** `pageNotFound()`, `NOT_FOUND` pre typ/lokáciu, `BAD_REQUEST` s konkrétnym textom pre okno/čas; honeypot vracia **falošný úspech** (zámer, `:478-486`).
**Počet klikov / prepnutí kontextu:** interné ~5–7; online ~6 (odhad).
**Trenie & zistenia:**
- F-02-1 [P2][UX] Rozdielne rate-limit politiky pre rovnaký účel: `booking.book` má dva limity (IP + slug), `portal.requestAppointment` má vlastný režim; klient, ktorý omylom odošle formulár dvakrát, dostane nešpecifikovanú chybu bez rozlíšenia „už ste žiadali“. Dôkaz: `booking.ts:489-500`, `portal.ts:1227`.
- F-02-2 [P3][DOCS] `ROADMAP.md` uvádza „Drag-to-reschedule“ a „Waitlist automatické oslovenie“ ako **v0.7** nenaplánované, ale `waitlist.ts` už existuje s `manageRole` — dokumentácia a stav kódu si protirečia.
**Čo funguje dobre:** Per-practice scheduling lock proti súbežnému dvojitému zápisu (aj medzi verejnou a portálovou cestou) je presne ten typ opravy, ktorý väčšina PIMS nemá.
**Pokrytie testami:** unit ✅ (`booking-router.test.ts`, `waitlist-safety.test.ts`, `portal-booking-inputs.test.ts`, `appointments-safety.test.ts`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** reálne správanie `/schedule` drag&drop a mobilný layout neoverené (chýba bežiaci server). `UNVERIFIED` — potrebné spustenie `pnpm dev` (v tomto prostredí chýba `pnpm`).

### J-03 · Príjem pacienta → čakáreň → whiteboard (front_desk + technician)
**Vstup:** `/schedule` → check-in → `/waiting-room` (TV) → `/whiteboard`
**Cieľ používateľa:** zobrať pacienta do ambulancie a vidieť, kto kde je, bez telefonovania.
**Kroky (as-is):**
1. Check-in: `appointments.*` s `requireRole(..., "front_desk")` (`appointments.ts:1038`).
2. Whiteboard dáta: `whiteboard.getActive` (`whiteboard.ts:87`) — číta dnešné termíny + pacientov + klientov, všetko s `activePracticePredicate`.
3. Live update: `useWhiteboardStream()` (`lib/whiteboard/use-whiteboard-stream.ts:22`) → `GET /api/whiteboard/stream` (SSE, `app/api/whiteboard/stream/route.ts:11`), heartbeat každých 15 s (`:35`); hook volá `onUpdate` na `ping` (`use-whiteboard-stream.ts:38-41`), stránka na to robí `invalidate()` (`whiteboard/page.tsx:733-737`).
4. Polling fallback: `refetchInterval: isLive ? false : 30000` (`whiteboard/page.tsx:746`).
5. `/waiting-room` je v `PUBLIC_PATH_PREFIXES` (`middleware.ts:24`) — TV obrazovka sa dá otvoriť bez prihlásenia; dáta ťahá klientský komponent `WaitingRoomTv`.
**Miesta vstupu AI:** žiadne.
**Bezpečnostné brány:** SSE endpoint vyžaduje session s `practiceId` (`stream/route.ts:12-15`); `whiteboard.*` je `protectedProcedure` + `requireRole`.
**Stavy chýb / prázdne stavy:** `pageMissing`, `settingsMissing`, `activeAppointmentsMissing` s oddeleným spracovaním (`whiteboard/page.tsx:757-769`) — nadpriemerné.
**Počet klikov / prepnutí kontextu:** 1–2 (odhad).
**Trenie & zistenia:**
- F-03-1 [P2][PERF] „Real-time“ kanál v skutočnosti neposiela žiadne dátové udalosti — SSE emituje iba `connected` a `ping` (`stream/route.ts:24-46`); obnova dát je dôsledok 15 s heartbeat-u, ktorý klient interpretuje ako update (`use-whiteboard-stream.ts:38`). Keď je spojenie „live“, polling sa **vypne** (`:746`), takže ticho polootvorené spojenie (proxy timeout bez `onerror`) = zamrznutá tabuľa. Odporúčanie: emitovať `update` event, alebo nechať polling bežať.
- F-03-2 [P2][SAFETY] `/waiting-room` je verejná cesta v middleware; ochrana je teda len na úrovni session v `whiteboard.getActive`. Ak by ktokoľvek pridal do TV komponentu iný zdroj dát, dostane sa mimo middleware. Dôkaz: `middleware.ts:24` + `whiteboard.ts:85-88`. (Nie je to diera — dnes je API chránené — ale je to nekonzistentná hranica.)
**Čo funguje dobre:** prázdne/chybové stavy sú v tomto module najlepšie v projekte; `isFetching` indikátor je viditeľný.
**Pokrytie testami:** unit ✅ (`whiteboard.test.ts`), e2e ❌ pre waiting-room TV (`baseline-screenshots.spec.ts` pokrýva len screenshoty).
**Otvorené otázky / UNVERIFIED:** či `WaitingRoomTv` filtruje mená majiteľov na TV obrazovke (GDPR minimalizácia) — `UNVERIFIED`, treba prečítať `components/waiting-room/waiting-room-tv.tsx`.

### J-04 · Vyšetrenie a SOAP zápis (veterinarian) — **KĽÚČOVÝ AI WORKFLOW**
**Vstup:** `/schedule` → klik na termín → `/encounters/[appointmentId]` → `/records/new-soap/[patientId]`
**Cieľ používateľa:** za < 3 min mať právne platný SOAP záznam a poslať klienta na platbu.
**Kroky (as-is):**
1. Encounter: `/encounters/[appointmentId]` (5 409 riadkov, `app/page.tsx`) → `encounters.*`; vitálne funkcie `vitals.recordVitalSigns` (`recordRole = admin/vet/tech`, `vitals.ts:42`).
2. Otvorenie editora: `/records/new-soap/[patientId]` → `patients.getById` (`page.tsx:176`), `records.getSoapDraft` (`:181`), `records.saveSoapDraft` (`:188`), `records.finalizeSoapNote` (`:189`).
3. Klinický strážca popri písaní: `extensions.clinicalGuardian.checkMedications` (`:191`) a `recordAlerts` (`:192`).
4. **Manuálny zápis** — autosave draftu s `expectedRevision`, ochrana proti offline (`saveState === "offline"`, `page.tsx:1035+`).
5. **„Draft with AI“** — `ai.draftSoapNote` (`page.tsx:416`) → `draftWithAi.mutate({ patientId, mode, deepThinking })` (`:441-446`); dostupnosť cez `agent.status` (`:410`).
6. **Hlasová diktácia** — `ScribeWidget` (`components/layout/scribe-widget.tsx:38`) → `/agent/voice` → `voice.uploadAndProcess` / `process` / `formatTextToSoap` → `voice.prepareConfirmation` → `ClinicalDiffConfirmModal` → `voice.saveAsSoapNote`.
7. Finalizácia: `records.finalizeSoapNote` (`records.ts:1763`) → `finalizeAppointmentSoapDraft` (`lib/records/soap-lifecycle.ts`) → webhook `soap_note.created` (`records.ts:1787-1800`).
**Miesta vstupu AI:**
- `ai.draftSoapNote` (`ai.ts:356`) — bez potvrdenia, bez auditu (F-04-1).
- `voice.saveAsSoapNote` (`voice.ts:633`) — **s** envelope a auditom (vzor).
- `ai.createSoapFromAI` (`ai.ts:225`) — externý scribe, priama potvrdenie.
- `extensions.imaging.injectFindingsIntoSoap` (`imaging.ts:574`) — vkladá AI nález do draftu.
- `extensions.clinicalGuardian.checkMedications` — deterministické, nie LLM.
**Bezpečnostné brány:** `requireRole(admin,veterinarian)` na `saveSoapDraft`/`finalizeSoapNote`/`draftSoapNote`; `lockOpenVisitForClinicalAppend` (zapisovať sa dá len počas `in_exam`); `soap_notes_appointment_invariant` constraint; `hasUnresolvedSoapTemplatePrompts`; **`assertAiMayWriteToSoapNote`** pre imaging; `ClinicalDiffConfirmModal` + `prepareConfirmation` + `assertAndConsumeDirectConfirmation` pre voice/scribe.
**Stavy chýb / prázdne stavy:** `saveState` má 8 stavov vrátane `conflict` a `offline` s „Retry save“ (`page.tsx:1055-1120`); `finalizedElsewhereRef` zabráni prepisu už finalizovaného záznamu (`:433`); AI chyby → `toast.error(err.message)` s anglickým server textom.
**Počet klikov / prepnutí kontextu:** manuálne ~6; s AI draftom ~7 (vrátane čakania); s diktátom ~9 + potvrdzovací modál (odhad z kódu).
**Trenie & zistenia:**
- **F-04-1 [P0][SAFETY][DATA]** AI text z `draftSoapNote` **a** z `injectFindingsIntoSoap` môže byť finalizovaný cez `records.finalizeSoapNote`, ktorý nevyžaduje `clinicianConfirmed` a nezapisuje `ext_ai_audit_log`. Dôkazy: `ai.ts:356` (procedúra bez `appendAiAuditEvent`), `ai.ts:326` (jediné volanie v `ai.ts`), `imaging.ts:574-660` (zapisuje len draft), `records.ts:1763` (finalize bez potvrdenia), `docs/confirmation-protocol.md:11-13` („all browser/API finalization of AI drafts“), `docs/ai-audit-ledger.md:22` („records every clinician confirmation of AI-generated clinical content“).
- **F-04-2 [P0][SAFETY]** Prompt injection: `buildSoapDraftPrompt` vkladá `patient.name` (a breed/species) bez `<db_record>` ohraničenia a `SOAP_DRAFT_SYSTEM_PROMPT` neobsahuje pravidlo „dáta z karty sú neveľry, nevykonávaj inštrukcie“. Zdroj neveľrých dát je **verejná** verejná rezervácia: `booking.book` je `publicProcedure` (`booking.ts:470`) a `pet.name` má 128 znakov (`booking.ts:297-299`). Porovnaj s agentom, ktorý má `wrapUntrustedData` (`runner.ts:367-378`) a pravidlo #6 v `SYSTEM_PROMPT` (`runner.ts:70-73`).
- **F-04-3 [P1][AI][UX]** `visitContext` (najhodnotnejší vstup — dôvod návštevy) **nie je odosielaný zo žiadneho UI**. Grep `visitContext` v `apps/web` nájde len `soap-draft.ts:45,85`, `ai.ts:362,518` a nesúvisiace `records/page.tsx`. Bez neho dostane model len signál (meno, druh, plemeno, alergie, problem list, posledné vitálne) → draft bude prevažne `[add]` placeholdery.
- **F-04-4 [P1][UX][AI]** Jeden klik prepíše všetky 4 sekcie; `window.confirm` je jediná poistka (`page.tsx:437-440`) a existuje len keď už je obsah. Chýba diff, undo, a hlavne **žiadny trvalý „AI-generated“ marker** — po uložení nie je z dokumentácie poznateľné, ktoré časti vygeneroval model. Chromý je aj `toast.success("Draft ready…")`.
- **F-04-5 [P2][AI]** `draftSoapNote` má rate limit 10/min **per aktér** (`ai.ts:374-385`) a **žiadny practice-level limit** — na rozdiel od agenta (20/min aktér + 120/min prax, `runner.ts:37-39`). Zneužitie (alebo len zabudnuté tlačidlo) minie kľúč rýchlo.
- **F-04-6 [P2][I18N]** Chybové hlášky AI draftu prechádzajú do toastu v angličtine (`ai.ts:533`, `page.tsx:426`), hoci `AGENTS.md` §4 hovorí, že klient prekladá cez `useI18n()` — preklad chýba.
**Čo funguje dobre:** SOAP lifecycle je dôsledný (lock open visit, revision-based conflict, imutabilný finalized záznam, addenda/replacements); voice flow je referenčná implementácia HITL; autosave s offline ochranou je nad úrovňou bežného PIMS.
**Pokrytie testami:** unit ✅ rozsiahle (`lib/ai/__tests__/soap-draft.test.ts` 7, `server/__tests__/ai-draft-safety.test.ts` 25, `ai-safety.test.ts` 20, `ai-clinical-finalization.integration.test.ts` 23, `extensions-ai-finalization.test.ts` 21, `records-*`); e2e ✅ `e2e/ai-finalization-pilot.spec.ts` (gated `PILOT_E2E=1`, vyžaduje DB `openpims_pilot_*` a `PLAYWRIGHT_BASE_URL`) — **nepokrýva** `draftSoapNote` (fixture pre-seeduje hotový draft, `e2e/fixtures/ai-finalization-pilot.sql`).
**Otvorené otázky / UNVERIFIED:** reálna kvalita SK draftu pri „flash“ režime (bez `visitContext`) — `UNVERIFIED`, potrebný beh proti reálnemu providerovi.

### J-05 · Liečebný plán a súhlas klienta (veterinarian + klient)
**Vstup:** `/encounters/[appointmentId]` → plán liečby → podpisový odkaz
**Cieľ používateľa:** odovzdať majiteľovi zrozumiteľný plán a získať podpísaný súhlas.
**Kroky (as-is):**
1. Plán: `treatmentPlans.*` (`clinicalRole = admin/vet/tech`, `treatment-plans.ts:24`) a `treatmentEstimates.*` (pôvodne `visitTreatmentPlans`, `visit-treatment-plans.ts:56`; v `_app.ts` je starý názov označený `@deprecated`, `_app.ts:87-88`).
2. Prezentácia klientovi: `visit_treatment_plan_presentations` / `..._responses` (+ `api/treatment-plan/[token]`).
3. Podpis: `api/sign/[token]` + `lib/consult/consent-pdf.ts`, `consent_requests` s deferred triggermi (`enable-rls.sql:139-152`: aplikácia nemôže vymazať request ani volať trigger body).
4. AI: `treatmentEstimate` a `treatmentPlan` sú v `AI_CONFIRMATION_AUDIT_RECORD.entityType` (`draft-safety.ts:129-135`), ale v routeroch sa `appendAiAuditEvent` pre ne nevolá (grep v §5.2).
**Miesta vstupu AI:** dnes iba nepriamo — nie je tu žiadne „navrhni plán“ tlačidlo. AI vstupuje cez SOAP draft, z ktorého plán vzniká manuálne.
**Bezpečnostné brány:** capability tokeny pre podpis; immutabilita consent evidence; `superRefine` validácia vstupu (`encounters.ts:123`).
**Stavy chýb / prázdne stavy:** `visit_treatment_plan_presentations` s revisions a response lines — história revízií je zachovaná.
**Počet klikov / prepnutí kontextu:** ~7–9 (odhad).
**Trenie & zistenia:**
- F-05-1 [P2][UX] Duplicita konceptov: `treatmentPlans` (longitudinálny) vs `treatmentEstimates` (klientsky návrh), v API **oba** názvy (`_app.ts:82-88`). Pre frontend vývojára je to pasca; komentár v `_app.ts:82-84` to priznáva.
- F-05-2 [P3][TEST] `visit-treatment-plan-*.integration.test.ts` existujú, ale pokrývajú DB vrstvu; UI kompozícia (`components/encounters/treatment-plan-composer.tsx`, 11 hardcoded textov, §5.3) testovaná nie je.
**Čo funguje dobre:** Consens evidence má najprísnejšie DB granty v celom projekte (`enable-rls.sql:139-180`) vrátane revokovaných `EXECUTE` na trigger funkciách — nad rámec bežnej praxe.
**Pokrytie testami:** unit ✅ (`treatment-plans-safety.test.ts`, `visit-treatment-plan-authoring.integration.test.ts`), e2e ✅ čiastočne (`esign-consent-drill.spec.ts`).
**Otvorené otázky / UNVERIFIED:** či klientská obrazovka `/treatment-plan/[token]` zobrazuje revízie — `UNVERIFIED`.

### J-06 · Predpis / výdaj lieku vrátane kontrolovaných látok (veterinarian)
**Vstup:** `/encounters/[appointmentId]` → predpis · `/controlled-substances` → zápis do knihy OPL
**Cieľ používateľa:** vystaviť recept a zapísať výdaj OPL tak, aby obstál pri kontrole.
**Kroky (as-is):**
1. Recept: `records.*` pre preskripcie (`records.ts:1512,1632,1683` — admin/vet), `lib/records/prescription-safety.ts` (alergie + interakcie, `medicationNamesMatch` s tokenovým matchingom, `:39-56`), `lib/records/prescription-lifecycle.ts`, `prescription_events`.
2. Laboratórna/výdajová väzba: `dispense_charge_queue`, `visit-dispense-closure.integration.test.ts`.
3. OPL kniha: `controlledSubstances.create` (admin/vet, `controlled-substances.ts:449`); `list` je dostupný všetkým staff (`:344`) — pozor, `docs/authorization-matrix.md` hovorí „Technician ❌ DENIED, Front Desk ❌ DENIED“ na **Kniha OPL**.
4. Svedok: `controlledSubstanceWitnessError()` vyžaduje `witnessedBy` pri `administered`/`wasted` (`lib/controlled-substances/policy.ts:47-58`).
5. Zostatok trezoru: `computeControlledSubstanceBalance()` (`policy.ts:70-82`).
6. **AI cesta:** agent tool `create_prescription` (`tools.ts:2894`).
**Miesta vstupu AI:**
- Agent `create_prescription` — `readOnly: false`, `requiredApiScopes: ["records:write"]`, `assertAgentRole([veterinarian, admin])` (`tools.ts:2917-2925`), potom `.insert(prescriptions).values({... status: "active"})` (`tools.ts:2960-2975`).
- `voice.extractBillableItems` označí kontrolované látky cez `CONTROLLED_SUBSTANCES_PATTERNS` (`treatment-extractor.ts:20-46`) a vráti `requiresManualNarcoticProtocol`.
- `ClinicalDiffConfirmModal` — **zero prefill** pre kontrolované látky (`clinical-diff-confirm-modal.tsx:63-77`).
**Bezpečnostné brány:** `requireRole` na OPL create; svedok pri podaní/likvidácii; DB immutabilita cez `financial_closes`/append-only granty; UI zero-prefill; `assertAgentRole` fail-closed.
**Stavy chýb / prázdne stavy:** `controlledSubstances.errors.*` majú vlastné i18n kľúče vrátane `patientUnavailable`, `witnessUnavailable`, `noWitness` (`app/(dashboard)/controlled-substances/page.tsx:187-219,375-410`).
**Počet klikov / prepnutí kontextu:** OPL zápis ~6 (odhad).
**Trenie & zistenia:**
- **F-06-1 [P0][SAFETY]** Agent `create_prescription` **nekonzultuje `CONTROLLED_SUBSTANCES_PATTERNS` ani `isControlledSubstanceName`** pred zápisom a zapisuje `status: "active"`. Envelope sa vydáva **až po** INSERT (`tools.ts:2983`) a nikto ho nespotrebuje (`consumeClinicianConfirmation` sa v tools.ts nevyskytuje) — teda „potvrdenie“ je len odovzdané `confirmationId` vo výsledku s `requiresClinicianReview: true`, ktoré nemá vplyv na stav záznamu.
- F-06-2 [P1][DOCS] `docs/authorization-matrix.md` zakazuje technikovi a recepcii čítanie knihy OPL, ale `controlledSubstances.list` je `protectedProcedure` bez `requireRole` (`controlled-substances.ts:344`). Matrica a kód si protirečia.
- F-06-3 [P2][UX] `records` (recepty) a `controlledSubstances` (kniha) sú dve oddelené obrazovky bez krížového odkazu z receptu na zápis do knihy; lekár musí prepnúť kontext a prepísať údaje znova (dvojité zadávanie, §5.1).
**Čo funguje dobre:** svedok pri OPL, výpočet zostatku trezoru a explicitné i18n chybové stavy sú presne to, čo kontrola vyžaduje; modal má `role`-independent vizuálne varovanie.
**Pokrytie testami:** unit ✅ (`controlled-substances-safety.test.ts`, `records-prescription-safety.test.ts`, `records-prescription-lifecycle.test.ts`, `dosing-safety.test.ts`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** či UI zablokuje `create_prescription` tool, keď nie je otvorený run s `allowWrites` (kód áno — `runner.ts:399-401`), a či `inventory` odpočíta zásobu pri výdaji (nevidel som väzbu) — `UNVERIFIED`.

### J-07 · Laboratórium a zobrazovanie (veterinarian + technician)
**Vstup:** `/lab-results` (import, trendy) · `/agent/imaging` (AI analýza)
**Cieľ používateľa:** dostať čísla do karty a vidieť trendy, nie ich prepisovať.
**Kroky (as-is):**
1. Manuálny import: `extensions.labImport.parseFile` (`lab-import.ts:23`) → `autoDetectAndParse` (`lib/lab/analyzer-parser.ts`).
2. „AI“ import PDF/obrázku: `extensions.labImport.parsePdfOrImageReport` (`lab-import.ts:46`).
3. Uloženie: `saveReport` (`:145`) → `lab_analyzer_reports`; priradenie `assignReport` (`:301`), kontrola `reviewReport` (`:359`).
4. Trendy: `getPatientAnalyteHistory` (`:412`), `components/lab/analyte-trend-visualization.tsx`.
5. Zobrazovanie: `extensions.imaging.analyze` (`imaging.ts:150`) → `prepareConfirmation` (`:683`) → `confirmAnalysis` (`:743`); DICOM prehliadač `components/imaging/dicom-viewer.tsx`; dentálna schéma `extensions/dental.ts` + `dental_charts`.
6. Vloženie nálezu do SOAP: `injectFindingsIntoSoap` (`:574`).
**Miesta vstupu AI:** `imaging.analyze` (LLM), `injectFindingsIntoSoap`, `labImport.parsePdfOrImageReport` (**deklarované AI, žiadny model**).
**Bezpečnostné brány:** `staffProcedure = admin/vet/tech/front_desk` (`lab-import.ts:19-21`); `imagingProcedure = admin/vet + feature` (`imaging.ts:132-134`); `ClinicalDiffConfirmModal` v `analyzer-import-panel.tsx:665`; `prepareConfirmation`/`consumeClinicianConfirmation` pre imaging.
**Stavy chýb / prázdne stavy:** `parsePdfOrImageReport` pri binárnom PDF ticho vráti 0 výsledkov (base64 → UTF-8, `lab-import.ts:59-68`) — **bez chybového stavu**.
**Počet klikov / prepnutí kontextu:** ~5–8 (odhad).
**Trenie & zistenia:**
- **F-07-1 [P0][SAFETY][AI]** Falošný AI dôveryhodnostný signál: `confidenceScore` sa počíta z počtu nájdených parametrov (`lab-import.ts:81-89`), nie z modelu; záznam dostane `deviceModel: "PDF Laboklin/IDEXX AI OCR"` (`:121`) a note „AI Copilot PDF import (confidence: 94%)“ (`:129`); modal ho zobrazuje ako „Spoľahlosť extrakcie“ (`clinical-diff-confirm-modal.tsx:143`). `labParser` feature mapping existuje v UI (`ai-settings-tab.tsx:824`) ale v kóde sa nikdy nečíta (grep v §5.2) → admin si myslí, že túto funkciu nakonfiguroval.
- F-07-2 [P1][PERF] `imaging.analyze` nemá `abortSignal` ani timeout (`imaging.ts:244-262`), hoci komentár očakáva 10–60 s (`:225`) — pri zaseknutom providerovi drží request do platformového limitu.
- F-07-3 [P2][SAFETY] Chyba analýzy sa vracia s raw upstream textom (`imaging.ts:307` → `Analýza zlyhala: ${errorMessage}`), čo môže vyzradiť interné URL/model a je netranslatovateľné.
- F-07-4 [P2][UX] Dvojité zadávanie: referenčné rozsahy sa vyhodnocujú v `analyzer-parser` a znova „okom“ v trendovom grafe; `abnormalCount/criticalCount` sa ukladajú, ale v trendoch sa nezobrazujú ako upozornenie (komponent nebolo možné overiť, → `UNVERIFIED`).
**Čo funguje dobre:** word/line-level `reviewReport`, per-pacientské historické trendy a oddelenie `parseFile` (deterministické) od `parsePdfOrImageReport` (deklarované AI) dáva dobrý základ na opravu F-07-1: prvý je dôveryhodný, druhý treba premenovať alebo doplniť o skutočný OCR model.
**Pokrytie testami:** unit ✅ (`copilot-lab-flow.test.ts`, `imaging.test.ts`, `lab-result-safety` pokryté v `docs/lab-result-safety.md`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** či `analyzer-import-panel` posiela PDF aj ako base64 text alebo ako skutočný binárny obsah — `UNVERIFIED`.

### J-08 · Prepustenie a inštrukcie (veterinarian + front_desk)
**Vstup:** `/agent/discharge` · `/encounters/[appointmentId]` → closeout
**Cieľ používateľa:** majiteľ odchádza s jasnými pokynmi a s naplánovanou kontrolou.
**Kroky (as-is):**
1. `extensions.discharge.generate` (`discharge.ts:83`) — AI alebo šablóna; `usedAi` flag v odpovedi.
2. `prepareConfirmation` (`:210`) → `ClinicalDiffConfirmModal` → `save` (`:356`) s `consumeClinicianConfirmation` (`:490`) a `appendAiAuditEvent` (`:517`); stav cez `resolveAiRecordStatus` (`draft-safety.ts:97-107`).
3. SMS + naplánovanie: `generateSmsAndSchedule` (`:683`) s `appendAiAuditEvent` (`:869`) a sympathy gate.
4. Uzavretie návštevy: `encounters.finalizeClinical` (`encounters.ts:1770`, admin/vet/tech) → `visit_closeouts`, invoice (`:2431`).
5. História: `listByPatient` (`:650`), `listRecent` (`:668`).
**Miesta vstupu AI:** text správy (LLM) a SMS; **sympathy gate** blokuje automatizáciu pri `deceased` (`_safety.ts:70-104`, `assertPatientNotDeceased`).
**Bezpečnostné brány:** envelope + audit; `requireFeature("agent")`; distress/condolence vetva má **deterministickú** šablónu (`discharge.ts:167-172`).
**Stavy chýb / prázdne stavy:** AI nedostupné → deterministický text (`usedAi: false`) — používateľ nikdy nevidí prázdnu obrazovku.
**Počet klikov / prepnutí kontextu:** ~4–6 (odhad).
**Trenie & zistenia:**
- F-08-1 [P2][AI] `generate` používa `configuredModel()` (`discharge.ts:139`) — obchádza `feature_mappings` a teda aj voľbu poskytovateľa kliniky; pri `deepThinking`/`assistant` volenej inak než env default dostane klinika iný model, než si nastavila.
- F-08-2 [P2][UX] Prepúšťacia správa je Markdown (`DISCHARGE_SYSTEM_PROMPT_SK:11`); tlač/PDF render Markdownu nebolo možné overiť → `UNVERIFIED`.
- F-08-3 [P3][I18N] `usedAi` sa vracia, ale UI badge „AI generated“ nebolo overené v komponente → `UNVERIFIED`.
**Čo funguje dobre:** jediný AI povrch s poctivým fallbackom, sympathy vetva a dvojitý audit (generate + save).
**Pokrytie testami:** unit ✅ (`extensions-ai-finalization.test.ts`, `ai-clinical-finalization.integration.test.ts`), e2e ✅ čiastočne (`ai-finalization-pilot.spec.ts` nepokrýva discharge).
**Otvorené otázky / UNVERIFIED:** zobrazenie `usedAi` v UI.

### J-09 · Očkovania, revakcinácie, besnota, štatutárne hlásenia (veterinarian)
**Vstup:** `/vaccinations` · `/recalls` · `/statutory` · `/statutory/kvepis`
**Cieľ používateľa:** splniť zákonné hlásenia na prvýkrát, bez ručného prepisovania.
**Kroky (as-is):**
1. Očkovanie: `vaccination_records` + `lib/records/vaccination-policy.ts`; formulár `components/records/vaccination-form-fields.tsx`.
2. Recalls: `marketing.getRecallSchedule` (`marketing.ts:1851`) a `ext_marketing_recall_schedules`; `lib/vaccination-recalls.ts`.
3. Besnota: `ext_rabies_notifications`, `ext_rabies_observations`; agent tool `check_rabies_observations` (`tools.ts:2331`).
4. KVEPIS: `extensions.kvepis.*` (`kvepis.ts:21` — admin/vet/tech), XSD validácia, mesačná ambulantná kniha; UI `/statutory/kvepis`.
5. CRSZ: `extensions.crsz.*` (admin/vet/tech/front_desk, `crsz.ts:26`) — `microchip_registrations`, `kvl_cr_passports`, `pet_passports`; ISO 11784/11785 validácia.
6. Ochranné lehoty: `ext_withdrawal_periods` + agent tool `check_withdrawal_periods` (`tools.ts:2205`).
7. RVPS hlásenie: agent tool `generate_rvps_report` (`tools.ts:2101`).
**Miesta vstupu AI:** agent tools (RVPS, ochranné lehoty, besnota, mikročip) — všetky `readOnly: true`, výstup sa wrappuje do `<db_record>`; `get_controlled_substances_log` (`tools.ts:3012`) tiež read-only.
**Bezpečnostné brány:** žiadny AI zápis do štatutárnych tabuliek; `requireRole` na routeroch; XSD validácia; `docs/production-readiness` uvádza, že priame podanie na ŠVPS nie je implementované (XML-only).
**Stavy chýb / prázdne stavy:** `UNVERIFIED` pre UI prázdne stavy KVEPIS (stránku som nečítal).
**Počet klikov / prepnutí kontextu:** `UNVERIFIED`.
**Trenie & zistenia:**
- F-09-1 [P2][AI] Agent dokáže vygenerovať RVPS text a vypočítať ochranné lehoty, ale **výsledok sa neaudituje** (`appendAiAuditEvent` sa pre agent runs nevolá) — pri štatutárnom hlásení je to citeľná medzera v dôkaznom reťazci.
- F-09-2 [P3][DOCS] `ROADMAP.md` transparentne uvádza „XML-only export; priame podanie neuskutočnené“ — konzistentné s kódom (žiadne B2G volanie som nenašiel). Dobrá prax.
**Čo funguje dobre:** štatutárne moduly sú read-only pre AI — presne správny postoj; agent má na ne explicitné tooly s jasnými názvami v SK legislatívnom kontexte (`runner.ts:56-61`).
**Pokrytie testami:** unit ✅ (`statutory.test.ts`, `dosing-safety.test.ts`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** UI `/statutory` a `/statutory/kvepis` workflow klik-po-kliku — `UNVERIFIED`.

### J-10 · Follow-up a starostlivosť (front_desk + veterinarian)
**Vstup:** `/care-reminders` · `/wellness` · `ai.patientsNeedingFollowUp`
**Cieľ používateľa:** nezabudnúť na pacienta, ktorý sa nevráti.
**Kroky (as-is):**
1. Pripomienky: `careReminders.*` (`care-reminders.ts:40` — admin/vet/tech/front_desk), `care_reminders`, cron `/api/cron/reminders`.
2. Wellness: `wellness.*` (`manageRole = admin/front_desk`, `wellness.ts:32`), `wellness_enrollments`, cron `/api/cron/wellness-billing`.
3. Follow-up kandidáti: `ai.patientsNeedingFollowUp` (`ai.ts:615`) — termíny `checked_out` za 7 dní bez budúceho termínu; `ai.patientsOverdueVaccinations` (`ai.ts:546`).
4. Automatizácie: `lib/autopilot/*` (journeys, rules, enrollments, suppression), cron `/api/cron/automation-worker`.
**Miesta vstupu AI:** žiadne reálne — obe `ai.*` procedúry sú **čisté SQL** (grep v §5.2); v API dokumentácii sú však vedené pod `/api-docs/ai`.
**Bezpečnostné brány:** sympathy gate na viacerých vrstvách (`consent-gate.ts:71-78`, `postoperative.ts:177-178`, `segmentation-engine.ts:320-355`, `rules-engine.ts:611`); suppression log `ext_automation_suppression_log`.
**Stavy chýb / prázdne stavy:** `patientsNeedingFollowUp` vracia `[]` bez chyby pri žiadnych dátach (`ai.ts:696`).
**Počet klikov / prepnutí kontextu:** `UNVERIFIED`.
**Trenie & zistenia:**
- F-10-1 [P2][AI][DOCS] Marketingová/API prezentácia nazýva tieto procedúry AI (`/api-docs/ai`), hoci ide o deterministické SQL. Rovnaký problém ako A19 — znižuje dôveru v to, čo je naozaj AI (a v prípade `ai.dailySummary` ide aj o gating: pozri F-X4-1).
- F-10-2 [P3][UX] `ai.patientsNeedingFollowUp` nemá v aplikácii žiadny UI (grep: jediný výskyt mimo routera je v `app/api-docs/ai/page.tsx`). Teda follow-up kandidáti sú dnes dostupní len volaním API — mŕtvy koniec pre Zuzanu.
**Čo funguje dobre:** sympathy gate je implementovaný na toľkých vrstvách, že je prakticky nemožné ho obísť jedným zabudnutým `if` v novom journale.
**Pokrytie testami:** unit ✅ (`care-reminders-dismissal.test.ts`, `wellness-safety.test.ts`, `autopilot-e2e-journeys.test.ts`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** reálne správanie UI `/care-reminders`.

### J-11 · Fakturácia a platba (front_desk)
**Vstup:** `/billing` · `/billing/new` · `/billing/pos` · `/billing/ekasa`
**Cieľ používateľa:** vybrať peniaze, vystaviť doklad a mať hotovú uzávierku.
**Kroky (as-is):**
1. Faktúra: `billing.*` — `billingAdminProcedure = requireRole("admin")` (`billing.ts:189`), platby `requireRole("admin","front_desk")` (`:1935`).
2. Rozúčtovanie: `extensions.reconciliation.*` (admin/vet/tech/front_desk, `reconciliation.ts:20`), `extensions.accounting.*` (admin/vet, `accounting.ts:21`).
3. e-Kasa: `extensions.ekasa.*` (`ekasa.ts:89,160,202,277,380`), `ekasa_config`, `ekasa_receipts`, `ekasa_daily_closures`; crony `/api/cron/ekasa-daily-closure`, `/api/cron/ekasa-retry`; UI `/billing/ekasa` (denná uzávierka používa **`ekasa.dailySummary`**, nie `ai.dailySummary`).
4. AI: `voice.createBillFromExtractedItems` (`voice.ts:966`) — návrh účtu z diktátu.
5. Poisťovne: `insurance.*`, `extensions.insurance.*` (admin/front_desk, `insurance.ts:420,450,571,601`).
**Miesta vstupu AI:** `voice.extractBillableItems` + `createBillFromExtractedItems` (oba admin/vet). Lekár vyberá položky pred vytvorením účtu = HITL pre peniaze.
**Bezpečnostné brány:** `financial_closes` append-only a **neviditeľné** pre `openpims_app` (REVOKE ALL, `enable-rls.sql:181-190`); `payment_processor_*` bez DELETE; `EKASA_FISCALIZATION_ENABLED` default false (R-P0-001 v `RISK_REGISTER.md`).
**Stavy chýb / prázdne stavy:** e-Kasa má retry cron a `sms-recovery-console`-analogické nástroje v `/admin`.
**Počet klikov / prepnutí kontextu:** `UNVERIFIED`.
**Trenie & zistenia:**
- F-11-1 [P2][AI] Ceny v `KNOWN_SERVICES_CATALOG`/`KNOWN_MEDICATIONS_CATALOG` (`treatment-extractor.ts:61-115`) sú **hardcoded slovenské ceny a 23 %/19 % DPH** napísané v kóde, nie z cenníka kliniky (`services`, `products`). Extrakcia tak navrhne sumu, ktorá nemusí zodpovedať realite. User to môže prepísať (HITL), ale riziko nesprávnej faktúry je vysoké.
- F-11-2 [P2][DOCS] e-Kasa denná uzávierka má vlastný `dailySummary` v `extensions.ekasa`, pričom `ai.dailySummary` počíta iné agregáty (počet finalizovaných SOAP, platieb). Dve procedúry s rovnakým názvom a rôznym významom sú lákadlo na chybu.
**Čo funguje dobre:** finančné evidence sú označené ako nezmazateľné a `financial_closes` je odňaté aplikačnej role úplne — najprísnejšie v projekte.
**Pokrytie testami:** unit ✅ (`billing-*.test.ts` 8 súborov, `stripe-*`, `extensions-reconciliation.test.ts`, `visit-dispense-closure.integration.test.ts`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** či POS obrazovka ponúkne AI-extrahované položky aj pri manuálnej faktúre.

### J-12 · Sklad a objednávky (technician + admin)
**Vstup:** `/inventory`
**Kroky (as-is):**
1. `inventory.*` — `requireRole("admin","veterinarian","technician","front_desk")` (`inventory.ts:143`), úpravy admin/vet (`:147`).
2. Import dodacích listov: `lib/inventory/wholesaler-import.ts` + `extensions.wholesaler-import.ts` (parser pre Cymedica/Pharmos/Samohýl/Henry Schein je implementovaný).
**Miesta vstupu AI:** žiadne (parser je deterministický — správne).
**Bezpečnostné brány:** `inventory-safety.test.ts`; `extensions-wholesaler-import.test.ts` + `-confirm-import`.
**Trenie & zistenia:**
- F-12-1 [P1][UX][DOCS] `ROADMAP.md` („Transparentny register“, bod 9) a `docs/help/*` uvádzajú, že **UI pre wholesaler import neexistuje** a je plánované na v0.7. Parser a tRPC procedúry pritom existujú. Pre front_desk je to slepá ulička: dáta sa nedajú naliať inak než SQL. Dôkaz: `ROADMAP.md` bod 9, `lib/inventory/wholesaler-import.ts`, `server/routers/extensions/wholesaler-import.ts`.
- F-12-2 [P3][UX] Bez AI je to v poriadku, ale `inventory` nemá žiadnu napojenie na `contraindications`/`dosing` ani na OPL spotrebu — dvojité zadávanie pri výdaji lieku (viď F-06-3).
**Čo funguje dobre:** sklad je zámerne bez AI. Pri liekoch je to správne rozhodnutie.
**Pokrytie testami:** unit ✅, e2e ❌.
**Otvorené otázky / UNVERIFIED:** či `/inventory` obsahuje čo i len tlačidlo na import → `UNVERIFIED`.

### J-13 · Komunikácia s klientom (front_desk)
**Vstup:** `/inbox` · `/marketing/messages`
**Kroky (as-is):**
1. Inbox: `communications.*` (`communications.create`, `markClientRead`, `assignClient`, `updateStatus`, `linkCommunicationToClient` — `components/communications/inbox-view.tsx:316-400`), `messaging.getInboxStatus` (`:259`).
2. Odosielanie: `messaging.*`, `lib/sms-dispatch.ts`, `lib/sms.ts`, quiet hours, `sms_suppressions`, `email_suppressions`.
3. Telemetria: `sms_provider_events`, `sms_delivery_events`, recovery konzola `/admin/sms-recovery-console.tsx` (30 hardcoded textov).
**Miesta vstupu AI:** **žiadne**. Inbox nemá AI súhrn, klasifikáciu ani odpovede (grep `ai`/`generateText` v `messaging.ts` a `inbox-view.tsx` vracia len nesúvisiace zhody).
**Bezpečnostné brány:** suppression listy, quiet hours, `checkSmsRateLimit` (`marketing.ts:2941`), unsubscribe tokeny (`unsubscribeByToken`, `:3015`).
**Stavy chýb / prázdne stavy:** `getInboxStatus` dáva samostatný stav pre nenakonfigurovanú schránku.
**Trenie & zistenia:**
- F-13-1 [P2][AI] Absencia AI je z hľadiska prompt-injection **pozitívum**, ale z hľadiska hodnoty **medzera**: Zuzana nemá ani „zhrň mi tento vlákno“, ani „navrhni odpoveď“. Keďže ide o texty **od klientov**, každá budúca AI funkcia tu musí ísť cez `<db_record>` ohraničenie (vzor v `runner.ts:367-378`). Dnes je to jediný veľký komunikovaný povrch bez AI a je to bezpečné.
- F-13-2 [P2][I18N] `inbox-view.tsx` má 9 hardcoded textov, `message-logs-view.tsx` 3, `sms-recovery-console.tsx` 30 (`§5.3`).
**Čo funguje dobre:** žiadny AI text od klienta nejde do promptu — jediná cesta je `visitContext` (staff) a `booking.pet.name` (verejnosť, P0 F-04-2).
**Pokrytie testami:** unit ✅ (`communications-inbox.test.ts`, `communications-send.test.ts`, `messaging-*`), e2e ❌.
**Otvorené otázky / UNVERIFIED:** priame správanie quiet hours pri hraničnom čase.

### J-14 · Marketing a automatizácie (front_desk + admin)
**Vstup:** `/marketing` (14 podstránok) · `/automations`
**Kroky (as-is):**
1. Plán a obsah: `marketing.getWeeklyPlan` (`:2144`), `generatePost` (`:323`), `createContentItem` (`:603`), `autoFixContentItem` (`:2213`).
2. Schvaľovanie: social approval queue — `approveContentItem` (`:658`), `createContentBatch` (`:2092`)/`approveContentBatch` (`:2107`), `rejectContentItem` (`:2196`); komponent `components/marketing/social-approval-queue-tab.tsx` (obsahuje text „Sympathy Gate aktívny“, L159).
3. Médiá: `generateImage`/`generateImageForPost`/`submitVideo`/`pollVideo`/`generateIllustration`/`applyMediaEdit`, consent evidence `ext_marketing_media_consents` + `grantConsent`/`revokeConsent`.
4. Journeys a pravidlá: `automation-*` routery, `lib/autopilot/*` (rules-engine, segmentation-engine, consent-gate), suppression `ext_automation_suppression_log`.
5. CRM segmenty: `extensions.crm-segments.*` (admin/vet, `crm-segments.ts:93,133,157`).
6. Web builder: `getWebsiteConfig`/`updateWebsiteSections`/`publishWebsite` + `suggestWebsiteFaq`.
7. TV a letáky: `listTvSlides`/`createTvSlide`, `lib/marketing/*`, `components/marketing/tv-player.tsx`.
**Miesta vstupu AI:** copy (`configuredModel()` v `composer.ts:106`), recenzie (`generateReviewReply:1485`), FAQ (`4580`), alt-texty (`3401`), competitor (`3661`), obrázky/video (Alibaba), autoFix.
**Bezpečnostné brány:** `validateMarketingText` (block/warn), `assertPatientNotDeceased` (`_safety.ts:88-104`), media consent evidencia, schvaľovacia fronta, `appendAiAuditEvent` pre `marketing_content` (`:583,1567`) a `marketing_media` (`:4696`).
**Trenie & zistenia:**
- F-14-1 [P1][AI] `generatePost`/`composer` používajú `configuredModel()` (`composer.ts:106`) a **ignorujú `marketingCopy` mapping**, ktorý admin nastavuje v `/settings?tab=ai` (`ai-settings-tab.tsx:886`). To isté pre `competitors.ts:144`, `suggestWebsiteFaq` (`marketing.ts:4590`) a `suggestMediaAltText` (`:4646`). Klinika teda nemá kontrolu nad tým, ktorý poskytovateľ dostane jej marketingové texty (a ani nad tým, či ide o EÚ endpoint).
- F-14-2 [P2][AI][TEST] `lib/ai/__tests__/marketing-audit.test.ts` (12 testov) overuje audit marketing obsahu — dobré. Chýba však test, ktorý by zachytil, že `marketingCopy` mapping nie je nikde použitý.
- F-14-3 [P2][SAFETY] Recenzné texty sú cudzí vstup (Google/ekanál) a idú do promptu bez `<db_record>`; pozri F-X3-2.
- F-14-4 [P2][I18N] Marketing je najväčší zdroj hardcoded textov: `website-editor-sheet.tsx` 76, `client-automations-view.tsx` 36, `clinical-automations-view.tsx` 13 (`§5.3`). Časť je **zámerná** (texty na tlač letákov, A5 náhľad `„Ošetrujúci veterinárny lekár:“`), časť nie (tlačidlá, placeholdery).
**Čo funguje dobre:** schvaľovacia fronta + `validateMarketingText` + sympathy gate tvoria reálny “human-in-the-loop” pre marketing; štítok „AI Canvas“ je pri procedurálnych ilustráciách poctivo označený ako „Ilustrácia (generovaná)“.
**Pokrytie testami:** unit ✅ (`marketing.test.ts`, `marketing-audit.test.ts`, `automation-content.test.ts`, `website-builder.test.ts`, `website-data-integration.test.ts`), e2e ✅ (`website-builder.spec.ts`), ale žiadny e2e pre approval queue.
**Otvorené otázky / UNVERIFIED:** či schválenie batchu v UI skutočne brzdí odoslanie na sociálne siete (publisher nebolo možné overiť v behu).

### J-15 · Reporty a dashboard (admin + veterinarian)
**Vstup:** `/` · `/reports`
**Kroky (as-is):**
1. Dashboard: `dashboard.getStats`/`getCharts`/`getDashboard` (`dashboard.ts:138,220,393`) — `protectedProcedure` bez `requireRole` (vhodné pre všetky roly).
2. Reporty: `reports.*` (`requireRole("admin","veterinarian")`, `reports.ts:35`).
3. AI agregáty: `ai.dailySummary` (`ai.ts:719`) — **nemá UI** (jediný výskyt mimo routera je `/api-docs/ai`).
**Miesta vstupu AI:** žiadne reálne (SQL agregáty).
**Trenie & zistenia:**
- F-15-1 [P2][DOCS] `ai.dailySummary` je inzerovaný v `/api-docs/ai` ako „Daily practice summary“ pre „AI dashboard assistants“, ale v produktoch nemá spotrebiteľa. Buď doplniť UI, alebo z dokumentácie odstrániť — dnes je to zbytočná plocha.
- F-15-2 [P2][PERF] `ai.patientsOverdueVaccinations` nemá `assertActivePractice` na začiatku, ostatné dve ju majú (`ai.ts:546` vs `:615,719`) — nekonzistentná validácia (praktický dopad je nulový, pretože `practiceDateInput` aj tak overí prax, ale je to vzor pre copy-paste chyby).
**Čo funguje dobre:** dashboard je čistý, bez AI, s deterministickými číslami — správne pre prevádzkový prehľad.
**Pokrytie testami:** unit ✅ (`dashboard.test.ts`, `reports.test.ts`), e2e ✅ (`dashboard.spec.ts`).
**Otvorené otázky / UNVERIFIED:** žiadne.

### J-16 · Onboarding novej ambulancie (admin)
**Vstup:** `/onboarding` · `/settings` · `/settings/import-v2`
**Kroky (as-is):**
1. Kroky sprievodcu v `components/onboarding/steps/*`: `practice-basics.tsx` (7 hardcoded textov), `branding`, `invite-team`, `bring-data` (9), `add-a-card`, `try-agent` (3).
2. **AI krok:** `trpc.agent.status.useQuery()` + `trpc.agent.run.useMutation()` v `try-agent.tsx:57-58`; pri chýbajúcom kľúči ukáže **statický ukážkový výstup** s jasným označením (`:21` komentár „A short, clearly-labeled sample so users see the value even with no AI key“).
3. AI provider setup: samostatná karta `/settings?tab=ai` (J-17).
4. Dátová migrácia: `/settings/import-v2` → `v2-import.ts`, `lib/import/*` (Shepherd, VetSoftware v2, CSV).
**Miesta vstupu AI:** `agent.status` + `agent.run` (ukážka); inak žiadne.
**Bezpečnostné brány:** onboarding je admin-only v `settings.*` (`settings.ts:109`).
**Trenie & zistenia:**
- F-16-1 [P2][UX] Krok „vyskúšaj AI“ je **pred** konfiguráciou AI poskytovateľa v poradí sprievodcu; admin takmer vždy vidí „AI helper is not available right now“ a odchádza s dojmom, že AI nefunguje. Dôkaz: `components/onboarding/steps/try-agent.tsx:164-181` (texty pre nedostupnosť) vs `settings.ai` karta inde.
- F-16-2 [P2][I18N] 25 hardcoded textov v `components/onboarding/steps/*` (practice-basics 7, bring-data 9, add-a-card 2, branding 2, invite-team 2, try-agent 3) — prvý dojem novej kliniky je čiastočne nepreložiteľný.
- F-16-3 [P3][TEST] `settings-onboarding-help.test.ts` a `settings-onboarding-migrations.test.ts` existujú, ale **žiaden test nepokrýva `try-agent` krok**.
**Čo funguje dobre:** statická, jasne označená ukážka AI bez kľúča je elegantné riešenie, ktoré neklame.
**Pokrytie testami:** unit ✅ čiastočne, e2e ✅ (`fresh-clinic-mock-launch.spec.ts`, `registration-flow.spec.ts`).
**Otvorené otázky / UNVERIFIED:** reálne poradie krokov v sprievodcovi (poradie som odvodil z názvov súborov, nie z komponentu radu) — `UNVERIFIED` pre presné číslo kroku.

### J-17 · Nastavenie AI poskytovateľov a feature mapping (admin) — **KĽÚČOVÝ AI WORKSPACE**
**Vstup:** `/settings?tab=ai` · `/settings/ai`
**Cieľ používateľa:** nakonfigurovať poskytovateľa, overiť spojenie a vedieť, kam jeho dáta tečú.
**Kroky (as-is):**
1. Načítanie: `extensions.aiSettings.getSettings` (`ai-settings.ts:22`) — **`protectedProcedure` bez `requireRole`**; vracia `maskedKey` pre OpenAI/Gemini/Alibaba (posledné 4 znaky dešifrovaného kľúča, `ai-crypto.ts:85-91`) a base URL (default `http://127.0.0.1:8080/v1`).
2. Uloženie: `updateSettings` (`:132`, `requireRole("admin")`) — šifrovanie `encryptAiApiKey` (AES-256-GCM, formát `v1:<iv>:<tag>:<ct>`, `ai-crypto.ts:31-44`), ochrana proti prepisu maskovanou hodnotou (`startsWith("••••")`, `:160-172`).
3. Test spojenia: `testConnection` (`:254`, admin) — meria latenciu a zapisuje `lastStatus`.
4. Načítanie modelov: `fetchModels` (`:361`, admin) → `cachedModels` pre UI select.
5. Health lokálnej proxy: `checkAliProxyHealth` (`:488`) — **bez role gate**.
6. Feature mapping: 8 kľúčov v `DEFAULT_PRACTICE_FEATURE_MAPPINGS` (`ai-presets.ts:24-33`) + preset katalógy (`ai-presets.ts:3-22`); UI karty v `ai-settings-tab.tsx:763-908`.
7. Resolver: `resolveFeatureConfig`/`resolvePracticeLanguageModel` (`ai-config-resolver.ts:57-231,290-343`) s **automatickým fallbackom** medzi providermi a „intelligent auto-fallback“ (ak zvolený provider nemá kľúč, použije sa iný aktívny).
**Miesta vstupu AI:** celý resolver je rozcestník pre všetky AI volania (grep v §5.2).
**Bezpečnostné brány:** šifrovanie kľúčov v DB, maskovanie v UI, `requireRole("admin")` na všetkých mutáciách, `REVOKE`/RLS na `ext_ai_settings` (cez dynamický blok `enable-rls.sql:62-113`).
**Stavy chýb / prázdne stavy:** `getSettings` bez záznamu vracia úplný default objekt (`:29-71`) — UI sa nikdy nezobrazí prázdne; `lastStatusMessage` drží poslednú chybu testu.
**Počet klikov / prepnutí kontextu:** 3–5 pre zmenu modelu jednej funkcie (odhad).
**Trenie & zistenia:**
- **F-17-1 [P1][SAFETY]** `getSettings` je bez role gate, hoci všetky ostatné procedúry v routeri vyžadujú `admin`. `front_desk`, `technician` aj `viewer` tak dostanú `maskedKey` (posledné 4 znaky kľúča) pre všetkých troch poskytovateľov, ich base URL a históriu testov. `checkAliProxyHealth` navyše vracia `version`/`uptimeSeconds`/`error` bez akejkoľvek roly. Test `ai-settings-router.test.ts:82` overuje len to, že `updateSettings` je admin-only — chýbajúci gate na `getSettings` nezachytáva.
- **F-17-2 [P1][DATA]** `resolveKeyBuffer()` používa ako fallback `createHash("sha256").update(process.env.NEXTAUTH_SECRET || "openvpm-dev-ai-settings-default-secret-seed")` (`ai-crypto.ts:19-30`). Ak nie je nastavený `AI_SETTINGS_ENCRYPTION_KEY` **ani** `NEXTAUTH_SECRET` (alebo je použitá verejná dev hodnota), sú všetky uložené provider kľúče dešifrovateľné kýmkoľvek, kto pozná repozitár a má prístup k DB dumpu. Kľúč navyše **nie je verzovaný** – rotácia `AI_SETTINGS_ENCRYPTION_KEY` ticho znefunkční všetky uložené kľúče (`tryDecrypt` v resolveri ich iba zaloguje a padne späť na „default“ provider, `ai-config-resolver.ts:108-116`) bez toho, aby to admin v UI videl.
- **F-17-3 [P1][AI]** `feature_mappings` je rešpektovaný len pre `assistant`, `deepThinking` (`agent.ts:131`, `ai.ts:505`), `voiceSoap` (`voice.ts:169,345,463`), `imagingRtg` (`imaging.ts:233`), `imageGeneration`/`videoGeneration` (`marketing.ts:824,880,908`). **`marketingCopy` a `labParser` sa v kóde nikdy nečítajú** (grep vracia iba výskyty v `ai-settings-tab.tsx` a v presetoch). SOAP „flash“ draft, discharge, transcription, treatment extraction a marketing copy používajú `configuredModel()` (`soap-draft.ts:153`, `discharge.ts:139`, `transcription.ts:127`, `treatment-extractor.ts:241`, `composer.ts:106`, `competitors.ts:144`, `marketing.ts:353,1505,4590,4646`). Admin teda platí za obrazovku, ktorá čiastočne neplatí.
- **F-17-4 [P1][SAFETY][DOCS]** **Data residency nie je nikde v UI.** Panel „Klinická a legislatívna bezpečnosť“ (`ai-settings-tab.tsx:926-957`) hovorí iba o HITL, kontrolovaných látkach a sympathy gate — ani slovo o tom, že texty odchádzajú k tretiemu subjektu, do akého regiónu, s akou retenciou, ani o stave DPA. `docs/ai-evidence/MODEL_CARDS.md:15-22` pritom deklaruje „EU / US“ pre Claude a „EU“ pre Vertex a tvrdí, že „PHI sa neposiela do modelu bez klinického kontextu po súhlase kliniky“ — **súhlas kliniky s odosielaním PHI tretiemu subjektu nie je nikde evidovaný** (grep `consent` v `ai-settings-tab.tsx` vracia prázdno). Súvisí s R-P1-006 v `RISK_REGISTER.md`.
- **F-17-5 [P2][DOCS]** `MODEL_CARDS.md` uvádza modely „Claude 3.5 Sonnet“, „Gemini 1.5 Pro“ a „MedGemma“, ale kód má `DEFAULT_AI_MODEL = "gemini-3.8-flash-medium"` (`lib/ai-models.ts:13`) a presety `gemini-3.6-flash` / `gemini-3.1-pro-preview` (`ai-presets.ts:17-21`). Dokument je pre inšpekciu nepresný; slúži ako „Clinical AI Evidence Pack“ (`MODEL_CARDS.md:3-6`), takže nesúlad je právne relevantný.
- **F-17-6 [P2][UX]** „Intelligent Auto-Fallback“ (`ai-config-resolver.ts:141-215`) je síce odolný, ale v UI **nie je viditeľný**: ak klinika nastaví Gemini a systém ticho použije OpenAI, lekár to nezistí (vidí iba `lastStatus` z manuálneho testu). Pri GDPR je tiché prepnutie sub-procesora neprijateľné.
**Čo funguje dobre:** AES-256-GCM s `base64url` IV/tagom, maskovanie v odpovedi, ochrana maskovaného kľúča proti prepisu, cache modelov, meranie latencie, a RLS na `ext_ai_settings`.
**Pokrytie testami:** unit ✅ (`ai-settings-router.test.ts` 5, `ai-config-resolver.test.ts` 3, `ai-crypto.test.ts` 4), e2e ❌.
**Otvorené otázky / UNVERIFIED:** či produkčné nasadenie nastavuje `AI_SETTINGS_ENCRYPTION_KEY` (`.`env.example` deklaruje `NEXTAUTH_SECRET`, ale kľúč pre AI nastavenia som tam nenašiel) — `UNVERIFIED`.

### J-18 · Agent (admin + veterinarian)
**Vstup:** `/agent` · `/agent/voice` · `/agent/imaging` · `/agent/discharge` · `POST /api/v1/agent`
**Cieľ používateľa:** získať odpoveď nad vlastnými dátami bez klikania v piatich obrazovkách.
**Kroky (as-is):**
1. Status: `agent.status` (`agent.ts:65`) — `protectedProcedure`, vracia `configured`, `canUseAi`, `needsBillingSetup`, `accessMessage`, zoznam toolov.
2. Beh: `agent.run` (`agent.ts:90`, `agentProcedure = admin/vet + requireFeature("agent")`) → `runAgent` (`runner.ts:441`).
3. Tool loop: AI SDK, `MAX_ITERATIONS = 12` (`runner.ts:33`), `MAX_OUTPUT_TOKENS = 4096`.
4. Write gate: `allowWrites` default false (`agent.ts:99`), `runner.ts:399-401` odmietne write tool s `"Write tools are disabled for this run."`; API navyše vyžaduje scope `agent:write` a resource scope (`api/v1/agent/route.ts:89-90`).
5. Role gate v tool vrstve: `assertAgentRole(ctx, [...], msg)` fail-closed (`authorization.ts:60-90`).
6. Ochrana proti prompt injection v dátach: `wrapUntrustedData` escapuje `</db_record>` (`runner.ts:367-378`) + pravidlo #6 v system prompte (`runner.ts:70-73`).
7. Rate limity: 20/min aktér + 120/min prax (`runner.ts:37-39`), meranie `recordUsage(kind: "ai_run")` po úspešnom behu.
**Miesta vstupu AI:** 25 toolov (`tools.ts`, `AGENT_TOOL_NAMES`), z toho 4 write: `book_appointment` (`:668`), `record_vital_signs` (`:995`), `record_vitals_from_speech` (`:2594`), `create_prescription` (`:2894`).
**Bezpečnostné brány:** role gate na procedure, feature gate, rate limity, `allowWrites`, `requiredApiScopes`, `assertAgentRole`, `wrapUntrustedData`, `lockPracticeForExternalSideEffects` (recovery hold), `readHostedAiAccess` pod zámkom.
**Stavy chýb / prázdne stavy:** `agent.status` má 4 rozlíšené stavy (billing setup, nekonfigurované, neoverené, pripravené) a retry tlačidlá (`agent/page.tsx:298-400`); `buildFallbackSummary` (`runner.ts:640-662`) vytvorí zrozumiteľnú odpoveď zo zlyhaného behu.
**Počet klikov / prepnutí kontextu:** 1–3 (najlepšie v projekte).
**Trenie & zistenia:**
- **F-18-1 [P0][SAFETY]** `create_prescription` — pozri F-06-1. Tu len dopĺňam rozsah: tool je dostupný aj cez `POST /api/v1/agent` s kľúčom, ktorý má `records:write`, teda **automatizovaný skript** dokáže vystaviť aktívny recept. `veterinarian_user_id` je voliteľný (`api/v1/agent/route.ts:36,107-121`) a pri absencii sa použije rola `service_agent`, ktorá je pre `create_prescription` odmietnutá — čiže cez API je potrebný ľudský veterinár v systéme, čo je správne zmiernenie, ale **nie prevencia** kontrolovaných látok.
- **F-18-2 [P1][UX]** `/agent` je v navigácii len pre admin/vet (správne), ale `/agent/voice` je v `custom-nav.ts:111-118` pre **všetkých** vrátane `viewer` a všetky roly vidia aj plávajúce tlačidlo `ScribeWidget` (`components/layout/scribe-widget.tsx:38-40`) v dashboard layoute. `voiceProcedure` pritom vyžaduje admin/vet (`voice.ts:45-47`). Technik teda klikne na mikrofón, nahrajú sa mu audio blob do S3 (`voice.ts:112-118`) a **až potom** dostane `FORBIDDEN` s textom `"Requires one of: admin, veterinarian"` (`trpc.ts` `requireRole`), ktorý sa zobrazí ako toast (`agent/voice/page.tsx:275`).
- **F-18-3 [P2][AI][DATA]** Behy agenta sa **neauditujú**. `appendAiAuditEvent` sa volá len na 4 povrchoch (`ai.ts:326`, `discharge.ts:517,869`, `imaging.ts:836,975`, `marketing.ts:583,1567,4696`, `voice.ts:808`). Agent, ktorý prečíta celú kartu pacienta (najväčší objem PHI v prompte zo všetkých funkcií), nezanechá v dôkaznom reťazci nič okrem `audit_log` mutácií — čo pri **read-only** behu nie je žiadny záznam (mutation middleware sa na query nevzťahuje, `trpc.ts`).
- **F-18-4 [P2][UX]** Ovládanie zápisov je len jeden checkbox; pri `deepThinking` a write mode sa v UI nezobrazuje, ktorý model odpovedá (model sa vyberá v `agent.ts:128-132` podľa praxe) — lekár nemá ako zistiť, či odpovedal „Pro“ model.
- F-18-5 [P3][DOCS] Tool `calculate_drug_dose` je v system prompte mandatórny pre dávky (`runner.ts:47-49`), ale jeho `zod` schéma používa `z.preprocess` (`tools.ts:887-918`), čo pre model znamená voľnejšiu štruktúru; v kombinácii s 12-krokovým limitom môže „MANDATORY SAFETY RULE“ zostať nesplnené. Neoverené v behu → `UNVERIFIED`.
**Čo funguje dobre:** `<db_record>` ohraničenie + explicitné pravidlo v prompte je správna obrana proti prompt injection **v tool výstupoch**; fail-closed `assertAgentRole`; duálne rate limity; recovery-hold a billing gates volané pod zámkom.
**Pokrytie testami:** unit ✅ rozsiahle (`lib/agent/__tests__`: tools 61 testov, runner 14, runner-rate-limit 11, agent-auth-e2e 17, inference-proxy 6), e2e ❌ (žiaden pokrýva write tool).
**Otvorené otázky / UNVERIFIED:** správanie `record_vitals_from_speech` (parser reči na čísla, `tools.ts:2594`) pri slovenskom diktáte; potrebný beh s reálnym modelom.

### J-19 · Migrácia dát z iného PIMS (admin)
**Vstup:** `/migration-archive` · `/settings/import-v2`
**Kroky (as-is):**
1. Náhľad archívu: `migrationArchive.*` — `reviewStatus` (`:53`), `summary` (`:71`), `list` (`:230`), `detail` (`:701`) — **všetky iba `protectedProcedure` bez `requireRole`** (`migration-archive.ts:24`).
2. Import: `v2-import.ts`, `lib/import/*` — `shepherd-core-adapter.ts`, `vetsoftware-v2-adapter.ts`, `shepherd-care-reminder-adapter.ts`, `normalize.ts`, `csv/import.ts`.
3. Sympathy gate už pri importe: `vetsoftware-v2-extractor.ts:157-273` explicitne počíta `deceasedPatientsCount` a nastavuje `deceased` status (`:145`).
**Miesta vstupu AI:** žiadne (iba deterministické parsery) — správne rozhodnutie: historické cudzie dáta nie sú vhodné pre model.
**Trenie & zistenia:**
- F-19-1 [P3][SAFETY] `migrationArchive` čítanie je bez `requireRole`; `viewer` (read-only účet, napr. externý účtovník) vidí celý migračný archív vrátane starých dát iného systému. Nie je to PHI únik mimo tenant, ale porušuje princíp minimálnych práv.
- F-19-2 [P2][UX] Pri komplexnosti importu (`lib/import/*` má >10 súborov) je jediný UI vstup `/settings/import-v2` a `migration-review-checklist.tsx`; `docs/help/*` nematú SK runbook pre Cymedica/Pharmos (R-P1-010 v risk registri).
**Čo funguje dobre:** sympathy gate sa aplikuje už pri importe, nie až pri komunikácii — presne správne poradie.
**Pokrytie testami:** unit ✅ (`data-import-*.test.ts` 3 súbory, `lib/import/__tests__` 2), e2e ❌.
**Otvorené otázky / UNVERIFIED:** reálne UI toku importu.

### J-20 · Audit a export, RLS, multi-tenancy, support session (admin)
**Vstup:** `/settings?tab=data` (export) · `scripts/verify-ai-audit-trail.ts` · `/support`
**Kroky (as-is):**
1. Inšpekčný protokol: `extensions.auditExport.exportInspectionProtocol` (`audit-export.ts:24`, `requireRole("admin","veterinarian")`) → `collectTimelineEvents` (`lib/audit/export.ts`) spája `audit_log`, `ext_ai_audit_log` (`:80-102`) a ďalšie časové osi; výstup CSV + JSON + PDF + SHA-256 manifest (`audit-export.ts:50-64`).
2. Overenie AI reťaze: `scripts/verify-ai-audit-trail.ts` + `lib/ai/audit-chain.ts` (deteguje `SEQUENCE_GAP`, `PREDECESSOR_MISMATCH`, `HASH_MISMATCH`, `MUTATED_ROW`, `SOFT_DELETED_ROW`, `FUTURE_TIMESTAMP`, `ALTERED_EDIT_FLAG`).
3. RLS: `packages/db/rls/enable-rls.sql` (757 riadkov) — granty, `app_current_practice_id()`, `app_rls_bypass()`, dynamické pokrytie `ext_*`/`ekasa_*` + 7 explicitných tabuliek (`:62-113`), child tabuľky cez parent join (`:470-500`), referenčné dáta (`:494-505`), append-only granty pre `ext_ai_audit_log` a `recent_clinical_items` (`:125-190`).
4. Support session: `extensions.support.*` (`support.ts:21-142`) + `/support` UI + `app/api/support/signaling/route.ts`.
**Bezpečnostné brány:** RLS politika `USING/WITH CHECK (app_rls_bypass() OR practice_id::text = app_current_practice_id()::text)`; immutability trigger na `ext_ai_audit_log`; `REVOKE` na trigger funkciách.
**Trenie & zistenia:**
- F-20-1 [P1][DOCS] `docs/authorization-matrix.md:33-40` tvrdí, že `technician` môže „Dictate Draft“ (AI voice) a „Create/Edit“ SOAP drafts a že existuje rola `portal_user`/`service_cron`. Realita: `voiceProcedure` aj `saveSoapDraft` vyžadujú admin/vet (`voice.ts:45-47`, `records.ts:1738`), rola `portal_user` neexistuje (je `portalProcedure` s capability tokenom) a pribudla rola `viewer`, ktorá v matrici chýba. Dokument je označený ako „Canonical Security Reference“ — nesúlad je pri audite viditeľný.
- F-20-2 [P2][SAFETY][UX] Support session: **žiadna** procedúra nemá `requireRole` (`support.ts:21,38,61,79,109`) a `checkSupportRole` vracia `isSupport = ctx.user.role === "admin"` — teda **rola v klinike**, nie `isPlatformAdmin()` (`lib/platform-admin.ts:14`). Zúčastnený „agent podpory“ je v skutočnosti ktokoľvek z tej istej kliniky. `getSessionByCode` je viazaný na `ctx.practiceId`, takže expozícia mimo tenanta nehrozí; ide o nedostatok oddelenia rolí. Navyše `app/api/support/signaling/route.ts:21-28` vracia **501** — WebRTC signalling neexistuje, takže zdieľanie obrazovky v UI (`ScreenShareButton`, `getDisplayMedia`) sa spojí na nič. Ide o **mŕtvy koniec prezentovaný ako funkcia**.
- F-20-3 [P2][DATA] **Audit úplnosť**: `appendAiAuditEvent` pokrýva 4 entity types, ale `draft-safety.ts:129-135` deklaruje 5 (`prescription` a `treatment_plan` sa v praxi nikde nezapisujú). AI-derived recept (`create_prescription`) a AI-derived plán teda nemajú žiadny záznam v ledgeri.
- F-20-4 [P2][PERF/DATA] RLS je v `enable-rls.sql`, ale **nerobí sa `FORCE ROW LEVEL SECURITY`** (`enable-rls.sql:6-9` explicitne: owner RLS obchádza). To je správne pre migrácie, ale zároveň to znamená, že „100 % izolácia“ z `ROADMAP.md` platí **iba** ak je `DATABASE_URL` nasmerovaný na `openpims_app`. V kóde som nenašiel runtime kontrolu, ktorá by to overila pri štarte... *pozor*: `assertHostedRlsRoleOnce()` sa volá v `createTRPCContext` (`trpc.ts:99`) — **existuje**, v `lib/rls-assertion.ts`. Pozitívum; ponechávam ako overené.
**Čo funguje dobre:** RLS pokrytie `ext_*` je **dynamické** — `DO` blok enumeruje `pg_class` podľa `relname LIKE 'ext_%' OR relname LIKE 'ekasa_%' OR relname IN (...)`, takže nová `ext_*` tabuľka s `practice_id` je chránená automaticky; všetkých 17 tabuliek, ktoré vyzerajú ako „chýbajúce“ pri statickom grepe, je pokrytých. Audit chain má explicitne dokumentované limity a neprezentuje sa ako WORM.
**Pokrytie testami:** unit ✅ (`security/rls-visibility-probes.test.ts`, `adversarial-tenant-isolation.test.ts`, `tenant-scoping.test.ts`, `lib/ai/__tests__/audit-chain.test.ts` 32 testov, `audit-ledger.test.ts` 18), e2e ✅ (`restore-drill.spec.ts`).
**Otvorené otázky / UNVERIFIED:** či `verify-ai-audit-trail.ts` beží aj v CI (v `.github/workflows/ci.yml` som ho nenašiel).

### J-21 · Platform admin (OpenVPM operátor)
**Vstup:** `/admin` · `/admin/pilot` · `/admin/support`
**Kroky (as-is):**
1. Prístup: `platformAdminProcedure` = `isPlatformAdmin(ctx.session.user.email)` proti `PLATFORM_ADMIN_EMAILS` (`lib/platform-admin.ts:7-19`) — **nie je možné sa do role eskalovať z aplikácie**, iba env var.
2. Prehľad: `admin.overview` (`admin.ts:1215`) beží v `withSystem` (obchádza RLS, komentár to priznáva) a agreguje practices/users/clients/patients/locations + primary admin kontakt.
3. Ostatné: `admin.extendTrial`, `admin.saveClinicPilot`, `admin.submitMessaging*`, `admin.assignMessagingNumbers`, `admin.inspectMessagingProf*` — povolené aj keď je platformový trial prepadnutý (`HOSTED_READ_ONLY_MUTATION_ALLOWLIST`, `trpc.ts`).
4. Bez AI.
**Trenie & zistenia:**
- F-21-1 [P2][OBS] `admin.overview` zobrazuje počty zvierat, používateľov a MRR, ale **nie AI spotrebu per klinika**. `usageRecords` má `ai_run` a existuje `usageForPractice` (`lib/billing/usage.ts`), `subscription.get` ich vracia pre vlastnú prax (`subscription.ts:81-128`), ale operátorský prehľad ich nezahŕňa. Pri overovaní „abuse threshold“ 5000 AI behov/mesiac (`usage.ts:25-31`) nemá operátor odkiaľ to vidieť okrem DB.
- F-21-2 [P3][SAFETY] `withSystem` na `admin.overview` obchádza RLS — je to nevyhnutné pre cross-tenant, ale je to jediné miesto v projekte, kde sa zámok vypína, a nie je pokryté explicitným `assertPlatformAdmin` na úrovni DB funkcie (iba middleware). Správne vyriešené, len stojí za zmienku.
**Čo funguje dobre:** e-mailový allowlist je najjednoduchšia a najbezpečnejšia možná implementácia „interného“ prístupu; `HOSTED_READ_ONLY_MUTATION_ALLOWLIST` má komentár vysvetľujúci prečo.
**Pokrytie testami:** unit ✅ (`admin-overview.test.ts`, `admin-*.test.ts` 8 súborov), e2e ❌.
**Otvorené otázky / UNVERIFIED:** žiadne.

---

## 5. Prierezové zistenia (cross-cutting)

### 5.1 Dvojité zadávanie

| # | Kde sa to isté zadáva dvakrát | Dôkaz | Priorita |
|---|---|---|---|
| F-X1-1 | Recept (`records`) vs. zápis do knihy OPL (`controlledSubstances`) — rovnaký liek, dávka, pacient a šarža sa prepisujú ručne na dvoch obrazovkách bez krížového odkazu | `records.ts:1512+`, `controlled-substances.ts:449`, `/controlled-substances/page.tsx` | P2 [UX] |
| F-X1-2 | Váha: zapisuje sa do `vital_signs` (`vitals.recordVitalSigns`) a súčasne sa uvádza v texte SOAP `objective`; dávkovacia kalkulačka `dosing.*` má vlastný vstup hmotnosti | `vitals.ts:42`, `records/new-soap/.../page.tsx`, `routers/dosing.ts` | P2 [UX][SAFETY] |
| F-X1-3 | Kontakt klienta sa zadáva pri registrácii (`clients`), pri online rezervácii (`booking.contact`) a pri portálovej žiadosti (`portal.requestAppointment`) — bez spoločnej normalizácie a bez zlúčenia | `booking.ts:290-296`, `portal.ts:1227` | P3 [DATA] |
| F-X1-4 | Sumy účtu: `voice.createBillFromExtractedItems` používa hardcoded katalógové ceny, ktoré sa musia prepísať podľa reálneho cenníka (`services`/`products`) | `treatment-extractor.ts:61-115` | P2 [AI] |

### 5.2 Mŕtve konce a „deklarované, ale nefunkčné“ plochy

| # | Plocha | Čo sa deje | Dôkaz | Priorita |
|---|---|---|---|---|
| F-X2-1 | `marketingCopy`, `labParser` v AI nastaveniach | Prepínače providera/modelu, ktoré kód nikdy nečíta | grep vracia iba `ai-settings-tab.tsx` + presety | P1 [AI][DOCS] |
| F-X2-2 | `/support` zdieľanie obrazovky | UI plne funkčné, server vracia `501 Not Implemented` | `app/api/support/signaling/route.ts:21-28` | P2 [UX] |
| F-X2-3 | `/vet-intel` | Route existuje, ale je to iba `router.replace("/marketing?tab=competitors")` (22 riadkov) | `app/(dashboard)/vet-intel/page.tsx:11-13` | P3 [DOCS] |
| F-X2-4 | `ai.patientsNeedingFollowUp`, `ai.dailySummary` | Nemajú žiadneho spotrebiteľa v UI; existujú len pre `/api-docs/ai` | grep naprieč `apps/web` | P2 [DOCS] |
| F-X2-5 | Wholesaler import | Parser aj router existujú, UI chýba (priznané v `ROADMAP.md`) | `ROADMAP.md` bod 9, `lib/inventory/wholesaler-import.ts` | P1 [UX] |
| F-X2-6 | „AI“ pomenovanie deterministických funkcií: Clinical Guardian, `/api-docs/ai` procedúry, lab import | Používateľ očakáva model tam, kde je regex/SQL — pri lab importe to vedie k P0 F-07-1 | `clinical-guardian.ts`, `ai.ts:546-801`, `lab-import.ts:121,129` | P0/P2 [AI][DOCS] |

### 5.3 Konzistencia UI a i18n

- **Skener:** `apps/web/scripts/scan-hardcoded-i18n.js` (spustiteľný aj mimo `pnpm`: `node scripts/scan-hardcoded-i18n.js`).
  Výsledok v tomto prostredí: **1 016 potenciálne nepreložených reťazcov v 153 súboroch** z 292 skenovaných TSX/JSX súborov.
- **Symetria slovníkov:** manuálna kontrola (bez `pnpm`) — `en.json` 7 031 kľúčov, `sk.json` 7 031 kľúčov, **0 rozdielov v oboch smeroch** ✅. (`RISK_REGISTER.md` R-P2-002 tvrdí, že kontrola nie je v CI — symetria dnes platí, ale nie je vynútená.)
- **Top 20 súborov podľa počtu nálezov:** `marketing/website-editor-sheet.tsx` 76 · `automations/client-automations-view.tsx` 36 · `admin/sms-recovery-console.tsx` 30 · `ekasa/thermal-receipt-drawer.tsx` 21 · `automations/clinical-automations-view.tsx` 13 · `encounters/treatment-plan-composer.tsx` 11 · `communications/inbox-view.tsx` 9 · `imaging/dicom-viewer.tsx` 9 · `onboarding/steps/bring-data.tsx` 9 · `marketing/website-sections/contact-form.tsx` 9 · `records/ambulatory-visit-records-card.tsx` 6 · `components/SoapNoteEditor.tsx` 6 · `marketing/website-media-picker-dialog.tsx` 5 · `accounting/accounting-export-dialog.tsx` 5 · `marketing/ai-flyer-generator.tsx` 5 · `marketing/ai-canvas.tsx` 4 · `marketing/flyer-preview-modal.tsx` 4 · `onboarding/steps/try-agent.tsx` 3 · `brand/accent-color-picker.tsx` 3 · `culture/…` (ďalších 133 súborov).
- **Klasifikácia:** časť nálezov je **zámerná** — texty tlačených A5 letákov a náhľadov (`„Ošetrujúci veterinárny lekár:“`, `„SCAN ME“`, `„MVDr. .....“`) nesmú byť prekladané. Skener teda **nesmie byť použitý ako CI gate bez whitelistu**; pri jeho zavedení treba doplniť `// i18n-ignore` mechansmus alebo konfiguráciu ciest.
- **Konzistencia serverových chýb:** `AGENTS.md:44` hovorí, že routery hádžu chyby v angličtine a klient ich prekladá cez `useI18n()`. V praxi sa text servera často zobrazuje **priamo** (`toast.error(err.message)` v `agent/voice/page.tsx:275`, `new-soap/.../page.tsx:426`), takže slovenský používateľ vidí `"Requires one of: admin, veterinarian"` alebo `"Analýza zlyhala: <raw upstream text>"` (`imaging.ts:307`). Dôkaz je jednoznačný: jediná „prekladová“ vrstva je na klientovi a chýba.
- **Dátumy:** všetky obrazovky, ktoré som čítal, používajú `formatDateInputForTimeZone`/`date-input` namiesto `toLocaleDateString`; jediná výnimka je `buildAgentSystemPrompt`, ktorý **zámerne** používa `toLocaleDateString("sk-SK", { timeZone: tz })` pre ľudský popis dátumu v prompte (`runner.ts:80-95`) — správne, nie je to UI. ✅

### 5.4 Rola vs. obrazovka

| # | Nesúlad | Dôkaz | Dopad |
|---|---|---|---|
| F-X4-1 | `/agent/voice` je v navigácii pre `technician`, `front_desk`, `viewer`, ale API vyžaduje `admin`/`veterinarian` | `config/custom-nav.ts:111-118` vs `voice.ts:45-47` | Technik zapne nahrávanie, audio sa uloží do S3, potom `FORBIDDEN` |
| F-X4-2 | Plávajúce `ScribeWidget` tlačidlo je v dashboard layoute pre všetkých a pushuje na `/agent/voice` | `app/(dashboard)/layout.tsx` (render) + `scribe-widget.tsx:38-40` | Rovnaké ako F-X4-1, ale ešte o krok skôr |
| F-X4-3 | `aiSettings.getSettings` bez `requireRole` (zvyšok routera admin-only) | `ai-settings.ts:22` vs `:132,254,361` | Únik posledných 4 znakov kľúčov + base URL + histórie testov |
| F-X4-4 | `extensions.support.*` bez `requireRole`, `checkSupportRole` meria rolu v klinike, nie `isPlatformAdmin` | `support.ts:21,139` vs `platform-admin.ts:14` | „Support agent“ = ktokoľvek z kliniky |
| F-X4-5 | `ai.patientsOverdueVaccinations` / `patientsNeedingFollowUp` / `dailySummary` bez `requireRole` → dostupné aj `viewer` | `ai.ts:546,615,719` | Minimálne práva; `viewer` je read-only účet, nemá vidieť recall zoznamy s menami majiteľov |
| F-X4-6 | `migrationArchive.*` bez `requireRole` | `migration-archive.ts:24` | `viewer` vidí celý migračný archív |
| F-X4-7 | `controlledSubstances.list` bez `requireRole`, hoci matrica ho zakazuje technikovi aj recepcii | `controlled-substances.ts:344` vs `docs/authorization-matrix.md:35` | Nesúlad dokumentácie a kódu |
| F-X4-8 | `voice` a `records` (SOAP draft) zakazujú `technician`, hoci matrica mu dáva „Dictate Draft“ a „Create/Edit SOAP Draft“ | `voice.ts:45-47`, `records.ts:1738` vs `docs/authorization-matrix.md:33,34` | Dokument je pre inšpekciu nesprávny |

### 5.5 Multi-tenancy a RLS

- **Pokrytie `ext_*` je dynamické a správne.** `enable-rls.sql:62-113` vytvára `tenant_isolation` politiku pre **každú** tabuľku v schéme `public`, ktorá má stĺpec `practice_id` a názov `ext_%` / `ekasa_%` alebo patrí do explicitného zoznamu (`ai_imaging_analyses`, `dental_charts`, `discharge_reports`, `kvl_cr_passports`, `lab_analyzer_reports`, `microchip_registrations`, `pet_passports`, `voice_dictations`). Statický „missing“ zoznam 17 tabuliek (`ext_marketing_*`, `ext_sms_delivery_log`) je **falošný poplach** — tie tabuľky sú pokryté; všetkých 17 `pgTable("…")` v `ext_*.ts` má `practiceId` (grep `-L practiceId` vracia prázdno).
- Politika je `USING (app_rls_bypass() OR practice_id::text = app_current_practice_id()::text)` + identický `WITH CHECK` — teda aj zápis mimo tenanta je blokovaný, nielen čítanie.
- **Child tabuľky** bez `practice_id` (`patient_allergies`, `patient_weights`, `case_entries`, `treatment_plan_items`, `treatment_template_items`, `invoice_items`, `invoice_adjustments`, `payments`) majú join-politiku na rodiča (`:470-500`).
- **Append-only evidence:** `ext_ai_audit_log` má `REVOKE ALL` + `GRANT SELECT, INSERT` + immutability trigger (`:125-138`); `consent_receipt_capabilities` `SELECT/INSERT/UPDATE` bez DELETE; `financial_closes` `SELECT, INSERT`; `recent_clinical_items` `SELECT, INSERT, UPDATE` bez DELETE (`:181-195`).
- **Runtime overenie:** `assertHostedRlsRoleOnce()` sa volá v `createTRPCContext` (`trpc.ts:99`, implementácia `lib/rls-assertion.ts`) a pri hostovanom nasadení v produkcii overí, že rola nie je superuser, nemá `BYPASSRLS` a nevlastní tabuľky. Toto je nadštandardné.
- **Zistenie F-X5-1 [P2][DOCS]:** `enable-rls.sql:6-9` (a `docs/architecture`) uvádzajú, že tabuľky **nevlastní** `openpims_app` a že owner RLS obchádza; na self-hoste tak RLS **neplatí**. Nič v UI to nepovie. Bezpečnostné tvrdenie „100 % izolácia“ z `ROADMAP.md` platí iba pre hostovaný režim s `openpims_app`.

### 5.6 Úplnosť audit trailu

| # | Klinicky relevantný zápis | Má `appendAiAuditEvent`? | Má `audit_log`? | Dôkaz |
|---|---|---|---|---|
| F-X6-1 | `ai.draftSoapNote` → finalizovaný SOAP | ❌ | ✅ (generic mutation middleware) | `ai.ts:356`, `trpc.ts` |
| F-X6-2 | `imaging.injectFindingsIntoSoap` → SOAP | ❌ | ✅ | `imaging.ts:574` |
| F-X6-3 | Agent `create_prescription` → `prescriptions` | ❌ | ✅ | `tools.ts:2894` |
| F-X6-4 | Agent read-only behy (PHI v prompte) | ❌ | ❌ (query neprechádza mutation auditom) | `trpc.ts` (audit len `type === "mutation"`) |
| F-X6-5 | `voice.saveAsSoapNote` | ✅ | ✅ | `voice.ts:808` |
| F-X6-6 | `discharge.save` / `generateSmsAndSchedule` | ✅ | ✅ | `discharge.ts:517,869` |
| F-X6-7 | `imaging.confirmAnalysis` | ✅ | ✅ | `imaging.ts:836` |
| F-X6-8 | Marketing AI obsah/médiá | ✅ | ✅ | `marketing.ts:583,1567,4696` |
| F-X6-9 | `ai.createSoapFromAI` | ✅ | ✅ | `ai.ts:326` |
| F-X6-10 | `treatment_plan`, `prescription` entity types | Deklarované, ale nepoužité | — | `draft-safety.ts:129-135` |

**Záver:** ledger je úplný pre 4 z 9 AI povrchov. Chýbajú práve tie, ktoré prechádzajú „obyčajnou“ SOAP finalizáciou — čo je aj najčastejší scenár.

### 5.7 Offline a pomalá sieť

- Editor SOAP rieši offline explicitne: `saveState === "offline"` („Offline — autosave is paused“), `isOnline` guard na AI tlačidle (`!isOnline || !aiConfigured || !canUseAi`, `new-soap/.../page.tsx:1026`), manuálny „Retry save“ (`:1055-1070`), `beforeunload` guard (`page.tsx:395-406`). ✅
- AI volania majú **rôzne** timeouty a niektoré žiadny:
  - SOAP draft: 30 s `AbortController` (`soap-draft.ts:143-145`)
  - Agent: 60 s + 30 s fallback (`runner.ts:490,555`)
  - Transkripcia: 60 s (`transcription.ts:52-54`)
  - **Imaging analýza: žiadny timeout** (`imaging.ts:244-262`, komentár očakáva 10–60 s)
  - Marketing `generateText` volania (copy, FAQ, alt-texty): bez timeoutu (`marketing.ts:387,1535,4596,4664`)
  - `discharge.generate`: bez timeoutu (`discharge.ts:155-160`)
- 20-sekundová odpoveď AI počas vyšetrenia: používateľ vidí `Loader2` + „Drafting...“ (`new-soap/.../page.tsx:1029-1038`) **bez** progresu, bez možnosti zrušiť a **bez** timeout indikátora; pri `flash` režime to je 5–20 s, pri `pro` aj minúty. Na tablete v ordinácii je to najhoršie možné miesto na čakanie bez spätnej väzby. → **F-X7-1 [P1][UX]**.

### 5.8 Mobil / tablet

- `min-h-11` (44 px dotykový cieľ) sa v projekte používa **25×** — v `patient-history-search.tsx`, `whiteboard-page` prvkoch a onboarding krokoch. To je dobrý, ale nedostatočný signál: v najdôležitejších obrazovkách pre tablet (`encounters/[appointmentId]/page.tsx` 5 409 riadkov, `records/new-soap/[patientId]/page.tsx` 1 331 riadkov) sa `min-h-11`, `hidden sm:block` ani `overflow-x-auto` **nenachádzajú ani raz**.
- `overflow-x-auto` (tabulkové wrappery) je v 44 súboroch, ale práve v encounter/SOAP editoroch chýba.
- Editor SOAP je postavený na `contentEditable`/rich-texte (`setSubjective(draftTextToHtml(...))`, `page.tsx:420-423`) — na tablete je to najrizikovejšie UI v celom systéme.
- **F-X8-1 [P1][UX][A11Y]** Jadro ambulantnej práce (encounter, nový SOAP, hlas) nemá ani jeden responzívny marker; predpokladám desktop-only rozloženie. **UNVERIFIED** v behu (nedá sa overiť bez servera) — ale absencia akýchkoľvek `sm:`/`md:`/`lg:` variantov v týchto súboroch je silný statický dôkaz.

---

## 6. Konsolidovaný register nálezov

Register je **autoritatívne miesto pre priority a kategórie** — prierezové nálezy z §5 majú prioritu priradenú tu (v tabuľkách §5 je len dopad). Usporiadané podľa priority; v rámci priority podľa poradia ciest J-01…J-21.
Stĺpec **GT** = číslo navrhnutého Golden Ticketu v `tasks/proposed/` (existuje pre každé P0 a P1).
Stĺpec **Úsilie**: S = hodiny, M = 1–3 dni, L = viac ako 3 dni.

### 6.1 P0 — bezpečnosť, strata dát, zákonná zodpovednosť

| ID | P | Kat. | Nález | Dôkaz | Úsilie | Vlastník | GT |
|---|---|---|---|---|---|---|---|
| **F-04-1** | P0 | SAFETY, DATA | SOAP vytvorený AI (`draftSoapNote`) alebo AI nálezmi zobrazovacieho vyšetrenia (`injectFindingsIntoSoap`) sa **finalizuje bez zápisu do `ext_ai_audit_log`** — dôkazný reťazec nevie preukázať, ktoré vety v karte pochádzajú od modelu | `ai.ts:356`, `imaging.ts:574`, `records.ts` (finalize), `trpc.ts` (audit len mutácie) | M | API + DB | GT-001 |
| **F-04-2** | P0 | SAFETY, AI | Neverejný text od klienta (meno pacienta z verejnej rezervácie, ≤128 znakov) sa dostáva do kontextu AI promptu bez ohraničenia `<db_record>` — jediný povrch, kde môže cudzí človek zapísať text do promptu | `booking.ts:297-299`, `ai.ts:362`, `runner.ts:367-378` | M | AI + API | GT-002 |
| **F-18-1** *(v §4/J-06 uvedené aj ako F-06-1 — kanonické je F-18-1)* | P0 | SAFETY | Agent tool `create_prescription` vystaví **aktívny** recept bez klinických brán: recept sa zapíše so `status = active`, obálka (`clinician-confirmation`) sa vydáva až **po** INSERT a nikdy sa nespotrebuje (chýba ekvivalent `consumeEnvelope` pred zápisom) | `lib/agent/tools.ts:2894`, `lib/ai/clinician-confirmation.ts`, `lib/records/prescription-safety.ts`, `lib/controlled-substances/policy.ts` | M | AI + API + DB | GT-003 |
| **F-07-1** | P0 | AI, SAFETY | Deterministický heuristický parser laboratórneho reportu sa v UI prezentuje ako AI s číselnými „istotami“ a ako „AI OCR“ zariadenie — lekár nemá ako rozpoznať, že hodnoty čítal regex | `lib/lab-import.ts:81-89` (0.65/0.72/0.84/0.94), `:121`, `:129` | S | UI + API | GT-004 |

### 6.2 P1 — blokuje workflow alebo dôveru v AI

| ID | P | Kat. | Nález | Dôkaz | Úsilie | Vlastník | GT |
|---|---|---|---|---|---|---|---|
| **F-04-3** | P1 | AI, UX | `visitContext` (kontext aktuálnej návštevy) existuje v API (`ai.ts:362`) a volá ho jediná obrazovka, pričom ju neposiela — AI draft tak štandardne **nevidí** dnešné merania a poznámky | `records/page.tsx:627` (`visitContextKey`), `ai.ts:362-370` | S | UI | GT-005 |
| **F-04-4** | P1 | UX, SAFETY | Jedno kliknutie „Draft“ prepíše **všetky štyri** sekcie SOAP naraz, bez označenia AI textu a bez možnosti prijať len jednu sekciu | `new-soap/[patientId]/page.tsx:1029-1045` | M | UI | GT-006 |
| **F-06-2** | P1 | SAFETY, DOCS | `docs/authorization-matrix.md` zakazuje technikovi a recepcii čítanie knihy OPL, kód procedúru **negate-uje vôbec** (`protectedProcedure`) | `controlled-substances.ts:344` vs `authorization-matrix.md:35` | S | API + DOCS | GT-007 |
| **F-07-2** | P1 | PERF, AI | AI analýza zobrazovacieho vyšetrenia nemá **žiadny timeout** — pri nedostupnom providery visí obrazovka; ostatné AI cesty timeout majú | `imaging.ts:244-262` (vs `soap-draft.ts:143-145`) | S | API | GT-008 |
| **F-12-1** | P1 | UX, DOCS | Parser aj router pre wholesaler import existujú, ale **UI nie je** — recepcia nemôže doplniť sklad inak než SQL (priznané v ROADMAP) | `ROADMAP.md` bod 9, `lib/inventory/wholesaler-import.ts`, `server/routers/extensions/wholesaler-import.ts` | L | UI | GT-009 |
| **F-17-1** *(aj F-X4-3)* | P1 | SAFETY, DATA | `aiSettings.getSettings` je bez `requireRole`, hoci celý zvyšok routera je admin-only → `viewer`/`technician` dostanú `maskedKey` (posledné 4 znaky kľúčov všetkých poskytovateľov), base URL a históriu testov; `checkAliProxyHealth` bez gate | `ai-settings.ts:22,29-71,488` vs `:132,254,361` | S | API | GT-010 |
| **F-17-2** | P1 | DATA, SAFETY | Fallback odvodenia šifrovacieho kľúča z `NEXTAUTH_SECRET`/verejnej dev hodnoty (`ai-crypto.ts:19-30`) robí uložené provider kľúče dešifrovateľné; kľúč **nie je verzovaný**, rotácia ticho znefunkční všetky uložené kľúče a UI to nezobrazí | `ai-crypto.ts:19-44`, `ai-config-resolver.ts:108-116` | M | API + DB | GT-011 |
| **F-17-3** *(aj F-14-1, F-X2-1)* | P1 | AI, DOCS | `marketingCopy` a `labParser` z feature mappingu **kód nikdy nečíta**; SOAP flash draft, discharge, transkripcia, extrakcia liečby a marketing používajú `configuredModel()` — nastavenie v UI je čiastočne fiktívne a klinika nemá kontrolu nad tým, komu tečú jej texty | `ai-presets.ts:24-33`, `ai-settings-tab.tsx:763-908` vs `soap-draft.ts:153`, `discharge.ts:139`, `transcription.ts:127`, `treatment-extractor.ts:241`, `composer.ts:106` | M | AI + UI | GT-012 |
| **F-17-4** | P1 | SAFETY, DOCS | **Data residency a DPA nie sú v UI nikde**; `MODEL_CARDS.md` deklaruje „EU / US“ a odosielanie PHI „po súhlase kliniky“, ale súhlas nie je nikde evidovaný; tiché prepnutie poskytovateľa (auto-fallback) nie je viditeľné | `ai-settings-tab.tsx:926-957`, `MODEL_CARDS.md:15-22`, `ai-config-resolver.ts:141-215` | M | UI + DOCS | GT-013 |
| **F-18-2** *(aj F-X4-1, F-X4-2)* | P1 | UX, SAFETY | `/agent/voice` je v navigácii (a v plávajúcom Scribe tlačidle) pre všetky roly, ale API vyžaduje admin/vet; technik nahrá audio do S3 a **až potom** dostane `FORBIDDEN` v angličtine | `config/custom-nav.ts:111-118`, `scribe-widget.tsx:38-40`, `voice.ts:45-47`, `voice.ts:112-118` | S | UI | GT-014 |
| **F-20-1** | P1 | DOCS, SAFETY | `docs/authorization-matrix.md` je označená ako „Canonical Security Reference“, ale je v rozpore s kódom v 5 bodoch (technician dictation, technician SOAP edit, `portal_user`, `service_cron`, chýbajúca rola `viewer`) | `authorization-matrix.md:33-40` vs `voice.ts:45-47`, `records.ts:1738`, `platform-admin.ts`, `trpc.ts` | S | DOCS | GT-015 |
| **F-X7-1** | P1 | UX, PERF | Pri AI odpovedi (5–20 s `flash`, minúty `pro`) používateľ vidí len spinner **bez progresu, bez zrušenia a bez timeout indikátora** — presne počas vyšetrenia | `new-soap/[patientId]/page.tsx:1029-1038` | M | UI | GT-016 |
| **F-X8-1** | P1 | UX, A11Y | Jadro ambulantnej práce (encounter 5 409 riadkov, nový SOAP, hlas) **nemá ani jeden responzívny marker** (`sm:`/`md:`/`lg:`, `min-h-11`, `overflow-x-auto` sa v týchto súboroch nenachádzajú) — na tablete v ordinácii je to nepoužiteľné | `encounters/[appointmentId]/page.tsx`, `records/new-soap/[patientId]/page.tsx`, `agent/voice/page.tsx`, `whiteboard/page.tsx` | L | UI | GT-017 |

### 6.3 P2 — trenie a nekonzistencia

| ID | P | Kat. | Nález | Dôkaz | Úsilie | Vlastník |
|---|---|---|---|---|---|---|
| F-01-1 | P2 | DATA, UX | Duplicitný klient sa hľadá len cez `LIKE %posledných 9 číslic%`; na úrovni pacienta **žiadna** kontrola pri vytváraní | `duplicate-shield.ts:44-51`, `patients.ts:100` | M | API + DB |
| F-01-2 | P2 | UX | `duplicate-shield` nájde kandidáta, ale nevráti skóre ani dôvod zhody — recepcia rozhoduje naslepo; chýba „zlúčiť/už je to ten istý“ | `duplicate-shield.ts:44-51` | S | UI |
| F-02-1 | P2 | DATA | Dva režimy rate-limitu rezervácií (IP a slug) s rôznymi prahmi bez spoločnej dokumentácie | `booking.ts:489-500` | S | API |
| F-03-1 | P2 | PERF | SSE stream posiela iba `connected`/`ping`; realtime obnova je vlastne 30 s polling, ktorý sa **vypne**, keď je stream „live“ | `api/whiteboard/stream/route.ts:24-46`, `whiteboard/page.tsx:746` | M | API + UI |
| F-03-2 | P2 | SAFETY | `/waiting-room` je v middleware verejných prefixov — obrazovka čakárne bez prihlásenia | `middleware.ts` (public prefixes) | S | API |
| F-04-5 | P2 | AI, PERF | Rate limit AI draftu je len 10/min na aktéra, bez limitu na prax | `ai.ts:356-368` | S | API |
| F-04-6 | P2 | I18N | Chybové texty AI tokov sa zobrazujú v angličtine priamo zo servera | `new-soap/[patientId]/page.tsx:426`, `agent/voice/page.tsx:275` | S | UI |
| F-05-1 | P2 | DOCS, UX | Dvojité pomenovanie toho istého modulu (`treatmentPlans` vs `treatmentEstimates`) v API aj v UI | `_app.ts:82-88` | S | UI + API |
| F-06-3 | P2 | DATA | Recept a kniha OPL nie sú krížovo prepojené — rovnaký výdaj sa zapisuje dvakrát | `records.ts:1512+`, `controlled-substances.ts:449` | M | API + DB |
| F-07-3 | P2 | UX, I18N | Surový text chyby upstream providera sa zobrazí používateľovi | `imaging.ts:307` | S | API |
| F-07-4 | P2 | UX | Panel analýzy neponúka „skopírovať do poznámky“ pre jednotlivý nález, iba vloženie celého bloku | `imaging.ts:574` | S | UI |
| F-08-1 | P2 | AI | `discharge.generate` obchádza feature mapping cez `configuredModel()` — klinika nemôže určiť providera pre prepúšťacie správy | `discharge.ts:139` | S | AI |
| F-08-2 | P2 | UX | Determinizovaný fallback prepúšťacej správy sa tvári ako AI výstup (chýba viditeľné označenie zdroja) | `discharge.ts:155-175` | S | UI |
| F-09-1 | P2 | SAFETY, DATA | Výstupy agenta pre zákonné registre (CRSZ/KVEPIS) nejdú do AI ledgera | `agent.ts:90`, `tools.ts` (statutory tooly) | M | AI + API |
| F-10-1 | P2 | AI, DOCS | SQL procedúry sú v `/api-docs/ai` vedené ako AI | `app/api-docs/ai/page.tsx`, `ai.ts:546,615,719` | S | DOCS |
| F-11-1 | P2 | AI, DATA | Extrakcia položiek účtu používa hardcoded slovenský cenník a sadzby DPH namiesto cenníka kliniky | `treatment-extractor.ts:61-115` | M | AI + DB |
| F-11-2 | P2 | DOCS, UX | Dve procedúry s názvom `dailySummary` (e-Kasa uzávierka vs AI agregát) s rôznym významom | `ekasa.ts`, `ai.ts:719` | S | DOCS |
| F-13-1 | P2 | AI | Inbox nemá žiadnu AI podporu (súhrn/odpoveď) — bezpečné, ale je to najväčšia funkčná medzera pre recepciu | `messaging.ts`, `cli-components/communications/inbox-view.tsx` | L | AI |
| F-13-2 | P2 | I18N | 9 + 3 + 30 hardcoded textov v inbox/komunikačných komponentoch | `inbox-view.tsx`, `message-logs-view.tsx`, `sms-recovery-console.tsx` | S | UI |
| F-14-2 | P2 | TEST | Žiadny test nezachytáva nepoužité feature mappings (trieda chýb F-17-3) | `lib/ai/__tests__/marketing-audit.test.ts` | S | TEST |
| F-14-3 | P2 | SAFETY, AI | Texty recenzií (cudzí vstup) idú do promptu bez ohraničenia `<db_record>` | `marketing.ts:1485-1520` | S | AI |
| F-14-4 | P2 | I18N | Marketing je najväčší zdroj nepreložených textov (76 + 36 + 13 + …) | `website-editor-sheet.tsx`, `client-automations-view.tsx`, `clinical-automations-view.tsx` | M | UI |
| F-15-1 | P2 | DOCS | `ai.dailySummary` bez spotrebiteľa v UI | `ai.ts:719` | S | DOCS |
| F-15-2 | P2 | TEST | Nekonzistentné `assertActivePractice` medzi troma AI agregátmi | `ai.ts:546` vs `:615,719` | S | API |
| F-16-1 | P2 | UX | Krok „vyskúšaj AI“ je pred nastavením poskytovateľa → admin takmer vždy vidí „AI helper is not available right now“ | `onboarding/steps/try-agent.tsx:164-181` | S | UI |
| F-16-2 | P2 | I18N | 25 hardcoded textov v onboarding krokoch | `components/onboarding/steps/*` | S | UI |
| F-17-5 | P2 | DOCS | `MODEL_CARDS.md` uvádza modely, ktoré v kóde nie sú (`gemini-3.8-flash-medium` vs deklarované), dokument je „Clinical AI Evidence Pack“ | `lib/ai-models.ts:13`, `ai-presets.ts:17-21`, `MODEL_CARDS.md` | S | DOCS |
| F-17-6 | P2 | SAFETY, UX | Tiché prepnutie poskytovateľa (auto-fallback) nie je v UI viditeľné | `ai-config-resolver.ts:141-215` | M | AI + UI |
| F-18-3 | P2 | AI, DATA | Agent read-only behy nezanechajú v ledgeri nič, hoci posielajú najviac PHI | `runner.ts:441`, `trpc.ts` | M | AI + API |
| F-18-4 | P2 | UX | Lekár nevidí, ktorý model odpovedal (`deepThinking` vs flash) | `agent.ts:128-132` | S | UI |
| F-19-2 | P2 | UX, DOCS | Migrácia má >10 súborov parserov, ale jeden UI vstup a chýbajúci SK runbook | `settings/import-v2`, `docs/help/*` | M | UI + DOCS |
| F-20-2 | P2 | SAFETY, UX | Support: žiadne `requireRole`, `checkSupportRole` meria rolu v klinike; signaling vracia **501**, zdieľanie obrazovky je mŕtvy koniec | `support.ts:21,139`, `api/support/signaling/route.ts:21-28` | M | API + UI |
| F-20-3 | P2 | DATA | `draft-safety` deklaruje 5 entity types, ledger zapisuje 4 (`prescription`, `treatment_plan` nikdy) | `draft-safety.ts:129-135` | S | API + DB |
| F-20-4 | P2 | DOCS | RLS neplatí na self-hoste (owner obchádza politiky) a UI to nepovie; runtime assertion existuje len pri hostovanom režime | `enable-rls.sql:6-9`, `lib/rls-assertion.ts:14-20`, `trpc.ts:99` | S | DOCS |
| F-21-1 | P2 | OBS | Platform admin nevidí AI spotrebu na kliniku | `admin.ts:1215`, `lib/billing/usage.ts:25-31` | S | API + UI |
| F-X1-1 | P2 | UX | Recept vs kniha OPL — dvojité zadanie (ten istý problém ako F-06-3, iný pohľad) | viď F-06-3 | — | — |
| F-X1-2 | P2 | UX, SAFETY | Váha sa zadáva v `vital_signs`, v texte SOAP a v dávkovacej kalkulačke | `vitals.ts:42`, `routers/dosing.ts` | M | UI + API |
| F-X1-4 | P2 | AI | AI návrh účtu používa cudzie ceny | viď F-11-1 | — | — |
| F-X2-2 | P2 | UX | `/support` zdieľanie obrazovky je plne vykreslené, ale server vracia 501 | `api/support/signaling/route.ts:21-28` | S | UI |
| F-X2-4 | P2 | DOCS | `ai.dailySummary` a `ai.patientsNeedingFollowUp` nemajú spotrebiteľa | `ai.ts:615,719` | S | DOCS |
| F-X2-6 | P2 | AI, DOCS | Deterministické funkcie nesú „AI“ pomenovanie (Clinical Guardian, `/api-docs/ai`, lab import) — pri lab importe eskaluje na P0 F-07-1 | `clinical-guardian.ts`, `ai.ts:546+`, `lab-import.ts:121,129` | M | DOCS + UI |
| F-X3-2 | P2 | SAFETY | Recenzné texty v prompte (detail k F-14-3) | `marketing.ts:1485-1520` | S | AI |
| F-X4-4 | P2 | SAFETY | Support bez role gate (detail k F-20-2) | `support.ts:21` | S | API |
| F-X4-5 | P2 | SAFETY | AI agregáty bez `requireRole` → aj `viewer` vidí mená majiteľov | `ai.ts:546,615,719` | S | API |
| F-X4-6 | P2 | SAFETY | `migrationArchive.*` bez `requireRole` | `migration-archive.ts:24` | S | API |
| F-X4-7 | P2 | SAFETY, DOCS | Ten istý nález ako F-06-2 | viď F-06-2 | — | — |
| F-X4-8 | P2 | DOCS | Ten istý nález ako F-20-1 | viď F-20-1 | — | — |
| F-X5-1 | P2 | DOCS | Rozsah platnosti RLS nie je komunikovaný (detail k F-20-4) | `enable-rls.sql:6-9` | S | DOCS |
| F-X6-1…X6-10 | P2 | DATA | Tabuľka úplnosti auditu (chýbajúce záznamy pre SOAP/agent cesty, deklarované ale nepoužité entity types) | §5.6 | M | API + DB |
| F-23-1 | P2 | I18N | 1 016 hardcoded textov v 153 súboroch; skener nie je v CI a bez whitelistu by produkoval falošné nálezy (tlačené šablóny) | `scripts/scan-hardcoded-i18n.js`, `en.json`/`sk.json` symetria ✅ | M | UI |
| F-23-2 | P2 | TEST | Symetria slovníkov nie je vynútená v CI (dnes 7 031 = 7 031) | `RISK_REGISTER.md` R-P2-002 | S | TEST |

### 6.4 P3 — kozmetické a dokumentačné

| ID | P | Kat. | Nález | Dôkaz | Úsilie | Vlastník |
|---|---|---|---|---|---|---|
| F-01-3 | P3 | UX | Duplicitný klient sa nedá „označiť ako iný“ priamo v dialógu | `duplicate-shield.ts` | S | UI |
| F-02-2 | P3 | DOCS | ROADMAP/waitlist drift voči kódu | `ROADMAP.md` | S | DOCS |
| F-05-2 | P3 | I18N | Terminológia plánu liečby sa líši medzi obrazovkami | `treatment-plans.ts:24` | S | UI |
| F-08-3 | P3 | DOCS | Chýba popis „čo sa stane pri prepustení“ | `docs/help/*` | S | DOCS |
| F-09-2 | P3 | UX | Zákonné registre nemajú jednotný stav „odooslané“ | `crsz.ts:26`, `kvepis.ts:21`, `statutory.ts:21` | S | UI |
| F-10-2 | P3 | UX | Follow-up kandidáti nemajú UI | `ai.ts:615` | M | UI |
| F-12-2 | P3 | UX | Sklad nie je prepojený na OPL spotrebu | `inventory.ts:147` | M | API |
| F-16-3 | P3 | TEST | Onboarding krok `try-agent` nemá test | `components/onboarding/steps/try-agent.tsx` | S | TEST |
| F-18-5 | P3 | AI | `calculate_drug_dose` mandatórne pravidlo vs `z.preprocess` schéma (**UNVERIFIED** v behu) | `runner.ts:47-49`, `tools.ts:887-918` | S | AI |
| F-19-1 | P3 | SAFETY | `migrationArchive` čítanie bez role gate (detail k F-X4-6) | `migration-archive.ts:24` | S | API |
| F-21-2 | P3 | SAFETY | `withSystem` obchádza RLS (zámerné, komentované) | `admin.ts:1215` | S | API |
| F-X1-3 | P3 | DATA | Kontakt klienta na 3 miestach bez normalizácie | `booking.ts:290-296`, `portal.ts:1227` | M | API |
| F-X2-3 | P3 | DOCS | `/vet-intel` je len redirect | `app/(dashboard)/vet-intel/page.tsx:11-13` | S | DOCS |

### 6.5 Zhrnutie registra

| Priorita | Riadkov v registri | Poznámka |
|---|---|---|
| P0 | 4 | — |
| P1 | 13 | z toho 0 čistých aliasov |
| P2 | 51 | z toho 4 čisto aliasové riadky (F-X1-1, F-X1-4, F-X4-7, F-X4-8) a 1 riadok zastupujúci 10 záznamov z §5.6 |
| P3 | 13 | z toho 1 alias (F-19-1 k F-X4-6) |
| **Spolu** | **81 riadkov registra** | približne 86 jednotlivých zistení vrátane rozpadu §5.6 |

**Prevodník aliasov:** F-06-1 = F-18-1 · F-X4-1, F-X4-2 = F-18-2 · F-X4-3 = F-17-1 · F-14-1, F-X2-1 = F-17-3 · F-X4-7 = F-06-2 · F-X4-8 = F-20-1 · F-X1-1 = F-06-3 · F-X1-4 = F-11-1 · F-X3-2 = F-14-3.

---

## 7. Odporúčaný plán na najbližšie 3 sprinty

### Sprint 1 — „Zastav krvácanie“ (2 týždne)

**Cieľ:** odstrániť všetky P0 a tie P1, ktoré sa dajú vyriešiť do jedného dňa. **Nepúšťať žiadnu novú AI funkciu.**

| # | Ticket | Nález | Prečo teraz |
|---|---|---|---|
| 1 | GT-001 | F-04-1 | Bez zápisu v ledgeri neexistuje dôkaz, kto vložil AI text do karty — pri spore s klientom je to právne najdrahšie |
| 2 | GT-002 | F-04-2 | Jediná cesta, ako sa cudzí text dostane do promptu; oprava je ohraničenie `<db_record>` + validácia vstupu |
| 3 | GT-003 | F-18-1 | Recept s kontrolovanou látkou z agenta bez brány = zákonná zodpovednosť (OPL) |
| 4 | GT-004 | F-07-1 | Falošná „istota“ a „AI OCR“ pri heuristike je klamanie používateľa v klinickom rozhodnutí |
| 5 | GT-010 | F-17-1 | `requireRole` na jednu procedúru (hodiny) |
| 6 | GT-007 | F-06-2 | `requireRole` na jednu procedúru (hodiny) |
| 7 | GT-014 | F-18-2 | Skryť/zablokovať mikrofón pred nahraním audia (hodiny) |
| 8 | GT-008 | F-07-2 | Timeout na jedno volanie (hodiny) |
| 9 | GT-015 | F-20-1 | Zosúladiť `authorization-matrix.md` s kódom (dokumentačné, hodiny) |
| 10 | GT-005 | F-04-3 | Odovzdať `visitContext`, ktorý už existuje — najvyššia hodnota/úsilie v celom audite |
| 11 | GT-011 | F-17-2 | Fail-closed validácia šifrovacieho kľúča pri štarte (bez rotácie) |

**Exit kritériá:** nulové P0 v registri; `pnpm test -- lib/ai lib/agent server` zelené; nové testy pre F-04-1 (finalizácia zapisuje ledger), F-18-1 (write tool bez obálky zlyhá), F-17-1 (viewer dostane `FORBIDDEN`).

### Sprint 2 — „Dôvera v AI“ (2–3 týždne)

**Cieľ:** používateľ musí vedieť, čo je AI, čo s tým model urobil a kam jeho dáta odišli.

| # | Ticket | Nález | Výsledok pre používateľa |
|---|---|---|---|
| 1 | GT-006 | F-04-4 | Prijatie jednej sekcie namiesto prepísania štyroch + viditeľné označenie AI textu |
| 2 | GT-016 | F-X7-1 | Progres, zrušenie a timeout pri 20 s čakaní |
| 3 | GT-012 | F-17-3 | Každá AI funkcia reálne rešpektuje nastaveného providera (alebo zmizne z UI) |
| 4 | GT-013 | F-17-4 | Panel residency/DPA + evidencia súhlasu + viditeľný fallback |
| 5 | GT-011 | F-17-2 | Verzovaný šifrovací kľúč s povinným `AI_SETTINGS_ENCRYPTION_KEY` v produkcii |
| 6 | — | F-20-3, F-X6-1…10 | Doplniť ledger pre SOAP finalizáciu z AI a pre agent behy |
| 7 | — | F-08-1, F-08-2, F-14-3 | Feature mapping pre discharge; označiť deterministický fallback; `<db_record>` pre recenzie |
| 8 | — | F-15-2, F-14-2, F-16-3 | Testy, ktoré zachytia triedy chýb objavené v tomto audite (regresná sieť) |

**Exit kritériá:** `grep` na `configuredModel()` v AI cestách vracia 0 výskytov alebo má komentár s odôvodnením; `scripts/verify-ai-audit-trail.ts` prechádza na dátach z pilotného behu s AI-finalizovaným SOAP; UI test dokazuje označenie AI textu.

### Sprint 3 — „Recepcia a tablet“ (3 týždne)

**Cieľ:** práca mimo kancelárie a mimo myši.

| # | Ticket | Nález | Výsledok |
|---|---|---|---|
| 1 | GT-017 | F-X8-1 | Encounter/SOAP použiteľné na tablete (touch ciele, responzívne rozloženie, bez horizontálneho skrolu) |
| 2 | GT-009 | F-12-1 | UI pre wholesaler import — recepcia doplní sklad bez SQL |
| 3 | — | F-10-2, F-15-1, F-X2-4 | Buď doplniť UI pre `ai.dailySummary`/`patientsNeedingFollowUp`, alebo ich z `/api-docs/ai` odstrániť (rozhodnutie produktu) |
| 4 | — | F-13-1 | Prvý AI prvok v inboxe, ale **len** so `<db_record>` a bez auto-odoslania |
| 5 | — | F-01-1, F-01-2 | Duplicitný pacient: skóre zhody + rozhodnutie v dialógu |
| 6 | — | F-23-1, F-23-2 | i18n: whitelist pre skener + symetria slovníkov v CI |
| 7 | — | F-02-1, F-03-1, F-03-2, F-X1-2 | Booking limity, whiteboard realtime, čakáreň za loginom, jednotná váha |

**Exit kritériá:** encounter obrazovka prejde manuálnym tablet testom (iPad landscape) bez horizontálneho skrolu; whitespace/duplicita klesne; i18n CI job blokuje nesymetrické slovníky.

**Čo v týchto troch sprintoch **zámerne nerobiť**: nové AI funkcie (súhrny, chat, auto-odpovede) — najprv musia platiť existujúce nastavenia a záznamy.

---

## 8. Zoznam UNVERIFIED a čo treba na ich overenie

| # | UNVERIFIED tvrdenie | Prečo nešlo overiť staticky | Čo treba |
|---|---|---|---|
| U-01 | Reálne správanie `/clients/new` pri nájdenom duplikátovi (zobrazí sa kandidát a ako) | `duplicate-shield.ts` je len serverová logika; UI dialóg nebolo možné spustiť | Bežiaci dev server + testovacie dáta |
| U-02 | Filtrovanie mena majiteľa/pacienta na obrazovke čakárne (TV mód) | Závisí od `privacyMode` v nastaveniach a od runtime dát | Bežiaci server s TV módou |
| U-03 | Drag & drop v rozvrhu (`/schedule`) — či funguje na dotyku | UI udalosti nie sú v statickom kóde čitateľné ako správanie | Manuálny test na tablete |
| U-04 | Či prepúšťacia správa zobrazuje `usedAi` badge | Komponent som čítal, ale bez chodu neviem potvrdiť render | Manuálny test |
| U-05 | Verzionovanie revízií plánu liečby (`requireExpectedRevision`) v UI | Server gate overený v kóde; UI tok nie | Manuálny test |
| U-06 | UI pre `statutory`/`kvepis` (existencia tlačidla „odoslané“) | Router overený, obrazovka nie | Manuálny test |
| U-07 | Kódovanie PDF v paneli laboratórneho analyzátora | Závisí od reálneho súboru od prístroja | Testovacie PDF z analyzátora |
| U-08 | Či `lib/ai/evals` beží v CI | V `.github/workflows/ci.yml` som nenašiel job spúšťajúci evals (a `verify-ai-audit-trail.ts` tiež nie) | Rozhodnutie CI vlastníka |
| U-09 | Produkčné hodnoty `AI_SETTINGS_ENCRYPTION_KEY` / `NEXTAUTH_SECRET` | Env nie je v repozitári; `.env.example` `AI_SETTINGS_ENCRYPTION_KEY` **neobsahuje** (obsahuje `MESSAGING_REGISTRATION_ENCRYPTION_KEY`) | Prístup k prostrediu nasadenia |
| U-10 | Reálne časovanie AI odpovede (5 s vs 60 s) na produkčnom modeli | Závisí od providera a dĺžky promptu | Meranie na pilotnej klinike |
| U-11 | Či schválenie batchu v marketing UI skutočne brzdí publikovanie | Publikátor je mimo repozitára (externý scheduling) | Dokumentácia publishera |
| U-12 | Správanie `record_vitals_from_speech` na slovenskom diktáte | Parser reči na čísla, potrebuje reálny vstup | Nahraný SK diktát |
| U-13 | Poradie krokov onboarding sprievodcu (číslo kroku „vyskúšaj AI“) | Odvodené z názvov súborov, nie z komponentu poradia | Manuálny priechod |
| U-14 | Pôvodné zámery `visitContext` v úlohe AI (komentáre vs. reálne volania) | UI ho neposiela, dôvod nie je v kóde | Git história / autor |
| U-15 | Existencia ľubovoľného AI volania v `inbox`/`messaging` | Grep nenašiel, ale dynamické volanie by sa dalo prepásť | Manuálne preklikanie + runtime log |

**Poznámka k metodike:** všetky zistenia okrem zoznamu vyššie sú podložené priamym čítaním kódu (súbor:riadok) alebo grepom. Nič v tomto reporte nie je odhad bez dôkazu; pri odhadoch (napr. „počet klikov“) je to explicitne uvedené.
