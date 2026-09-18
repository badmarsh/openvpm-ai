# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
as described in `docs/production-readiness/VERSIONING.md`.

## [Unreleased]

## [0.6.1] - 2026-09-18

### Added

- **Wholesaler Delivery Note Import & Controlled Substances Safety Gate (Zákon č. 139/1998 Z. z.):**
  - Expanded parsing support for Slovak veterinary wholesalers: BIOPHARM, KOMVET (tab-delimited safe parser), SG-Vet (Slovak XML tags), SANVET, and PHRAMED.
  - Automatic detection of controlled substances (`isControlledSubstance: true`, including Ketamidor, ketamine, butorphanol, fentanyl, propofol) with default action `skip` requiring explicit manual veterinarian sign-off into Kniha OPL.
- **Inventory Pagination & Performance:**
  - 50 items per page with dynamic tRPC offset pagination, page counters, and automatic search/filter resets.
- **Clinical Records & Vaccination UX:**
  - Clean 6-column strictly aligned table for patient vaccination records (`Vakcína` | `Dátum aplikácie` | `Ďalšia revakcinácia` | `Aplikoval` | `Stav` | `Akcie`).
  - Dedicated Actions column for statutory clinical corrections (`ClinicalCorrectionControl` per Zákon č. 39/2007 Z. z.) with vertical cell centering.
  - Unified European date format (`DD.MM.YYYY`) across patient vitals, encounters, and forms.
- **Marketing & Educational Handouts:**
  - Widened 2-column modal (`max-w-4xl`) for creating handouts without vertical scrolling, with backdrop and header close buttons.
  - Updated clinic contact phone to `0903 949 401`.
- **Security & User Profile:**
  - In-app password change accessible to all staff members via `/settings/security` with direct sidebar profile shortcut.
- **AI Assistant UX & Reliability:**
  - Rich Markdown rendering in AI assistant message bubbles (lists, bold highlights, tables).
  - Strict adherence to practice-configured AI provider in `ext_ai_settings` and proper Gemini thought signature handling.
- **Dokploy & Server Operations:**
  - Dokploy Swarm Standalone Database Services support (`openvpm-postgres-cfoqxx` production DB, `openvpm-arena-postgres-ygh6nf` external arena clone).
  - Dual-environment data sync guardrails and automated `deploy.ps1`.
- **i18n & Localization Quality:**
  - 100% dictionary symmetry between `en.json` and `sk.json` (6,930+ keys).
  - Proper Slovak grammatical plurals in inventory, billing, and settings.
  - Dedicated `prelozit` skill for automated translation hygiene.

## [0.6.0] - 2026-09-13

### Added

- **Pilot-Ready Slovak Integrations & Registries:**
  - KVEPIS (ŠVPS SR) B2G submission pipeline: XML generator with strict XSD schema validation.
  - CRSZ (Centrálny register spoločenských zvierat) chip registry lookup and PetPass validation.
  - CEHZ (Centrálna evidencia hospodárskych zvierat) animal tracking data exports.
  - ÚPVS (Ústredný portál verejnej správy) electronic delivery integration schemas.
  - PetExpert veterinary insurance claim payload builder and export format.
- **Clinical AI Trust & Audit Integrity:**
  - Tamper-evident cryptographic hash chain for `ext_ai_audit_log` with practice-scoped sequence validation (`verify-ai-audit-trail.ts`).
  - One-time clinical confirmation envelopes bound to actor, entity, revision, and draft hash.
  - Deterministic evaluation harness (`clinical-eval-harness.test.ts`) with synthetic Slovak clinical cases.
- **Mobile Client Portal PWA:**
  - Progressive Web App (`/portal/:token`) for pet owners with responsive appointment booking, vaccination cards, and invoice history.
- **Pilot Clinic Onboarding:**
  - Production configurations and seed datasets for the first pilot deployment at Súkromná veterinárna klinika MVDr. Martin Sýkora (Rimavská Sobota).

### Security

- Full PostgreSQL Row-Level Security (RLS) enforcement verified on PG 16.
- Fail-closed actor role resolution across all 26 agent tools (`assertAgentRole`).
- Advisory transaction locks on AI audit event insertions preventing sequence collisions.

## [0.5.0] - 2026-09-12

### Added

- **Slovak Veterinary Compliance & Statutory Registers:**
  - Statutory registers for rabies observations (Kniha besnoty) with 3-day RVPS notification window.
  - Treatment diary (Kniha ošetrení) with withdrawal period (ochranná lehota) calculation and enforcement.
  - Controlled substances ledger with double-signoff witness verification and immutable audit trail.
  - Euthanasia register with exact dosing, disposal documentation, and rendering plant tracking.
  - Slovak informed consent protocols (Anesthesia, Surgery, Hospitalization, Euthanasia).
- **Slovak Fiscal Compliance (e-Kasa — Zákon č. 289/2008 Z. z.):**
  - Integrated fiscal driver supporting Slovak VAT rates (20%, 10%, 5% / 23%, 19%, 5%).
  - Offline sync queue with cryptographic UUID idempotency and automatic deduplication.
- **Clinical AI Safety & Veterinary Ethics:**
  - Mandatory clinician confirmation gates with one-time authorization tokens and state binding.
  - Sympathy gate: automatic blocking of reminders, marketing, and reviews for deceased patients.
  - Medical imaging analysis with direct object storage streaming and DICOM auto-preparation.
  - Voice SOAP dictation pipeline with GDPR-compliant 24-hour audio purge cron.
- **Complete Multilingual Support (i18n):**
  - 100% dictionary symmetry between English (`messages/en.json`) and Slovak (`messages/sk.json`).
  - Dynamic client-side localization via `useI18n()` hook with fallback safety across all dashboard routes.
- **Platform & Governance:**
  - Production-readiness documentation pack under `docs/production-readiness/`.
  - Process liveness probe `GET /api/health/live` and readiness probes.
  - PostgreSQL Row-Level Security (RLS) tenant isolation test suite.
  - Automated migration append-only verification and schema drift guards in CI.

### Security

- Cryptographic confirmation envelopes and immutable audit ledger for clinical actions.
- Fail-closed actor role verification eliminating unauthenticated or fallback privileges.
- Production dependency audits and Next.js / Sharp security updates.

## [0.1.0] - 2026-03-18

Package versions in `apps/web` and `packages/db` were `0.1.0`. Baseline repository state.
