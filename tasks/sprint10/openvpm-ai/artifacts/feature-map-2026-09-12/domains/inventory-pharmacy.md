# Domain: Inventory & Pharmacy
Commit: `23f23a3`

---

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| Product catalog (CRUD) | `inventoryRouter.list/create/update` | admin, veterinarian, technician, front_desk | `products` | **Live** | [VERIFIED: apps/web/server/routers/inventory.ts:187-298] |
| Stock tracking start (explicit opening qty) | `inventoryRouter.startTracking` | admin, veterinarian, technician, front_desk | `products` (flips `inventoryTracked=true`) | **Live** | [VERIFIED: apps/web/server/routers/inventory.ts:300-340] |
| Stock adjustment (± with reason) | `inventoryRouter.adjustStock` | admin, veterinarian, technician, front_desk | `products` (atomic `stockQuantity ± n`) | **Live** | [VERIFIED: apps/web/server/routers/inventory.ts:342-427] |
| Supplier directory (CRUD) | `inventoryRouter.listSuppliers/createSupplier/updateSupplier` | admin, veterinarian, technician, front_desk | `suppliers` | **Live** | [VERIFIED: apps/web/server/routers/inventory.ts:429-562] |
| Low-stock & expiry alerts | `inventoryRouter.list` with `alert` filter + `lib/inventory/alerts.ts` | All authenticated | `products` (computed columns: `stockStatus`, `expirationStatus`, `needsAttention`) | **Live** | [VERIFIED: apps/web/server/routers/inventory.ts:196-260; apps/web/lib/inventory/alerts.ts:1-87] |
| Lot/batch tracking | `products.lotNumber` field + create/update/startTracking | admin, vet, tech, front_desk | `products` | **Live** | [VERIFIED: packages/db/schema/billing.ts:339] |
| Expiration date tracking | `products.expirationDate` field + 90-day window alerts | All authenticated | `products` | **Live** | [VERIFIED: packages/db/schema/billing.ts:340; apps/web/lib/inventory/alerts.ts:62-70] |
| Controlled substances log (DEA Schedule II-V) | `controlledSubstancesRouter.create/list/summary` | admin, veterinarian (create); all authenticated (list/summary) | `controlled_substance_log` | **Live** | [VERIFIED: apps/web/server/routers/controlled-substances.ts:382-560] |
| Witness-required wasting | `controlledSubstancesRouter.create` — rejects `action="wasted"` without `witnessedBy` | admin, veterinarian | `controlled_substance_log` | **Live** | [VERIFIED: apps/web/server/routers/controlled-substances.ts:459-463] |
| Controlled substance ledger balance | `assertControlledSubstanceBalance` with `pg_advisory_xact_lock` | admin, veterinarian | `controlled_substance_log` (aggregated per practice+drug+unit) | **Live** | [VERIFIED: apps/web/server/routers/controlled-substances.ts:281-318, 169-180] |
| Witness roster lookup | `controlledSubstancesRouter.listWitnesses` | admin, veterinarian | `users` (active practice members) | **Live** | [VERIFIED: apps/web/server/routers/controlled-substances.ts:388-403] |
| Drug dosing calculator (formulary) | `dosingRouter.formulary/calculate` | All authenticated | None (pure computation against static `FORMULARY`) | **Live** | [VERIFIED: apps/web/server/routers/dosing.ts:23-63] |
| Drug dosing (AI agent tool) | `calculate_drug_dose` agent tool | admin, veterinarian, technician | None (wraps `calculateDose()` from `lib/dosing`) | **Live** | [VERIFIED: apps/web/lib/agent/tools.ts:861-906] |
| Dispensing → stock deduction | `computeStockDeductions()` in `lib/inventory/dispense.ts` | N/A (pure function called by checkout/visit closeout) | `products` (decremented by caller) | **Live** | [VERIFIED: apps/web/lib/inventory/dispense.ts:1-31] |
| Wholesaler delivery-note parser | `parseWholesalerDeliveryNote()` in `lib/inventory/wholesaler-import.ts` | N/A (pure library, no tRPC endpoint) | None (returns typed `WholesalerDeliveryNote`) | **Library only — not wired to any server route** | [VERIFIED: apps/web/lib/inventory/wholesaler-import.ts:1-418; CONFIRMED ABSENT: no `wholesaler` or `deliveryNote` in any server router] |
| Inventory CSV export | Not found | — | — | **Not implemented** | [VERIFIED: data.ts exports only clients/patients/appointments/invoices — no product/inventory export; apps/web/server/__tests__/data-export.test.ts has no product/inventory references] |

---

## B. Import/Export specifics

### B.1 Wholesaler delivery-note import — parser-only, dry-run claim

**ROADMAP claim:** `[x] Veľkoobchody liečiv: elektronický import dodacích listov so šaržami a expiráciami od Cymedica SK, Pharmos a.s., Samohýl SK a Henry Schein SK.` [CLAIMED IN DOCS: ROADMAP.md:30]

**Reality:** The parser library exists at `apps/web/lib/inventory/wholesaler-import.ts` (418 LoC) supporting **10 wholesalers**: Cymedica, Pharmos, Samohýl, Henry Schein, Biopharm, Komvet, SG-Vet (XML!), Sanvet, Phramed, and a GENERIC_CSV fallback. It includes auto-detection from content/filename, Slovak decimal comma support (`14,50` → `14.50`), DD.MM.YYYY date parsing, and XML parsing for SG-Vet (via regex, server-safe — no DOM).

However, **there is zero server-side wiring**:
- No tRPC endpoint for uploading/parsing delivery notes [VERIFIED: grep for `wholesaler|deliveryNote|parseWholesaler` in `apps/web/server/` returns zero results]
- No import button in the inventory dashboard page [VERIFIED: apps/web/app/(dashboard)/inventory/page.tsx contains no import/upload/wholesale references except a tooltip about "imported source stock"]
- No mutation that creates products from parsed `WholesalerDeliveryNote` items
- The `products` table has import-ready columns (`externalSource`, `externalId`, `importFingerprint` with SHA-256 constraint and unique index) [VERIFIED: packages/db/schema/billing.ts:341-343, 375-396] — but no code feeds these columns from the parser

**Verdict:** The ROADMAP checkbox overstates completion. The parser is a well-tested pure library (`apps/web/lib/inventory/__tests__/wholesaler-import.test.ts` has 10 parser-specific test cases covering all wholesalers including SG-Vet XML, decimal comma parsing, EAN barcodes, and multi-line delivery notes [VERIFIED: apps/web/lib/inventory/__tests__/wholesaler-import.test.ts:1-193]) but is **not integrated into any user-facing workflow**.

### B.2 Inventory CSV export — absent

No dedicated product/inventory CSV export exists. The `dataRouter` exports clients, patients, appointments, and invoices — but not products [VERIFIED: apps/web/server/routers/data.ts:2554-2614 shows `exportFullBackup`, `exportClients`, `exportPatients`, `exportAppointments`, `exportInvoices` — no `exportProducts`]. Products are only captured in the full practice JSON backup (`exportFullBackup` → `exportPracticeData()`).

### B.3 Import pipeline for product migration

The `lib/import/` directory contains a comprehensive migration pipeline (`shepherd-product-adapter.ts`, `product-import.ts`, etc.) for importing from legacy PIMS, but this is a **migration tool**, not ongoing inventory import [VERIFIED: apps/web/lib/import/ directory listing — 37 files covering shepherd and vetsoftware-v2 adapters].

---

## C. Integration specifics

### C.1 Wholesaler integrations — parser-only, no API

All 10 wholesaler "integrations" are **file-format parsers only**. There are:
- No REST/SOAP API calls to any wholesaler
- No EDI/XML upload endpoints
- No scheduled fetch cron jobs
- No live inventory sync with supplier systems

The parser supports:
| Wholesaler | Format | Detection | Batch/Expiry | EAN | Source tag |
|---|---|---|---|---|---|
| Cymedica SK | CSV (`;` delimiter) | Content + filename | ✓ | — | [VERIFIED: wholesaler-import.ts:117-182] |
| Pharmos a.s. | CSV (`;` delimiter) | Content + filename | ✓ | — | [VERIFIED: wholesaler-import.ts:184-225] |
| Samohýl SK | CSV (`;` delimiter) | Content + filename | — | ✓ | [VERIFIED: wholesaler-import.ts:227-263] |
| Henry Schein SK | CSV | Content + filename | — | — | [VERIFIED: wholesaler-import.ts:265-302] |
| Biopharm | CSV (standard layout) | Content | ✓ | — | [VERIFIED: wholesaler-import.ts:341-343] |
| Komvet | Tab-delimited TXT | Content | ✓ | — | [VERIFIED: wholesaler-import.ts:345-350] |
| SG-Vet | **XML** (regex-based, server-safe) | Content | ✓ | — | [VERIFIED: wholesaler-import.ts:354-408] |
| Sanvet | CSV (standard layout) | Content | ✓ | — | [VERIFIED: wholesaler-import.ts:410-412] |
| Phramed | CSV (standard layout) | Content | ✓ | — | [VERIFIED: wholesaler-import.ts:414-416] |
| Generic CSV | CSV (configurable) | Fallback | — | — | [VERIFIED: wholesaler-import.ts:418-457] |

All parsers use `parseSlovakNumber()` for comma-decimal support and `parseDate()` for DD.MM.YYYY→YYYY-MM-DD normalization [VERIFIED: wholesaler-import.ts:72-83, 459-470].

### C.2 ROADMAP cross-reference on pharmacy integrations

From ROADMAP.md v0.6 "Pilot-Ready":
- `[x] Veľkoobchody liečiv` — checkbox implies complete, but as documented above, this is parser-only with no server endpoint.
- `[x] In-house analyzátory` — IDEXX Catalyst/ProCyte, Fuji Dri-Chem NX500, Mindray BC-Vet parser exists (`lib/lab/analyzer-parser.ts`), same pattern: parser library without live API integration [VERIFIED: ROADMAP.md:30-31; apps/web/lib/lab/analyzer-parser.ts:309]
- `[x] Dávkovacia kalkulačka liečiv` — fully functional, pure algorithmic, validated by extensive tests [VERIFIED: apps/web/lib/dosing/__tests__/calculator.test.ts]

### C.3 Dispense-to-inventory bridge

When a visit prescription is finalized during encounter closeout, `computeStockDeductions()` aggregates prescription line items by product ID and the caller performs the actual `adjustStock` decrements. This is a pure library function — the integration point is in the encounter closeout/checkout flow [VERIFIED: apps/web/lib/inventory/dispense.ts:1-31; INFERRED: dispatch point is in encounter/visit closeout based on `apps/web/lib/encounters/visit-completion.ts:20`].

---

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| ROADMAP: "Veľkoobchody liečiv: elektronický import dodacích listov … od Cymedica SK, Pharmos a.s., Samohýl SK a Henry Schein SK" — checkbox `[x]` (done) | **Overstated.** Parser library exists with full test coverage for all 4 named wholesalers + 6 others, but zero server wiring, zero UI integration. The `products` table schema has import columns ready but no code feeds them. | [VERIFIED: apps/web/lib/inventory/wholesaler-import.ts exists; CONFIRMED ABSENT: no tRPC endpoint, no UI button, no server-side usage] |
| ROADMAP: "Dávkovacia kalkulačka liečiv s kontrolou maximálnych dávok a druhovej toxicity (paracetamol mačky, ivermektín kólie)" | **Accurate for architecture but formulary coverage is starter-only.** Formulary has 8 drugs (maropitant, carprofen, meloxicam, gabapentin, metronidazole, amoxicillin-clavulanate, famotidine, oclacitinib). No paracetamol or ivermectin entries exist in the live formulary — those species-toxicity checks are in the *agent tool* `check_drug_safety` (separate from dosing calculator). | [VERIFIED: apps/web/lib/dosing/formulary.ts:57-139 (8 drugs); apps/web/lib/agent/tools.ts:1260-1442 (`checkDrugSafetyTool` — separate tool)] |
| UX analysis: "Controlled-substance wasting strictly requires and validates a co-worker witness at both API and UI layers" | **Confirmed.** API: `controlledSubstancesRouter.create` rejects `action="wasted"` without `witnessedBy` with `TRPCError("Controlled substance waste requires a witness.")`. UI: `canSubmit` gate disables the submit button when `form.action === "wasted" && !form.witnessedBy`. Witness must be active practice member (`assertWitnessBelongsToPractice`). | [VERIFIED: apps/web/server/routers/controlled-substances.ts:459-463, 482-484; apps/web/lib/__tests__/controlled-substances-ui.test.ts:56-104] |
| UX analysis: "The form disables the submit button if form.action === 'wasted' and no witness is selected" | **Confirmed with nuance.** The UI also fails closed when the witness query returns no data: `"Witness lookup returned no data. Please retry before recording wasted inventory."` and `"Witness lookup is unavailable. Please retry."` | [VERIFIED: apps/web/lib/__tests__/controlled-substances-ui.test.ts:75-104] |
| Inventory page tooltip: "Imported source stock and lots are not assumed." (line 616) | **Reveals design intent.** The `startTracking` mutation requires explicit review of opening quantity before stock adjustments are allowed — but the "imported source" referenced in the tooltip has no UI path to arrive at the system. | [VERIFIED: apps/web/app/(dashboard)/inventory/page.tsx:616; apps/web/server/routers/inventory.ts:300-340] |
| Schema: `products` table has `externalSource`, `externalId`, `importFingerprint` with uniqueness constraints | **Infrastructure exists but unused.** No code writes to these columns. The SHA-256 fingerprint constraint and unique index per practice are ready for deduplication but never exercised. | [VERIFIED: packages/db/schema/billing.ts:341-343, 375-396] |

---

## E. Friction notes

### E.1 Controlled substances witness enforcement — API + UI still match UX analysis

The UX analysis (2026-09-11, commit `e927ef5`) documented that:
- API requires witness for `"wasted"` action [VERIFIED: controlled-substances.ts:459-463]
- UI computes `canSubmit` with `form.action !== "wasted" || Boolean(form.witnessedBy)` [VERIFIED: controlled-substances-ui.test.ts:56]
- UI fails closed when witness/parent lookups return no data [VERIFIED: controlled-substances-ui.test.ts:75-104]

**All these checks still hold at commit `23f23a3`.** Additionally, `controlledSubstanceWitnessError()` in `lib/controlled-substances/policy.ts` provides a Slovak regulatory message for both `administered` and `wasted` actions [VERIFIED: apps/web/lib/controlled-substances/policy.ts:47-56], though the server-side only enforces `"wasted"` — `"administered"` requires a patient but not a witness.

**Friction:** The policy function `controlledSubstanceWitnessError` says witness is required for both `administered` AND `wasted` (citing Zákon č. 139/1998 Z. z.), but the server only enforces it for `"wasted"`. This is a potential regulatory gap — Slovak law may require dual-signature for administration as well. [INFERRED: discrepancy between `controlled-substances/policy.ts:52` and `controlled-substances.ts:459-463`]

### E.2 Dosing calculator — dual entry points, standalone + AI agent

The dosing calculator has two access paths:

1. **tRPC router** (`dosingRouter.calculate`) — direct UI consumption, available to all authenticated users [VERIFIED: apps/web/server/routers/dosing.ts:39-63]
2. **AI agent tool** (`calculate_drug_dose`) — restricted to admin/veterinarian/technician roles, invokes the same `calculateDose()` pure function [VERIFIED: apps/web/lib/agent/tools.ts:861-906]

Both call the same `lib/dosing/calculator.ts:calculateDose()` function. The difference is:
- tRPC router: role-gated only by `protectedProcedure` (any authenticated user)
- Agent tool: additionally gated to `["admin", "veterinarian", "technician"]` with a Slovak message: `"Kalkulácia dávkovania liečiv je vyhradená pre klinický personál."`

**Friction:** The tRPC router is less restrictive than the agent tool. A front_desk user can calculate doses via the tRPC router but not via the AI agent. This asymmetry may be intentional (front desk may need to look up reference ranges for client questions) but is not documented. [INFERRED]

### E.3 Wholesaler import — parser exists, no integration

The parsing library is robust (10 wholesalers, XML support, Slovak number/date normalization, 10+ test cases) but completely disconnected from the application. This creates a misleading ROADMAP signal and unused schema infrastructure:

- `products.externalSource`, `products.externalId`, `products.importFingerprint` columns exist with constraints but are never populated [VERIFIED: packages/db/schema/billing.ts:341-343]
- `products` table has `importIdentityCheck` and `importFingerprintCheck` CHECK constraints and unique indexes — ready for deduplication [VERIFIED: packages/db/schema/billing.ts:387-396]
- The inventory page tooltip references "imported source stock" suggesting the feature is expected by users [VERIFIED: apps/web/app/(dashboard)/inventory/page.tsx:616]

### E.4 No inventory CSV export

Unlike clients, patients, appointments, and invoices — which all have dedicated CSV export endpoints — inventory/products have no export capability. The only way to extract product data is via the full JSON practice backup (`exportFullBackup`). This is a gap for practices that want to reconcile inventory in spreadsheets or share product catalogs. [VERIFIED: apps/web/server/routers/data.ts:2557-2614 — no `exportProducts`; apps/web/server/__tests__/data-export.test.ts — no inventory/product references]

### E.5 Products and billing share the same table

The `products` table in `billing.ts` serves dual purpose: it is both the **inventory catalog** and the **billable services/products catalog**. Products with `inventoryTracked=false` skip stock tracking but remain sellable (the CHECK constraint enforces `stockQuantity=0` and null lot/expiry when not tracked). This is a pragmatic design but means "inventory" and "service catalog" are the same entity from a data-model perspective. [VERIFIED: packages/db/schema/billing.ts:393-399]

---

## F. Proposed user-manual section(s)

### F.1 Personas

| Persona | Relevance | Key workflows |
|---|---|---|
| Veterinarian | High | Controlled substance wasting (witness co-sign), drug dose calculation, stock consumption during visits |
| Technician | High | Stock adjustments (cycle counts), dispensing, controlled substance administration, low-stock alerts |
| Admin / Practice Manager | High | Supplier management, product catalog pricing, reorder point configuration, inventory audit |
| Front Desk | Medium | Product lookup for client billing, basic stock visibility |
| Viewer | Read-only | Can view product catalog, stock levels, and controlled substance log; all mutations blocked |

### F.2 Product & stock management — user-facing documentation outline

```
## Inventory → Products
- View all products with search (name/SKU), category filter, and alert filter
- Alert dashboard cards: Needs Attention, Low Stock, Expired, Expiring Soon
- Add product: name, SKU, category (medication/preventive/supplement/food/supply), unit price, cost price, taxable toggle, opening stock, reorder point, lot number, expiration date
- Edit product: inline row editing with validation
- Adjust stock: +/− with reason (cycle count, dispensed, damaged, received)
- Start tracking: required when importing products without reviewed opening quantities
- Price per unit = per dispensing unit (per tablet, per ml, per vial), not per package
```

### F.3 Controlled substances — regulatory-precision reference

```
## Controlled Substances Log (/controlled-substances)

### Regulatory basis
- Slovak Law No. 139/1998 Z. z. on narcotic and psychotropic substances
- Decree of the Ministry of Health of the Slovak Republic
- DEA Schedule classification: II, III, IV, V

### Key concepts
- **4 actions:** Received, Administered, Wasted, Returned
- **Ledger balance:** Received + Returned − Administered − Wasted (per practice, per drug name + unit)
- **Witness requirement:** Wasting (likvidácia) requires a second qualified staff member (veterinarian or technician) present as witness. The system enforces this at both the server and UI:
  - Server rejects `action="wasted"` without `witnessedBy` UUID
  - UI disables submit button until a witness is selected
  - Witness must be an active member of the same practice
  - If the witness list fails to load, the form fails closed with an error message
- **Patient requirement:** Administering requires a patient selection
- **Balance enforcement:** Consuming actions (administered, wasted, returned) are validated against the current ledger balance with a PostgreSQL advisory lock to prevent race conditions
- **Audit trail:** All entries are immutable (no update endpoint — create-only with soft delete). Timestamps stored with timezone per practice settings.

### Workflow: Wasting a controlled substance
1. Select action "Wasted"
2. Select drug name, DEA schedule, quantity, unit
3. Select a witness from the practice staff list (must be loaded successfully)
4. Optional: lot number, notes, performed-at timestamp
5. Submit — validated for witness presence, balance sufficiency, practice membership

### Workflow: Receiving a controlled substance
1. Select action "Received"
2. Enter drug name, DEA schedule, quantity, unit
3. No witness required for receipt
4. Submit — increments the ledger balance

### Viewing the log
- Filter by drug name, date range
- Paginated entries with performer and witness attribution
- Summary view aggregates by drug + unit showing received/administered/wasted/returned totals
```

### F.4 Drug dosing calculator — user-facing documentation outline

```
## Drug Dosing Calculator

### Disclaimer
⚠️ Reference ranges only. Verify every dose against a current veterinary drug reference
and the patient's full clinical picture before prescribing.

### Using the calculator
1. Select drug from formulary (8 drugs: maropitant, carprofen, meloxicam, gabapentin, metronidazole, amoxicillin-clavulanate, famotidine, oclacitinib)
2. Select species (canine/feline)
3. Enter weight in kg (max 200 kg)
4. Optional: concentration in mg/mL for liquid/injectable volume calculation
5. Result shows:
   - Dose range (mg/kg low–high)
   - Total dose range in mg
   - Administration route and frequency
   - Liquid volume range (if concentration provided)
   - Tablet suggestions (¼-tablet precision, nearest quarter)
   - Warnings (species-specific, max single dose caps, drug-specific cautions)

### Limitations
- Only dogs and cats are supported
- 8 starter formulary drugs — does not include all veterinary medications
- Paracetamol/ivermectin toxicity checks are in the separate AI Drug Safety Check tool, not the basic calculator
- Always consult Plumb's Veterinary Drug Handbook or equivalent for comprehensive guidance
```

### F.5 Wholesaler delivery note import — pending integration

```
## Importing Wholesaler Delivery Notes (Coming Soon)

The system includes a parser for 10 Slovak veterinary wholesalers:
- Cymedica SK, Pharmos a.s., Samohýl SK, Henry Schein SK
- Biopharm, Komvet, SG-Vet (XML), Sanvet, Phramed
- Generic CSV fallback

The parser handles:
- Batch/lot numbers and expiration dates
- EAN barcodes (Samohýl)
- Slovak number format (decimal comma)
- DD.MM.YYYY date format
- SG-Vet XML delivery notes

⚠️ This feature is parser-only at present. Server-side upload and product creation from parsed
delivery notes is planned but not yet implemented. Products imported from wholesaler delivery
notes will require explicit stock review (startTracking) before adjustments can be recorded.
```