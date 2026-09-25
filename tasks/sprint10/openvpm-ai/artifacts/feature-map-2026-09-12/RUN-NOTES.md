# RUN-NOTES — Feature Map & User Manual Blueprint

**Commit:** `23f23a3` [VERIFIED: git rev-parse --short HEAD]
**Date:** 2026-09-12
**Prior art read:** `artifacts/ux-codebase-analysis-2026-09-11.md` (276 lines), `artifacts/ai-feature-audit.md` (387 lines), `artifacts/audit-prompts/ai-audit-prompt.md`

## Reconciled Domain List

Derived from `apps/web/server/routers/_app.ts` (38 tRPC routers), `apps/web/server/routers/extensions/` (16 extension routers), `apps/web/app/(dashboard)/` (25 route dirs), and `apps/web/config/custom-nav.ts` (5 nav sections: clinical, frontDesk, pharmacy, billing, admin).

| # | Domain slug | Source routers | Dashboard routes | Changes from hypothesis |
|---|---|---|---|---|
| 1 | core-clinical | records, encounters, templates, treatment-plans, visit-treatment-plans, vitals, recent-clinical-items | records, encounters, patients | Split `treatment-plans` from `visit-treatment-plans` (separate routers, different lifecycle) |
| 2 | scheduling-front-desk | appointments, booking, waitlist, whiteboard | schedule, whiteboard, waiting-room | Added `waiting-room` dashboard route |
| 3 | clients-portal | clients, portal | clients | Unchanged |
| 4 | billing-finance | billing, subscription + ext/accounting, ext/ekasa | billing | Merged `subscription` router into billing domain; kept e-Kasa here (statutory aspect covered in domain 8 too, cross-reference) |
| 5 | inventory-pharmacy | inventory, dosing, controlled-substances | inventory, controlled-substances | Unchanged |
| 6 | lab-imaging | ext/lab-import, ext/imaging | lab-results | Lab & imaging share dashboard route `lab-results`; imaging AI also in domain 11 (AI/agent) — cross-reference |
| 7 | insurance | insurance + ext/insurance | (none — reached via clients/billing) | Unchanged |
| 8 | statutory-compliance | ext/statutory, ext/kvepis, ext/crsz, ext/dental | statutory | Added `ext/dental` (dental charting is a statutory record in SK); e-Kasa is also in domain 4 — cross-reference |
| 9 | import-export-migration | migration-archive + ext/v2-import, ext/audit-export | migration-archive | Added `ext/v2-import`, `ext/audit-export` |
| 10 | integrations-api | api-keys, webhooks, notifications | (none — API/integration settings) | Unchanged |
| 11 | ai-agent | agent, ai + ext/voice, ext/discharge | agent, vet-intel | Voice dictation and discharge are extensions but AI-driven; imaging analysis cross-references domain 6 |
| 12 | marketing-communications | communications, messaging, care-reminders + ext/marketing | marketing, care-reminders, recalls, inbox | Added `inbox` dashboard (messaging inbox); `recalls` is care-reminders UI |
| 13 | admin-settings | admin, settings, data, dashboard + ext/support, ext/_safety | admin, settings, support | Added `support` dashboard route |
| 14 | auth-onboarding | auth | onboarding, post-login | Added `post-login` dashboard route (onboarding flow) |
| 15 | reports | reports | reports | Unchanged |
| 16 | wellness | wellness | (reached via /marketing/wellness nav item) | **Collision flag:** `wellness` tRPC router is separate from `/marketing/wellness` nav item — subagents for marketing and wellness must both investigate whether these are same feature exposed twice or two different features |
| 17 | i18n-localization | (infrastructure — no router) | (infrastructure) | Unchanged |

## Merges & Splits

- **Split `treatment-plans` from `visit-treatment-plans`:** They are separate routers in `_app.ts`, suggesting different concepts (long-term treatment plans vs. per-visit treatment plans). Hypothesis keeps them in same domain but subagent must verify.
- **Merged `subscription` into billing:** Subscription router handles Stripe billing — natural fit with billing.
- **Merged `communications`, `messaging`, `care-reminders` into marketing-communications:** All three routers + ext/marketing form the outward-facing communications surface.
- **Added `ext/dental` to statutory:** Dental charting is a required clinical record in Slovak veterinary practice.

## Cross-domain collision watchlist

1. **wellness router vs. /marketing/wellness nav** — same feature? different? Both subagents flag, orchestrator resolves.
2. **e-Kasa** appears in both billing-finance (domain 4) and statutory-compliance (domain 8)
3. **ext/imaging** touches lab-imaging (domain 6) AND ai-agent (domain 11) — AI imaging analysis
4. **ext/voice** is AI-driven but its router is an extension — cross-reference ai-agent (domain 11)
5. **inbox** dashboard — is this messaging inbox or something else? marketing-communications subagent must verify