# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
as described in `docs/production-readiness/VERSIONING.md`.

## [Unreleased]

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

## [0.1.0] — unreleased baseline

Package versions in `apps/web` and `packages/db` were `0.1.0`. Baseline repository state.
