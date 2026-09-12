# Risk register

Status date: 2026-09-12. Owners are roles, not named individuals.

| ID | Severity | Likelihood | Module | Evidence | Mitigation | Automated test/control | Owner | Closure criterion | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-P0-001 | P0 | Low (gated off) | e-Kasa | HMAC placeholder removed; outbound gated | `EKASA_FISCALIZATION_ENABLED` default false; RSA PEM required; SSRF allowlist | `lib/ekasa/__tests__/fiscal.test.ts` | Engineering + accounting | FR SR-approved signing + witnessed certification | High until legal go-live |
| R-P0-002 | P0 | Med | Quality gates | pnpm missing in audit env | Install toolchain; run CI locally | `.github/workflows/ci.yml` | Engineering | Green CI on the release SHA | Unverified here |
| R-P0-003 | P0 | Low-med | Public API | middleware public `/api` | Handler-level auth | Per-route tests (partial) | Engineering | Inventory of all `/api` routes with auth proof | Unknown routes |
| R-P0-004 | P0 | High | Scope overstatement | README/ROADMAP claimed "certified" integrations and real pilot; corrected 2026-09-12 | GAP_ANALYSIS_POST_PILOT_READY.md; claim corrections in README + ROADMAP | Human review of public claims before release | Product + Legal | All public-facing claims verified against evidence | Reputational until corrected |
| R-P0-005 | P0 | High | Production evidence | 0 real production clinics, 0 real KVEPIS submissions, 0 real e-Kasa transactions in CHDÚ | Pre-Pilot Gate 10-point checklist; recruit pilot clinic | ISSUE_TRACKER_GAP.md G-01 | Product | First real clinic active and producing verifiable records | Core risk |
| R-P1-001 | P1 | Med | Release | No tags, version 0.1.0, no CHANGELOG | SemVer + CHANGELOG (this package) | Human release checklist | Engineering | First tagged RC after owner approval | Process new |
| R-P1-002 | P1 | Med | DR | Restore drill skipped in CI | Operator schedule; `e2e/restore-drill.spec.ts` | Manual with `RESTORE_DRILL_BACKUP` | Ops | Dated drill log on target SHA | Last logged 2026-07-10 in runbook |
| R-P1-003 | P1 | Med | Observability | Combined `/api/health` | Add `/api/health/live` and `/api/health/ready` | Health route tests | SRE | Probes wired in deploy | Until deploy |
| R-P1-004 | P1 | Low | CI coverage | E2E not in `ci.yml` | Require E2E before production deploy | Playwright locally | QA | Documented deploy gate | Process |
| R-P1-005 | P1 | Med | Secrets | Narrow OSS scanner | Expand patterns; Dependabot | `verify:oss-release` | Security | Broader scanner in CI | History unscanned |
| R-P1-006 | P1 | Med | AI data transfer | Vertex/Anthropic receive chart context | DPA + kill switch (unset `AI_MODEL`) | Agent not-configured errors | Legal + eng | Signed DPA + region confirmed | Contract |
| R-P1-007 | P1 | Low | Multi-location | Pilot guide: not supported | Do not sell multi-location | Product | Product | Validated ops | Explicit |
| R-P1-008 | P1 | Med | DB surface | PostgreSQL RLS tested in unit tests; no external pentest | Schedule independent RLS/IDOR/SSRF audit | `security/rls-visibility-probes.test.ts` | Security | Signed pentest report; all P0 findings closed | Until pentest |
| R-P1-009 | P1 | High | AI automation bias | Clinicians may over-rely on AI drug dosing recommendations | Onboarding disclaimer screen; mandatory opt-in; AI cannot publish record unilaterally | `clinician opt-in` gate in AI router | UX + Clinical | Onboarding module ships; disclaimer test passes | Ongoing clinical training |
| R-P1-010 | P1 | Med | SK data migrations | No SK-specific field runbook; CYMEDICA/PHARMOS CSV formats vary | `wholesaler-import.ts` handles delimiters; runbook needed | Wholesaler import tests | Ops | Step-by-step runbook tested on staging | Partial |
| R-P1-011 | P1 | High | Hardware certification | "Supported hardware" (FiskalPRO) marketed as "certified integration" | Corrected claims in README + ROADMAP; formal FR SR certification in progress | None (process) | Legal + Eng | FR SR certification complete | Until certified |
| R-P2-001 | P2 | Low | DX | CLAUDE.md `db:push` | Align docs | Migration integrity CI | Eng | Doc match CI | Confusion |
| R-P2-002 | P2 | Med | i18n | Dual dictionaries | Key symmetry check | Not in CI | Eng | CI job | Partial |
| R-P2-003 | P2 | Med | UX onboarding | No measurement of onboarding time; target < 2h unverified | Measure with 3+ non-technical users during pilot | Manual timing | Product + UX | Documented result < 2h | Unmeasured |
| R-P2-004 | P2 | Med | Data classification | No sensitivity labels on DB schema; no formal data classification policy | Write policy; add sensitivity column to patients/encounters | None | Legal + Eng | Policy published + migration merged | Missing |
| R-P2-005 | P2 | Med | Legislative update | No pipeline for SVPS/FR SR law changes to codebase | Write SOP for monitoring regulatory changes | None | Product | SOP documented and first change tracked | Process gap |
| R-P2-006 | P2 | High | AI liability | No legal opinion on AI recommendation liability in SK jurisdiction | Commission legal memo from SK lawyer | None | Legal | Signed legal memo | Unaddressed |

Acceptance: a P0 is closed only with passing automated test **and** owner sign-off when legal/fiscal.
