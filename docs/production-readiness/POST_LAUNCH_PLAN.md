# Post-launch plan

Horizon: first 30/90 days of a **controlled clinic pilot**, not general availability.

## Days 0–7

- Daily: health, cron heartbeats, error fingerprints (no PHI)
- Daily clinic champion review (friction log — Jira, not git)
- Confirm no e-Kasa production traffic
- Confirm SMS still gated

## Days 8–30

- Restore drill on synthetic data
- Review audit_log volume and denials
- Dependency: Dependabot PRs
- Re-evaluate AI usage vs DPA

## Days 31–90

- Decide: continue pilot / pause / expand location (expansion **not** supported without new validation)
- Schema/migration debt
- Accessibility and SK dictionary audit
- Close or explicitly accept each P1 in RISK_REGISTER

## Metrics (privacy-aware)

Use counts and latencies already in health/cron heartbeats. Do not label metrics with patient or client identifiers.

## Exit

Clinic can export JSON/CSV anytime. Account-closure purge is owner-operated after the documented window — **requires legal review**.
