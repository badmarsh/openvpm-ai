# Admin Settings

**Settings** (`/settings`) is your practice control panel. Everything from
user roles and service templates to e-Kasa configuration and data exports
lives here. Only the **Admin** role has full access to all settings;
Veterinarians can read most sections.

---

## 1. Settings overview

The settings page is organised into the following sections:

| Section | What you configure |
|---|---|
| **Practice info** | Name, address, phone, timezone, logo |
| **Users & roles** | Invite staff, assign roles, deactivate accounts |
| **Services & products** | Service catalogue, pricing, tax codes |
| **Templates** | SOAP note, discharge, prescription, and email templates |
| **Reminders** | Vaccine recall rules, care reminder timing |
| **e-Kasa** | Fiscal cash register hardware, DIČ, IČ DPH, connection test |
| **Brand Kit** | Practice logo (SVG/PNG), primary/secondary colors, document headers |
| **Data import** | Migrate records from previous system (`/settings/import-v2`) |
| **Data export & backup** | CSV exports, database JSON backup |
| **API keys** | Generate and revoke API keys for integrations |
| **Subscription & billing** | Plan management, Stripe Connect setup |
| **Guides** | In-app interactive walkthroughs |

---

## 2. Quick-start walkthroughs (Guides)

Open **Settings → Guides** to launch step-by-step interactive walkthroughs
that use your own live data. Available walkthroughs:

- **Set up your practice** — complete practice info, add your first service
- **Add your first patient** — create a client, register a pet, add a
  microchip number
- **Create your first invoice** — add a service, send it, record payment
- **Write your first SOAP note** — open an encounter, fill in Subjective/
  Objective/Assessment/Plan, finalise and sign

Each walkthrough takes 1–3 minutes and can be restarted at any time.

---

## 3. Data management

All data operations live in **Settings → Data**.

### Exporting data

- **CSV exports** — Download clients, patients, appointments, or invoices
  as spreadsheet-compatible files. Use these for accounting, bulk analysis,
  or migration.
- **Database backup** — Download a complete structured JSON backup of your
  practice: every client, pet, SOAP note, lab result, invoice, and payment.
  Click **Export Database Backup**. Uploaded file attachments (images, PDFs)
  are not embedded in this JSON file; they are stored separately.

> ⚠️ **PDF export — Slovak diacritics**: PDF exports run through a
> sanitiser that converts Slovak diacritics (č→c, š→s, ä→a). Use CSV
> exports to preserve all characters exactly.

### Importing data

Migrate from another system via **Settings → Data Import**
(`/settings/import-v2`). Imports run in strict order (clients → patients →
vaccines) and every import shows a **dry run preview** first — you see
exactly what will change before anything is saved. Imports only add records;
they never overwrite existing data.

See [Your data: export, backup, and import](../your-data.md) for the full
step-by-step migration playbook.

### Removing sample data

When you are ready for real work, click **Remove sample data** under
Settings → Data. This removes all demo records. The action is irreversible.

### Practice deletion

Practice deletion is permanent and irreversible. Contact
[jurkemik@significa.sk](mailto:jurkemik@significa.sk) for assistance.

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk) and a real
person will answer.
