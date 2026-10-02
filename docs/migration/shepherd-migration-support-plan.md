# Shepherd migration support plan

This document defines the public, vendor-level contract. Clinic archives,
filenames, values, identifiers, row errors, and mapping evidence never belong
in the repository, issues, pull requests, CI logs, or test fixtures.

## Goal

Move the operational record a clinic needs to work in OpenVPM while preserving
source identity and documenting every record that was imported, deferred,
reviewed manually, or excluded. The same pipeline must work for another
Shepherd clinic. Other PIMS vendors plug into the same normalized domain plan.

## Supported migration surface

The reusable Shepherd adapter now supports:

- owners, patients, vaccinations, and locked SOAP history with stable source
  identity;
- non-sending care reminders;
- billable services and active products, with imported product inventory
  explicitly untracked until a clinic enters a reviewed opening quantity;
- co-owner/contact history, historical appointments, prescriptions and fills,
  lab reports, financial documents, line items, payments, and allocations as a
  read-only migration archive; and
- allowlisted PDF, JPEG, PNG, and plain-text documents through checksum-verified
  managed storage. A document without an exact source relationship remains
  unlinked and visibly needs review.

The same normalized tables, source identities, retry semantics, review states,
and operator UI are clinic-independent. A new Shepherd clinic supplies a new
private manifest and reviewed coverage plan; it does not require clinic-specific
code or fixtures.

## Operational versus historical state

- Owners, patients, vaccinations, finalized notes, care reminders, services,
  and the untracked product catalog can support current clinic work after the
  practice review hold is released.
- Historical appointments never create upcoming calendar work.
- Imported prescriptions and fills are clinical history, not a new prescription
  or authorization to dispense.
- Financial documents and payments are historical evidence, not live invoices,
  receivables, credits, or opening balances.
- A product can be billed while inventory is untracked, but it cannot be used as
  clinic stock. Stock tracking starts only through an explicit opening-count
  action.
- Imported co-owners are client contacts. They receive no portal account,
  permission, consent, or communication access from the migration.

## Reusable domain boundaries

- Source adapters emit only normalized domain records; tenant rows never
  depend on Shepherd filenames or private archive paths.
- Every supported row carries a practice-scoped source identity and a
  deterministic payload fingerprint. An exact retry is convergent; the same
  source ID with changed content fails closed.
- A reviewed preview is bound to aggregate decisions and exact target versions
  before commit. The durable migration ledger contains only hashes, counts,
  source namespace, lifecycle state, and operator identity.
- Source rows that share an ambiguous name/code or patient relationship are
  deferred together. File order is never used to choose a winner.
- Care-reminder imports create internal staff work only. They cannot create a
  communication, restore consent, or schedule a provider send.
- Service imports cannot create products, change stock, create invoices, or
  mutate existing manual catalog rows.

## Deliberate exclusions

- Vendor authentication, credentials, runtime settings, audit logs, and staff
  accounts are never portable.
- Historical invoices and payments are reference-only until OpenVPM can prove
  the opening balance without altering live accounts receivable or inventory.
- A source lab panel is kept as a typed document when its structure cannot be
  represented by OpenVPM's scalar lab result without losing meaning.
- Communication history never restores SMS consent, provider delivery state,
  or an outbound send queue.
- Historical stock quantities, lots, and expirations are not trusted as current
  inventory. A clinic must verify and enter an opening count.
- Source diagnoses or procedures without an exact patient/event relationship are
  not synthesized into clinical events. Existing locked source notes remain the
  evidence until a reviewed adapter can preserve their semantics without
  duplication.
- Unlinked document bodies remain available only in the migration archive and
  require a human relationship review before being treated as patient evidence.

## Commit safety

- Put the practice under a recovery/review hold before the first write.
- Use one immutable bundle hash and a reviewed coverage-plan hash.
- Namespace every external identity by source and practice.
- Use deterministic entity IDs or an immutable entity-link receipt, plus a
  payload hash, so retrying is convergent and changed source data conflicts.
- Commit in dependency order with bounded transactions. Clinical content and
  its patient link commit together.
- Upload documents before linking them; require checksum, size, object version
  or ETag, and an `available` manifest state.
- Reconcile source, eligible, imported, deferred, excluded, and error counts.
  Those counts must add up exactly for every domain.
- Keep the hold until a reviewer checks owner/patient identity, medical
  timelines, reminders, medications, catalog behavior, documents, and the
  exception report in the application.

## Public-repository rules

- Tests use synthetic clinics and canary values only.
- Logs and evidence contain fixed reason codes, schema fingerprints, hashes,
  and aggregate counts. They contain no source paths, filenames, headers,
  record values, names, contact details, notes, or external IDs.
- Private operator manifests are owner-only files outside the repository.
- CI may run generated synthetic archives and a disposable Postgres drill. It
  must never access a clinic archive or production database.
