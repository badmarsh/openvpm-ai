# OpenVPM AI — User Manual Proposal (2026-09-12)

**Commit:** `23f23a3` [VERIFIED: git rev-parse --short HEAD]

This proposal defines the information architecture for a complete, production-grade user manual (`uzivatelska prirucka`). It is built on three pillars:

1. **Role-first navigation** — not domain-first. The existing 25-flat-sidebar structure creates cognitive overload (UX analysis F4). This proposal groups features by *who uses them* and *what they need to do*.
2. **Parallel SK/EN content** — because the UI is bilingual (`messages/sk.json`, `messages/en.json`) and `docs/help/*.md` are in English, but all UI labels are Slovak. A monolingual manual would be unusable.
3. **Task-oriented, short-form help** — matching the style of existing `docs/help/*.md`, but extended to cover all 17 domains.

## Format decision: Single manual, parallel SK/EN

- **Why not multiple manuals?** The existing `docs/help/` is a single, unified system. Splitting it into separate "vet guide", "admin manual", etc., would break the in-app Guides viewer and create maintenance overhead.
- **Why parallel SK/EN?**
  - The UI is bilingual: all buttons, tabs, and labels render in Slovak or English based on user preference.
  - All existing `docs/help/*.md` files are written in English prose describing a Slovak-labeled UI — this is a mismatch. Users reading English docs see Slovak UI labels and must mentally translate.
  - Solution: Each help page has two versions: `/help/sk/<page>.md` and `/help/en/<page>.md`. The in-app Guides viewer detects the user's language setting and shows the correct one.

## Proposed file/folder layout

```
docs/help/
├── sk/
│   ├── your-day.md
│   ├── client-portal.md
│   ├── billing-invoices.md
│   ├── inventory-stock.md
│   ├── lab-results.md
│   ├── statutory-kvepis.md
│   └── ...
├── en/
│   ├── your-day.md
│   ├── client-portal.md
│   ├── billing-invoices.md
│   ├── inventory-stock.md
│   ├── lab-results.md
│   ├── statutory-kvepis.md
│   └── ...
└── README.md (redirects to /help/sk/README.md or /help/en/README.md)
```

The in-app Guides viewer will be updated to respect the `i18nKey` and load the correct language folder.

## Full table of contents (role + task grouped)

### For Front Desk Staff
- Your Day Sheet (`your-day.md`) — schedule, whiteboard, check-in
- Client Portal Setup (`client-portal.md`) — generate and share portal links
- Calendar Feed Sync (`calendar-feed.md`) — Google/Apple/Outlook sync
- Appointment Management (`appointments.md`) — confirm, cancel, recover, no-show
- Billing Basics (`billing-basics.md`) — create invoices, mark as paid, void

### For Veterinarians & Technicians
- SOAP Notes & Encounters (`soap-notes.md`) — rich-text editor, templates, vitals
- Controlled Substances (`controlled-substances.md`) — wasting with witness, lot tracking
- Lab Results Viewer (`lab-results.md`) — upload, view, AI analysis
- Discharge Summaries (`discharge-summaries.md`) — AI-generated, editable, signed
- Wellness Plans (`wellness-plans.md`) — create, assign, track subscription status

### For Admins & Practice Owners
- Billing & Finance (`billing-finance.md`) — Stripe subscriptions, e-Kasa compliance, accounting export
- Inventory & Pharmacy (`inventory-pharmacy.md`) — stock levels, wholesaler import, controlled substances audit log
- Statutory Compliance (`statutory-compliance.md`) — KVEPIS B2G submission, CRSZ registration, dental charting
- Marketing Studio (`marketing-studio.md`) — social media posts, SMS/email campaigns, waiting room TV
- Reports Engine (`reports.md`) — clinical, financial, operational reports
- System Settings (`system-settings.md`) — practice info, user roles, API keys, safety checks

### For Everyone
- Ask the AI (`ask-the-ai.md`) — query your data in plain words
- Your Data (`your-data.md`) — export, backup, restore, import
- Remote Support (`remote-support.md`) — start a support session

## Complete proposed sections by domain

### core-clinical (6 sections)
- F.1 "Writing a SOAP Note" — Veterinarian persona (screen-by-screen)
- F.2 "Recording a Vaccination" — Technician/Vet persona
- F.3 "Managing the Problem List" — Veterinarian persona
- F.4 "Writing a Prescription" — Veterinarian persona (with safety checks)
- F.5 "Reviewing Lab Results" — Veterinarian/Technician persona
- F.6 "Recording Vital Signs" — Technician/Vet persona

### scheduling-front-desk (3 persona-focused sections)
- Persona front_desk: "Managing Today's Appointments" (9 sub-sections — check-in, no-show, reschedule, recall, calendar feed, walk-in triage, appointment statuses, quick create, batch operations)
- Persona veterinarian: "Your Daily Appointment Flow" (4 sub-sections — today's schedule, between-appointment workflow, discharge from appointment, mark-as-complete)
- Persona admin: "Setting Up Scheduling" (6 sub-sections — service catalog, appointment types, provider schedules, recall rules, calendar integration, buffer/transition settings)

### clients-portal (4 sections)
- F.1 "Getting Started with Your Pet Portal" — Client persona
- F.2 "Requesting an Appointment" — Client persona
- F.3 "Paying Your Invoice Online" — Client persona
- F.4 "Portal Link Expired? Here's What To Do" — Client FAQ

### billing-finance (5 sections)
1. Invoicing — create, edit, void, template-based invoices
2. Payments — cash, card, split payments, payment plans
3. e-Kasa (Slovak fiscal compliance) — legal requirements, export formats, audit trail
4. Subscription & Plans — Stripe billing, plan management, proration
5. Accounting exports — CSV/Excel export, period closing, reconciliation

### inventory-pharmacy (4 sections)
- F.1 Product & stock management — categories, suppliers, reorder levels, stock adjustments
- F.2 Controlled substances — regulatory-precision reference (wasting, witness signatures, audit log, reconciliation)
- F.3 Drug dosing calculator — weight-based dosing, concentration lookup
- F.4 Wholesaler delivery note import (pending integration) — expected format, mapping

### lab-imaging (2 sections)
- Section: Laboratórne výsledky a analyzátory — upload, link to patient, reference ranges, flags
- Section: Zobrazovacie metódy a AI analýza — image viewer, annotation, AI-assisted interpretation

### insurance (3 sections + appendix)
- F.1 Insurance Module Overview (7 sub-sections — adding a policy, creating a claim, document requirements, submission, tracking, payment posting, denials)
- F.2 Quick Reference Card
- F.3 Video Tutorial Outline

### statutory-compliance (7 sections, HIGH COMPLEXITY)
1. Legislative framework overview — Act No. 136/2004, EU Regulation 2019/6, Slovak veterinary regulations
2. KVEPIS submission workflow — B2G data export, formatting, submission, error handling
3. Rabies management — vaccination recording, certificate issuance, KVEPIS reporting, titer checks
4. Withdrawal periods (ochranné lehoty) — definition, lookup, application to food-producing animals, documentation
5. CRSZ & PetPass — registration, identification, travel documentation
6. Carcass disposal register — mandatory recording, SNHRA reporting
7. Current limitations (transparent disclosure) — what the system does and does not yet support

### import-export-migration (3 sections)
- F.1 "Importing Data from Your Previous System" — supported formats, mapping, validation
- F.2 "Exporting Accounting Data" — e-Kasa compliance, period ranges, formats
- F.3 "Reviewing Imported History" — verifying completeness, handling gaps

### integrations-api
- API key management — creation, rotation, revocation, scope
- Webhook setup — event subscriptions, payload verification, retry behavior
- Calendar integrations — Google, Apple, Outlook sync (covered in `calendar-feed.md`)

### ai-agent (6 sections)
- F.1 "AI Agent Chat — Enabling Write Operations" — opt-in, scope, safety confirmation
- F.2 "AI-Generated Clinical Content — Review Requirements" — mandatory vet review, attribution
- F.3 "Drug Safety Checker — Limitations" — not a substitute for professional judgment
- F.4 "Marketing Content Generation — Billing & Rate Limits" — usage caps, costs
- F.5 "Voice Dictation — Audio Retention Policy" — storage, deletion, privacy
- F.6 "Statutory Withdrawal Periods — Data Entry Requirements" — accurate input for compliance

### marketing-communications
- Communications overview — channels, audiences, segmentation
- Messaging setup — SMS, email, push notification configuration
- Care reminders — automated recall, vaccination due, follow-up sequences
- Marketing studio — social media posts, waiting room content
- Wellness redemptions — tracking, expiration, promotion

### admin-settings (3+ sections)
- F.1 Settings Overview (13 tabs table — practice, users, roles, services, templates, safety checks, API, billing, statutory, labels, reminders, integrations, localization)
- F.2 Guides — Quick Start Walkthroughs (practice setup, first patient, first invoice, first SOAP note)
- F.3 Data management (import/export/restore/deletion) — full lifecycle of practice data

### auth-onboarding (8 subsections)
- Getting Started — Your First Login
- Creating Your Practice Account
- Inviting Team Members
- Password Reset
- Email Verification (Hosted Only)
- Demo Mode (Evaluation Accounts)
- Client Portal Access
- Roles & Permissions Quick Reference

### reports (10 sections)
- Section 1: Reports Overview — navigation, date ranges, saved reports
- Section 2: Revenue Reports — daily/weekly/monthly, service breakdown, payment methods
- Section 3: Appointment Analytics — volume, no-show rates, utilization
- Section 4: Service Performance Reports — margin, frequency, provider comparison
- Section 5: Inventory Management Reports — stock levels, usage trends, expiry alerts
- Section 6: Statutory Compliance Reports — rabies register, treatment diary, euthanasia register
- Section 7: Legacy Data Reports — historical comparisons, trend analysis
- Section 8: Export and Sharing — PDF, CSV, scheduled delivery
- Section 9: Troubleshooting — common report issues, data gaps
- Section 10: Advanced Features (Future) — custom report builder, predictive analytics

### wellness (2 sections)
- Quick reference (`docs/help/wellness.md`) — plan overview, enrollment, redeemables
- Reference doc (`docs/manual/wellness-billing.md`) — billing workflow, proration, cancellation

### i18n-localization (1 section)
- Short section in Settings/Admin chapter — language toggle, date/number formats, localization configuration

## Coverage gap table

| Domain | Current state | Proposed sections (from §F) | Notes |
|---|---|---|---|
| `core-clinical` | Partial | F.1 SOAP Note, F.2 Vaccination, F.3 Problem List, F.4 Prescription, F.5 Lab Results, F.6 Vital Signs | Existing `your-day.md` covers day sheet but not SOAP writing, problem list, or prescription workflow |
| `scheduling-front-desk` | Full | front_desk: Managing Today's Appointments (9 sub); veterinarian: Daily Appointment Flow (4 sub); admin: Setting Up Scheduling (6 sub) | All covered in existing `your-day.md`, `calendar-feed.md`, `client-portal.md` |
| `clients-portal` | Full | F.1 Pet Portal Getting Started, F.2 Request Appointment, F.3 Pay Invoice, F.4 Portal Link Expired FAQ | All covered in existing `client-portal.md` |
| `billing-finance` | Zero | 1. Invoicing, 2. Payments, 3. e-Kasa, 4. Subscription & Plans, 5. Accounting Exports | No billing-specific help exists — critical gap for practice admins |
| `inventory-pharmacy` | Zero | F.1 Product & Stock, F.2 Controlled Substances, F.3 Drug Dosing Calculator, F.4 Wholesaler Import | No inventory, dosing, or controlled substances help exists |
| `lab-imaging` | Zero | Laboratórne výsledky a analyzátory, Zobrazovacie metódy a AI analýza | No lab results or imaging help exists |
| `insurance` | Zero | F.1 Insurance Module Overview (7 sub), F.2 Quick Reference Card, F.3 Video Tutorial Outline | No insurance provider management help exists |
| `statutory-compliance` | Zero | 1. Legislative Framework, 2. KVEPIS Submission, 3. Rabies, 4. Withdrawal Periods, 5. CRSZ & PetPass, 6. Carcass Disposal, 7. Current Limitations | HIGH COMPLEXITY — 7 sections. No statutory compliance help exists; legal/regulatory domain |
| `import-export-migration` | Partial | F.1 Importing Data, F.2 Exporting Accounting Data, F.3 Reviewing Imported History | Missing e-Kasa export, audit log export, lab analyzer import |
| `integrations-api` | Partial | API Key Management, Webhook Setup, Calendar Integrations | `calendar-feed.md` covers calendar; API keys and webhooks undocumented |
| `ai-agent` | Full | F.1 AI Chat Write Ops, F.2 Clinical Content Review, F.3 Drug Safety Limitations, F.4 Marketing Billing, F.5 Voice Dictation Policy, F.6 Statutory Data Entry | Covered in `ask-the-ai.md` but needs 6 explicit sub-sections for safety disclosures |
| `marketing-communications` | Zero | Communications Overview, Messaging Setup, Care Reminders, Marketing Studio, Wellness Redemptions | No marketing help exists |
| `admin-settings` | Zero | F.1 Settings Overview (13 tabs), F.2 Quick Start Walkthroughs, F.3 Data Management | No admin settings help exists |
| `auth-onboarding` | Zero | 1. First Login, 2. Practice Account, 3. Inviting Team, 4. Password Reset, 5. Email Verification, 6. Demo Mode, 7. Client Portal Access, 8. Roles & Permissions | No login, registration, or demo access help exists |
| `reports` | Zero | 1. Overview, 2. Revenue, 3. Appointment Analytics, 4. Service Performance, 5. Inventory, 6. Statutory Compliance, 7. Legacy Data, 8. Export & Sharing, 9. Troubleshooting, 10. Advanced (Future) | No reports help exists |
| `wellness` | Zero | Quick reference (plans, enrollment, redeemables), Reference doc (billing workflow) | No wellness plan help exists |
| `i18n-localization` | N/A | Short section in Settings/Admin (language toggle, date/number formats) | Infrastructure + user-facing config |

## Persona matrix

| Persona | Primary sections | Secondary sections | Notes |
|---|---|---|---|
| **Front Desk (front_desk)** | Managing Today's Appointments (9 sub), Client Portal Setup, Billing Basics | Your Day Sheet, Calendar Feed Sync, Reports Overview | Needs fast task-oriented guides for check-in, no-shows, rescheduling, payments |
| **Veterinarian (veterinarian)** | Writing a SOAP Note (F.1), Managing the Problem List (F.3), Writing a Prescription (F.4), Your Daily Appointment Flow (4 sub) | Reviewing Lab Results (F.5), Recording a Vaccination (F.2), Drug Safety Checker Limitations (F.3) | Core clinical workflow is SOAP → Problem List → Prescription. Needs safety check disclosures throughout |
| **Veterinary Technician (technician)** | Recording a Vaccination (F.2), Recording Vital Signs (F.6), Reviewing Lab Results (F.5) | Managing Today's Appointments (front_desk sub-sections), SOAP Notes (F.1, as support) | Often acts as dual front-desk/vet-tech; needs cross-referenced sections |
| **Admin / Practice Owner (admin)** | Setting Up Scheduling (6 sub), Billing & Finance (5 sections), Inventory & Pharmacy (4 sections), Statutory Compliance (7 sections), System Settings (F.1 13 tabs), Reports (10 sections) | Data Management (F.3), AI Agent Write Ops (F.1), API Key Management, Insurance Module | Highest section count — admin persona is the default for solo practitioners |
| **Client (client)** | Pet Portal Getting Started (F.1), Requesting an Appointment (F.2), Paying Invoice Online (F.3), Portal Link Expired FAQ (F.4) | — | Client portal has its own help ecosystem; sections are self-contained |
| **Eval / Demo User** | Demo Mode (auth-onboarding), Quick Start Walkthroughs (F.2), AI Chat Write Ops (F.1) | — | Temporary accounts need fast onboarding without full setup |

## Language strategy resolution

- **Current mismatch:** `docs/help/*.md` are English prose describing a Slovak-labeled UI.
- **Proposal:** All new help pages will be written in the same language as the UI label they describe.
  - If the UI button says `"Marketingové Štúdio"`, the SK help page uses that term and explains it in Slovak.
  - If the UI button says `"Marketing Studio"`, the EN help page uses that term and explains it in English.
- This eliminates the mental translation burden and aligns documentation with the user's actual experience.

### i18n findings that affect documentation

Analysis of `i18n-localization.md` §E uncovered the following issues that directly impact the manual's language strategy:

1. **12/19 custom-nav i18nKeys missing from dictionaries** — Both `sk.json` and `en.json` lack entries for 12 of 19 custom navigation keys. This means the sidebar displays fallback labels that are not consistent with the i18n system. Documentation referencing these labels must note which terms are hardcoded vs. i18n-keyed.

2. **Hardcoded Slovak labels as fallbacks in `custom-nav.ts`** — When i18n keys are missing, the component falls back to hardcoded Slovak strings. This creates a de facto Slovak-only experience for custom nav items regardless of user language preference. The manual's language toggle documentation must clarify which sidebar items are affected.

3. **Top-bar routeLabels have mixed-language fallbacks** — English labels for vanilla routes, Slovak labels for custom routes. Users switching to English see a hybrid UI (English standard menus + Slovak custom menus). Help pages must document this current limitation.

4. **Brand header hardcoded Slovak text** — `"MVDr. Martin Sýkora"` and `"Súkromná veterinárna ambulancia"` are hardcoded in the brand header component and not i18n-keyed. These will appear in Slovak regardless of user preference. Manual should note this in Settings → Localization tab.

5. **PDF sanitizeForPdf() strips Slovak diacritics** — The sanitization function converts č→c, š→s, ä→a, etc. This means exported PDFs lose Slovak character encoding. Documentation for any PDF export feature must warn users that Slovak diacritics will be lost in PDF output. This is a known limitation.

6. **`<html lang="sk">` hardcoded in SSR** — The root HTML lang attribute is statically set to Slovak regardless of user preference. This affects screen readers and browser translation prompts. The manual should note this in the accessibility/accessibility considerations section.
