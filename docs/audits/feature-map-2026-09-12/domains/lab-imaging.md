# Domain: Lab & Imaging
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **Lab analyzer file import** (parse + save) | `ext/lab-import` tRPC: `parseFile`, `saveReport` | admin, veterinarian, technician, front_desk | `lab_analyzer_reports` | **Live** | [VERIFIED: `apps/web/server/routers/extensions/lab-import.ts:L23-99`] |
| **Lab analyzer auto-detection** | `lib/lab/analyzer-parser.ts:autoDetectAndParse` | (server-side only) | — | **Live** — 7 parser backends: IDEXX, Fuji Dri-Chem, Mindray, Labtechnik/Zoetis, INLAB, QuickSeal, Generic CSV | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L484-529`] |
| **Lab report inbox** (assign, review) | `ext/lab-import`: `listReports`, `getReport`, `assignReport`, `reviewReport` | admin, veterinarian, technician, front_desk | `lab_analyzer_reports` | **Live** | [VERIFIED: `apps/web/server/routers/extensions/lab-import.ts:L101-243`] |
| **Core lab results** (lifecycle: pending→completed→reviewed) | `records` tRPC: `createLabResult`, `completeLabResult`, `updateLabResultStatus` | admin, veterinarian, technician | `lab_results`, `lab_result_events`, `lab_result_replacements` | **Live** — with immutable event ledger | [VERIFIED: `packages/db/schema/clinical.ts:L330-500`]; [VERIFIED: `apps/web/server/routers/records.ts`] |
| **Lab result follow-up** (assign, reassign, complete) | `records`: `assignLabFollowUp`, `completeLabFollowUp` | admin, veterinarian, technician, front_desk | `lab_results` (followUpStatus, followUpAssignedTo, followUpDueAt fields) | **Live** | [VERIFIED: `apps/web/app/(dashboard)/lab-results/page.tsx:L281-310`] |
| **Lab result error correction** (entered-in-error → replacement) | `records`: `markLabResultEnteredInError` | admin, veterinarian | `lab_results`, `lab_result_replacements`, `clinical_record_corrections` | **Live** | [VERIFIED: `apps/web/server/routers/records.ts:L3542-3626`] |
| **Lab results dashboard** (inbox + filter tabs) | `app/(dashboard)/lab-results/page.tsx` | all staff (role-aware filtering) | `lab_results` | **Live** — with tabs: "Laboratórna schránka & Review" and "Import z analyzátorov" | [VERIFIED: `apps/web/app/(dashboard)/lab-results/page.tsx:L1-973`] |
| **AI imaging analysis** | `ext/imaging`: `analyze` | admin, veterinarian (requires `agent` feature flag) | `ai_imaging_analyses` | **Live** — VLM multimodal via `configuredModel()` | [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L140-280`] |
| **Imaging analysis listing** (per patient, per analysis) | `ext/imaging`: `listByPatient`, `get` | admin, veterinarian | `ai_imaging_analyses` | **Live** | [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L282-322`] |
| **Imaging → SOAP injection** | `ext/imaging`: `injectFindingsIntoSoap` | admin, veterinarian | `ai_imaging_analyses`, `soap_notes` | **Live** — appends AI findings to SOAP Objective section | [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L374-460`] |
| **Imaging clinician confirmation** (audit-trailed) | `ext/imaging`: `prepareConfirmation`, `confirmAnalysis` | admin, veterinarian | `ai_imaging_analyses`, `ext_ai_audit_log` | **Live** — with kryptografický audit trail, optimistic concurrency | [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L652-850`] |
| **Surgical plan from imaging** | `ext/imaging`: `createSurgicalPlanFromImaging` | admin, veterinarian | `ai_imaging_analyses`, `treatment_plans`, `treatment_plan_items`, `consent_requests` | **Live** — generates anesthesia protocol with weight-based dosing | [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L324-372`] |
| **VHS calculator** (Vertebral Heart Score) | `ext/imaging`: `calculateVhs` + `lib/imaging/vhs-calculator.ts` | admin, veterinarian | — (pure computation) | **Live** — breed-specific ranges for 13 canine breeds + feline | [VERIFIED: `apps/web/lib/imaging/vhs-calculator.ts:L1-173`] |
| **Marketing quiz from imaging** | `ext/imaging`: `createMarketingQuizFromImaging` | admin, veterinarian | `ai_imaging_analyses`, `ext_marketing_content_items` | **Live** — with KVL SR compliance validator | [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L852-944`] |
| **DICOM viewer** (client-side) | `components/imaging/dicom-viewer.tsx` + `lib/imaging/dicom-parser.ts` | (client-side only) | — | **Live** — Part 10 header parser, Window/Level presets, 16-bit rendering | [VERIFIED: `apps/web/lib/imaging/dicom-parser.ts:L1-291`] |
| **Lab provider adapter** (IDEXX/Antech/Zoetis) | `lib/lab-integration.ts` | — | — | **Stub** — all external providers fail-closed; only `in_house` works | [VERIFIED: `apps/web/lib/lab-integration.ts:L65-93`] |

## B. Import/Export specifics

### Lab analyzer import — supported formats

| Analyzer | Parser function | Detection keywords | Device model hint | Source tag |
|---|---|---|---|---|
| IDEXX Catalyst / ProCyte | `parseIdexx()` | "idexx", "catalyst", "procyte" in content or filename | Catalyst One / ProCyte Dx | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L218-265`] |
| Fuji Dri-Chem NX500i / NX700 | `parseFujiDriChem()` | "fuji", "dri-chem" | Fuji Dri-Chem NX500i | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L271-312`] |
| Mindray BC-2800Vet / BC-5000Vet | `parseMindray()` | "mindray", "bc-" | Mindray BC-Vet | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L318-357`] |
| Labtechnik / Zoetis VetScan | `parseLabtechnik()` | "labtechnik", "vetscan", "abaxis", ".ltk" | Labtechnik / Zoetis VetScan | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L380-430`] |
| INLAB (INBAL) | `parseInlab()` | "inlab", "inbal", "i-lab", ".inl", ".ibl" | INLAB Analyzer | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L436-479`] |
| QuickSeal Point-of-Care | `parseQuickSeal()` | "quickseal", "quick seal", ".qs" | QuickSeal Point-of-Care | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L370-376`] |
| Generic CSV (fallback) | `parseIdexx()` → `parseFujiDriChem()` fallback | (none matched) | — | [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L510-514`] |

**Dry-run preview:** `parseFile` mutation returns parsed results without persisting to DB. User reviews results, then calls `saveReport` to persist. [VERIFIED: `apps/web/server/routers/extensions/lab-import.ts:L24-39`]

**Built-in reference ranges:** 26 analytes covering biochemistry (ALT, AST, ALP, GGT, UREA, BUN, CREA, GLU, TBIL, TP, ALB, GLOB, AMYL, LIPA), electrolytes (CA, PHOS, NA, K, CL), and hematology (RBC, HGB, HCT, MCV, WBC, PLT) — with species-specific (canine/feline) critical thresholds. [VERIFIED: `apps/web/lib/lab/analyzer-parser.ts:L58-217`]

### Imaging upload formats

Supported: **JPG, PNG, WebP, and DICOM (.dcm)** up to 10 MB. [VERIFIED: `apps/web/messages/sk.json:L5472`]

DICOM files are parsed entirely client-side: [VERIFIED: `apps/web/lib/imaging/dicom-parser.ts:L1-291`]
- Part 10 header detection ("DICM" at byte 128)
- Extracts: patient name/ID, modality, study date, manufacturer, rows/cols, bit depth, Window Center/Width, Rescale Intercept/Slope, pixel data offset
- Renders to HTML5 Canvas with Window/Level presets (default, bone, lung, soft_tissue, abdomen, high_contrast)
- After client-side rendering, the DICOM is converted to PNG for upload to S3 and AI analysis

## C. Integration specifics

### Lab analyzers — parsers, not live API integrations

**ROADMAP claim (point 7):** "Parser vzorov existuje; ziadna ziva integr. s externym API laboratoria v produkcii." [VERIFIED: `ROADMAP.md:L80`]

**Verification:** This claim is **accurate**. The `lab-integration.ts` file defines a `LabProvider` interface with `submitOrder`, `checkStatus`, `getResults` methods — but only `in_house` is functional. IDEXX, Antech, and Zoetis are all stubbed with `LabProviderNotConfiguredError`. [VERIFIED: `apps/web/lib/lab-integration.ts:L65-93`]

**GAP analysis** (C-05): "ext_lab_import.ts existuje; chyba live API konektor." Target: Q1 2027. [VERIFIED: `docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md:L58`]

**Architectural note:** The `lab-integration.ts` interface (used for order submission / status check) is **separate from** the analyzer file parsers used by `ext/lab-import`. The parsers handle **offline file import** from in-clinic analyzer devices. The LabProvider interface would handle **online API integration** with reference labs — this path is not yet built.

### Imaging AI — multimodal analysis via VLM

**AI Audit Reference (Surface #5):** "Multimodal Imaging Analysis" uses `configuredModel()` (VLM multimodal) with `generateText` accepting base64 image buffer. [VERIFIED: `artifacts/ai-feature-audit.md:L42`]

**Model resolution chain:** `opts.model` → `process.env.AI_MODEL` → `process.env.AGENT_MODEL` → `DEFAULT_AI_MODEL` ("gemini-3.8-flash-medium"). [VERIFIED: `artifacts/ai-feature-audit.md:L66-67`]

**Modality-specific prompts:** 5 Slovak-language system prompts for `xray`, `ct`, `mri`, `ultrasound`, `photo` — each with structured analysis guidelines aligned with ŠVPS SR / KVL SR terminology. [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L66-118`]

**Safety:** Clinician confirmation envelope with cryptographic audit trail (`ext_ai_audit_log`), statutory diagnostic disclaimer displayed in UI, and optimistic concurrency revision checks. [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L652-850`]; [VERIFIED: `artifacts/ai-feature-audit.md:L334`]

**Cross-check:** The `alibaba-proxy.ts` library (Wanx 2.1 image generation, Wan 2.1 video generation) is **not** used for imaging analysis. It is used only by the marketing domain (`marketing.ts:generatePostVisual`). Imaging analysis uses the Vercel AI SDK's `generateText` with the configured model (typically Gemini). [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L211-227`]; [VERIFIED: `apps/web/lib/ai/alibaba-proxy.ts:L1-9`]

### DICOM support — current state

**What exists:**
- Client-side DICOM Part 10 parser (`lib/imaging/dicom-parser.ts`) — no C++/WASM dependencies
- `DicomViewer` React component with interactive Window/Level presets
- DICOM upload accepted on the imaging page (`.dcm`, `.dicom`, `application/dicom`)
- After client-side parsing/rendering, converted to PNG for upload to S3 [VERIFIED: `apps/web/app/(dashboard)/agent/imaging/page.tsx:L254-265`]

**What is NOT implemented (planned):**
- **DICOM PACS server** — ROADMAP lists "Pokročilý DICOM PACS server: cloudové a lokálne ukladanie RTG, ultrazvukových a CT snímok" as an unchecked item. [VERIFIED: `ROADMAP.md:L64`]
- **DICOM store / C-STORE SCP** — GAP analysis confirms "Auto-prepare stub v encounters; chyba realny DICOM store" (C-06, target Q2 2027). [VERIFIED: `docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md:L59`]
- **DICOM Worklist (MWL)** — no reference found
- **DICOM Query/Retrieve** — no reference found
- **Server-side DICOM → PNG conversion** — all conversion is client-side; the server stores only the PNG rendering, not the original DICOM pixel data

**Pricing context:** README mentions "DICOM PACS cloudové úložisko snímok" as a feature of the "Cloud Nemocnica" (229 €/month) tier. [VERIFIED: `README.md:L91`]

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| "Lab konektory (IDEXX, Zoetis): Parser vzorov existuje; ziadna ziva integr. s externym API" (ROADMAP point 7) | **CONFIRMED** | `lab-integration.ts` has stubs for IDEXX/Antech/Zoetis that throw `LabProviderNotConfiguredError`. Only `in_house` works. [VERIFIED: `apps/web/lib/lab-integration.ts:L65-93`] |
| "DICOM PACS cloudové úložisko snímok" listed in Cloud Nemocnica tier (README) | **MISLEADING** — not yet built | ROADMAP has it as unchecked; GAP analysis calls it "Partial" (C-06, Q2 2027). Only client-side DICOM parsing exists today. [VERIFIED: `ROADMAP.md:L64`]; [VERIFIED: `GAP_ANALYSIS_POST_PILOT_READY.md:L59`] |
| "AI imaging analysis must be reviewed by a licensed veterinarian" (system prompt disclaimer) | **CONFIRMED** — enforced | `confirmAnalysis` requires clinician confirmation envelope + audit ledger. Statutory disclaimer displayed in UI. [VERIFIED: `imaging.ts:L798`]; [VERIFIED: `ai-feature-audit.md:L207`] |
| "Imaging AI uses VLM multimodal model" (AI audit Surface #5) | **CONFIRMED** | `imaging.ts:analyze` calls `generateText` with `{ type: "image", image: dataUrl }` — multimodal input. [VERIFIED: `imaging.ts:L220-227`] |
| "AI write paths require explicit clinician confirmation" (SECURITY.md) | **PARTIAL** — true for imaging, false for Agent chat tools | AI audit notes this discrepancy: "True for clinical finalization modules (SOAP, imaging, discharge). False for Agent chat write tools (create_prescription, book_appointment), which write immediately once allowWrites: true." [VERIFIED: `ai-feature-audit.md:L297`] |
| "Lab & Imaging" as a single unified domain (audit-prompts feature map) | **MISLEADING** — two loosely-coupled subsystems | Lab import (`ext/lab-import`) and core lab results (`records`) share no code path with imaging (`ext/imaging`). They are separate extensions under the extensions router with independent DB tables. Only the lab-results dashboard page unifies them via UI tabs. [VERIFIED: `apps/web/server/routers/extensions/index.ts:L4,L7`] |

## E. Friction notes

### 1. Lab import is an extension (`ext/lab-import`), not core

The lab analyzer import lives under `extensionsRouter.labImport` while core lab results (lifecycle, review, follow-up) live in `recordsRouter`. This creates a **split responsibility**:

- **`ext/lab-import`** (`lab_analyzer_reports`): Handles file parsing from in-clinic analyzers, produces parsed reports with status UNASSIGNED→ATTACHED→REVIEWED
- **`records`** (`lab_results`): Handles individual lab result lifecycle, review inbox, follow-up workflow — a separate table with different status model (pending→completed→reviewed)
- **`lab-integration.ts`** (`LabProvider` interface): A third abstraction for external reference lab API integration — currently all stubs

These three systems address different workflows but share no data migration path between them. An analyzer report saved via `saveReport` does not automatically create `lab_results` rows. [INFERRED — no cross-table trigger or migration found]

### 2. Imaging AI analysis also lives in the ai-agent domain (domain 11)

The imaging page (`/agent/imaging`) is under the `/agent/` route namespace — part of the AI Agent domain. However:

- The tRPC router is `extensions.imaging` — an extension
- The page is at `app/(dashboard)/agent/imaging/page.tsx` — alongside the AI chat agent
- The imaging analysis uses the same `configuredModel()` as the agent chat
- Cross-features: `injectFindingsIntoSoap` writes to SOAP notes (records domain), `createSurgicalPlanFromImaging` creates treatment plans (clinical domain), `createMarketingQuizFromImaging` writes to marketing (marketing domain)

**Recommendation:** The user manual should cross-reference imaging analysis in both domain 6 (Lab & Imaging) and domain 11 (AI Agent). [INFERRED]

### 3. VHS calculator is pure computation with no persistence

The `calculateVhs` endpoint is a stateless tRPC mutation — it computes VHS and returns clinical interpretation, but does not store results in any DB table. Clinicians must manually record the VHS result in the SOAP note or clinical record. [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L462-495`]

### 4. Surgical plan from imaging does drug dosing without formulary lookup

`createSurgicalPlanFromImaging` computes weight-based anesthesia doses using **hardcoded drug names and concentrations** (Butomidor 10mg/ml, Sedator 1mg/ml, Propofol 1%, Meloxidyl 5mg/ml). These are not sourced from the drug formulary table (if one exists) and have no interaction checks. [VERIFIED: `apps/web/server/routers/extensions/imaging.ts:L274-298`]

### 5. DICOM workflow gap

DICOM files are client-side parsed and rendered, then converted to PNG for upload. The original DICOM pixel data (16-bit, HU-calibrated) is **discarded** — only the PNG rendering is preserved. This means Window/Level adjustments cannot be re-applied after upload, and no PACS integration (C-STORE, MWL, Q/R) exists. [VERIFIED: `apps/web/app/(dashboard)/agent/imaging/page.tsx:L254-265`]

## F. Proposed user-manual section(s)

### Section: Laboratórne výsledky a analyzátory

**Personas:** veterinár, technik, admin, recepčný

**1. Import výsledkov z analyzátora**
- Podporované analyzátory: IDEXX Catalyst/ProCyte, Fuji Dri-Chem NX500i/NX700, Mindray BC-Vet, Labtechnik/Zoetis VetScan, INLAB, QuickSeal
- Postup: Nahrajte exportný súbor (CSV/TXT) z analyzátora → systém automaticky rozpozná typ zariadenia → skontrolujte výsledky → uložte protokol → priraďte pacientovi → lekár schváli
- Referenčné rozsahy sú automaticky vyhodnocované podľa druhu zvieraťa (pes/mačka) s vyznačením kritických hodnôt

**2. Laboratórna schránka (Inbox)**
- Filtre: Action required, Awaiting values, Awaiting review, Critical, Follow-up
- Životný cyklus: pending → completed → reviewed
- Follow-up: priradenie úlohy konkrétnemu členovi tímu s termínom

**3. História a opravy**
- Každá zmena je zaznamenaná v immutable audit logu (`lab_result_events`)
- Chybne zadané výsledky možno opraviť cez workflow "entered in error" → nový záznam s odkazom na pôvodný

### Section: Zobrazovacie metódy a AI analýza

**Personas:** veterinár, admin

**1. Nahratie snímku**
- Podporované formáty: JPG, PNG, WebP, DICOM (.dcm) do 10 MB
- DICOM súbory sú automaticky dekódované priamo v prehliadači s možnosťou úpravy jasu/kontrastu (Window/Level)

**2. AI analýza snímku**
- Podporované modality: RTG, CT, MRI, ultrasonografia, klinická fotografia
- AI model (VLM) poskytne štruktúrovaný popis nálezov v slovenčine alebo angličtine
- **UPOZORNENIE:** AI analýza je orientačná — každý nález musí byť potvrdený licencovaným veterinárnym lekárom
- Po schválení lekárom je možné nález vložiť do SOAP záznamu vizity

**3. Výpočet VHS (Vertebral Heart Score)**
- Zadajte rozmery srdca (dlhá os, krátka os) a dĺžku stavca T4
- Podpora pre plemenné špecifiká (13 plemien psov) a mačky
- Výsledok: VHS skóre + klinická interpretácia

**4. Chirurgický plán z AI nálezu**
- Na základe AI rádiologického nálezu systém vygeneruje predoperačný plán
- Automatický výpočet dávok anestetík podľa hmotnosti pacienta
- Príprava informovaného súhlasu majiteľa

### Cross-reference: AI imaging analysis in the AI Agent domain

Táto funkcionalita je detailne popísaná aj v doméne **AI Agent** (domain 11), keďže imaging analýza využíva rovnaký AI model a infraštruktúru ako AI asistent. Pozrite príslušnú sekciu v manuáli pre doménu AI Agent.