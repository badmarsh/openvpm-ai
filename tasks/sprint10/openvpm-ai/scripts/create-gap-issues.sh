#!/usr/bin/env bash
# create-gap-issues.sh
# Bulk-imports the 27 GAP issues into GitHub Issues.
# Prerequisites: gh CLI authenticated, Issues enabled in repo Settings.
# Usage: bash scripts/create-gap-issues.sh

set -euo pipefail

REPO="badmarsh/openvpm-ai"

check_issues_enabled() {
  enabled=$(gh api "repos/$REPO" --jq '.has_issues')
  if [ "$enabled" != "true" ]; then
    echo "ERROR: GitHub Issues are disabled for $REPO."
    echo "Enable them in Settings -> Features -> Issues, then re-run."
    exit 1
  fi
}

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    2>/dev/null && echo "Created: $title" || echo "WARN: Could not create: $title"
}

check_issues_enabled

echo "=== Creating P0 issues (8) ==="

create_issue \
  "[P0-L01] KVEPIS: Obtain SVPS test endpoint and prove data acceptance" \
  "**Area:** Regulatory / KVEPIS\n**Acceptance:** Signed confirmation from SVPS that test submission was accepted; screenshot of portal status\n**Owner:** Eng + Legal\n**Ref:** docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md#L-01" \
  "p0,kvepis,legal,regulatory"

create_issue \
  "[P0-L03] UPVS/eID: Obtain NASES sandbox and integration agreement" \
  "**Area:** Regulatory / eID\n**Acceptance:** NASES sandbox credentials + signed integration agreement\n**Owner:** Legal\n**Ref:** GAP L-03" \
  "p0,upvs,eid,legal"

create_issue \
  "[P0-L05] Data classification policy and sensitivity labels in schema" \
  "**Area:** Legal / Data\n**Acceptance:** Written policy + sensitivity column on patients/encounters tables\n**Owner:** Legal + Eng\n**Ref:** GAP L-05" \
  "p0,data-governance,legal"

create_issue \
  "[P0-L07] Legal opinion on AI recommendation liability" \
  "**Area:** Legal / AI\n**Acceptance:** Written legal memo from qualified SK lawyer\n**Owner:** Legal\n**Ref:** GAP L-07" \
  "p0,ai-safety,legal"

create_issue \
  "[P0-G01] Recruit first pilot clinic and sign pilot agreement" \
  "**Area:** Product / Sales\n**Acceptance:** Signed pilot agreement with named clinic + onboarding date set\n**Owner:** Product\n**Ref:** GAP G-01" \
  "p0,pilot,product"

create_issue \
  "[P0-G02] Sign DPA with all AI sub-processors (Vertex AI, Anthropic)" \
  "**Area:** Legal / Privacy\n**Acceptance:** Signed DPA, EU/EEA region confirmed, kill-switch tested\n**Owner:** Legal\n**Ref:** GAP G-02" \
  "p0,dpa,privacy,legal"

create_issue \
  "[P0-G05] External security audit (RLS / IDOR / SSRF)" \
  "**Area:** Security\n**Acceptance:** Audit report from independent party; all P0 findings remediated\n**Owner:** Security\n**Ref:** GAP G-05" \
  "p0,security,audit"

create_issue \
  "[P0-G08] e-Kasa: void/storno flow tested in FRSR test environment" \
  "**Area:** e-Kasa / Fiscal\n**Acceptance:** Passing test with ORP device in FRSR test env; void receipt stored in DB\n**Owner:** Eng + Accounting\n**Ref:** GAP G-08 / L-02" \
  "p0,ekasa,fiscal"

echo ""
echo "=== Creating P1 issues (10) ==="

create_issue "[P1-L02] e-Kasa: Publish certified ORP device list" \
  "**Acceptance:** Public doc listing >=3 certified ORP models with integration test results\n**Ref:** GAP L-02" \
  "p1,ekasa,documentation"

create_issue "[P1-L04] DPA sub-processor register published in privacy policy" \
  "**Acceptance:** Sub-processor register in privacy policy; DPO assigned\n**Ref:** GAP L-04" \
  "p1,dpa,legal"

create_issue "[P1-L06] Legislative update pipeline: law change to code SOP" \
  "**Acceptance:** Written SOP for monitoring SVPS/FR SR changes and updating codebase\n**Ref:** GAP L-06" \
  "p1,regulatory,process"

create_issue "[P1-P03] Production uptime monitoring and SLA definition" \
  "**Acceptance:** Uptime dashboard live; SLA target documented; alert routing configured\n**Ref:** GAP P-03" \
  "p1,observability,sre"

create_issue "[P1-A01] Expand AI eval dataset with veterinary clinical review" \
  "**Acceptance:** Dataset reviewed by licensed SK veterinarian; >=200 cases; drug interaction coverage\n**Ref:** GAP A-01" \
  "p1,ai-safety,evals"

create_issue "[P1-A02] Define clinical safety threshold for AI FP/FN rate" \
  "**Acceptance:** Documented threshold signed by clinical advisor (e.g. FN < 2% for drug contraindications)\n**Ref:** GAP A-02" \
  "p1,ai-safety,clinical"

create_issue "[P1-A03] Red-team: prompt injection and hallucination adversarial tests" \
  "**Acceptance:** Report with >=20 adversarial cases; all P0 findings mitigated\n**Ref:** GAP A-03" \
  "p1,ai-safety,security,red-team"

create_issue "[P1-S02] Document disaster recovery drill with evidence" \
  "**Acceptance:** Dated drill log (< 90 days old) with RTO/RPO measurements\n**Ref:** GAP S-02" \
  "p1,dr,ops"

create_issue "[P1-S03] Add Playwright E2E tests to CI pipeline as merge gate" \
  "**Acceptance:** ci.yml has E2E job that blocks merge on failure; green on main\n**Ref:** GAP S-03" \
  "p1,ci,testing,e2e"

create_issue "[P1-G07] KVEPIS: Submit first real report and get SVPS production acceptance" \
  "**Acceptance:** First real KVEPIS report accepted by SVPS production; response stored in DB\n**Ref:** GAP G-07" \
  "p1,kvepis,regulatory"

echo ""
echo "=== Creating P2 issues (9) ==="

create_issue "[P2-L01-void] e-Kasa: Document void, storno, and correction procedures" \
  "**Acceptance:** Written runbook + passing tests for void/storno/correction flows\n**Ref:** GAP L-02" \
  "p2,ekasa,documentation"

create_issue "[P2-P05] Production API p95 latency dashboard" \
  "**Acceptance:** p95 latency dashboard live; threshold alert configured\n**Ref:** GAP P-05" \
  "p2,observability,performance"

create_issue "[P2-P08] Pilot outcomes report template: 30/60/90 day metrics" \
  "**Acceptance:** Report template created; first report generated 30 days after pilot start\n**Ref:** GAP P-08" \
  "p2,pilot,reporting"

create_issue "[P2-A04] Per-recommendation audit trail in DB" \
  "**Acceptance:** Each AI recommendation logged with source references in audit table\n**Ref:** GAP A-04" \
  "p2,ai-safety,audit"

create_issue "[P2-A05] Onboarding automation bias warning screen for clinicians" \
  "**Acceptance:** Onboarding flow has explicit disclaimer; test covering it passes\n**Ref:** GAP A-05" \
  "p2,ux,ai-safety,clinical"

create_issue "[P2-S04] Data retention and automated deletion policy" \
  "**Acceptance:** CRON job for retention; policy specifying retention periods per data category\n**Ref:** GAP S-04" \
  "p2,data-governance,legal"

create_issue "[P2-S05] SK data migration runbook for SK-specific fields" \
  "**Acceptance:** Step-by-step runbook tested on staging with SK clinic data\n**Ref:** GAP S-05" \
  "p2,migration,ops"

create_issue "[P2-H03] Wholesale live EDI/API integration (CYMEDICA/PHARMOS)" \
  "**Acceptance:** Live API call to at least one wholesaler; inventory updated automatically\n**Ref:** GAP H-03" \
  "p2,inventory,integration"

create_issue "[P2-P09] Measure and document user onboarding time" \
  "**Acceptance:** Onboarding time measured for >=3 non-technical users; target < 2h documented\n**Ref:** GAP P-09" \
  "p2,ux,pilot"

echo ""
echo "=== Done. Created 27 issues in $REPO ==="