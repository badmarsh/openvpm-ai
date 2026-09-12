# Domain: Admin Settings

**Date:** 2026-09-12
**Commit:** 23f23a3
**Scope:** Settings page (13 tabs), admin router endpoints, platform admin, messaging provider provisioning, billing/subscription, booking pages, data import/export, wellness plans, treatment templates, brand kit, ambulatory workspace

---

## A. Feature Inventory Table

| ID | Feature | Entry Point | Roles | DB Tables | Status | Source Tag |
|----|---------|-------------|-------|-----------|--------|------------|
| AS-01 | Practice info (name, address, phone, email, website, timezone, country, currency, tax rate, VAT) | Settings → Practice Info | admin | `practices` (settings JSONB) | Complete | `[VERIFIED: settings/page.tsx:518-1160; routers/settings.ts getPractice/updatePractice]` |
| AS-02 | Brand Kit (logo upload, accent color, secondary color, theme presets, brand voice, hashtags, social media copy, mockup preview, 3D banner) | Settings → Brand Kit | admin | `practices` (settings.brandColor, logoUrl) | Complete | `[VERIFIED: components/settings/brand-kit-tab.tsx:1-1017]` |
| AS-03 | Locations CRUD (name, type, address, phone, email, website, primary location toggle, messaging status per location) | Settings → Locations | admin | `locations`, `locationMessaging` | Complete | `[VERIFIED: settings/page.tsx:1164-1568; routers/settings.ts locations CRUD]` |
| AS-04 | Staff management (invite, role assignment, schedule, license number, clinical profile, admin roster lock) | Settings → Staff | admin | `users`, `staffSchedules` | Complete | `[VERIFIED: settings/page.tsx:2264-2885; routers/settings.ts staff CRUD]` |
| AS-05 | Appointment types CRUD (name, duration, color) | Settings → Appointment Types | admin | `appointmentTypes` | Complete | `[VERIFIED: settings/page.tsx:2887-3310; routers/settings.ts appointmentTypes CRUD]` |
| AS-06 | Rooms CRUD (name, type: exam/surgery/treatment/boarding) | Settings → Rooms | admin | `rooms` | Complete | `[VERIFIED: settings/page.tsx:4781-4989; routers/settings.ts rooms CRUD]` |
| AS-07 | Services & Pricing catalog (name, code, category, default price, taxable, archive/restore) | Settings → Services & Pricing | admin | `services` | Complete | `[VERIFIED: components/settings/services-tab.tsx:1-537; routers/billing.ts listServices/createService/updateService/archiveService]` |
| AS-08 | Data export (clients, patients, appointments, invoices, full backup JSON) | Settings → Data → Export | admin | All practice tables | Complete | `[VERIFIED: settings/page.tsx:3313-3800; routers/data.ts exportClients/exportPatients/exportAppointments/exportInvoices/exportFullBackup]` |
| AS-09 | Data import (CSV: clients, patients, vaccinations, SOAP notes, care reminders, services; preview/dry-run; migration ledger) | Settings → Data → Import | admin | `clients`, `patients`, `vaccinationRecords`, `soapNotes`, `careReminders`, `services` | Complete | `[VERIFIED: settings/page.tsx:3313-4200; routers/data.ts importClientsCsv/importPatientsCsv/importVaccinationsCsv/importSoapNotesCsv/importCareRemindersCsv/importServicesCsv]` |
| AS-10 | Practice backup restore (JSON upload, dry-run verify, restore) | Settings → Data → Restore | admin | All practice tables | Complete | `[VERIFIED: settings/page.tsx:3313-3800; routers/data.ts restoreBackup; lib/backup/export.ts]` |
| AS-11 | Account deletion request (contact email, reason, retention review) | Settings → Data → Account Deletion | admin | `practices.settings.accountDeletionRequest` | Complete | `[VERIFIED: settings/page.tsx:4200-4500; routers/settings.ts requestAccountDeletion]` |
| AS-12 | Treatment templates (name, description, category, items linked to services/products) | Settings → Templates | admin | `treatmentTemplates`, `treatmentTemplateItems` | Complete | `[VERIFIED: settings/page.tsx:5274-5600; routers/templates.ts CRUD]` |
| AS-13 | Wellness plans (name, description, price monthly/annual, active/inactive) | Settings → Wellness Plans | admin | `wellnessPlans` | Complete | `[VERIFIED: settings/page.tsx:4991-5272; routers/wellness.ts CRUD]` |
| AS-14 | Messaging setup (Telnyx provider, registration, A2P brand/campaign, sender identity, autoresponses, appointment reminders) | Settings → Messaging | admin | `messagingRegistrations`, `locationMessaging`, `smsDeliveryEvents`, `smsSendAttempts` | Complete | `[VERIFIED: components/settings/messaging-tab.tsx:1-659; routers/admin.ts messaging endpoints; routers/messaging.ts]` |
| AS-15 | Online booking page (slug, published toggle, weekly hours, lead time, booking window, intake fields, QR code, embed code) | Settings → Online Booking | admin | `bookingPages` | Complete | `[VERIFIED: components/settings/booking-tab.tsx:1-653; routers/booking.ts]` |
| AS-16 | Plan & Billing (subscription tier, checkout via Stripe, billing portal, payment account setup for client payments, trial management) | Settings → Plan & Billing | admin | `practices.settings` (subscription state), external Stripe | Complete | `[VERIFIED: settings/page.tsx:1570-2262; routers/subscription.ts, routers/billing.ts]` |
| AS-17 | Provider hours (per-location scheduling windows, day-of-week HH:MM ranges, non-overlapping validation) | Settings → Staff → Provider Hours | admin | `staffSchedules` | Complete | `[VERIFIED: components/settings/provider-hours.tsx; routers/settings.ts providerSchedule revision]` |
| AS-18 | Ambulatory workspace (field visits toggle, measurement system, body condition scale, compact closeout) | Settings → Practice Info → Ambulatory Workspace | admin | `practices.settings.ambulatoryWorkspace` | Complete — feature-gated (`ambulatoryWorkspaceRolloutEnabled`) | `[VERIFIED: components/settings/ambulatory-workspace-settings.tsx:1-153; lib/ambulatory-workspace.ts]` |
| AS-19 | Email preferences (marketing email opt-in/out for practice contact email) | Settings → Practice Info → Email Preferences | admin | External (platform email preferences API) | Complete | `[VERIFIED: settings/page.tsx:518-1160; routers/settings.ts getMarketingEmailPreference/setMarketingEmailPreference]` |
| AS-20 | Onboarding state (tour status, journey step, setup dismissed, migration source, help requests) | Settings → Practice Info → implicit | admin | `practices.settings.onboardingState` | Complete | `[VERIFIED: routers/settings.ts onboardingState merge patch]` |
| AS-21 | Guides viewer (welcome surface with guide cards: ask-ai, your-day, client-portal, calendar-feed; coachmark walkthroughs) | Settings header → "Guides" button (Compass icon, `data-tour="settings-guides"`) | all roles (role-filtered cards) | Local state (localStorage for guide completion) | Complete | `[VERIFIED: settings/page.tsx:440-450 Guides button → useWelcome().openWelcome(); components/welcome/welcome-provider.tsx; components/welcome/welcome-surface.tsx; lib/welcome/cards.ts]` |
| AS-22 | Platform admin dashboard (activation funnel, journey funnel, activation recovery, clinic pilots, SMS operations, messaging provider provisioning) | /admin (separate route, not Settings tab) | platform_admin (PLATFORM_ADMIN_EMAILS) | Cross-practice queries | Complete | `[VERIFIED: routers/admin.ts:1-3398; lib/platform-admin.ts]` |
| AS-23 | Clinical profile (admin as veterinarian toggle, license number, location assignment) | Settings → Practice Info → Clinical Profile | admin | `users.isVeterinarian`, `users.licenseNumber`, `users.locationId` | Complete | `[VERIFIED: routers/settings.ts getMyClinicalProfile/updateMyClinicalProfile]` |
| AS-24 | SMS recovery & operations (delivery events, send attempts, provider events, resolution workflow) | Settings → Messaging → SMS Operations | admin | `smsDeliveryEventHistory`, `smsSendAttemptEvents`, `smsProviderEvents`, `smsProviderEventResolutions` | Complete | `[VERIFIED: routers/admin.ts SMS operations endpoints; lib/messaging/sms-operations-queues.ts]` |

---

## B. Import / Export Specifics

### B.1 CSV Import Architecture

**Parser:** Custom CSV parser with RFC 4180 compliance
`[VERIFIED: apps/web/lib/csv/parse.ts]`

- Handles quoted fields with embedded commas, quotes, and newlines
- Strips UTF-8 BOM from first header
- Rejects duplicate headers after normalization
- Reports extra columns instead of silently discarding data

**Importable entities:**
| Entity | Endpoint | Max rows | File size limit | Reconciliation |
|--------|----------|----------|-----------------|----------------|
| Clients | `data.importClientsCsv` | 10,000 | 5 MB | By email or externalId |
| Patients | `data.importPatientsCsv` | 10,000 | 5 MB | By name + owner match |
| Vaccinations | `data.importVaccinationsCsv` | 10,000 | 5 MB | By patient + vaccine name |
| SOAP Notes | `data.importSoapNotesCsv` | 10,000 | 5 MB | Fingerprint dedup (SHA-256) |
| Care Reminders | `data.importCareRemindersCsv` | 10,000 | 5 MB | By patient + reminder type |
| Services | `data.importServicesCsv` | 10,000 | 5 MB | By name + code |

**Dry-run preview workflow:**
1. Upload CSV → parse → validate → return preview (willInsert, willReconcile, duplicates, errors)
2. User reviews → commit import → returns imported count, reconciled count, errors
3. Preview tokens expire; stale previews return CONFLICT error

**Import fingerprinting:** SOAP notes use SHA-256 `import_fingerprint` column with unique index for deduplication of imported historical records. `[VERIFIED: routers/data.ts; lib/import/fingerprint.ts]`

### B.2 Full Backup Export/Restore

**Export format:** Single JSON file containing all practice data
`[VERIFIED: lib/backup/export.ts exportPracticeData]`

Sections: clients, patients, appointments, invoices, invoiceItems, services, products, locations, rooms, appointmentTypes, staffSchedules, vaccinationRecords, soapNotes, careReminders, wellnessPlans, treatmentTemplates

**Export endpoints:**
- `data.exportFullBackup` — complete JSON backup
- `data.exportClients` — clients CSV-like export
- `data.exportPatients` — patients with owner info
- `data.exportAppointments` — appointments with joins (patient, client, doctor, type)
- `data.exportInvoices` — invoices with line items

**Restore workflow:**
1. Upload JSON → validate size (max `PRACTICE_BACKUP_JSON_MAX_BYTES`)
2. Dry-run verify → returns counts per section, missing sections, restore errors
3. Confirm fresh practice checkbox (destructive operation)
4. Restore → returns restored counts per table

**Safety gates:**
- Size validation: `isPracticeBackupJsonSizeValid` `[VERIFIED: lib/backup/policy.ts]`
- Practice must be active and not deleted
- Restore requires explicit confirmation checkbox (`confirmFreshPractice`)

### B.3 Accounting Export

**Slovak market integrations:**
- Pohoda XML export (STORMWARE)
- KROS Omega CSV export
- e-Kasa receipt integration

`[VERIFIED: lib/accounting/export.ts; CLAIMED IN DOCS: README.md]`

---

## C. Integration Specifics

### C.1 Telnyx Messaging Provider

**Provisioning flow:**
1. Register A2P brand (displayName, entityType, businessPhone, country="US")
2. Create A2P campaign (referenceId = `openvpm-clinic-{practiceId}`)
3. Create messaging profile
4. Assign phone number to profile
5. Configure autoresponses
6. Enable profile → provider attestation

**Safety gates:**
- `MESSAGING_PROVISIONING_ENABLED` env flag kill-switch
- Practice recovery hold blocks external side effects
- Provider event gate: unresolved provider events must be projected or reconciled before profile enablement
- 15-minute stale lock timeout for submission locks
- 15-minute max age for provider profile attestation

**Registration statuses:** not_started, pending, active, action_required, failed, suspended
`[VERIFIED: components/settings/messaging-tab.tsx REGISTRATION_BADGE]`

**Autoresponses:** Configurable per messaging profile; safety issues tracked separately
`[VERIFIED: lib/messaging/telnyx-provisioning.ts ensureMessagingProfileAutoresponses]`

**Appointment reminders:** Hourly cron sends reminders for confirmed appointments within lead window (24/48/72 hours)
`[VERIFIED: components/settings/messaging-tab.tsx APPOINTMENT_REMINDER_LEAD_OPTIONS]`

### C.2 Stripe Billing Integration

**Subscription flow:**
- Trial period with calendar-day counting
- Checkout via hosted Stripe billing URL
- Billing portal for subscription management
- Plan tiers with monthly/annual cadence
- Seat-based pricing (`CLOUD_SEAT_UNIT_PRICE_MONTHLY_USD`)
- Location-based pricing (`CLOUD_LOCATION_UNIT_PRICE_MONTHLY_USD`)

**Payment account for client payments:**
- Stripe Connect onboarding for clinic to accept client payments
- Separate from subscription billing (clinic pays OpenVPM vs. client pays clinic)
- Dashboard access for payment account management

**Billing sync:**
- Subscription quantities synced after staff/location changes
- Errors tracked in `billingSyncStatus` (error/legacy/ok)

`[VERIFIED: routers/subscription.ts; routers/billing.ts; lib/billing/plans.ts]`

### C.3 Online Booking Page

**Public-facing booking page at `/{slug}`:**
- Weekly hours configuration (per-day time windows)
- Lead time options (none, 1hr, 4hr, 1day, 2day)
- Booking window options (2 weeks to 6 months)
- Previsit intake fields (symptoms, onset, meds, allergies, history, diet, handling, service address)
- QR code generation for sharing
- Embed code for website integration
- Appointment type selection

**Slug validation:** `isValidBookingSlug` — alphanumeric, hyphens, max length
`[VERIFIED: lib/booking/page-config.ts]`

### C.4 Platform Admin (Separate from Settings)

**Cross-practice operator dashboard at `/admin`:**
- Activation funnel (practices by stage)
- Journey funnel (onboarding steps completion)
- Activation recovery (stalled practices)
- Clinic pilots (pilot program management)
- SMS operations (delivery events, send attempts, provider events, resolution workflow)
- Messaging provider provisioning (brand/campaign/profile management)

**Gate:** `PLATFORM_ADMIN_EMAILS` allowlist — NOT the practice "admin" role
`[VERIFIED: routers/admin.ts platformAdminProcedure]`

### C.5 Guides / Welcome Surface

**The "Settings → Guides" viewer exists and is implemented as follows:**

- **Entry point:** "Guides" button (Compass icon) in the Settings page header (`data-tour="settings-guides"`)
- **Action:** Calls `openWelcome()` from `WelcomeContext`, which opens the `WelcomeSurface` modal dialog
- **Content:** Polaroid-style guide cards for role-filtered walkthroughs:
  - `ask-ai` — AI helper walkthrough (admin + veterinarian only, checks `canRunAgentGuideRole`)
  - `your-day` — Schedule + Whiteboard walkthrough (all roles)
  - `client-portal` — Client portal link walkthrough (all roles)
  - `calendar-feed` — Calendar subscription walkthrough (all roles)
- **Navigation:** Each guide launches a coachmark-based walkthrough via `start(card, ctx)` from the `TourProvider`
- **Completion tracking:** LocalStorage per user (not server-persisted, unlike the classic "tour")
- **Auto-open gates:** New trial admins (not finished onboarding, not dismissed, not established practice); invited staff (once per user per device)
- **Deep link:** `?guides=1` URL param opens guides directly
- **Variant toggle:** `?welcomeVariant=imagery|vignette` for review

**Key files:**
- `[VERIFIED: settings/page.tsx:440-450]` — Guides button in PageHeader actions
- `[VERIFIED: components/welcome/welcome-provider.tsx]` — WelcomeProvider with openWelcome, auto-open logic, guide completion handling
- `[VERIFIED: components/welcome/welcome-surface.tsx]` — WelcomeSurface modal with Polaroid cards
- `[VERIFIED: lib/welcome/cards.ts]` — Role matrix for card visibility
- `[VERIFIED: components/tour/guide-recipes.ts]` — Guide step definitions
- `[VERIFIED: components/tour/tour-provider.tsx]` — Coachmark engine

---

## D. Docs-vs-Reality Pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| Settings page has 13 tabs (practice, brandKit, locations, staff, appointmentTypes, rooms, services, data, templates, wellness, messaging, booking, billing) | **CONFIRMED** | All 13 tabs present in `settings/page.tsx` tabs array and render logic. `[VERIFIED: settings/page.tsx:155-240]` |
| "Guides" button in Settings header opens welcome/guides surface | **CONFIRMED** | Button with `data-tour="settings-guides"` calls `openWelcome()` → WelcomeSurface with guide cards. `[VERIFIED: settings/page.tsx:440-450; welcome-provider.tsx]` |
| Guides include ask-ai, your-day, client-portal, calendar-feed | **CONFIRMED** | `visibleWelcomeCards` returns these 4 cards (ask-ai role-filtered). `[VERIFIED: lib/welcome/cards.ts]` |
| Classic "tour" is a separate recipe from welcome guides | **CONFIRMED** | "tour" is the classic value tour (admin-only, server-persisted); welcome guides are per-user local storage. `[VERIFIED: lib/welcome/cards.ts; tour-provider.tsx]` |
| CSV import supports 6 entity types with dry-run preview | **CONFIRMED** | All 6 import mutations exist with dry-run support. `[VERIFIED: routers/data.ts]` |
| Full backup export/restore is a single JSON file | **CONFIRMED** | `exportPracticeData` and `restorePracticeData` handle complete JSON backup. `[VERIFIED: lib/backup/export.ts]` |
| Telnyx messaging requires A2P brand + campaign registration | **CONFIRMED** | Provisioning flow: brand → campaign → profile → number → autoresponses → enable. `[VERIFIED: lib/messaging/telnyx-provisioning.ts]` |
| Stripe billing handles both subscription (clinic pays OpenVPM) and client payments (client pays clinic) | **CONFIRMED** | Separate flows: subscription checkout vs. payment account onboarding. `[VERIFIED: routers/subscription.ts; routers/billing.ts]` |
| Online booking page has public URL with slug, QR code, and embed | **CONFIRMED** | QRCodeSVG component, copy-to-clipboard for link and embed. `[VERIFIED: booking-tab.tsx]` |
| Platform admin is separate from Settings (different route, different auth gate) | **CONFIRMED** | `/admin` route with `PLATFORM_ADMIN_EMAILS` gate vs Settings with practice "admin" role. `[VERIFIED: routers/admin.ts]` |
| Ambulatory workspace is feature-gated and doesn't affect clinic workflows | **CONFIRMED** | `ambulatoryWorkspaceRolloutEnabled` guard; description says "Existing clinic workflows stay unchanged until this is enabled." `[VERIFIED: ambulatory-workspace-settings.tsx]` |
| Brand Kit includes AI-generated social media copy and hashtag suggestions | **CONFIRMED** | Brand kit tab has tone presets, hashtag suggestions, social copy generation with Sparkles icon. `[VERIFIED: brand-kit-tab.tsx]` |
| Services catalog links to treatment template items | **CONFIRMED** | Template items can link to services/products via catalog picker. `[VERIFIED: settings/page.tsx:5274-5600; templates/catalog-picker.tsx]` |

---

## E. Friction / "doesn't make sense" notes

### E.1 Settings page is 5,875 lines — monolithic

**Problem:** All 13 tabs are in a single file (`settings/page.tsx:5875` lines). Only messaging, booking, provider-hours, services, brand-kit, and ambulatory-workspace are dynamically imported. The rest (practice, locations, staff, appointment-types, rooms, data, templates, wellness, billing) are inline.

**Impact:** Slow initial load, hard to navigate, merge conflicts likely with multiple contributors.

**Recommendation:** Split each tab into its own component file (already done for 6 tabs; complete the remaining 7).

### E.2 "Guides" naming vs "Tour" naming confusion

**Problem:** The Settings button says "Guides" but opens the "Welcome" surface, which contains "guide cards" that launch "tours" (coachmarks). The terminology overlaps:
- "Guides" button → Welcome surface → Guide cards → Tour coachmarks
- `data-tour="settings-guides"` attribute mixes both terms
- "tour" is also a recipe name (`GuideId = "tour" | "ask-ai" | ...`)

**Impact:** Confusing for new contributors and users. The i18n key is `settings.header.guides` → "Guides" but the component is `WelcomeSurface`.

**Recommendation:** Unify terminology — either "Guides" throughout (button, surface, cards, coachmarks) or keep "Welcome" for the surface and "Guides" for the walkthroughs.

### E.3 Booking intake settings vs provider hours — both in separate files but same tab pattern

**Problem:** `booking-intake-settings.tsx` and `provider-hours.tsx` are separate components but are used inline in the main settings page. They follow the same controlled-component pattern but are structured differently.

**Impact:** Inconsistent component architecture within the same settings surface.

### E.4 Data tab does import/export/restore/account-deletion in one tab

**Problem:** The Data tab combines four distinct operational domains:
1. CSV import (6 entity types)
2. Data export (5 export types)
3. Backup restore (JSON upload + verify + restore)
4. Account deletion request

**Impact:** The tab is ~1,200 lines of complex state management. Each sub-domain has its own workflow, error handling, and recovery messages.

**Recommendation:** Consider sub-tabs or separate pages for import vs. export vs. restore vs. deletion.

### E.5 Brand Kit is 1,017 lines with marketing-heavy features

**Problem:** The Brand Kit tab includes not just logo/color management but also:
- AI-generated social media copy
- Hashtag suggestions
- Mockup previews
- 3D banner components
- Theme presets (Vercel, Supabase, Linear, Stripe, Notion, Railway, VET.IS, Rose Gold)

**Impact:** This is a marketing/branding surface, not a core settings function. It inflates the settings page and may confuse users who just want to change their practice name or logo.

**Recommendation:** Consider moving advanced brand features (social copy, mockups, 3D banners) to a separate "Marketing" or "Brand Studio" surface, keeping basic branding (logo, color) in Settings.

### E.6 Messaging tab requires Telnyx-specific knowledge

**Problem:** The messaging tab exposes Telnyx-specific concepts (A2P brand, A2P campaign, messaging profile, sender E164, registration status) that require carrier knowledge to operate correctly.

**Impact:** Practice admins may not understand what "A2P brand registration" means or why their messaging is "action_required."

**Evidence:** Registration badges show: not_started, pending, active, action_required, failed, suspended — but the wizard explains these terms.

**Mitigation:** The `MessagingWizard` component provides guided setup, but the tab still exposes raw provider state for operators.

### E.7 Account deletion is in Data tab, not a dedicated "Danger Zone"

**Problem:** Account deletion request is buried in the Data tab alongside CSV import and backup restore. It's a destructive, irreversible action that should be prominently separated.

**Recommendation:** Move to a dedicated "Danger Zone" section at the bottom of Practice Info tab or a separate "Account" tab.

---

## F. Proposed User-Manual Section(s)

### F.1 Settings Overview

**Where to find it:** Sidebar → Nastavenia (Settings) — admin role only.

**What it does:** Configure your clinic's practice information, staff, services, data management, messaging, online booking, billing, and brand identity.

**Tabs:**
| Tab | What you configure |
|-----|-------------------|
| Practice Info | Name, address, contact, timezone, currency, tax rate, VAT, email preferences, clinical profile, ambulatory workspace |
| Brand Kit | Logo, accent color, secondary color, brand voice, social media copy, hashtags |
| Locations | Clinic locations, primary location, messaging status per location |
| Staff | Team members, roles, schedules, licenses, invitations |
| Appointment Types | Visit types with duration and color coding |
| Rooms | Exam rooms, surgery rooms, treatment rooms, boarding rooms |
| Services & Pricing | Billable services with codes, categories, prices, tax settings |
| Data | Import CSV, export data, backup/restore, account deletion |
| Templates | Treatment templates for common visit types |
| Wellness Plans | Membership plans with monthly/annual pricing |
| Messaging | SMS/text messaging setup via Telnyx, appointment reminders |
| Online Booking | Public appointment request page with hours, intake fields, QR code |
| Plan & Billing | OpenVPM Cloud subscription, Stripe checkout, client payment setup |

### F.2 Guides — Quick Start Walkthroughs

**Where to find it:** Settings page header → "Guides" button (Compass icon) — or visit any page with `?guides=1`.

**What it does:** Opens a welcome surface with interactive guide cards that walk you through key features using live (or demo) data.

**Available guides:**
| Guide | Who sees it | What it walks through |
|-------|-------------|----------------------|
| Ask AI | Admin + Veterinarian | How to ask the AI helper a question about your clinic data |
| Your Day | All roles | Schedule → Whiteboard workflow for managing daily visits |
| Client Portal | All roles | How to share the private portal link with clients |
| Calendar Feed | All roles | How to subscribe your personal calendar to the clinic schedule |

**How to use:**
1. Click "Guides" in the Settings header
2. Click any guide card to start the walkthrough
3. Follow the coachmarks — they'll navigate you to the right pages
4. Complete each guide to mark it done
5. Return to Guides anytime to revisit completed guides or start new ones

**Note:** Guide completion is tracked per-user on your device. It does not affect other team members.

### F.3 Importing Data from Another System

**Supported formats:** CSV files for clients, patients, vaccinations, medical history (SOAP notes), care reminders, and services.

**Import order matters:**
1. **Clients first** — pets link to their owners
2. **Patients second** — vaccinations and medical history link to pets
3. **Vaccinations third** — link to patients by name or source ID
4. **Medical history last** — SOAP notes link to patients

**Limits:** Max 5 MB per file, max 10,000 rows per import. Split larger exports into multiple files.

**Steps:**
1. Go to Settings → Data → Import
2. Select the import type (Clients, Patients, etc.)
3. Upload your CSV file
4. Review the preview: rows to import, duplicates, unmatched references, errors
5. Click "Commit Import" to proceed
6. Check the results: imported count, reconciled count, any errors

**Reconciliation:** Existing records are matched by email (clients), name + owner (patients), or external ID. Duplicates are skipped, not overwritten.

### F.4 Setting Up SMS/Text Messaging

**Prerequisites:**
- At least one clinic location
- US phone number for A2P registration
- Telnyx account (managed by OpenVPM Cloud)

**Steps:**
1. Go to Settings → Messaging
2. Click "Setup Texting" to start the wizard
3. Complete brand registration (clinic name, business phone, entity type)
4. Wait for A2P campaign approval (carrier review, may take days)
5. Configure autoresponses (optional: out-of-office, help message, opt-out confirmation)
6. Enable appointment reminders (choose lead time: 24h, 48h, or 72h)

**Important:** SMS is only sent to clients who have given explicit consent. The consent checkbox is unchecked by default in the client record.

### F.5 Creating an Online Booking Page

**Steps:**
1. Go to Settings → Online Booking
2. Choose a unique slug (letters, numbers, hyphens only)
3. Set your weekly hours (which days/times you accept online requests)
4. Choose lead time (how much notice you need before an appointment)
5. Choose booking window (how far in advance clients can book)
6. Select previsit intake fields (symptoms, medications, allergies, etc.)
7. Click "Publish" to make the page live

**Share your page:**
- Copy the direct link: `openvpm.com/{your-slug}`
- Copy the embed code for your website
- Download the QR code for print materials

### F.6 Managing Your Clinic Subscription

**OpenVPM Cloud plans:**
- Free trial period with full access
- Monthly or annual billing cadence
- Per-seat pricing (staff members)
- Per-location pricing (clinic sites)

**Billing actions:**
- **Subscribe:** Choose cadence → Stripe Checkout → subscription active
- **Manage subscription:** Billing Portal → update payment method, change plan
- **Client payments:** Set up Stripe Connect → clients can pay invoices online

**Self-hosted:** All features unlocked, no subscription required.
