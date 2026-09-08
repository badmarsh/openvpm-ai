---
name: openvpm-ai
description: Architectural guidelines, zero-conflict upstream sync, strict i18n rules, and Slovak veterinary compliance for OpenVPM AI.
---

# OpenVPM AI Development Guidelines & Skill

This skill enforces core architectural rules, zero-conflict upstream synchronization, multilingual stability, and veterinary clinical safety gates for OpenVPM AI.

## Development Environment & Reference Instance

- **Primary Project (Active Development):**
  - Path: `./openvpm-ai` (`C:\Users\marek\Documents\Vet\openvpm-ai`)
  - Dev Server Port: **3001** (`http://localhost:3001`)
  - All new features, Slovak localization, statutory compliance, e-Kasa, and AI extensions are built and committed here.
- **Reference Project (Vanilla / Upstream Inspiration):**
  - Path: `../OpenVPM` (`C:\Users\marek\Documents\Vet\OpenVPM`)
  - Dev Server Port: **3005** (`http://localhost:3005`)
  - Use this vanilla instance as a live baseline to inspect original workflows, component patterns, and upstream behavior before introducing custom extensions.

## 1. Architectural Guardrails (Zero-Conflict Upstream Sync)

- **Do NOT modify vanilla tables directly:**
  Never alter existing upstream table definitions in `packages/db/schema/*.ts`.
- **Isolated `ext_*` Schemas:**
  All new tables and enums MUST live in `packages/db/schema/ext_{name}.ts` (e.g., `ext_ekasa.ts`, `ext_imaging.ts`, `ext_statutory.ts`, `ext_discharge.ts`, `ext_marketing.ts`, `ext_support.ts`, `ext_voice.ts`). Export them via wildcard in `packages/db/schema/index.ts`:
  ```ts
  export * from "./ext_ekasa";
  export * from "./ext_imaging";
  ```
- **Database Migrations via `pnpm db:push`:**
  Always use `pnpm db:push` for development schema updates to keep the upstream migration journal `_journal.json` pristine. Never accept upstream merges or edits that touch or corrupt `_journal.json`.
- **Single tRPC Mount Point:**
  Mount all custom extension routers inside `apps/web/server/routers/extensions/` and attach under `extensions: extensionsRouter` in `apps/web/server/routers/_app.ts`:
  ```ts
  trpc.extensions.ekasa.*
  trpc.extensions.imaging.*
  trpc.extensions.statutory.*
  ```
- **Modular Navigation via `custom-nav.ts`:**
  Do NOT modify `sidebar.tsx` directly to hardcode links. Instead, add items to `apps/web/config/custom-nav.ts`. They are merged into the sidebar sections dynamically at runtime.
- **Upstream Merge & Backport Protocol:**
  When pulling or backporting changes from `upstream/main` (`https://github.com/evangauer/openvpm.git`):
  1. Inspect incoming changes: `git log upstream/main..main` and `git log main..upstream/main`.
  2. Ensure vanilla schemas in `packages/db/schema/*.ts` remain untouched.
  3. Re-verify 100% dictionary symmetry between `messages/en.json` and `messages/sk.json`.
  4. Run targeted safety suites (`ai-draft-safety.test.ts`, `care-reminders-safety.test.ts`, `responsive-tables.test.ts`) and `pnpm --filter @openpims/web type-check` immediately after merge.

## 2. Strict Multilingual Compatibility (i18n)

- **No Route Rewriting:**
  Do NOT add `app/[locale]/...` URL path prefixes. URLs must remain clean and canonical (`/schedule`, `/billing`, `/patients`, `/records`, `/agent/imaging`).
- **English as Safe Fallback & 100% Symmetry:**
  Maintain 100% dictionary key symmetry between `apps/web/messages/en.json` and `apps/web/messages/sk.json` (verified via key comparison scripts). Missing keys in Slovak must fall back cleanly to English or inline defaults.
- **Modular i18n Architecture:**
  All i18n logic lives in `apps/web/lib/i18n/`, `apps/web/components/i18n/`, and `apps/web/messages/`.
- **`useI18n()` Hook Usage:**
  Always use `const { t } = useI18n();` with dot notation and parameters:
  ```ts
  t("nav.agentImaging", "Image Analysis")
  t("patients.count", "{count} patients", { count: 5 })
  ```
- **Standardized Server Error Messages:**
  TRPC server routers must throw standard English error messages (e.g. `"Patient not found"`, `"Vaccination record not found"`). All user-facing localization happens on the client via `useI18n()`.

## 3. Clinical & Safety Gates (Veterinary Ethics)

- **Sympathy Flow Safety Gate (Euthanasia / Deceased Patient Protection):**
  When a patient's status is `deceased` or after a recorded euthanasia, the system MUST strictly enforce:
  - **Automated Outreach Blocking:** Unconditionally block automated vaccination and care reminder SMS/emails, post-discharge review requests ("Google Review Ask"), and promotional marketing triggers.
  - **Auto-Dismissal of Care Reminders:** Calling `applySympathyGate` automatically updates any open `careReminders` for the deceased patient to `status: "dismissed"` with `dismissalReason: "Sympathy Gate: Pacient uhynul / bol eutanazovaný."`.
  - **Multi-Pet Client Protection:** Marketing triggers without a specific `patientId` must check if all active patients for that client are deceased. If so, marketing outreach is blocked and `applySympathyGate` is invoked.
  - **Defensive Queue Filtering:** `careReminders.list` queries for `status === "open"` must filter out deceased patients (`sql`${patients.status} is distinct from 'deceased'``) so open reminders for deceased pets never appear in the active queue.
  - **AI Discharge Sympathy Mode:** Confirmed discharge for deceased/euthanized patients must enforce the condolence letter template and strip routine recall or follow-up calls-to-action.
  - **Staff Condolence Task:** Automatically creates an internal staff condolence task for staff to reach out compassionately.
- **Medical Imaging File Ownership:**
  Medical imaging uploads (`xray`, `ct`, `mri`, `ultrasound`, `photo`) must use category `"imaging"` and attach to the patient record WITHOUT overwriting `patient.photoUrl`.
- **Legal Statutory Registers (ŠVPS SR & KVL SR):**
  Compliance with Slovak veterinary legislation (Law 39/2007 Z. z. and Law 139/1998 Z. z.):
  - Rabies Register (Kniha besnoty) with 3-day notification window to RVPS.
  - Treatment Diary (Kniha ošetrení) with withdrawal period (ochranná lehota) tracking.
  - Euthanasia Register with exact dosing and rendering plant disposal records.
  - Controlled Substances Register (Opiates & psychotropic substances) with immutable audit ledger.
  - Informed consent protocols (Anesthesia, Surgery, Hospitalization, Euthanasia).

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

## 5. Slovak Fiscal Compliance (e-Kasa — Zákon 289/2008 Z. z.)

- **Isolated Fiscal Driver:**
  All e-Kasa logic lives in `packages/db/schema/ext_ekasa.ts`, `apps/web/lib/ekasa/`, and `apps/web/server/routers/extensions/ekasa.ts`.
- **Offline Resiliency & Deduplication:**
  Every e-Kasa receipt request uses cryptographic UUID idempotency keys and an offline sync queue to handle fiscal printer disconnects or Internet dropouts without double-charging or orphaned financial records.
- **Slovak VAT Slabs:**
  Ensure support for standard and reduced Slovak VAT rates (20%, 10%, 5% / 23%, 19%, 5% per tax consolidation rules) and correct item categorization (goods vs veterinary medical services).

## 6. AI Agent & Inference Standards

- **Multimodal Inference:**
  Use `configuredModel()` or inference proxy with Vercel AI SDK (`generateText`).
- **Storage Direct Reads:**
  Always load medical files directly from object storage via `readPrimaryObject(file.fileKey)` from `@/lib/s3`. Never perform HTTP self-fetch loops against `/api/files/...`.
- **GDPR 24-Hour Voice Purge:**
  Raw audio files used for voice transcription and SOAP drafting must be scheduled for deletion within 24 hours.

