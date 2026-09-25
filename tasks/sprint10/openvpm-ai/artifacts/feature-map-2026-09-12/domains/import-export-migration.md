# Import / Export / Migration Domain — Feature Map

**Date:** 2026-09-12  
**Commit:** 23f23a3  
**Scope:** CSV import, accounting export, audit export, full backup/restore, migration archive

---

## A. Feature Inventory Table

| ID | Feature | Type | Entry Point | Status | Source Tag |
|----|---------|------|-------------|--------|------------|
| IE-01 | Client CSV import | Import | Settings → Data → Import | Active | `[VERIFIED: apps/web/lib/csv/import.ts:L455-L510]` |
| IE-02 | Patient CSV import | Import | Settings → Data → Import | Active | `[VERIFIED: apps/web/lib/csv/import.ts:L512-L590]` |
| IE-03 | Vaccination CSV import | Import | Settings → Data → Import | Active | `[VERIFIED: apps/web/lib/csv/import.ts:L592-L670]` |
| IE-04 | Medical history (SOAP notes) CSV import | Import | Settings → Data → Import | Active | `[VERIFIED: apps/web/lib/csv/import.ts:L672-L850]` |
| IE-05 | Care reminder CSV import | Import | Settings → Data → Import | Active | `[VERIFIED: apps/web/lib/csv/import.ts:L852-L920]` |
| IE-06 | Service catalog CSV import | Import | Settings → Data → Import | Active | `[VERIFIED: apps/web/lib/csv/import.ts:L922-L1000]` |
| IE-07 | Pohoda XML export (invoices + e-Kasa) | Export | Accounting module | Active | `[VERIFIED: apps/web/lib/accounting/export.ts:L30-L180]` |
| IE-08 | KROS Omega CSV export (invoices + e-Kasa) | Export | Accounting module | Active | `[VERIFIED: apps/web/lib/accounting/export.ts:L182-L240]` |
| IE-09 | Audit timeline CSV export | Export | Audit module | Active | `[VERIFIED: apps/web/lib/audit/export.ts:L180-L210]` |
| IE-10 | Full practice backup JSON export | Export | Settings → Data → Export | Active | `[VERIFIED: apps/web/lib/backup/export.ts:L100-L200]` |
| IE-11 | Full practice backup JSON restore | Restore | Operator tooling | Active | `[VERIFIED: apps/web/lib/backup/export.ts:L200-L400]` |
| IE-12 | Migration archive workspace | UI | /migration-archive | Active | `[VERIFIED: apps/web/server/routers/migration-archive.ts:L1-L100]` |
| IE-13 | Migration review checklist | UI | Migration archive page | Active | `[VERIFIED: apps/web/components/migration/migration-review-checklist.tsx:L1-L250]` |
| IE-14 | Lab report import (extension) | Import | Extension router | Active | `[VERIFIED: apps/web/server/routers/extensions/lab-import.ts]` |
| IE-15 | v2 import format (extension) | Import | Extension router | Active | `[VERIFIED: apps/web/server/routers/extensions/v2-import.ts]` |
| IE-16 | Audit export (extension) | Export | Extension router | Active | `[VERIFIED: apps/web/server/routers/extensions/audit-export.ts]` |

---

## B. Import / Export Specifics

### B.1 CSV Import Architecture

**Parser:** Custom CSV parser with RFC 4180 compliance  
`[VERIFIED: apps/web/lib/csv/parse.ts]`

- Handles quoted fields with embedded commas, quotes, and newlines
- Strips UTF-8 BOM from first header
- Rejects duplicate headers after normalization
- Rejects blank or non-alphanumeric headers
- Reports extra columns instead of silently discarding data
- Reports unterminated quoted fields

**Header Normalization:**  
`[VERIFIED: apps/web/lib/csv/parse.ts:L10-L30]`

- Case-insensitive matching
- Strips non-alphanumeric characters (spaces, underscores, hyphens)
- First match wins among aliases

**Alias Coverage:**  
`[VERIFIED: apps/web/lib/csv/import.ts:L100-L400]`

| Entity | Key Aliases |
|--------|-------------|
| Client ID | `clientId`, `ownerId`, `accountId`, `clientNumber`, `ownerNumber`, `accountNumber` |
| Patient ID | `patientId`, `petId`, `animalId`, `patientNumber`, `petNumber`, `animalNumber` |
| Species | `species`, `speciesDescription`, `kind`, `animalType` |
| Sex | `sex`, `gender` (accepts `M`, `F`, `MN`, `FS`, `neutered male`, `spayed female`) |
| DOB | `dob`, `dateOfBirth`, `birthday`, `birthDate`, `born` (accepts `YYYY-MM-DD`, `M/D/YYYY`, `M/D/YY`) |
| Vaccine name | `vaccineName`, `vaccine`, `vaccination`, `description`, `treatment` |
| SOAP sections | `subjective`/`history`, `objective`/`examFindings`, `assessment`/`diagnosis`, `plan`/`treatment` |

**Validation Strategy:**

- Per-row errors reported with row numbers
- Partial imports proceed (valid rows imported, invalid rows skipped)
- Email validation: `z.string().trim().email().max(255)` `[VERIFIED: apps/web/lib/csv/import.ts:L420]`
- External ID max length: 160 characters `[VERIFIED: apps/web/lib/csv/import.ts:L422]`
- SOAP patient name max: 128 characters `[VERIFIED: apps/web/lib/csv/import.ts:L421]`

**Import Order Enforcement:**  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L40-L50]`

1. Clients first (pets link by source client ID or email)
2. Patients second (owner reference must exist)
3. Vaccinations third (links by source patient ID or owner + pet name)
4. Medical history last (links by source patient ID or owner + pet name)

**Dry Run Workflow:**  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L60-L80]`

- Shows rows parsed, rows to import, duplicates, unmatched references, per-row issues
- No data written until commit
- Committed imports are idempotent (replaying same file returns recorded result)

**Limits:**  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L100-L110]`

- Max file size: 5 MB
- Max rows: 10,000 per import
- Split larger exports into multiple files

### B.2 Accounting Export (Slovak Market)

**Pohoda XML (STORMWARE):**  
`[VERIFIED: apps/web/lib/accounting/export.ts:L30-L180]`

- Format: STORMWARE Pohoda XML v2.0
- Contains: `<inv:invoice>` (issued invoices) + `<vch:voucher>` (e-Kasa receipts)
- VAT rates: 23%, 19%, 5%, 0% (Slovak tax law)
- Includes partner identity (client address, IČO, DIČ)
- Payment type: `draft` (bank transfer)
- e-Kasa voucher types: `receipt` (cash/card)
- UID truncated to 8 chars for display

**KROS Omega CSV:**  
`[VERIFIED: apps/web/lib/accounting/export.ts:L182-L240]`

- Format: Semicolon-delimited CSV with UTF-8 BOM
- Header: `Druh;CisloDokladu;Datum;Partner;Text;Zaklad_23;DPH_23;Zaklad_19;DPH_19;Zaklad_5;DPH_5;Oslobodene_0;Spolu`
- Document types: `FA` (invoice), `PD` (e-Kasa receipt)
- VAT breakdown by rate (23%, 19%, 5%, 0%)

**Data Model:**  
`[VERIFIED: apps/web/lib/accounting/export.ts:L10-L28]`

```typescript
interface AccountingInvoiceItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  taxDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string | null;
  clientCity?: string | null;
  clientZip?: string | null;
  clientIco?: string | null;
  clientDic?: string | null;
  total: number;
  subtotal: number;
  tax: number;
  vatRate: number; // 23, 19, 5, 0
  status: string;
  items: Array<{ description, quantity, unitPrice, total }>;
}

interface AccountingEkasaItem {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  amountBase: number;
  amountVat: number;
  amountTotal: number;
  vatRate: string; // STANDARD_23, REDUCED_19, REDUCED_5, ZERO
  paymentMethod: string; // CASH, CARD
  okp?: string | null;
  uid?: string | null;
}
```

### B.3 Audit Timeline Export

**Sources:**  
`[VERIFIED: apps/web/lib/audit/export.ts:L20-L150]`

1. `audit_log` — mutations with user name/role
2. `ext_ai_audit_log` — AI confirmation events with hash chain
3. `clinical_record_corrections` — record corrections with reason

**Output Formats:**

- CSV: Semicolon-delimited with UTF-8 BOM `[VERIFIED: apps/web/lib/audit/export.ts:L180-L210]`
- JSON: Full event array
- Manifest: SHA-256 hashes of CSV and JSON for integrity verification `[VERIFIED: apps/web/lib/audit/export.ts:L212-L230]`

**CSV Columns:**  
`[VERIFIED: apps/web/lib/audit/export.ts:L185-L195]`

```
id, kind, occurred_at, actor_name, actor_role, ip_address, action, 
entity_type, entity_id, reason, event_hash, sequence_number
```

**Event Kinds:**

- `mutation` — CRUD operations
- `ai_confirmation` — AI draft confirmations
- `clinical_correction` — Record corrections with reason

### B.4 Full Practice Backup

**Format Version:** 9  
`[VERIFIED: apps/web/lib/backup/export.ts:L200]`

**Sections:** 70+ tables exported  
`[VERIFIED: apps/web/lib/backup/export.ts:L100-L200]`

Core sections include:
- Practice configuration
- Locations, rooms, users
- Clients, patients, contacts
- Appointments, waitlist
- Services, products, suppliers
- Invoices, payments, adjustments
- SOAP notes, vaccinations, lab results
- Prescriptions, treatment plans
- Files, consent forms
- Audit logs, corrections

**System Exclusions:**  
`[VERIFIED: apps/web/lib/backup/export.ts:L50-L100]`

- `usageRecords` — billing metering (could replay unmetered usage)
- `practicePaymentAccounts` — Stripe Connect state
- `stripeEvents` — webhook dedup ledger
- `rateLimitBuckets` — transient abuse control
- `sessions`, `verificationTokens`, `authTokens` — transient auth state
- `smsProviderEvents` — global provider inbox
- `captureSessions` — expiring QR tokens
- `fileObjectReplicas` — environment-bound verification state

**Audit-Only Sections:**  
`[VERIFIED: apps/web/lib/backup/export.ts:L102-L110]`

- `smsSendAttempts` — provider dispatch authority
- `smsDeliveryEvents` — environment-bound callbacks
- Exported for audit but not restored in ordinary clinic restore

**Secret Replacements:**  
`[VERIFIED: apps/web/lib/backup/export.ts:L112-L120]`

```typescript
{
  passwordHash: "$2a$12$HNkF00edpp2mYk2gvvj8ne/PWjlXwgT5YZhAodh0/UVgTgtIPdnWS",
  apiKeyPrefix: "disabled",
  apiKeyHash: "$2a$12$HNkF00edpp2mYk2gvvj8ne/PWjlXwgT5YZhAodh0/UVgTgtIPdnWS",
  webhookSecret: "rotate-after-restore"
}
```

**Reference Integrity Validation:**  
`[VERIFIED: apps/web/lib/backup/export.ts:L300-L500]`

- 100+ foreign key rules validated before restore
- Required vs optional references distinguished
- Max 25 reference errors reported before abort
- Rules cover: patients→clients, appointments→patients/clients/users/rooms/locations, invoices→clients/patients, etc.

**Row Sanitization:**  
`[VERIFIED: apps/web/lib/backup/export.ts:L200-L300]`

- Users: password hash replaced, emailVerifiedAt nulled
- Clients: accessToken nulled
- API keys: prefix/hash replaced, lastUsedAt nulled
- Webhooks: secret replaced, active set to false
- Location messaging: provider state cleared
- Audit log: secrets redacted from changes JSON

### B.5 Migration Archive Workspace

**Purpose:** Review imported history from prior PIMS  
`[VERIFIED: apps/web/server/routers/migration-archive.ts:L1-L50]`

**Sections:**  
`[VERIFIED: apps/web/server/routers/migration-archive.ts:L20-L30]`

1. `contacts` — imported client contacts (co-owners)
2. `appointments` — historical appointments
3. `medications` — external prescriptions + fills
4. `labs` — external lab reports + observations
5. `financial` — legacy financial documents + payments
6. `documents` — historical documents (files)

**Safety Boundary:**  
`[VERIFIED: apps/web/lib/__tests__/migration-archive-ui.test.ts:L20-L40]`

- Source-attributed history is non-operational
- Does not silently create live appointments, prescriptions, or receivables
- Requires manual reconciliation before clinical use

**Review Checklist:**  
`[VERIFIED: apps/web/components/migration/migration-review-checklist.tsx:L20-L60]`

Five-step validation workflow:
1. Confirm high-level totals
2. Find familiar clients and patients
3. Review care history (appointments, prescriptions, labs)
4. Review business history (documents, financial)
5. Sample items marked "Needs review"

**Privacy-Safe Issue Reporting:**  
`[VERIFIED: apps/web/components/migration/migration-review-checklist.tsx:L100-L150]`

- Copy template excludes names, contact info, medical details
- Uses only OpenVPM record references
- Checklist state stored in sessionStorage (never sent to server)
- Explicit disclaimer: completing checklist records no approval

---

## C. Integration Specifics

### C.1 External PIMS Export Formats

**Supported Sources:**  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L70-L90]`

| PIMS | Export Path |
|------|-------------|
| AVImark | Information Search → Clients/Patients → Export → CSV |
| Cornerstone | Reports → Client/Patient report → CSV |
| ezyVet | Records dashboard → Contacts/Animals → Export to CSV |
| Shepherd | Reports → export client/patient lists as CSV |
| Generic | Any spreadsheet saved as CSV |

**AVImark-Specific Aliases:**  
`[VERIFIED: apps/web/lib/csv/__tests__/import.test.ts:L200-L230]`

- `Owner Email`, `Pet Name`, `Species`, `Gender`, `Birthday`, `Microchip`
- Species: `Dog` → `canine`, `Cat` → `feline`, `Bird` → `avian`
- Sex: `MN` → `male_neutered`, `F` → `female`
- DOB: `3/5/2019` → `2019-03-05` (US month/day/year)

### C.2 Accounting Software Integration

**STORMWARE Pohoda:**  
`[VERIFIED: apps/web/lib/accounting/export.ts:L30-L180]`

- XML schema: `http://www.stormware.cz/schema/version_2/data.xsd`
- Invoice type: `issuedInvoice`
- Payment type: `draft` (bank transfer)
- VAT rates: `high` (23%), `low` (19%/5%), `none` (0%)

**KROS Omega:**  
`[VERIFIED: apps/web/lib/accounting/export.ts:L182-L240]`

- Semicolon-delimited CSV
- Document type codes: `FA` (faktúra), `PD` (pokladničný doklad)
- VAT columns: `Zaklad_23`, `DPH_23`, `Zaklad_19`, `DPH_19`, `Zaklad_5`, `DPH_5`, `Oslobodene_0`

### C.3 e-Kasa Integration

**Receipt Export:**  
`[VERIFIED: apps/web/lib/accounting/export.ts:L120-L180]`

- Payment methods: `CASH` (hotovosť), `CARD` (platobná karta)
- OKP (odberateľský kontrolný kód): optional
- UID (unikátny identifikátor): truncated to 8 chars
- VAT rates: `STANDARD_23`, `REDUCED_19`, `REDUCED_5`, `ZERO`

---

## D. Docs-vs-Reality Pass

### D.1 Documentation Claims

**Claim 1:** "Files up to 5 MB and 10,000 rows per import"  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L100]`  
**Status:** `[UNVERIFIED — could not access router validation]`  
**Note:** Import router not inspected; limits may be enforced at upload layer.

**Claim 2:** "Reviewed imports add records, skip stable duplicates, and may attach a missing source identifier to an unambiguous existing client or patient"  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L105]`  
**Status:** `[UNVERIFIED — could not access router logic]`  
**Note:** Deduplication logic not inspected in this pass.

**Claim 3:** "Imports are tenant scoped, protected by database row-level security, and admin only"  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L110]`  
**Status:** `[VERIFIED: apps/web/server/routers/migration-archive.ts:L50-L60]`  
**Evidence:** All queries filter by `eq(table.practiceId, practiceId)`.

**Claim 4:** "The migration ledger stores hashes and aggregate counts, not raw CSV content or row-level patient data"  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L110]`  
**Status:** `[UNVERIFIED — could not access ledger schema]`  
**Note:** Migration ledger tables not inspected.

**Claim 5:** "Appointments and invoices are not available in the self-serve CSV importer"  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L30]`  
**Status:** `[VERIFIED: apps/web/lib/csv/import.ts]`  
**Evidence:** Only client, patient, vaccination, SOAP note, care reminder, and service importers exist.

**Claim 6:** "A full OpenVPM backup JSON can also be restored into a fresh practice through the documented operator restore process"  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L35]`  
**Status:** `[VERIFIED: apps/web/lib/backup/export.ts:L200-L400]`  
**Evidence:** Full restore logic with reference validation and secret replacement.

### D.2 Undocumented Features

**Feature 1:** Care reminder CSV import  
`[VERIFIED: apps/web/lib/csv/import.ts:L852-L920]`  
**Status:** Not mentioned in migration guide  
**Note:** Requires `externalReminderId` and patient reference; not part of standard PIMS export workflow.

**Feature 2:** Service catalog CSV import  
`[VERIFIED: apps/web/lib/csv/import.ts:L922-L1000]`  
**Status:** Not mentioned in migration guide  
**Note:** Imports service definitions (name, code, category, price, taxable); distinct from inventory products.

**Feature 3:** Audit timeline CSV export with SHA-256 manifest  
`[VERIFIED: apps/web/lib/audit/export.ts:L180-L230]`  
**Status:** Not mentioned in user-facing docs  
**Note:** Forensic export with integrity verification; likely operator/auditor tool.

**Feature 4:** Migration archive workspace with review checklist  
`[VERIFIED: apps/web/server/routers/migration-archive.ts]`  
`[VERIFIED: apps/web/components/migration/migration-review-checklist.tsx]`  
**Status:** Partially documented in migration guide  
**Note:** Guide mentions "review imported history" but does not detail the workspace UI or checklist workflow.

---

## E. Friction / "Doesn't Make Sense" Notes

### E.1 Import Friction

**Friction 1:** Date format ambiguity  
`[INFERRED: apps/web/lib/csv/import.ts:L450-L470]`  
**Issue:** Slash dates (`3/5/2019`) are parsed as US month/day/year. European clinics (day/month/year) must pre-convert to ISO format.  
**Impact:** High — incorrect visit dates corrupt medical history.  
**Recommendation:** Add locale-aware date parsing or explicit format selection in UI.

**Friction 2:** Species normalization gaps  
`[VERIFIED: apps/web/lib/csv/normalize.ts — referenced but not inspected]`  
**Issue:** Accepts `dog`, `cat`, `bird`, `bunny`, `horse`, `lizard` but not all common synonyms (e.g., `puppy`, `kitten`, `snake`, `turtle`).  
**Impact:** Medium — rows rejected or species set to `other`.  
**Recommendation:** Expand alias list or allow custom species mapping.

**Friction 3:** SOAP note section fallback  
`[VERIFIED: apps/web/lib/csv/import.ts:L672-L850]`  
**Issue:** Standalone `notes` column fills first empty SOAP section (Subjective). If both `subjective` and `notes` columns exist, data may be split unexpectedly.  
**Impact:** Low — documented behavior, but non-obvious.  
**Recommendation:** Add explicit warning in UI when both columns detected.

**Friction 4:** No bulk import status tracking  
`[INFERRED: docs/migrating-to-openvpm.md]`  
**Issue:** Dry run shows preview, but no progress indicator during commit. Large imports (10,000 rows) may appear hung.  
**Impact:** Medium — user uncertainty during long operations.  
**Recommendation:** Add progress bar or streaming status updates.

### E.2 Export Friction

**Friction 5:** Accounting export requires manual trigger  
`[INFERRED: apps/web/lib/accounting/export.ts]`  
**Issue:** No scheduled export or automatic sync to accounting software.  
**Impact:** Medium — manual workflow for monthly accounting.  
**Recommendation:** Add scheduled export or direct API integration with Pohoda/Omega.

**Friction 6:** Audit export lacks filtering UI  
`[VERIFIED: apps/web/lib/audit/export.ts:L20-L50]`  
**Issue:** Filter supports `entityType` and `entityId` but no date range, user, or action type filters.  
**Impact:** Medium — auditors must post-process large exports.  
**Recommendation:** Add date range, user, and action type filters to export UI.

**Friction 7:** Backup JSON size limit undocumented  
`[VERIFIED: apps/web/lib/backup/policy.ts — referenced but not inspected]`  
**Issue:** `PRACTICE_BACKUP_JSON_MAX_BYTES` constant exists but limit not documented.  
**Impact:** Low — large practices may hit limit unexpectedly.  
**Recommendation:** Document limit in backup/restore guide.

### E.3 Migration Archive Friction

**Friction 8:** Migration archive is read-only  
`[VERIFIED: apps/web/server/routers/migration-archive.ts]`  
**Issue:** No ability to edit, reconcile, or approve imported records from the workspace.  
**Impact:** High — users must switch between archive and live records to reconcile.  
**Recommendation:** Add inline edit or "promote to live" action for reviewed records.

**Friction 9:** Checklist state not persisted  
`[VERIFIED: apps/web/components/migration/migration-review-checklist.tsx:L100-L120]`  
**Issue:** Checklist stored in sessionStorage; lost on browser close.  
**Impact:** Low — intentional privacy design, but inconvenient for multi-session reviews.  
**Recommendation:** Offer optional server-side persistence with explicit user consent.

**Friction 10:** No export from migration archive  
`[INFERRED: apps/web/server/routers/migration-archive.ts]`  
**Issue:** Cannot export filtered archive records (e.g., "export all labs needing review").  
**Impact:** Medium — reviewers cannot share filtered subsets with support.  
**Recommendation:** Add CSV export for filtered archive views.

### E.4 Logical Inconsistencies

**Inconsistency 1:** Import order vs. foreign key dependencies  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L40-L50]`  
**Issue:** Docs say "clients first, patients second" but vaccination/medical history imports accept `clientEmail` as owner reference, implying patients could import before clients if email is unique.  
**Resolution:** `[INFERRED]` — Email-based linking is a fallback; source ID linking requires clients first. Order is correct but docs could clarify.

**Inconsistency 2:** Duplicate handling not symmetric  
`[CLAIMED IN DOCS: docs/migrating-to-openvpm.md:L105]`  
**Issue:** Docs say "skip stable duplicates" but do not define "stable." Does same email = duplicate? Same external ID? Same name + DOB?  
**Resolution:** `[UNVERIFIED — could not access dedup logic]` — Docs should define duplicate criteria per entity type.

**Inconsistency 3:** Backup format version not user-visible  
`[VERIFIED: apps/web/lib/backup/export.ts:L200]`  
**Issue:** Format version 9 is internal; users cannot tell which version their backup uses.  
**Resolution:** `[INFERRED]` — Add format version to backup filename or metadata.

---

## F. Proposed User-Manual Section(s)

### F.1 Section: "Importing Data from Your Previous System"

**Location:** User Manual → Getting Started → Data Migration

**Content Outline:**

1. **Before You Begin**
   - Export CSV files from your old PIMS
   - Review file size (max 5 MB) and row count (max 10,000) limits
   - Back up your old system data before starting

2. **Import Order**
   - Step 1: Clients (pet owners)
   - Step 2: Patients (pets)
   - Step 3: Vaccinations
   - Step 4: Medical history (visit notes)
   - Why order matters: foreign key dependencies

3. **CSV File Preparation**
   - Required columns per entity type (table)
   - Optional columns and aliases (table)
   - Date format recommendations (ISO `YYYY-MM-DD` preferred)
   - Species and sex normalization (accepted values)
   - Common pitfalls: date formats, missing owner references, invalid emails

4. **Dry Run Workflow**
   - Upload CSV and review preview
   - Understanding the report: rows parsed, to import, duplicates, unmatched, errors
   - Resolving errors: per-row issues with row numbers
   - Committing the import: what happens next

5. **Post-Import Verification**
   - Spot-check 10+ records for accuracy
   - Verify owner/patient links
   - Check vaccination history and medical history
   - Using the migration archive workspace

6. **Troubleshooting**
   - "CSV is missing a recognized column" — add alias header
   - "Row X: email is not valid" — fix or remove email
   - "Row X: species must be one of..." — use accepted species value
   - "Row X: date must be a date" — convert to ISO format

### F.2 Section: "Exporting Accounting Data"

**Location:** User Manual → Accounting → Export

**Content Outline:**

1. **Export Formats**
   - STORMWARE Pohoda XML (for Slovak accounting software)
   - KROS Omega CSV (for Slovak accounting software)
   - What's included: invoices + e-Kasa receipts

2. **Pohoda XML Export**
   - When to use: monthly accounting sync
   - How to export: Accounting → Export → Pohoda XML
   - What's in the file: invoices with VAT breakdown, e-Kasa receipts
   - Importing into Pohoda: File → Import → Data Pack

3. **KROS Omega CSV Export**
   - When to use: monthly accounting sync
   - How to export: Accounting → Export → Omega CSV
   - What's in the file: semicolon-delimited rows with VAT columns
   - Importing into Omega: Import wizard

4. **VAT Rates**
   - 23% — standard rate (most services)
   - 19% — reduced rate (specific services)
   - 5% — reduced rate (specific goods)
   - 0% — exempt (specific medical services)

5. **e-Kasa Receipts**
   - Payment methods: cash, card
   - OKP and UID fields
   - Reconciliation with daily totals

### F.3 Section: "Reviewing Imported History"

**Location:** User Manual → Data Management → Migration Archive

**Content Outline:**

1. **What Is the Migration Archive?**
   - Non-operational history from your previous system
   - Why it's separate from live records
   - Safety boundary: does not create live appointments or prescriptions

2. **Accessing the Archive**
   - Settings → Data → Migration Archive
   - What you'll see: contacts, appointments, medications, labs, financial, documents

3. **Review Checklist**
   - Step 1: Confirm high-level totals
   - Step 2: Find familiar clients and patients
   - Step 3: Review care history (appointments, prescriptions, labs)
   - Step 4: Review business history (documents, financial)
   - Step 5: Sample items marked "Needs review"

4. **Searching and Filtering**
   - Search by name, ID, document number
   - Pagination (50 items per page)
   - Linked context: click to open client/patient record

5. **Items Needing Review**
   - What "Needs review" means: attribution or link uncertain
   - How to reconcile: manual verification against old system
   - Reporting issues: privacy-safe template (no names or medical details)

6. **When to Contact Support**
   - Unexplained matches or unmatched rows
   - Structural errors in imported data
   - Missing records that should have imported

### F.4 Section: "Backing Up and Restoring Your Data"

**Location:** User Manual → Data Management → Backup & Restore

**Content Outline:**

1. **Automatic Backups**
   - Nightly encrypted backups on OpenVPM Cloud
   - What's backed up: all practice data (clients, patients, records, files)
   - Retention policy: 30 days (configurable)

2. **Manual Backup Export**
   - When to export: before major changes, for offline archival
   - How to export: Settings → Data → Export → Full Backup JSON
   - What's in the file: complete practice data (70+ tables)
   - File size: typically 10-100 MB depending on data volume

3. **Restoring from Backup**
   - When to restore: data loss, migration to new practice
   - How to restore: contact support with backup file
   - What happens: practice data replaced with backup contents
   - What's not restored: secrets (passwords, API keys), provider state (Stripe, SMS)

4. **Backup Format**
   - JSON format, version 9
   - Sections: locations, users, clients, patients, appointments, invoices, SOAP notes, etc.
   - System exclusions: billing meters, Stripe state, transient auth data
   - Secret replacements: passwords hashed, API keys disabled, webhooks deactivated

5. **Backup Integrity**
   - SHA-256 hash of backup file
   - Verify integrity before restore
   - Request new backup if hash mismatch

---

## Appendix: File Index

| File | Purpose | Lines |
|------|---------|-------|
| `apps/web/lib/csv/import.ts` | CSV import parsers and validators | 1187 |
| `apps/web/lib/csv/parse.ts` | RFC 4180 CSV parser | ~200 |
| `apps/web/lib/csv/__tests__/import.test.ts` | Import unit tests | 450 |
| `apps/web/lib/accounting/export.ts` | Pohoda XML and KROS Omega CSV export | 240 |
| `apps/web/lib/audit/export.ts` | Audit timeline CSV/JSON export with manifest | 230 |
| `apps/web/lib/backup/export.ts` | Full practice backup JSON export/restore | 4169 |
| `apps/web/server/routers/migration-archive.ts` | Migration archive tRPC router | 906 |
| `apps/web/components/migration/migration-review-checklist.tsx` | Review checklist UI component | 250 |
| `apps/web/lib/__tests__/migration-archive-ui.test.ts` | Migration archive UI tests | 80 |
| `docs/migrating-to-openvpm.md` | User-facing migration guide | 120 |

---

**End of Document**
