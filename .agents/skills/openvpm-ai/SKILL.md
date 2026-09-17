---
name: openvpm-ai
description: Architectural guidelines, zero-conflict upstream sync, strict i18n rules, and Slovak veterinary compliance for OpenVPM AI.
---

# OpenVPM AI Development Guidelines & Skill

This skill enforces core architectural rules, zero-conflict upstream synchronization, multilingual stability, veterinary clinical safety gates, and statutory compliance for OpenVPM AI.

## Development Environment & Reference Instance

- **Primary Project (Active Development):**
  - Path: `./openvpm-ai` (`C:\Users\marek\Documents\Vet\openvpm-ai`)
  - Dev Server Port: **3001** (`http://localhost:3001`)
  - Database: Docker PostgreSQL `openvpm-postgres-1` (port **5434**, DB `openvpm_ai`)
  - All new features, Slovak localization, statutory compliance, e-Kasa, and AI extensions are built and committed here.
- **Reference Project (Vanilla / Upstream Inspiration):**
  - Path: `../OpenVPM` (`C:\Users\marek\Documents\Vet\OpenVPM`)
  - Dev Server Port: **3005** (`http://localhost:3005`)
  - Use this vanilla instance as a live baseline to inspect original workflows, component patterns, and upstream behavior before introducing custom extensions.

---

## 1. Architectural Guardrails (Zero-Conflict Upstream Sync)

- **Do NOT modify vanilla tables directly:**
  Never alter existing upstream table definitions in `packages/db/schema/*.ts`.
- **Isolated `ext_*` Schemas:**
  All new tables and enums MUST live in `packages/db/schema/ext_{name}.ts`:
  - `ext_ekasa.ts` (fiscalization receipts and offline queues)
  - `ext_imaging.ts` (DICOM and veterinary medical imaging)
  - `ext_statutory.ts` (KVL and ŠVPS statutory registries)
  - `ext_discharge.ts` (discharge summaries and condolence letters)
  - `ext_marketing.ts` (campaigns, reviews, handouts, staff tasks)
  - `ext_automation.ts` (durable event bus, rules engine, customer journeys, suppression audit)
  - `ext_crm.ts` (12 CRM segments and client memberships)
  - `ext_content_calendar.ts` (5 content pillars and approval queue briefs)
  - `ext_channel_accounts.ts` (encrypted OAuth account store for GBP, FB, IG, YouTube)
  - `ext_support.ts`, `ext_voice.ts`
  Export them via wildcard in `packages/db/schema/index.ts`:
  ```ts
  export * from "./ext_automation";
  export * from "./ext_crm";
  export * from "./ext_content_calendar";
  export * from "./ext_channel_accounts";
  ```
- **Database Migrations via `pnpm db:push`:**
  Always use `pnpm db:push` for development schema updates to keep the upstream migration journal `_journal.json` pristine. Never accept upstream merges or edits that touch or corrupt `_journal.json`.
- **Single tRPC Mount Point:**
  Mount all custom extension routers inside `apps/web/server/routers/extensions/` and attach under `extensions: extensionsRouter` in `apps/web/server/routers/_app.ts`:
  ```ts
  trpc.extensions.automationRules.*
  trpc.extensions.automationJourneys.*
  trpc.extensions.automationChannels.*
  trpc.extensions.crmSegments.*
  trpc.extensions.automationSuppression.*
  trpc.extensions.automationContent.*
  trpc.extensions.labImport.*
  ```
- **Modular Navigation via `custom-nav.ts`:**
  Do NOT modify `sidebar.tsx` directly to hardcode links. Instead, add items to `apps/web/config/custom-nav.ts`. They are merged into sidebar sections dynamically at runtime.
- **Upstream Merge & Verification Protocol:**
  When pulling or backporting changes from `upstream/main` (`https://github.com/evangauer/openvpm.git`):
  1. Inspect incoming changes: `git log upstream/main..main` and `git log main..upstream/main`.
  2. Ensure vanilla schemas in `packages/db/schema/*.ts` remain untouched.
  3. Re-verify 100% dictionary symmetry between `messages/en.json` and `messages/sk.json`.
  4. Run the full verification suite:
     ```bash
     pnpm --filter @openpims/web test lib/autopilot lib/marketing server/__tests__/marketing server/__tests__/autopilot-e2e-journeys server/__tests__/copilot-lab-flow config/__tests__/custom-nav-i18n.test.ts responsive-tables
     pnpm --filter @openpims/web type-check
     ```

---

## 2. Strict Multilingual Compatibility (i18n)

- **No Route Rewriting:**
  Do NOT add `app/[locale]/...` URL path prefixes. URLs must remain clean and canonical (`/schedule`, `/billing`, `/patients`, `/records`, `/marketing/automations`).
- **English as Safe Fallback & 100% Symmetry:**
  Maintain 100% dictionary key symmetry between `apps/web/messages/en.json` and `apps/web/messages/sk.json` (currently 5,265+ keys each with 0 missing).
  Verify symmetry with:
  ```bash
  node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); /* compare keys */"
  ```
- **Nested JSON Structure:**
  Always nest keys as JSON objects (e.g. `nav: { wellnessRedemptions: "..." }`). Never add root-level dotted strings (`"nav.wellnessRedemptions": "..."`) as dictionary resolvers will fail.
- **`useI18n()` Hook Usage & Zero Hardcoded JSX Text (Anti-Bypass Rule):**
  - All user-facing natural language text in JSX/TSX components (headers, banners, role switchers, buttons, labels, placeholders, aria-labels, tooltips, dialogs) MUST be routed through `useI18n()`.
  - Never leave raw English text directly in JSX elements (`<p>Like this workflow? ...</p>`).
  - Always use `const { t } = useI18n();` with dot notation, inline fallback, and optional parameters:
    ```ts
    t("marketing.automations.channelConnected", `Kanál "${name}" bol pripojený.`, { name })
    ```
- **"Demo & Marketing Infrastructure" Blind Spot Warning:**
  - Automated dictionary symmetry tests verify that `sk.json` and `en.json` match, but they DO NOT detect hardcoded JSX strings in components that bypass `useI18n()` altogether.
  - Components imported from upstream marketing/demo infrastructure (`apps/web/components/demo/demo-conversion-bar.tsx`, `apps/web/components/demo/demo-role-switcher.tsx`, `apps/web/lib/demo-role-switcher.ts`, `apps/web/components/onboarding/*`, `apps/web/app/(auth)/login/*`, `apps/web/app/(auth)/register/*`) are common culprits that bypassed localization.
  - All demo bar strings, role names, and conversion prompts must be fully localized with keys in `messages/sk.json` and `messages/en.json`.
- **Standard Slovak Role Nomenclature:**
  When translating system and demo roles in UI and switchers, use standardized Slovak terminology:
  - `admin` → **Správca praxe** (or Správca kliniky)
  - `veterinarian` → **Veterinárny lekár**
  - `technician` → **Veterinárny asistent / technik**
  - `front_desk` → **Recepcia**
  - `viewer` → **Prehliadajúci**
- **Brittle Regression Test Precautions:**
  - Beware of legacy upstream unit tests that assert raw English string literals in `.tsx` file content (e.g. `expect(bar).toContain("Start my clinic")` in `apps/web/lib/__tests__/demo-conversion-ui.test.ts`).
  - When localizing these components, always refactor the corresponding tests to check for i18n keys or localized translations so that translation does not break the test suite.
- **Standardized Server Error Messages:**
  tRPC server routers must throw standard English error messages (e.g. `"Patient not found"`, `"Channel account not found"`). All user-facing localization happens on the client via `useI18n()`.

---

## 3. Clinical & Safety Gates (Veterinary Ethics & Slovak Legislation)

- **Unconditional Sympathy Flow Safety Gate (SKILL.md §3):**
  When a patient's status is `deceased` or after recorded euthanasia, the system MUST strictly enforce:
  - **Automated Outreach Blocking:** Immediately suppress all automated vaccination reminders, care reminders, post-visit review asks ("Google Review Ask"), and promotional marketing.
  - **Auto-Dismissal of Care Reminders:** `applySympathyGate` automatically updates open `careReminders` for the deceased pet to `status: "dismissed"` with reason `"Sympathy Gate: Pacient uhynul / bol eutanazovaný."`.
  - **Defensive Queue Filtering:** `careReminders.list` queries for `status === "open"` must filter out deceased pets (`sql`${patients.status} is distinct from 'deceased'``).
  - **Audit Logging:** Every blocked outreach is logged to `ext_automation_suppression_log` with `suppressionType: "deceased_patient"`.
  - **Staff Condolence Task:** Automatically creates an internal staff condolence task in `extMarketingStaffTasks` for compassionate outreach.
- **Zákon 39/2007 Z. z. (§3) — Human-in-the-Loop & KVL Signature:**
  - AI is strictly an assistant and CANNOT directly commit clinical assertions into the Treatment Diary (Kniha ošetrení) or medical records.
  - All AI drafts (Voice→SOAP, PDF→Lab, content briefs) must remain in `draft` status until explicitly reviewed, verified, and signed by a licensed KVL veterinarian via **`ClinicalDiffConfirmModal`**.
- **Zákon 139/1998 Z. z. — STRICT ZERO AI Prefill for Controlled Substances:**
  - Controlled substances (omamné a psychotropné látky — Schedule I/II opiates, ketamine, propofol, butorphanol, fentanyl) MUST HAVE ZERO AI PREFILL.
  - The system must actively detect controlled substance codes/names, blank out AI proposals, and require manual, authenticated entry and signature by the attending veterinarian.
- **Veterinary Supervision over Social Media & Marketing Claims:**
  - Any clinical claim (treatment advice, dosage, disease prevention) in social media content briefs must satisfy the database check constraint `clinicalApprovalCheck` and record the approving veterinarian's UUID.
- **Medical Imaging File Ownership:**
  Medical imaging uploads (`xray`, `ct`, `mri`, `ultrasound`, `photo`) must use category `"imaging"` and attach to the patient record WITHOUT overwriting `patient.photoUrl`.
- **Legal Statutory Registers (ŠVPS SR & KVL SR):**
  - Rabies Register (Kniha besnoty) with 3-day notification window to RVPS.
  - Treatment Diary (Kniha ošetrení) with withdrawal period (ochranná lehota) tracking.
  - Euthanasia Register with exact dosing and rendering plant disposal records.
  - Controlled Substances Register with immutable audit ledger.
  - Informed consent protocols (Anesthesia, Surgery, Hospitalization, Euthanasia).

---

## 4. Next.js 15 & React 19 Runtime Stability & Hydration Guardrails

- **`experimental.optimizePackageImports` is Production-Only:**
  In `apps/web/next.config.js`, `optimizePackageImports` MUST be restricted to `process.env.NODE_ENV === "production"`. In development with Turbopack, package import optimization causes HMR boundary desyncs and hydration crashes.
- **Localhost Service Worker Ban:**
  Service workers MUST NEVER register or cache on `localhost`. Registration must be gated with `process.env.NODE_ENV === "production" && window.location.hostname !== "localhost"`. In development, `lib/providers.tsx` must actively unregister service workers and purge caches to prevent stale chunk freezing.
- **Theme Hydration Safety:**
  Components relying on client-side theme selection (`ThemeSwitcher`, `ThemeProvider`) must gate theme-dependent DOM rendering behind an explicit `mounted` state flag to prevent SSR/CSR HTML mismatches.
- **Responsive Table Governance:**
  All rendered JSX tables in `app/(dashboard)` and `app/portal` MUST be wrapped in `<div className="overflow-x-auto">` or `<TableScroll>`.
  - Governance tests (`responsive-tables.test.ts`) MUST use TypeScript AST parsing (`ts.createSourceFile`) to inspect genuine JSX `<table>` opening elements, avoiding false-positive failures on printable A4 report string templates.

---

## 5. Slovak Fiscal Compliance (e-Kasa — Zákon 289/2008 Z. z.)

- **Isolated Fiscal Driver:**
  All e-Kasa logic lives in `packages/db/schema/ext_ekasa.ts`, `apps/web/lib/ekasa/`, and `apps/web/server/routers/extensions/ekasa.ts`.
- **Offline Resiliency & Deduplication:**
  Every e-Kasa receipt request uses cryptographic UUID idempotency keys and an offline sync queue to handle fiscal printer disconnects or Internet dropouts without double-charging or orphaned financial records.
- **Slovak VAT Slabs:**
  Ensure support for standard and reduced Slovak VAT rates (20%, 10%, 5% / 23%, 19%, 5% per tax consolidation rules) and correct item categorization (goods vs veterinary medical services).

---

## 6. AI Agent, Copilot & Inference Standards

- **Multimodal Inference:**
  Use `configuredModel()` or inference proxy with Vercel AI SDK (`generateText`).
- **Storage Direct Reads:**
  Always load medical files directly from object storage via `readPrimaryObject(file.fileKey)` from `@/lib/s3`. Never perform HTTP self-fetch loops against `/api/files/...`.
- **Confidence Score Calibration:**
  All AI extraction modules (Voice SOAP, PDF Lab parser, OCR) must expose calibrated confidence scores categorized into 3 standardized tiers:
  - **High (`>= 0.92`):** Green badge — high reliability, safe for rapid verification.
  - **Medium (`0.75 – 0.91`):** Amber badge — manual review recommended.
  - **Low (`< 0.75`):** Red badge — low reliability, mandatory line-by-line validation.
  Rendered using the standard component **`ConfidenceScoreBadge`**.
- **Human-in-the-Loop Confirmation:**
  All Copilot entries must pass through **`ClinicalDiffConfirmModal`** showing side-by-side original vs proposed values before committing to the patient ledger.
- **GDPR 24-Hour Voice Purge:**
  Raw audio files used for voice transcription and SOAP drafting must be scheduled for deletion within 24 hours.

---

## 7. Autopilot, CRM & Reputation Governance

- **Durable Event Bus (`ext_automation_events`):**
  - 5 core trigger points must emit durable events:
    1. `visit_completed` (encounters/appointments)
    2. `appointment_no_show` (appointments)
    3. `appointment_booked` (appointments)
    4. `vaccine_due` (records vaccination entries)
    5. `surgery_completed` (post-op scheduling)
  - Events must specify a unique `dedupeKey` and start in `status: "pending"` before processing by the background worker.
- **5 Canonical Customer Journeys:**
  1. `welcome_new_client` (onboarding + welcome message + 7-day feedback)
  2. `post_visit_followup` (thank you + 24h review ask)
  3. `vaccine_reminder_journey` (14d reminder + 3d countdown + overdue notice)
  4. `post_operative_care` (24h condition check + day 3 recovery + day 10 suture check)
  5. `patient_reactivation` (12-month recall for inactive pets)
- **12 Canonical CRM Segments (`ext_crm_segments`):**
  Deterministic segmentation (`puppy_kitten`, `senior_pet`, `chronic_patient`, `vip_clients`, `churn_risk`, `unvaccinated_overdue`, `wellness_enrolled`, `dental_attention`, `post_op_recovery`, `frequent_flyer`, `weight_management`, `lapsed_inactive`) — the single canonical set implemented by `lib/autopilot/segmentation-engine.ts` (`CRM_SEGMENT_DEFINITIONS`) and seeded by `packages/db/seed-marketing.ts`.
- **OAuth Token Security (`ext_channel_accounts`):**
  Tokens for Google Business Profile, Facebook, Instagram, and YouTube MUST be encrypted at rest and NEVER exposed over tRPC APIs.
- **Reputation SLA & Reception Escalation:**
  Incoming reviews in `extMarketingReviews` must track a 24h response SLA. Negative reviews (`rating <= 2`) must automatically set `escalationStatus: "pending"` and route to `extMarketingStaffTasks`.
- **Unified Suppression Center (GDPR Art. 22):**
  All suppressed messages must be logged to `ext_automation_suppression_log` with explicit reason codes (`sympathy_gate`, `quiet_hours`, `sms_rate_limit`, `opt_out`, `frequency_cap`).
  - Legal basis: `contract` for transactional reminders; `consent` / `legitimate_interest` for promotional campaigns.
