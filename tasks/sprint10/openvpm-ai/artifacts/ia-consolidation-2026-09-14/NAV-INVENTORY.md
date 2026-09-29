# NAV-INVENTORY — Complete Navigation Item Inventory

**Commit:** `65e008d` | **Date:** 2026-09-14

> Source of truth for all cluster subagent analyses. Every nav-reachable destination from sidebar.tsx (vanilla) and custom-nav.ts (custom).

---

## Prehľad (Dashboard Overview)

| Nav label (SK) | Route | Source | Section | Roles | Backing router/lib | Backing DB tables | Purpose [VERIFIED] |
|---|---|---|---|---|---|---|---|
| Prehľad | `/` | vanilla | *(standalone)* | all | `trpc.dashboard.*` | `appointments`, `patients`, `invoices`, `encounters` | Practice overview KPIs and today's schedule snapshot |

---

## Section: Klinika & Pacienti (Clinical)

| Nav label (SK) | Route | Source | Section | Roles | Backing router/lib | Backing DB tables | Purpose [VERIFIED] |
|---|---|---|---|---|---|---|---|
| Pacienti | `/patients` | vanilla | clinical | all | `trpc.patients.*` | `patients`, `clients` | Patient registry CRUD, merge, history, microchip lookup |
| Záznamy | `/records` | vanilla | clinical | all | `trpc.records.*` | `soap_notes`, `vaccinations`, `prescriptions`, `lab_results`, `problems`, `procedures` | Patient medical record hub — SOAP, vaccinations, prescriptions, labs, problem list, procedures |
| Vyšetrenia | `/encounters` | vanilla | clinical | all | `trpc.encounters.*`, `trpc.appointments.*` | `encounters`, `appointments` | Visit/encounter list, SOAP note editor per visit, visit closeout, follow-ups |
| Laboratórium | `/lab-results` | vanilla | clinical | all | `trpc.records.listLabResults.*`, `trpc.records.completeLabResult`, `trpc.extensions.labImport.*` | `lab_results`, `ext_lab_imports` | Lab result inbox/review queue; lab PDF import; trend charts |
| Zdravotné pripomienky | `/care-reminders` | vanilla | clinical | all | `trpc.careReminders.*` | `care_reminders` | Proactive wellness/vaccination reminders per patient — create, send outreach, dismiss |
| Pripomienky | `/recalls` | vanilla | clinical | admin/vet/front_desk | `trpc.notifications.getVaccinationRecallPreview`, `trpc.notifications.sendVaccinationReminders` | `vaccinations`, `patients`, `clients` | Batch vaccination recall messaging — preview & send |
| Analýza Snímkov | `/agent/imaging` | **custom** | clinical | admin/vet | `trpc.extensions.imaging.*` | `ext_imaging_studies`, `ext_imaging_findings`, `soap_notes` | AI X-ray/image analysis with VHS calculator; inject findings into SOAP; marketing quiz generator |

---

## Section: Recepcia & Tok (Front Desk)

| Nav label (SK) | Route | Source | Section | Roles | Backing router/lib | Backing DB tables | Purpose [VERIFIED] |
|---|---|---|---|---|---|---|---|
| Rozvrh | `/schedule` | vanilla | frontDesk | all | `trpc.appointments.*`, `trpc.booking.*` | `appointments`, `providers`, `appointment_types` | Calendar scheduling, appointment CRUD, drag/drop, doctor/room assignment |
| Čakáreň | `/waiting-room` | vanilla | frontDesk | all | `trpc.whiteboard.*` | `appointments` | Waiting-room display board — checked-in patients |
| Prevádzková tabuľa | `/whiteboard` | vanilla | frontDesk | all | `trpc.whiteboard.*` | `appointments`, `encounters` | Live (30s poll) patient flow board — all active visits, status transitions |
| Klienti | `/clients` | vanilla | frontDesk | all | `trpc.clients.*` | `clients`, `patients`, `wellness_enrollments` | Client registry, portal access, wellness enrollment, insurance |
| Správy | `/inbox` | vanilla | frontDesk | admin/vet/tech/front_desk | `trpc.communications.*`, `trpc.messaging.*` | `conversations`, `messages`, `sms_log` | Internal + client messaging inbox; conversation threads |

---

## Section: Lekáreň & Sklad (Pharmacy / Inventory)

| Nav label (SK) | Route | Source | Section | Roles | Backing router/lib | Backing DB tables | Purpose [VERIFIED] |
|---|---|---|---|---|---|---|---|
| Sklad | `/inventory` | vanilla | pharmacy | all | `trpc.inventory.*` | `products`, `inventory_movements`, `dispense_charge_queue` | Product catalog, stock levels, dispensing queue, reorder alerts |
| Omamné látky | `/controlled-substances` | vanilla | pharmacy | admin/vet | `trpc.controlledSubstances.*` | `controlled_substance_log` | Controlled substance logging with witness enforcement; Schedule I/II audit trail |

---

## Section: Účtovníctvo & Predpisy (Billing / Statutory)

| Nav label (SK) | Route | Source | Section | Roles | Backing router/lib | Backing DB tables | Purpose [VERIFIED] |
|---|---|---|---|---|---|---|---|
| Fakturácia | `/billing` | vanilla | billing | all | `trpc.billing.*` | `invoices`, `invoice_items`, `payments`, `wellness_enrollments` | Invoice CRUD, payments, POS, wellness billing panel |
| Zákonné registre | `/statutory` | vanilla | billing | admin/vet | `trpc.extensions.statutory.*`, `trpc.extensions.kvepis.*`, `trpc.extensions.crsz.*` | `ext_statutory_*`, `ext_crsz_*`, `ext_kvepis_*` | Rabies register, treatment diary, euthanasia register, controlled substance register, CRSZ chip lookup, KVEPIS B2G |
| Prehľady | `/reports` | vanilla | billing | admin/vet | `trpc.reports.*` | `invoices`, `appointments`, `patients`, `inventory_movements` | Financial + clinical reports; accountant exports |
| e-Kasa Doklady | `/billing/ekasa` | **custom** | billing | admin/vet/front_desk | `trpc.extensions.ekasa.*` | `ext_ekasa_receipts`, `ext_ekasa_offline_queue` | Slovak fiscal receipt issuance, storno, daily closure, ORP/VRP integration |

---

## Section: Správa & Manažment (Admin / Management)

| Nav label (SK) | Route | Source | Section | Roles | Backing router/lib | Backing DB tables | Purpose [VERIFIED] |
|---|---|---|---|---|---|---|---|
| Platform Admin | `/admin` | vanilla | admin | admin | `trpc.admin.*` | `practices`, `users`, `subscriptions` | Multi-tenant practice management, user admin, subscription, audit |
| Nastavenia | `/settings` | vanilla | admin | admin | `trpc.settings.*` | `practices`, `services`, `rooms`, `appointment_types`, `users`, `wellness_plans`, `templates` | 13-tab clinic configuration: practice info, staff, locations, appointment types, services, templates, wellness plans, messaging, billing, brand kit, booking, data import/export |
| Agent | `/agent` | vanilla | admin | admin/vet | `trpc.agent.*`, `lib/agent/runner.ts`, `lib/agent/tools.ts` | reads 26 tool schemas | AI assistant chat — 26 tools (10 write-capable); audit-chained; billing-gated |
| Marketingové Štúdio | `/marketing` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_content_items`, `ext_marketing_channel_accounts`, `ext_marketing_reviews`, `ext_marketing_staff_tasks` | Marketing hub dashboard — KPIs, content pipeline overview, channel status |
| Brand Kit | `/marketing/brand-kit` | **custom** | admin | admin/vet | `trpc.extensions.marketing.*` | `ext_marketing_brand_kit` (via `practices.settings.brandKit`) | Brand colors, tone of voice, social handles, logo — used as creative context for AI content |
| Plán obsahu | `/marketing/plan` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_content_items`, `ext_content_calendar_briefs` | AI-assisted content calendar — schedule posts, assign pillars, view queue |
| Schvaľovanie obsahu | `/marketing/content-queue` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_content_items`, `ext_content_calendar_briefs` | Approval queue for AI-generated content before publishing |
| Recenzie | `/marketing/reviews` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_reviews`, `ext_marketing_staff_tasks` | Google/Facebook review inbox, 24h SLA tracking, escalation to staff tasks |
| Letáky | `/marketing/handouts` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_handouts` | AI-generated patient education handouts (PDFs) |
| Správy & SMS | `/marketing/messages` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*`, `trpc.messaging.*` | `ext_marketing_sms_log`, `conversations` | Outbound marketing SMS/email; NOT the same as inbox Správy (`/inbox`) |
| Web kliniky | `/marketing/website` | **custom** | admin | admin/vet | `trpc.extensions.marketing.getWebsiteConfig`, `.getPublicWebsiteData`, `.updateWebsiteSections` | `ext_marketing_website_config`, `ext_marketing_website_inquiries` | Clinic public website builder — sections editor, preview, live stats (pulls patient count, review count, staff count) |
| Čakáreň TV | `/marketing/tv` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_content_items`, `ext_marketing_handouts` | Waiting-room TV display — slides show reviews, handouts, content |
| Automatizácie | `/marketing/automations` | **custom** | admin | admin/vet | `trpc.extensions.automationRules.*`, `trpc.extensions.automationJourneys.*`, `trpc.extensions.automationChannels.*` | `ext_automation_rules`, `ext_automation_journeys`, `ext_automation_events`, `ext_channel_accounts` | CRM automation rules, 5 customer journeys, channel OAuth accounts |
| Centrum potlačení | `/marketing/suppression` | **custom** | admin | admin/vet | `trpc.extensions.automationSuppression.*` | `ext_automation_suppression_log` | GDPR suppression center — opt-outs, sympathy gate log, quiet hours, frequency caps |
| Súhlasy & skripty | `/marketing/consents` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.*` | `ext_marketing_consent_forms`, `ext_marketing_scripts` | Consent form templates + call/reception scripts |
| Knižnica médií | `/marketing/media` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.listMediaAssets`, `.createMediaAsset`, `.applyMediaEdit`, `.suggestMediaAltText` | `ext_marketing_media_assets` | Marketing media library — upload images/videos for social posts, handouts, TV, website |
| Čerpanie benefitov | `/marketing/wellness` | **custom** | admin | admin/vet/front_desk | `trpc.extensions.marketing.listWellnessRedemptions`, `.redeemWellnessBenefit` | `wellness_enrollments` | Wellness benefit redemption tracker — log which benefits a client has used (NOT plan management) |
| Hlasové Diktovanie | `/agent/voice` | **custom** | admin | all | `trpc.extensions.voice.*` | `ext_voice_sessions`, `soap_notes` | Voice-to-SOAP dictation — record audio, AI transcribes + structures into SOAP draft |
| Prepúšťacie Správy | `/agent/discharge` | **custom** | admin | admin/vet/tech/front_desk | `trpc.extensions.discharge.*` | `discharge_reports`, `patients`, `ext_ai_audit_log` | AI discharge summary generator — select patient (optionally appointment), generate, confirm, save, SMS to client |
| Vet Intelligence | `/vet-intel` | **custom** | admin | admin/vet | `trpc.extensions.marketing.listCompetitorSnapshots`, `.runCompetitorAnalysis` | `ext_marketing_competitor_snapshots` | Competitor monitoring — AI analysis of competitor websites/GBP, digest emails |
| Vzdialená Podpora | `/support` | **custom** | admin | all | `trpc.extensions.support.createSession`, `.startSession`, `.endSession` | `ext_support_sessions` | Remote support session — clinic initiates, gets code; support agent joins via session code |
| Admin Podpora | `/admin/support` | **custom** | admin | admin only | `trpc.extensions.support.endSession`, `.getSessionByCode` | `ext_support_sessions` | Support-agent side of remote session — join by code, observe/take-over |
| Pilotná Reconciliácia | `/admin/pilot` | **custom** | admin | all | `trpc.extensions.reconciliation.*` | `ext_reconciliation_discrepancies`, reads `appointments`, `clients`, `patients`, `invoices` | Daily parity check vs VetSoftware v2 shadow-run — discrepancy reporting for pilot period |

---

## Orphaned Routes (not in nav, but route exists)

| Route | Page file | Status |
|---|---|---|
| `/marketing/competitors` | `apps/web/app/(dashboard)/marketing/competitors/page.tsx` | Not in custom-nav.ts — accessible only via direct URL or from Vet Intel page link [INFERRED] |
| `/marketing/scripts` | `apps/web/app/(dashboard)/marketing/scripts/page.tsx` | Not in custom-nav.ts — the "Súhlasy & skripty" nav item at `/marketing/consents` may deep-link here |
| `/billing/pos` | `apps/web/app/(dashboard)/billing/pos/page.tsx` | Not in nav — accessible via billing page POS button |
| `/billing/new` | `apps/web/app/(dashboard)/billing/new/page.tsx` | Not in nav — new invoice creation flow |
| `/admin/pilot` | `apps/web/app/(dashboard)/admin/pilot/page.tsx` | IS in custom-nav.ts as "Pilotná Reconciliácia" — visible to all roles |
| `/onboarding` | `apps/web/app/(dashboard)/onboarding/page.tsx` | Not a persistent nav item — shown during setup only |

---

## Summary Counts

| Source | Count |
|---|---|
| Vanilla nav items (incl. overview) | **20** [VERIFIED: sidebar.tsx href extraction] |
| Custom nav items | **22** [VERIFIED: custom-nav.ts href extraction] |
| **Total nav items in sidebar** | **42** |
| Additional orphaned routes (not in nav, route exists) | 4 (competitors, scripts, billing/pos, billing/new) |
| Distinct sidebar sections | 5 + overview |
| Effective items in "Správa & Manažment" (admin section) | **~19** (3 vanilla + up to 16 custom assigned to admin, depending on role) |

> Note: NAV-RESTRUCTURE-PROPOSAL.md references "44 items" — this includes the 2 orphaned routes `/marketing/competitors` and `/marketing/scripts` that have route files but are not in the sidebar nav. The 42 figure is the correct nav-item count.
