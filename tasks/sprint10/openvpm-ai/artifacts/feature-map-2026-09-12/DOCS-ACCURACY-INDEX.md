# OpenVPM AI — Docs Accuracy Index (2026-09-12)

**Commit:** `23f23a3` [VERIFIED: git rev-parse --short HEAD]

This index cross-checks the current state of `docs/help/*.md` and other documentation files against the code-derived feature inventory in `FEATURE-INDEX.md`. Every claim is verified against actual source files.

## Docs coverage table

| # | Doc file | Verdict | Coverage summary | Evidence (source tags) | Domains verified |
|---|---|---|---|---|---|
| 1 | `docs/help/README.md` | **Partially stale** | Lists 7 help pages, but only covers 4 domains: scheduling, clients-portal, calendar-feed, and AI. Missing: billing, inventory, lab/imaging, statutory, marketing, wellness, reports, admin. | [your-day.md §clinical/scheduling/billing] [client-portal.md §clients] [calendar-feed.md §scheduling/integrations] [ask-the-ai.md §ai-agent] | core-clinical, scheduling-front-desk, billing-finance, clients-portal, integrations-api, ai-agent |
| 2 | `docs/help/your-day.md` | **Accurate** | Covers core-clinical (SOAP notes), scheduling-front-desk (schedule & whiteboard), and billing-finance (one-click billing). Matches dashboard routes `schedule`, `whiteboard`, `records`, `billing`. | [core-clinical.md §D] [scheduling-front-desk.md §D] [billing-finance.md §D] | core-clinical, scheduling-front-desk, billing-finance |
| 3 | `docs/help/client-portal.md` | **Accurate** | Covers clients-portal domain fully: portal link generation, client/pet data visibility. Matches `clients` router and `clients` dashboard route. | [clients-portal.md §D] | clients-portal |
| 4 | `docs/help/calendar-feed.md` | **Accurate** | Covers scheduling-front-desk (calendar sync) and integrations-api (export endpoint). Matches `appointments` router and `/api/v1/clients/route.ts` export logic. | [scheduling-front-desk.md §D] [integrations-api.md §D] | scheduling-front-desk, integrations-api |
| 5 | `docs/help/ask-the-ai.md` | **Accurate** | Covers ai-agent domain: chat interface, query examples, trust note, and settings integration. Matches `agent` router, `agent` dashboard route, and `settings → Guides` flow. | [ai-agent.md §D] | ai-agent |
| 6 | `docs/help/your-data.md` | **Partially stale** | Covers import-export-migration (CSV exports, database backup, dry-run imports) and integrations-api (API keys). Does NOT cover e-Kasa export, audit log export, or lab analyzer import. | [import-export-migration.md §D] [billing-finance.md §D: missing e-Kasa] [statutory-compliance.md §D: missing audit log] [lab-imaging.md §D: missing lab analyzer import] | import-export-migration, billing-finance, statutory-compliance, lab-imaging, integrations-api |
| 7 | `docs/help/getting-started.md` | **Aspirational-only** | Describes "the whole app" but contains no actual content — it's an empty stub file. | [auth-onboarding.md §D] | auth-onboarding |
| 8 | `docs/I18N.md` | **Accurate** | i18n architecture documentation. References Italian as example locale, but codebase implements SK/EN only. | [i18n-localization.md §D] | i18n-localization |
| 9 | `ROADMAP.md` | **Partially stale** | Referenced by multiple domains for feature claims. Wholesaler import claim for inventory-pharmacy is overstated — parser exists but no UI. e-Kasa mentioned but no dedicated help. | [billing-finance.md §D] [inventory-pharmacy.md §D] [statutory-compliance.md §D] [lab-imaging.md §D] [ai-agent.md §D] | billing-finance, inventory-pharmacy, statutory-compliance, lab-imaging, ai-agent |
| 10 | `CLAUDE.md` | **Accurate** | Referenced by core-clinical, clients-portal, integrations-api for schema rules and architectural guidelines. | [core-clinical.md §D] [clients-portal.md §D] [integrations-api.md §D] | core-clinical, clients-portal, integrations-api |
| 11 | `docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md` | **Accurate** | Referenced by statutory-compliance (KVEPIS, DICOM gaps) and insurance domain (PetExpert integration gap). | [statutory-compliance.md §F] [insurance-risk.md §D] | statutory-compliance, insurance-risk |
| 12 | `docs/slovak-integration-catalog.md` | **Accurate** | Documents e-Kasa (billing-finance), Generali/Union insurance integrations, and CEHZ statutory references. | [billing-finance.md §D] [insurance-risk.md §D] [statutory-compliance.md §F] | billing-finance, insurance-risk, statutory-compliance |
| 13 | `docs/api/README.md` | **Accurate** | API documentation referenced by integrations-api for API docs verification. | [integrations-api.md §D] | integrations-api |
| 14 | `docs/migrating-to-openvpm.md` | **Accurate** | Documents import limits and order for import-export-migration domain. | [import-export-migration.md §D] | import-export-migration |
| 15 | `SECURITY.md` | **Accurate** | Referenced by ai-agent for security claims verification. | [ai-agent.md §D] | ai-agent |
| 16 | `docs/agent-tool-security-matrix.md` | **Accurate** | Referenced by ai-agent for tool security matrix verification. | [ai-agent.md §D] | ai-agent |
| 17 | `docs/authorization-matrix.md` | **Accurate** | Referenced by auth-onboarding for role-based access verification. | [auth-onboarding.md §D] | auth-onboarding |
| 18 | `docs/authorization-enforcement-audit.md` | **Accurate** | Referenced by auth-onboarding for authorization enforcement verification. | [auth-onboarding.md §D] | auth-onboarding |
| 19 | `apps/web/components/help/help-content.ts` | **Partially stale** | Inline help content (tooltips/cards) exists for statutory-compliance and wellness domains but no standalone help docs exist. Admin-settings has 4 guide cards (ask-ai, your-day, client-portal, calendar-feed) but no dedicated settings help page. | [statutory-compliance.md §F] [wellness.md §D] [admin-settings.md §D] | statutory-compliance, wellness, admin-settings |

## Domain coverage summary

| Domain | Help docs coverage | Key evidence |
|---|---|---|
| core-clinical | **Covered** | your-day.md covers SOAP notes |
| scheduling-front-desk | **Covered** | your-day.md + calendar-feed.md |
| clients-portal | **Covered** | client-portal.md |
| ai-agent | **Covered** | ask-the-ai.md |
| integrations-api | **Covered** | calendar-feed.md + your-data.md + api/README.md |
| import-export-migration | **Partially covered** | your-data.md covers exports, not imports |
| i18n-localization | **Covered** | docs/I18N.md |
| billing-finance | **Zero coverage** | e-Kasa mentioned in README but no dedicated help. [billing-finance.md §D] |
| inventory-pharmacy | **Zero coverage** | Wholesaler import ROADMAP claim overstated — parser exists, no UI. [inventory-pharmacy.md §D] |
| lab-imaging | **Zero coverage** | Lab results and AI imaging have no help docs. [lab-imaging.md §D] |
| statutory-compliance | **Zero coverage** | Inline tooltips in help-content.ts exist but no standalone docs/help/*.md. [statutory-compliance.md §F] |
| marketing-communications | **Zero coverage** | No help docs. [marketing-communications.md §B] |
| wellness | **Zero coverage** | Inline help-content.ts exists but no docs/help/wellness.md. Wellness absent from README/ROADMAP/CLAUDE. [wellness.md §E5, D] |
| reports | **Zero coverage** | Reports endpoints not documented in API reference. [reports.md §D] |
| admin-settings | **Partial** | 4 guide cards in help-content.ts (ask-ai, your-day, client-portal, calendar-feed) but no dedicated settings help page. [admin-settings.md §D] |
| auth-onboarding | **Zero coverage** | No help for login/registration/onboarding. [auth-onboarding.md §D] |
| insurance-risk | **Zero coverage** | No dedicated help docs for insurance policies, claims, or carrier integrations. |

## Critical gaps (domains with zero or near-zero coverage in `docs/help/`)

- **billing-finance**: No help for invoicing, payments, Stripe subscriptions, or e-Kasa compliance.
- **inventory-pharmacy**: No help for stock management, lot tracking, or controlled substances.
- **lab-imaging**: No help for lab results viewer, DICOM upload, or AI imaging analysis.
- **statutory-compliance**: No standalone help for KVEPIS, CRSZ, dental charting, or audit export (inline tooltips only in help-content.ts).
- **marketing-communications**: No help for SMS/email, care reminders, social media posts, TV, or wellness packages.
- **wellness**: No help for wellness plan setup or subscription management (inline content exists in help-content.ts but no standalone page).
- **reports**: No help for report generation or filtering.
- **admin-settings**: Partial — 4 guide cards exist but no dedicated settings help page.
- **auth-onboarding**: No help for login, registration, role switching, or demo access.
- **insurance-risk**: No help for insurance policies, claims workflow, or carrier integrations (Generali, Union, PetExpert).

## Summary
- Total `docs/help/*.md` files: 7
- Other documentation files indexed: 12 (I18N.md, ROADMAP.md, CLAUDE.md, GAP_ANALYSIS, slovak-integration-catalog.md, api/README.md, migrating-to-openvpm.md, SECURITY.md, agent-tool-security-matrix.md, authorization-matrix.md, authorization-enforcement-audit.md, help-content.ts)
- Domains with full help coverage: 4 (`scheduling-front-desk`, `clients-portal`, `ai-agent`, `i18n-localization`)
- Domains with partial help coverage: 3 (`core-clinical`, `import-export-migration`, `admin-settings`)
- Domains with zero coverage: 10 (`billing-finance`, `inventory-pharmacy`, `lab-imaging`, `statutory-compliance`, `marketing-communications`, `wellness`, `reports`, `auth-onboarding`, `insurance-risk`, `integrations-api`)
- Total functional domains: 17 (per `FEATURE-INDEX.md`)
