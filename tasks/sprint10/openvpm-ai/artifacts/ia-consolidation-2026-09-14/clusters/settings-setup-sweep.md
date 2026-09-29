# Cluster: Settings / Setup Sweep (Cross-Cluster)

**Commit:** `65e008d` | **Cluster:** settings-setup-sweep | **Date:** 2026-09-14

**Purpose:** This cluster works INDEPENDENTLY of the other clusters' framing. For EVERY module across all clusters, it asks the single question: "Is this a once-per-clinic-setup configuration screen masquerading as a daily-use nav item?" The list below is derived fresh from examining each module's actual usage pattern, role restriction, and change frequency — then cross-checked against the other clusters to identify agreements and disagreements.

---

## H7 Verdict: TRUE — multiple nav items are setup/configuration screens, not daily workflow

**Evidence and full sweep:**

### Definite Settings Candidates (should move to Nastavenia)

| Module | Route | Why it's a Settings item | Currently in section |
|---|---|---|---|
| Brand Kit | `/marketing/brand-kit` | Changed once at onboarding (colors, tone, logo) and rarely thereafter. Admin/vet only. No daily data entry. | admin |
| Automatizácie — channel OAuth connections | within `/marketing/automations` | OAuth account linking for GBP/FB/IG/YouTube is done once. Rule/journey config is periodic. | admin |
| e-Kasa — printer/device config | within `/billing/ekasa` | ORP/VRP device registration and API credentials are once-per-setup. Daily receipt issuance stays in billing. | billing |
| Súhlasy & skripty — consent form templates | within `/marketing/consents` | Consent TEMPLATES are created once and rarely edited. Actual signing is patient-facing, not a nav destination. | admin |

### Borderline — High Setup Ratio, Some Daily Use

| Module | Route | Verdict | Rationale |
|---|---|---|---|
| Marketingové Štúdio (hub page) | `/marketing` | **Keep in nav, but simplify** | The hub dashboard is an at-a-glance overview. Low-frequency but provides value as a landing page for the marketing section. |
| Čerpanie benefitov | `/marketing/wellness` | **Move to frontDesk section** | Redemption logging happens per visit. Not setup, but misplaced in admin/marketing section. |
| Recenzie | `/marketing/reviews` | **Keep in marketing nav** | Review monitoring is regular (daily SLA). Not setup. |
| Centrum potlačení | `/marketing/suppression` | **Keep as sub-tab** — nest under Automatizácie | Regular compliance monitoring. Not setup. |
| Pilotná Reconciliácia | `/admin/pilot` | **Temporary — admin-only nav item** | Not setup, not daily for most roles. Pilot-period operational check. Restrict to admin, nest under admin page. |

### Clearly NOT Settings Candidates (daily workflow)

| Module | Why |
|---|---|
| Rozvrh, Čakáreň, Prevádzková tabuľa, Klienti, Správy | All front-desk, multiple-times-daily |
| Pacienti, Záznamy, Vyšetrenia, Laboratórium | Daily clinical workflow |
| Zdravotné pripomienky, Pripomienky | Regular (weekly/daily) front-desk actions |
| Sklad, Omamné látky | Daily/as-needed pharmacy workflow |
| Fakturácia, e-Kasa (receipts), Zákonné registre, Prehľady | Daily/weekly financial/compliance |
| Agent, Hlasové Diktovanie | Daily AI-assisted clinical use |
| Vzdialená Podpora | As-needed, but accessed when needed urgently |
| Plán obsahu, Schvaľovanie obsahu | Regular (weekly) for marketing staff |
| Recenzie | Daily SLA monitoring |
| Web kliniky, Knižnica médií, Letáky | Regular marketing activities |
| Správy & SMS (marketing) | Regular campaign management |

---

## Settings Candidates Summary (this sweep's independent list)

Items the Settings sweep identifies as belonging in Nastavenia or sub-sections:

1. **Brand Kit** → Settings > Branding
   - *Matches marketing cluster verdict ✅*
   - Migration risk: **Low** — admin-only; no e2e asserts this route; i18n key deprecated.

2. **e-Kasa device/printer configuration** (not the receipts page, just the config UI)
   - *Matches finance cluster verdict ✅*
   - Migration risk: **Low** — config panel moves; receipt workflow unchanged.

3. **Consent form templates** (the template management part of `/marketing/consents`)
   - *Matches marketing cluster verdict ✅*
   - Migration risk: **Med** — route splits; admin users who bookmark `/marketing/consents` for templates need updated bookmarks.

4. **Channel OAuth connections** (social channel linking within `/marketing/automations`)
   - *New finding from this sweep* — the other clusters noted automations stays but didn't explicitly call out the OAuth panel as a Settings candidate.
   - Migration risk: **Low** — sub-panel moves within settings; automations page keeps rule/journey config.

5. **Recall schedule configuration** (`extMarketingRecallSchedules` — the timing config for post-visit review asks, vaccine reminder delays)
   - *New finding from this sweep* — `getRecallSchedule` / `updateRecallSchedule` procedures [VERIFIED: marketing.ts:1613–1639]. These timing settings (e.g., "send post-visit review ask after 24 hours") are clinic setup parameters, not daily workflow.
   - Migration risk: **Low** — small config panel; move to Settings > Communications > Outreach Timing.

---

## Cross-Check Against Other Clusters

| Settings candidate | Marketing cluster | AI/Agent cluster | Finance cluster | Support cluster | Settings sweep | Agreement? |
|---|---|---|---|---|---|---|
| Brand Kit → Settings | ✅ YES | n/a | n/a | n/a | ✅ YES | ✅ Unanimous |
| e-Kasa device config → Settings | n/a | n/a | ✅ YES | n/a | ✅ YES | ✅ Unanimous |
| Consent templates → Settings | ✅ YES (split) | n/a | n/a | n/a | ✅ YES | ✅ Unanimous |
| Channel OAuth → Settings | ✅ partial | n/a | n/a | n/a | ✅ YES | ✅ Agreement |
| Recall schedule config → Settings | 🔶 not flagged | n/a | n/a | n/a | ✅ YES | New finding |
| Admin Podpora → remove from nav | n/a | n/a | n/a | ✅ YES | ✅ YES (not a setting, remove) | ✅ Unanimous |
| Pilotná Reconciliácia → admin-only | n/a | n/a | n/a | ✅ YES | ✅ YES (restrict) | ✅ Unanimous |

**No disagreements** between Settings sweep and the domain clusters on the above items. The recall schedule config is a new finding not flagged by other clusters.

---

## Settings Architecture Proposal

The current Settings page is a 5,875-line monolith with 13 tabs [VERIFIED: REORGANIZATION-FINDINGS.md §1]. The items being moved here fit naturally into these proposed NEW tabs within Settings:

| New Settings Tab | Moved-in items |
|---|---|
| **Branding** (rename from "Brand Kit") | Brand colors, logo, tone of voice, social handles |
| **Integrations** | e-Kasa device config, Channel OAuth (GBP/FB/IG/YT), Webhooks, API keys |
| **Communications** | Recall/outreach timing config (`extMarketingRecallSchedules`), SMS provider config |
| **Clinical Protocols** | Consent form templates, vaccination recall intervals, appointment type configuration |

The existing Settings tabs (Practice Info, Staff, Locations, Appointment Types, Services, Templates, Wellness Plans, Messaging, Booking, Data) stay as-is — the new tabs add without disrupting the existing 13.
