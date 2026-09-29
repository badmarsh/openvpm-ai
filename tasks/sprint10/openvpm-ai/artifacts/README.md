# artifacts/

Dated research reports, audit outputs, and agent-produced artifacts.
These are **read artifacts** — records of analysis sessions and audit evaluations, not live runbooks.
Live operational runbooks and guidelines live under [`docs/`](../docs/).

---

## Prompt library (read-only)

**[`audit-prompts/`](audit-prompts/)** — Reusable agent prompts for recurring audit passes and evaluations.
Do not modify without operator review. Includes:
- [`outline-docs-sync-prompt.md`](audit-prompts/outline-docs-sync-prompt.md) — Prompt for synchronizing OpenVPM AI v0.6 documentation with Outline.


---

## Feature & domain map — 2026-09-12 (commit `23f23a3`)

**[`feature-map-2026-09-12/`](feature-map-2026-09-12/)** — Comprehensive feature inventory across 17 functional domains.
Key files:
- `FEATURE-INDEX.md` — Top-level feature inventory and module breakdown
- `DOCS-ACCURACY-INDEX.md` — Cross-check of documentation claims against code reality
- `REORGANIZATION-FINDINGS.md` — Structural findings and architecture observations
- `USER-MANUAL-PROPOSAL.md` — Proposed user manual structure
- `domains/` — 16 domain deep-dive analysis reports

---

## Autopilot / Marketing automation vision — 2026-09-12 (commit `23f23a3`)

**[`autopilot-vision-2026-09-12/`](autopilot-vision-2026-09-12/)** — Architecture research and technical design for the marketing automation module.
Key files:
- `CONSOLIDATED-SUMMARY.md` — Executive summary and entry point
- `ARCHITECTURE-RESEARCH.md`, `SCHEMA-DESIGN.md` — Technical deep-dives
- `EVENT-ENGINE-PLAN.md` — Durable event bus design
- `GUARDRAILS-COMPLIANCE.md` — Safety gates and GDPR analysis
- `ROADMAP-COSTBENEFIT.md` — Roadmap phasing and cost-benefit analysis

---

## AI feature audit — 2026-09-11

**[`ai-feature-audit.md`](ai-feature-audit.md)** — Deep audit of clinical AI feature implementations and safety guardrails.

---

## UX codebase analysis — 2026-09-11

**[`ux-codebase-analysis-2026-09-11.md`](ux-codebase-analysis-2026-09-11.md)** — UX patterns, accessibility, focus management, and component architecture analysis.

---

## Bug hunts & Remediation

- **[`bug-hunt-2026-09-14.md`](bug-hunt-2026-09-14.md)** — Recent bug hunt findings.
- **[`bug-hunt-remediation-report.md`](bug-hunt-remediation-report.md)** — Detailed remediation report from the September 8, 2026 bug hunt.

---

## Documentation hygiene audits — 2026-09-14

- **[`docs-hygiene-report-2026-09-14.md`](docs-hygiene-report-2026-09-14.md)** — Full 143-file documentation hygiene audit report.
- **[`docs-hygiene-fixlist-2026-09-14.md`](docs-hygiene-fixlist-2026-09-14.md)** — Prioritized P0/P1/P2 remediation checklist.

---

## Evaluation data (JSON) — 2026-09-05

- **`dr-drill-report.json`** — Disaster recovery drill metrics snapshot (generated 2026-09-05).
- **`production-readiness-report.json`** — Production readiness score evaluation (generated 2026-09-05).
