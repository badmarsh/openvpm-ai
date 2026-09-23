# Inventory and wholesaler imports

## Behaviour

- The inventory table uses compact, tabular numeric cells, stock badges and a warning for expiry within fewer than 30 days. Server-side search covers name, SKU, barcode and stored active substance; category, supplier and below-minimum filters apply before pagination.
- Matching prefers exact supplier code/SKU/barcode, then accent/case/whitespace-normalized exact names. Ambiguous matches require an explicit selection; strength/pack differences are not fuzzy-matched.
- PDF uploads are limited to 5 MB and 100 pages. Password-protected, corrupt, image-only and empty invoices have localized errors. Every PDF loading task is destroyed in `finally`, including failure before the document loads; pages are cleaned individually.
- Category markup presets are 30% for medicines and 50% for supplies. Editable VAT includes 0/5/19/23% and historical rates. Missing generic VAT defaults to 23%; source-specific reduced-rate assumptions must still be reviewed. Catalog selling prices remain **net**; the import shows an immediately recalculated gross preview. This does not change billing's existing practice-level tax policy.
- A successful receipt atomically saves stock, metadata, pending controlled-substance references and the automation outbox event. Repeating the same supplier/document reference in a practice is rejected. Documents without a source number currently receive the existing parser-generated identifier; separately parsing such a file is **not** guaranteed to deduplicate. Verify the source document before importing it again.
- Existing upstream stock supports a single lot per product. Importing a different known lot while stock remains is rejected rather than overwriting the old lot. This is not a multi-lot/FEFO implementation.

## Controlled substances

Names and stored active substances are checked on the server, including selected catalog targets and the legacy import endpoint. Ketamine, diazepam, butorphanol, morphine, fentanyl and propofol (including accented names) cannot enter regular stock through these imports.

Flagged rows are skipped for stock and create a **pending manual review**, visible on `/controlled-substances` to the existing veterinarian/admin roles. This is deliberately **not an automatically completed legal ledger entry**. The responsible clinician opens a blank form and manually enters the receipt, drug, quantity, unit and schedule. The entry can then be linked to the source reference only if the practice, received action, clinician and normalized drug name match. One ledger entry cannot resolve multiple source rows. If linking fails after saving a receipt, retry linking the saved entry instead of creating it again.

## Deployment

The only new schema definitions are `packages/db/schema/ext_inventory.ts`, exported from the schema barrel. Upstream product/supplier definitions and previous migrations are unchanged.

The generated additive migration `0111_cool_phalanx.sql` creates:

- `ext_inventory_metadata`: tenant-scoped supplier identifiers, barcode, active substance and reviewed VAT; composite tenant/product foreign key.
- `ext_inventory_receipts`: durable document identity and pending/manual-review links.

Apply the generated migration through the normal deployment process, then run the repository's RLS installer (`pnpm db:rls`) before serving application traffic. The RLS installer discovers these tenant-scoped extension tables. Do not run `db:push` against production to bypass migration history.

## Verification (2026-09-23)

- `pnpm lint`: passed.
- Web and DB package `type-check`: passed.
- Complete web Vitest suite: **532 files / 5,344 tests passed**, 17 files / 41 tests skipped (opt-in integrations).
- Requested parser command: passed (6 selected files / 68 tests).
- Requested `server/__tests__/i18n-structure.test.ts`: passed. Inventory i18n scans found no hardcoded strings; EN/SK have identical 7,359-key structures.
- PostgreSQL 16 integration on **local `openvpm_ai:5434` only**: passed with generated migration and RLS installed. Exercises persisted stock/metadata, replay rejection, filters, controlled blocking, manual ledger linking and cross-tenant target rejection.
- `db:generate` after generation: no further schema changes. Existing migration/journal integrity tests pass in the full suite.
- Next.js Node runtime: five concurrent synthetic PDF extractions succeeded via a temporary route, with no font-path warning after fixing runtime resolution. Route removed after verification. Unit tests separately assert cleanup on PDF failures; this is not a long-duration heap/leak certification.
- Next production build: passed with **external, uncommitted Google Fonts response mocks** because this sandbox cannot fetch fonts.googleapis.com. No application font configuration was changed. Normal online font download and browser E2E were not verified.
- Production trace includes PDF standard fonts, CMaps and worker module.

Run the opt-in DB test only on the allowed disposable local database:

```sh
DATABASE_URL=postgres://openpims@127.0.0.1:5434/openvpm_ai \
INVENTORY_IMPORT_DB_INTEGRATION=1 \
pnpm --filter @openpims/web exec vitest run server/__tests__/inventory-import.integration.test.ts
```
