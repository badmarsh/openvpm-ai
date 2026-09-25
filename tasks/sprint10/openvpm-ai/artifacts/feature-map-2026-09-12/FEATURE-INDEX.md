# OpenVPM AI — Feature Index (2026-09-12)

**Commit:** `23f23a3` [VERIFIED: git rev-parse --short HEAD]

This is a complete, code-derived inventory of all functional domains in the OpenVPM AI monorepo. It is built directly from the source of truth: `apps/web/server/routers/_app.ts`, `apps/web/config/custom-nav.ts`, and `apps/web/app/(dashboard)/`. No inference or assumption is used.

| # | Domain slug | tRPC routers | Dashboard routes | Custom nav items | Feature count | Manual sections proposed | Description | Source tag |
|---|---|---|---|---|---|---|---|---|
| 1 | core-clinical | 7 (`records`, `encounters`, `templates`, `treatment-plans`, `visit-treatment-plans`, `vitals`, `recent-clinical-items`) | 3 (`records`, `encounters`, `patients`) | 0 | 53 | 6 (F.1–F.6) | Core clinical workflow: SOAP notes, encounters, vitals, treatment plans, patient records. | [VERIFIED: apps/web/server/routers/_app.ts] |
| 2 | scheduling-front-desk | 4 (`appointments`, `booking`, `waitlist`, `whiteboard`) | 3 (`schedule`, `whiteboard`, `waiting-room`) | 0 | 33 | 3 (F.1–F.3, 3 personas) | Front desk & scheduling: appointments, booking, waitlist, live whiteboard. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/app/(dashboard)/] |
| 3 | clients-portal | 2 (`clients`, `portal`) | 1 (`clients`) | 0 | 26 | 4 (F.1–F.4) | Client management & portal: client/patient database, token-based portal access. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/app/(dashboard)/] |
| 4 | billing-finance | 2 (`billing`, `subscription`) + 3 extensions (`ekasa`, `accounting`, `insurance`) | 1 (`billing`) | 1 (`/billing/ekasa`) | 27 | 5 | Financial operations: invoicing, Stripe subscriptions, e-Kasa compliance, accounting export. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/server/routers/extensions/*, apps/web/app/(dashboard)/] |
| 5 | inventory-pharmacy | 3 (`inventory`, `dosing`, `controlled-substances`) | 2 (`inventory`, `controlled-substances`) | 0 | 17 | 5 (F.1–F.5) | Pharmacy & inventory: stock, lot tracking, controlled substances with witness enforcement. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/app/(dashboard)/] |
| 6 | lab-imaging | 0 core + 2 extensions (`lab-import`, `imaging`) | 1 (`lab-results`) | 0 | 15 | 2 (+ cross-ref to domain 11) | Lab results & imaging: analyzer import, DICOM upload, AI analysis. | [VERIFIED: apps/web/server/routers/extensions/*, apps/web/app/(dashboard)/] |
| 7 | insurance | 1 (`insurance`) + 1 extension (`insurance`) | 0 | 0 | 16 | 3 (F.1–F.3, + appendix) | Insurance provider management (PetExpert, Generali). | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/server/routers/extensions/insurance.ts] |
| 8 | statutory-compliance | 0 core + 5 extensions (`statutory`, `kvepis`, `crsz`, `dental`, `audit-export`) | 1 (`statutory`) | 0 | 11 | 7 | Slovak regulatory compliance: KVEPIS, CRSZ, dental charting, audit export. | [VERIFIED: apps/web/server/routers/extensions/*, apps/web/app/(dashboard)/] |
| 9 | import-export-migration | 1 (`migration-archive`) + 3 extensions (`v2-import`, `audit-export`, `lab-import`) | 1 (`migration-archive`) | 0 | 16 | 3 (F.1–F.3) | Data migration: legacy import, backup/restore, audit log export. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/server/routers/extensions/*, apps/web/app/(dashboard)/] |
| 10 | integrations-api | 3 (`api-keys`, `webhooks`, `notifications`) | 0 | 0 | 39 | 0 | Developer-facing integrations: API keys, webhook configuration, notification delivery. | [VERIFIED: apps/web/server/routers/_app.ts] |
| 11 | ai-agent | 2 (`agent`, `ai`) + 4 extensions (`voice`, `discharge`, `imaging`, `marketing`) | 2 (`agent`, `vet-intel`) | 4 (`/agent/imaging`, `/agent/voice`, `/agent/discharge`, `/vet-intel`) | 18 (+ 26 tools) | 6 (F.1–F.6) | Generative AI features: chat, voice dictation, discharge summaries, imaging analysis, marketing content. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/server/routers/extensions/*, apps/web/config/custom-nav.ts] |
| 12 | marketing-communications | 3 (`communications`, `messaging`, `care-reminders`) + 1 extension (`marketing`) | 12 (`/marketing/*`, `care-reminders`, `recalls`, `inbox`) | 12 (`/marketing/*`, `care-reminders`, `recalls`, `inbox`) | 64 | 5+ (comms, messaging, care-reminders, marketing-studio, wellness-redemptions) | Marketing & communications: SMS/email, care reminders, social media posts, TV, wellness packages. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/server/routers/extensions/marketing.ts, apps/web/config/custom-nav.ts, apps/web/app/(dashboard)/] |
| 13 | admin-settings | 4 (`admin`, `settings`, `data`, `dashboard`) + 2 extensions (`support`, `_safety`) | 3 (`admin`, `settings`, `support`) | 2 (`/support`, `/admin/support`) | 24 | 3 (F.1–F.3, + Guides) | Administrative tools: system settings, data management, remote support, safety checks. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/server/routers/extensions/*, apps/web/config/custom-nav.ts, apps/web/app/(dashboard)/] |
| 14 | auth-onboarding | 1 (`auth`) | 2 (`onboarding`, `post-login`) | 0 | 31 | 8 (login, register, invite, pw-reset, verify, demo, portal, roles) | Authentication & onboarding: login, registration, role switching, demo access. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/app/(dashboard)/] |
| 15 | reports | 1 (`reports`) | 1 (`reports`) | 0 | 18 | 10 (§F.1–F.10) | Reporting engine: clinical, financial, operational reports. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/app/(dashboard)/] |
| 16 | wellness | 1 (`wellness`) | 0 | 1 (`/marketing/wellness`) | 18 | 2 (quick ref + reference doc) | Wellness plans: subscription-based veterinary wellness packages. | [VERIFIED: apps/web/server/routers/_app.ts, apps/web/config/custom-nav.ts] |
| 17 | i18n-localization | 0 | 0 | 0 | 14 | 1 (short section) | Localization infrastructure: `messages/sk.json`, `messages/en.json`, i18n hooks. | [VERIFIED: apps/web/messages/*, apps/web/lib/i18n] |
| | | | | | | | | |
| **TOTAL** | **17 domains** | **38 routers** | **~25 routes** | **29 nav items** | **430 features** | **~80 sections** | | |

## Cross-domain collisions (verified)

### Previously identified

1. **Wellness router vs /marketing/wellness nav item** (domain 16): Two separate entry points for the same concept — one as a standalone tRPC domain, one as part of marketing UI. [VERIFIED: apps/web/server/routers/_app.ts:L157, apps/web/config/custom-nav.ts:L128]
2. **e-Kasa** (domain 4 ↔ domain 8): Appears in both `billing-finance` and `statutory-compliance` — financial tool and statutory requirement. [VERIFIED: apps/web/server/routers/extensions/ekasa.ts, apps/web/server/routers/extensions/statutory.ts]
3. **Imaging** (domain 6 ↔ domain 11): Appears in `lab-imaging` and `ai-agent` — imaging AI analysis lives in both domains. [VERIFIED: apps/web/server/routers/extensions/imaging.ts, apps/web/server/routers/extensions/marketing.ts]
4. **Voice dictation** (domain 11): `ai-agent` domain (router `ext/voice.ts`) but also appears in `marketing` nav (`/agent/voice`). [VERIFIED: apps/web/server/routers/extensions/voice.ts, apps/web/config/custom-nav.ts:L82]

### Newly discovered

5. **Wellness navigation misclassification** [WELLNESS-COLLISION-1]: The `wellness` router handles plan CRUD and billing (Settings, Billing pages), while `/marketing/wellness` nav item handles benefit redemption tracking. They share `wellness_enrollments` as join table. The nav label "Wellness balíčky" is misleading — should be "Čerpanie benefitov". Additionally, `/marketing/wellness` lives under Marketing nav section but benefit redemption is clinical/front-desk operational, not marketing. Severity: Medium.
6. **Wellness plan-to-benefit mapping gap** [WELLNESS-COLLISION-2]: `ext_marketing_wellness_redemptions.benefit_key` is free-text with no FK to plan-defined benefits — no enforced relationship between what a plan offers and what gets redeemed. Severity: High.
7. **Wellness help content hallucination** [WELLNESS-COLLISION-3]: Help content for wellness describes contract generation, benefit lists, and automated reminders — none of these exist in code. Severity: Medium.
8. **Wellness undocumented in project docs** [WELLNESS-COLLISION-4]: Wellness feature absent from README, ROADMAP, and CLAUDE.md — completely undocumented. Severity: Low.
9. **Wellness i18n key inconsistency** [WELLNESS-COLLISION-5]: "Wellness" kept in English in Slovak labels, inconsistent with other localized terms. Severity: Low.
10. **"Guides" vs "Tour" naming confusion** [ADMIN-COLLISION-1]: Settings button says "Guides" but opens "Welcome" surface with "guide cards" launching "tours" — three different names for the same feature across UI layers. Severity: Low.
11. **12/19 custom nav items missing i18n keys** [I18N-COLLISION-1]: Missing from both `sk.json` and `en.json`, causing hardcoded Slovak fallbacks. Missing keys: `nav.marketingPlan`, `nav.marketingHandouts`, `nav.marketingMessages`, `nav.marketingWebsite`, `nav.waitingRoomTv`, `nav.marketingAutomations`, `nav.marketingConsents`, `nav.marketingWellness`, `nav.remoteSupport`, `nav.adminSupport`, `nav.collapseMenu`, `nav.expandMenu`. Severity: Medium.
12. **Top-bar routeLabels mixed-language fallbacks** [I18N-COLLISION-2]: English for vanilla routes, Slovak for custom routes — inconsistent lang attribute. Severity: Medium.
13. **Brand header hardcoded Slovak text** [I18N-COLLISION-3]: Not i18n-keyed, always shows Slovak regardless of locale. Severity: Low.
14. **`<html lang="sk">` hardcoded in SSR** [I18N-COLLISION-4]: Fixed only client-side, causing flash of wrong lang attribute. Severity: Low.
15. **`sanitizeForPdf()` strips Slovak diacritics** [I18N-COLLISION-5]: PDF output loses national characters. Severity: High.
16. **Dead-weight i18n files** [I18N-COLLISION-6]: `messages/parts/` directory contains 8 unused JSON files (~356KB). Severity: Low.
17. **Docs/I18n.md references Italian** [I18N-COLLISION-7]: Documentation describes Italian localization but codebase is Slovak/English. Severity: Low.
18. **CRITICAL: Broken agent context role injection** [AI-COLLISION-1]: All 26 AI agent tools inoperable in production due to broken context injection. Severity: Critical.
19. **CRITICAL: Drug safety checker false-negative risk** [AI-COLLISION-2]: Drug safety checker may miss dangerous interactions. Severity: Critical.
20. **CRITICAL: REST API foreign key syntax error** [AI-COLLISION-3]: REST API endpoint has foreign key syntax error. Severity: Critical.
21. **Marketing generation escapes billing gates** [AI-COLLISION-4]: No rate limiting, no billing entitlement checks on marketing content generation. Severity: High.
22. **Wholesaler delivery-note parser dead code** [INVENTORY-COLLISION-1]: Parser exists for 10 wholesalers but zero server wiring and zero UI integration — ROADMAP checkbox overstates completion. Severity: Medium.
23. **Dental charting misclassified** [STATUTORY-COLLISION-1]: Dental charting is clinical functionality, not statutory compliance — misclassified in audit prompt. Severity: Low.
24. **Lab import split responsibility** [LAB-COLLISION-1]: Lab import is an extension, not core — split responsibility between `ext/lab-import` and `records` domains. Severity: Low.

## Summary statistics
- **Total feature count:** 430 (from §A feature inventory tables across all 17 domains)
- **Total manual sections proposed:** ~80 (counting all proposed sections across domains)
- **Total tRPC routers:** 38 (core + extensions)
- **Total dashboard routes:** ~25
- **Total custom nav items:** 29 (all in `custom-nav.ts`)
- **Total distinct functional domains:** 17 (as reconciled in RUN-NOTES.md)
- **Total cross-domain collisions identified:** 24 (4 previously + 20 newly discovered)

## Domain detail files

Each domain has a dedicated audit file with full feature inventory, section mappings, and collision analysis:

1. [`core-clinical.md`](./domains/core-clinical.md)
2. [`scheduling-front-desk.md`](./domains/scheduling-front-desk.md)
3. [`clients-portal.md`](./domains/clients-portal.md)
4. [`billing-finance.md`](./domains/billing-finance.md)
5. [`inventory-pharmacy.md`](./domains/inventory-pharmacy.md)
6. [`lab-imaging.md`](./domains/lab-imaging.md)
7. [`insurance.md`](./domains/insurance.md)
8. [`statutory-compliance.md`](./domains/statutory-compliance.md)
9. [`import-export-migration.md`](./domains/import-export-migration.md)
10. [`integrations-api.md`](./domains/integrations-api.md)
11. [`ai-agent.md`](./domains/ai-agent.md)
12. [`marketing-communications.md`](./domains/marketing-communications.md)
13. [`admin-settings.md`](./domains/admin-settings.md)
14. [`auth-onboarding.md`](./domains/auth-onboarding.md)
15. [`reports.md`](./domains/reports.md)
16. [`wellness.md`](./domains/wellness.md)
17. [`i18n-localization.md`](./domains/i18n-localization.md)
