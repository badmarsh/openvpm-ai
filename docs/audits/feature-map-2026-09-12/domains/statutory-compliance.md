# Domain: Slovak Statutory Compliance
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **KVEPIS Submission Hub** — príprava, validácia, podpis a evidencia podaní na ŠVPS SR | `ext/kvepis` router, `/statutory/kvepis` page, `lib/kvepis/validator.ts`, `lib/kvepis/builder.ts` | admin, veterinarian, technician | `ext_kvepis_credentials`, `ext_kvepis_submissions` | **LIVE (GUIDED mode)** — XML generation + local lifecycle; B2G transport NOT live (awaiting ŠVPS production tokens) | [VERIFIED: apps/web/server/routers/extensions/kvepis.ts:L258-276] [CLAIMED IN DOCS: ROADMAP.md:L68] |
| **CRSZ — Register mikročipov (ISO 11784/11785)** — validácia 15-miestnych čipov, registrácia, generovanie certifikátov | `ext/crsz` router, `lib/crsz/microchip.ts`, `/statutory` CRSZ tab | admin, veterinarian, technician, front_desk | `microchip_registrations` | **LIVE (local)** — offline chip validation + CSV/XML batch export for KVL SR; CRSZ online lookup is SIMULATED | [VERIFIED: apps/web/lib/crsz/microchip.ts:L256-277] |
| **CRSZ — PetPass EÚ** — vystavovanie pasov spoločenských zvierat | `ext/crsz` router (`issuePetPassport`, `listPassports`) | admin, veterinarian, technician, front_desk | `pet_passports` | **LIVE** — full CRUD with 21-day travel eligibility calculation | [VERIFIED: apps/web/server/routers/extensions/crsz.ts:L167-238] |
| **CRSZ — KVL ČR pasy** — české pasy pre cestovanie | `ext/crsz` router (`issueKvlCrPassport`, `listKvlCrPassports`) | admin, veterinarian, technician, front_desk | `kvl_cr_passports` | **LIVE** — separate table, separate validation | [VERIFIED: apps/web/server/routers/extensions/crsz.ts:L333-420] |
| **CEHZ — Centrálna evidencia hospodárskych zvierat** | KVEPIS validator (`lib/kvepis/validator.ts`), KVEPIS builder | N/A (embedded in KVEPIS flow) | `ext_kvepis_submissions.cehz_code` | **LIVE (validation only)** — regex-based validation of CEHZ farm codes; no standalone CEHZ module/API integration | [VERIFIED: apps/web/lib/kvepis/validator.ts:L94-97, L224-237] |
| **Kniha besnoty (Rabies Register)** — očkovanie + 14-dňové pozorovanie po pohryznutí | `ext/statutory` router (`listRabiesNotifications`, `listRabiesObservations`, `createRabiesObservation`, `recordRabiesCheckpoint`) | admin, veterinarian, technician | `ext_rabies_notifications`, `ext_rabies_observations` | **LIVE** — full CRUD with RVPS notification tracking and 3-stage observation protocol (day 1/5/14) | [VERIFIED: apps/web/server/routers/extensions/statutory.ts:L108-272] |
| **Kniha ošetrení hospodárskych zvierat** — ochranné lehoty mäso/mlieko | `ext/statutory` router (`listWithdrawalPeriods`, `createWithdrawalPeriod`) | admin, veterinarian, technician | `ext_withdrawal_periods` | **LIVE** — includes built-in drug catalog with known withdrawal periods | [VERIFIED: apps/web/server/routers/extensions/statutory.ts:L32-108] [VERIFIED: apps/web/lib/statutory/withdrawal.ts:L15-93] |
| **Register eutanázií a kafilérie** — kadávery, odvoz, súhlas klienta | `ext/statutory` router (`listCarcassDisposals`, `recordCarcassDisposal`) | admin, veterinarian, technician | `ext_carcass_disposals` | **LIVE** — auto-marks patient as deceased, triggers Clinical Sympathy Gate | [VERIFIED: apps/web/server/routers/extensions/statutory.ts:L274-415] |
| **Dental charting** — zubný záznam s FDI notáciou | `ext/dental` router, `lib/records/dental.ts` | admin, veterinarian, technician | `dental_charts` | **LIVE** — pure clinical record, NOT statutory (misclassified in audit prompt) | [VERIFIED: apps/web/server/routers/extensions/dental.ts:L10-12] |
| **e-Kasa driver** — fiskálna registračná pokladnica | `ext/ekasa` router, `lib/ekasa/` | admin, veterinarian | `ext_ekasa_config`, `ext_ekasa_receipts`, `ext_ekasa_daily_reports` | **LIVE (driver)** — FiskalPRO/VPR2 hardware support; NOT formally certified by FR SR | [CLAIMED IN DOCS: ROADMAP.md:L69] [VERIFIED: packages/db/schema/ext_ekasa.ts:L1-60] |

### Notes on feature inventory

- **KVEPIS** is the most architecturally ambitious subdomain: it models a full submission lifecycle (DRAFT → VALIDATED → SIGNED → SUBMITTED → ACKNOWLEDGED/REJECTED) with cryptographic hashing, GovBox XML envelopes, and KEP signature metadata. However, the actual B2G transport is stubbed — `submitSubmission` only records a local timestamp and synthetic MessageID. [VERIFIED: apps/web/server/routers/extensions/kvepis.ts:L258-276]
- **CRSZ online lookup** (`lookupCrszOnline`) returns simulated data based on chip prefix matching. Names like `isRegisteredSimulated` in the source make this explicit. [VERIFIED: apps/web/lib/crsz/microchip.ts:L256-277]
- **CEHZ** exists only as a validation field and a regex. There is no separate CEHZ router, no CEHZ API integration, and no CEHZ dashboard page. The ROADMAP claim "CEHZ evidencia: validácia 6-miestnych kódov fariem pre hospodárske zvieratá a kontrola ochranných lehôt mäsa/mlieka" [CLAIMED IN DOCS: ROADMAP.md:L69] conflates two separate things: (a) CEHZ code validation (regex in kvpepis validator) and (b) withdrawal periods (which live in the `ext_statutory` router, not CEHZ). The CEHZ regex pattern `/^[A-Z0-9]{2}[\- ]?\d{6,9}$/i` [VERIFIED: apps/web/lib/kvepis/validator.ts:L74] allows 6-9 digits after country prefix, not strictly 6-digit as claimed.
- **Dental charting** is a clinical records feature (FDI tooth notation, conditions, treatments). It is NOT statutory — there is no Slovak law requiring digital dental charts. It is listed under `ext/dental` router and `records/dental` library, completely separate from the statutory dashboard. Its inclusion in this domain appears to be a scoping error in the audit prompt. [VERIFIED: apps/web/server/routers/extensions/dental.ts:L1-12, apps/web/lib/records/dental.ts]

---

## B. Import/Export specifics

### KVEPIS B2G submission — ROADMAP says "not yet live"
**Verdict: CONFIRMED.** The code fully supports the Guided Submission Hub workflow but the actual B2G transport is explicitly deferred to Phase 2 ("v0.7 — Priame B2G SOAP/REST volania do KVEPIS"). Key evidence:
- `submitSubmission` mutation records a local `SUBMITTED` status and generates a synthetic `upvsMessageId` (format: `UPVS-{referenceNumber}`) — no actual HTTP call to ŠVPS SR. [VERIFIED: apps/web/server/routers/extensions/kvepis.ts:L258-276]
- Schema comment: "Fáza 2 (priamy B2G konektor cez ÚPVS bránu s mandátnym certifikátom KEP) nadviaže na rovnaký dátový model bez migračných zmien." [VERIFIED: packages/db/schema/ext_kvepis.ts:L25-27]
- `lookupCrszOnline` returns simulated data — the function literally sets `isRegisteredSimulated = isSlovak ? true : Boolean(...)`. [VERIFIED: apps/web/lib/crsz/microchip.ts:L261]
- ROADMAP technical debt item #1: "Realny produkcny KVEPIS token zatial neprideleny." [VERIFIED: ROADMAP.md:L68]

### CRSZ registration — what's implemented?
- **Implemented:** Microchip validation (ISO 11784/11785), registration records, certificate generation (HTML for printing), batch XML/CSV export for KVL SR portal, PetPass EU issuance, KVL ČR passport issuance.
- **NOT implemented:** Live API integration with CRSZ/KVL SR portal. The `exportKvlSrBatch` endpoint generates XML/CSV files but the user downloads them manually — there is no programmatic submission to the KVL SR portal. [INFERRED: no HTTP client call in exportKvlSrBatch mutation]
- **NOT implemented:** Real CRSZ online lookup. The `lookupCrszOnline` function checks chip prefix (e.g., "703" = Slovakia) and simulates a "REGISTERED" status for Slovak-coded chips. It never contacts an external registry. [VERIFIED: apps/web/lib/crsz/microchip.ts:L256-277]

### Other export formats
| Export | Format | Method | Status |
|---|---|---|---|
| KVEPIS submission XML | GovBox-style envelope (`kvepis:submission`) | `buildXmlPayload()` → download | LIVE |
| KVEPIS submission JSON | Canonical JSON with SHA-256 hash | `buildJsonPayload()` → `hashPayload()` | LIVE |
| Rabies register (Kniha besnoty) | CSV + printable inspection form | `downloadStatutoryCsv()` / `openInspectionPrintView()` | LIVE |
| Withdrawal certificate | HTML (A4 print) | `formatWithdrawalCertificateHtml()` | LIVE |
| Microchip certificate | HTML (A4 print) | `generateMicrochipCertificateHtml()` | LIVE |
| KVL SR batch | XML (`DavkaCRSZ`) + CSV (semicolon, BOM) | `exportKvlSrBatchXml()` / `exportKvlSrBatchCsv()` | LIVE (manual upload) |
| Rabies bite inspection report | HTML (A4 print) | `printRabiesBiteInspectionReport()` | LIVE |

---

## C. Integration specifics

### KVEPIS — Slovak B2G system
**Integration status: Phase 1 (Guided) complete; Phase 2 (B2G) pending.**

The code is structured in two clearly separated phases:
- **Phase 1 (GUIDED mode)** — current: Manual XML generation + local lifecycle tracking. The validator checks IČO, CEHZ codes, ear tags, transponder numbers, KVL numbers. The builder generates GovBox-style XML. The router supports the full submission lifecycle locally. No HTTP calls to external systems.
- **Phase 2 (B2G mode)** — planned v0.7: Direct SOAP/REST to ŠVPS SR. The schema accommodates this (`integrationMode` field on `ext_kvepis_credentials` with values `GUIDED` / `B2G`). [VERIFIED: packages/db/schema/ext_kvepis.ts:L47]

KVEPIS submission types supported: `rabies_notification`, `treatment_diary_batch`, `animal_movement`, `infectious_disease_alert`. [VERIFIED: packages/db/schema/ext_kvepis.ts:L33-38]

Signature methods: `NONE`, `DSIGNER` (D.Signer / Disig Web Signer with eID card reader), `CLOUD_SEAL` (cloudová pečať ambulancie), `HSM` (hardware security module). [VERIFIED: packages/db/schema/ext_kvepis.ts:L46-50]

### CRSZ — Slovak companion animal register
**Integration status: Local data management complete; no live API.**

The CRSZ module manages the full lifecycle of microchip data locally:
- Chip validation (15-digit ISO 11784/11785, country/manufacturer prefix recognition for 12 known prefixes)
- Registration records with CRSZ status tracking (`NOT_REGISTERED → PENDING_SUBMISSION → REGISTERED / REJECTED`)
- Batch export to KVL SR in XML and CSV formats
- PetPass EU issuance with travel eligibility calculation (21-day rule per EU Regulation 576/2013)
- KVL ČR passport issuance with separate validation

However, the `lookupCrszOnline()` function is clearly simulated — it resolves chip prefixes to manufacturer/country names but never makes an HTTP call. Slovak-coded chips (prefix "703") are always reported as "REGISTERED" in simulated mode. [VERIFIED: apps/web/lib/crsz/microchip.ts:L256-277]

### CEHZ — any references in code?
**CEHZ exists only as a data field, not a module.**

References found (56 total across codebase):
- `ext_kvepis_submissions.cehz_code` column — stores the CEHZ farm code on KVEPIS submissions [VERIFIED: packages/db/schema/ext_kvepis.ts:L127]
- `isValidCehzCode()` function — regex validation: `/^[A-Z0-9]{2}[\- ]?\d{6,9}$/i` [VERIFIED: apps/web/lib/kvepis/validator.ts:L74, L94-97]
- KVEPIS validator treats CEHZ code as required for `treatment_diary_batch` and `infectious_disease_alert` types [VERIFIED: apps/web/lib/kvepis/validator.ts:L142-157]
- KVEPIS builder includes `cehzCode` in XML output [VERIFIED: apps/web/lib/kvepis/builder.ts:L176]
- Dashboard page includes a "CEHZ kód chovu" input field on the KVEPIS submission form [VERIFIED: apps/web/app/(dashboard)/statutory/kvepis/page.tsx:L310-311]
- README and docs reference CEHZ as a standalone feature, but in code it is entirely subsumed under KVEPIS [CLAIMED IN DOCS: README.md:L74, docs/slovak-integration-catalog.md:L65]

There is NO:
- Standalone CEHZ router
- CEHZ schema table (beyond the column on `ext_kvepis_submissions`)
- CEHZ API client
- CEHZ dashboard page

### ÚPVS — Slovak central government portal
**Integration status: XML generation only; no live API.**

- `ext_kvepis_credentials.upvsSchranka` — stores the electronic mailbox ID [VERIFIED: packages/db/schema/ext_kvepis.ts:L45]
- `ext_kvepis_submissions.upvsMessageId` — stores the MessageID for ÚPVS GovBox tracking [VERIFIED: packages/db/schema/ext_kvepis.ts:L137]
- `buildXmlPayload()` generates XML in GovBox envelope style (namespace: `https://www.svps.sk/kvepis/schemas/submission/v1`) [VERIFIED: apps/web/lib/kvepis/builder.ts:L22-23]
- There is NO ÚPVS API client, no message delivery, no GovBox polling — the integration is limited to generating conformant XML that would be manually uploaded or sent via the hypothetical future B2G connector.

---

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| ROADMAP: "KVEPIS Hub: validacia dat voci oficialnej XSD scheme SVPS SR" | **PARTIALLY TRUE** — validator checks formát (IČO, CEHZ, ear tag, transponder, KVL), but there is no evidence of actual XSD schema loading or XML Schema validation. The validator is a custom JavaScript function, not an XSD processor. | [VERIFIED: apps/web/lib/kvepis/validator.ts — no XSD import, no XML schema library usage] |
| ROADMAP: "mesacna ambulantna kniha, hlasenie chorob" | **TRUE** — `treatment_diary_batch` and `infectious_disease_alert` submission types exist | [VERIFIED: packages/db/schema/ext_kvepis.ts:L33-38] |
| ROADMAP: "priame podanie na SVPS SR v produkcii zatial neuskutocnene" | **TRUE** — `submitSubmission` is a local-only mutation | [VERIFIED: apps/web/server/routers/extensions/kvepis.ts:L258-276] |
| ROADMAP: "CRSZ modul: validácia a kontrola 15-miestnych mikročipov podľa ISO 11784/11785" | **TRUE** — `validateMicrochipNumber()` checks 15-digit format and recognizes 12 country/manufacturer prefixes | [VERIFIED: apps/web/lib/crsz/microchip.ts:L33-52] |
| ROADMAP: "export dávok do KVL SR" | **TRUE** — `exportKvlSrBatch` generates XML and CSV batches | [VERIFIED: apps/web/server/routers/extensions/crsz.ts:L281-332] |
| ROADMAP: "CEHZ evidencia: validácia 6-miestnych kódov fariem" | **INACCURATE** — CEHZ regex allows 6-9 digits, not strictly 6-digit. Also, there is no separate "CEHZ evidencia" — the field lives inside KVEPIS submissions. | [VERIFIED: apps/web/lib/kvepis/validator.ts:L74 — regex `[A-Z0-9]{2}[\- ]?\d{6,9}`] |
| ROADMAP: "CEHZ ... kontrola ochranných lehôt mäsa/mlieka" | **MISATTRIBUTED** — withdrawal periods are in `ext_statutory` router, not CEHZ. CEHZ is a code validation field. | [VERIFIED: apps/web/server/routers/extensions/statutory.ts:L32-108 — withdrawal periods] vs [VERIFIED: apps/web/lib/kvepis/validator.ts:L94-97 — CEHZ is a regex validator] |
| ROADMAP: "ÚPVS / Slovensko.sk: generovanie GovBox XML obálok" | **TRUE** — `buildXmlPayload()` generates GovBox-style XML. But no delivery mechanism. | [VERIFIED: apps/web/lib/kvepis/builder.ts:L142-208] |
| README: "Plná integrácia centrálnych štátnych registrov EÚ (TRACES NT)" | **FALSE for v0.6** — TRACES NT is listed as a v1.0 roadmap item, not implemented. README's feature table is aspirational, not reflective of current state. | [CLAIMED IN DOCS: README.md:L74] vs [ROADMAP.md v1.0 section — no TRACES mention in current milestones] |
| docs/slovak-integration-catalog.md: CEHZ "Implementované (v0.6)" with "Evidencia a validácia 6-miestnych kódov fariem" | **OVERSTATED** — only a regex validator exists. No CEHZ API, no CEHZ registry lookup, no standalone CEHZ module. | [VERIFIED: apps/web/lib/kvepis/validator.ts:L94-97] |
| docs/slovak-integration-catalog.md: ÚPVS "Implementované (v0.6)" with "Generovanie GovBox XML obálky pre elektronické schránky s podporou kvalifikovaného podpisu" | **OVERSTATED** — XML generation exists; signature support models the metadata but no actual KEP signing integration (D.Signer, cloud seal, HSM are modeled as enum values but no integration code exists). | [VERIFIED: packages/db/schema/ext_kvepis.ts:L46-50 — enum values only] |

---

## E. Friction notes

### e-Kasa cross-over with billing domain (domain 4)
e-Kasa is architecturally positioned in two places simultaneously:
- **Statutory context:** ROADMAP lists e-Kasa under "Slovenský legislatívny balík" (milestone v0.6, item 2) alongside KVEPIS/CRSZ/CEHZ. It is a statutory requirement under Zákon č. 289/2008 Z.z.
- **Billing context:** The e-Kasa router (`ext/ekasa`) and schema (`ext_ekasa.ts`) are registered in the `extensionsRouter` alongside `accounting`, not under the statutory dashboard. The statutory dashboard page (`/statutory`) has no e-Kasa tab.
- **Implication:** Domain 4 (billing) needs to reference e-Kasa for the fiscal receipt lifecycle; this domain should note that e-Kasa's legal basis is statutory but its operational home is billing.

### Dental charting is an extension — why statutory?
Dental charting (`ext_dental` router, `dental_charts` table, FDI tooth notation) is a purely clinical feature. It is NOT driven by Slovak veterinary law. There is no statutory dental reporting requirement. The dental router's procedures (`list`, `create`, `update`, `remove`) are standard CRUD for clinical records. Its inclusion in this domain appears to be based on the audit prompt's domain assignment, not on actual architectural grouping. In the codebase, dental lives under:
- Router: `apps/web/server/routers/extensions/dental.ts`
- Library: `apps/web/lib/records/dental.ts` (note: `records/` not `statutory/`)
- Dashboard: NOT under `/statutory` — accessed through patient records
- Schema: `packages/db/schema/ext_dental.ts`

### All statutory routers are extensions (`ext_*`) — architectural note
This is by design. The `extensionsRouter` aggregates all extension routers including `statutory`, `kvepis`, `crsz`, `ekasa`, `dental`. This isolation means statutory features follow the same patterns as other extensions (e-Kasa, insurance, lab imports, imaging). There is no "statutory super-router" — instead, `statutory`, `kvepis`, and `crsz` are sibling routers. The dashboard page at `/statutory` aggregates them visually into one UI, but they are separate tRPC namespaces:
- `ext.statutory.*` — rabies, withdrawals, carcass disposals
- `ext.kvepis.*` — KVEPIS submissions, credentials, signing, receipts
- `ext.crsz.*` — microchips, PetPass, KVL ČR, batch export

### Simulated integrations are explicitly labeled in code
The codebase is honest about simulation status. Key examples:
- `isRegisteredSimulated` variable name in `lookupCrszOnline` [VERIFIED: apps/web/lib/crsz/microchip.ts:L261]
- Schema comment: "Fáza 2 (priamy B2G konektor cez ÚPVS bránu s mandátnym certifikátom KEP) nadviaže na rovnaký dátový model" [VERIFIED: packages/db/schema/ext_kvepis.ts:L25-27]
- Router comment: "Vo fáze 1 (GUIDED) zaznamená odoslanie a vytvorí MessageID; skutočný transport cez B2G bránu nadviaže vo fáze 2." [VERIFIED: apps/web/server/routers/extensions/kvepis.ts:L258-260]

### Regulatory scope note
The laws referenced are consistent across the codebase:
- **Zákon č. 39/2007 Z.z.** — o veterinárnej starostlivosti (primary law for rabies, CRSZ, KVEPIS, withdrawal periods, carcass disposal)
- **Zákon č. 139/1998 Z.z.** — o omamných a psychotropných látkach (referenced in withdrawal docs but narcotics control is handled elsewhere)
- **Zákon č. 289/2008 Z.z.** — o používaní ERP (e-Kasa, handled in billing domain)
- **Zákon č. 305/2013 Z.z.** — o e-Governmente (ÚPVS, referenced in integration catalog)
- **Nariadenie EÚ č. 576/2013** — pet travel (PetPass 21-day rule)

---

## F. Proposed user-manual section(s)

### Personas
- **Veterinarian (veterinárny lekár):** Primary user. Needs to: record rabies vaccinations and notify RVPS within 3 days, manage 14-day bite observations, record withdrawal periods for food animals, register microchips and issue PetPasses, prepare KVEPIS submissions, record euthanasias and carcass disposals.
- **Administrator (správca praxe):** Secondary user. Needs to: configure KVEPIS credentials (IČO, KVL ID, ÚPVS schránka, signing certificates), manage KEP signing preferences, review submission history and delivery receipts, export batch data for KVL SR portal.
- **Technician (technik):** Support role. May record rabies notifications and withdrawal periods but cannot sign/submit KVEPIS submissions (signing requires veterinarian).

### HIGH COMPLEXITY — reference-style documentation needed
The statutory compliance domain is the most legally complex area of the application. It requires a **statutory reference manual**, not in-app help tooltips. Proposed sections:

1. **Legislative framework overview** — which laws apply, to whom, with what deadlines
2. **KVEPIS submission workflow** — step-by-step DRAFT → VALIDATED → SIGNED → SUBMITTED → ACKNOWLEDGED lifecycle, with screenshots. Include: how to configure credentials, how to validate a submission, how to sign (D.Signer / cloud seal / HSM — explain that these are modeled but not yet integrated), how to handle rejections, how to file delivery receipts.
3. **Rabies management** — two tracks: (a) routine vaccination → 3-day RVPS notification deadline, (b) bite incident → 14-day observation protocol with day-1/day-5/day-14 checkpoints, certificate issuance, animal bite inspection report printing.
4. **Withdrawal periods (ochranné lehoty)** — for food animals: built-in drug catalog with known withdrawal periods for meat and milk, how to calculate safe-until dates, how to print the official certificate for the farmer and RVPS inspection.
5. **CRSZ & PetPass** — microchip registration workflow (validate → implant → verify → certificate → CRSZ registration), PetPass EU issuance with travel eligibility calculation (21-day rule, revaccination rules), KVL ČR passport issuance, batch export to KVL SR portal.
6. **Carcass disposal register** — euthanasia recording, rendering plant documentation, client consent tracking, storage location management.
7. **Current limitations (transparent disclosure)** — KVEPIS is GUIDED mode only (no live B2G), CRSZ lookup is simulated (prefix-based, not real API), KEP signing is modeled but not integrated, e-Kasa is not formally certified by FR SR. This disclosure is critical for regulatory audits.

### In-app help status
The codebase contains help content for KVEPIS workflows in `apps/web/components/help/help-content.ts` (at least 2 entries found referencing CEHZ codes and KVEPIS submission steps). [VERIFIED: apps/web/components/help/help-content.ts:L757, L783] These are inline tooltips, not a reference manual — appropriate for quick guidance but insufficient for statutory compliance documentation.