# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
as described in `docs/production-readiness/VERSIONING.md`.

## [Unreleased]

### Added

- Production-readiness documentation pack under `docs/production-readiness/` (baseline audit, threat model, risk register, tenancy, AI governance, operations, DR, release, compliance evidence matrix, go-live and post-launch).
- Process liveness probe `GET /api/health/live` distinct from readiness (`GET /api/health` and `GET /api/health/ready`).
- Versioning policy and this changelog.

### Security

- e-Kasa no longer HMAC-signs with a placeholder secret or invents `MOCK-UID` values. Outbound FR SR calls require `EKASA_FISCALIZATION_ENABLED=true`, an allowlisted HTTPS host, and an RSA PEM key.
- Unofficial receipts no longer emit FR SR verification QR URLs.
- e-Kasa cron jobs fail closed without `CRON_SECRET` (same helper as other crons).

## [0.1.0] — unreleased tag

Package versions in `apps/web` and `packages/db` are `0.1.0`. No Git tags were present when this file was introduced.
