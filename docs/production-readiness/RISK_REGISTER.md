# Risk register

Status date: 2026-09-05. Owners are roles, not named individuals.

| ID | Severity | Likelihood | Module | Evidence | Mitigation | Automated test/control | Owner | Closure criterion | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-P0-001 | P0 | Low (gated off) | e-Kasa | HMAC placeholder removed; outbound gated | `EKASA_FISCALIZATION_ENABLED` default false; RSA PEM required; SSRF allowlist | `lib/ekasa/__tests__/fiscal.test.ts` | Engineering + accounting | FR SR-approved signing + witnessed certification | High until legal go-live |
| R-P0-002 | P0 | Med | Quality gates | pnpm missing in audit env | Install toolchain; run CI locally | `.github/workflows/ci.yml` | Engineering | Green CI on the release SHA | Unverified here |
| R-P0-003 | P0 | Low–med | Public API | middleware public `/api` | Handler-level auth | Per-route tests (partial) | Engineering | Inventory of all `/api` routes with auth proof | Unknown routes |
| R-P1-001 | P1 | Med | Release | No tags, version 0.1.0, no CHANGELOG | SemVer + CHANGELOG (this package) | Human release checklist | Engineering | First tagged RC after owner approval | Process new |
| R-P1-002 | P1 | Med | DR | Restore drill skipped in CI | Operator schedule; `e2e/restore-drill.spec.ts` | Manual with `RESTORE_DRILL_BACKUP` | Ops | Dated drill log on target SHA | Last logged 2026-07-10 in runbook |
| R-P1-003 | P1 | Med | Observability | Combined `/api/health` | Add `/api/health/live` and `/api/health/ready` | Health route tests | SRE | Probes wired in deploy | Until deploy |
| R-P1-004 | P1 | Low | CI coverage | E2E not in `ci.yml` | Require E2E before production deploy | Playwright locally | QA | Documented deploy gate | Process |
| R-P1-005 | P1 | Med | Secrets | Narrow OSS scanner | Expand patterns; Dependabot | `verify:oss-release` | Security | Broader scanner in CI | History unscanned |
| R-P1-006 | P1 | Med | AI data transfer | Vertex/Anthropic receive chart context | DPA + kill switch (unset `AI_MODEL`) | Agent not-configured errors | Legal + eng | Signed DPA + region confirmed | Contract |
| R-P1-007 | P1 | Low | Multi-location | Pilot guide: not supported | Do not sell multi-location | Product | Product | Validated ops | Explicit |
| R-P2-001 | P2 | Low | DX | CLAUDE.md `db:push` | Align docs | Migration integrity CI | Eng | Doc match CI | Confusion |
| R-P2-002 | P2 | Med | i18n | Dual dictionaries | Key symmetry check | Not in CI | Eng | CI job | Partial |

Acceptance: a P0 is closed only with passing automated test **and** owner sign-off when legal/fiscal.
