# Your Data: Export, Backup, and Import

You own everything here. Export it any time. No lock-in, period.

Everything on this page lives in one place: **Settings → Data**.

## Export your data

- **CSV exports.** Download your clients, patients, appointments, or
  invoices as simple spreadsheet files.
- **Database backup.** Download your practice's structured data as one JSON
  file: every client, pet, saved SOAP draft, signed note with its attribution,
  correction, addendum, shot, lab, bill, payment, and attachment manifest.
  Click **Export Database Backup** and keep the file somewhere safe. Uploaded
  document and image bytes are not embedded in this JSON file.

On OpenVPM Cloud we also take this database backup every night and store it
outside the live database. Independent attachment-file replication is being
rolled out separately; until its recovery drill passes, do not treat the JSON
download as a complete attachment archive.

## Import your data

Switching from another system? Bring your clients, pets, and vaccine history
with you. Imports run in a strict order (clients, then patients, then
vaccines) and every import shows a **dry run** first, so you see exactly what
will happen before anything is saved. Imports never overwrite your records;
they only add.

The full step-by-step playbook, including how to export from AVImark,
Cornerstone, and ezyVet, is here:
[Switching to OpenVPM](../migrating-to-openvpm.md).

## Restore a database backup

A database backup can be restored into an empty practice. It rebuilds the
structured records, bills, and history. Restores check the file first, never
overwrite, and only add rows that do not already exist. If the backup contains
attachment manifests, that empty target must be the original practice; a
cross-practice restore fails before writing instead of creating broken links.

If you ever need this, we run it with you. The technical runbook is
[here](../backup-restore-runbook.md).

## e-Kasa export & fiscal audit log

Your fiscal receipt records (e-Kasa) are stored separately from standard
invoices and can be exported for accounting and tax submissions.

- **Receipt export**: Go to **Settings → e-Kasa** and use the date-range
  export to download a CSV of all fiscal receipts (including VAT breakdown,
  UID, payment method, and daily closure records) for the selected period.
- **Audit log export**: The full e-Kasa audit trail — including voided
  receipts, offline queue events, and storno records — is available as a
  CSV export from the same screen.

> ⚠️ **PDF export note**: PDF exports of fiscal receipts strip Slovak
> diacritics (č→c, š→s, ä→a). Use CSV for submissions to Finančná správa SR
> or your accountant to preserve all characters.

## Lab analyzer import

Results from in-house analysers (IDEXX Catalyst, IDEXX ProCyte, Fuji
Dri-Chem NX500, Mindray BC-Vet) are imported automatically — no manual
file upload required. The system receives result files from the analyser,
parses them, checks reference ranges, and adds them to the Lab Inbox for
review.

Manual CSV upload of lab results is available for analysers not yet
connected automatically. Go to **Lab Results → Upload results** and select
your CSV file.

**Full live API connectors** (direct integration with external reference
laboratory APIs such as IDEXX Reference Labs or Laboklin) are coming in
v0.7. The parsers are implemented; the live API connections are not yet
active.

## Sample data

New practices start with a few sample pets so the app feels real on day one.
When you are ready for real work: **Settings → Data → Remove sample data**.
