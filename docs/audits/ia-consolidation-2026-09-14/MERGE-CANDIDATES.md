# Merge Candidates — Definite Resolution

**Commit:** `65e008d` | **Date:** 2026-09-14

Aggregated from all cluster §3.B findings. The orchestrator has cross-cluster visibility — each item below is resolved to a definite **MERGE / NO-MERGE / NEST** call, with rationale and migration risk. Partial overlaps flagged by clusters that couldn't make the call alone are resolved here.

---

## M-01 · Vzdialená Podpora vs Admin Podpora
**Hypothesis tested:** H3  
**Cluster verdict:** support-admin-pilot — H3 FALSE (different procedures, different audiences)  
**Orchestrator resolution:** **NO MERGE — but REMOVE Admin Podpora from clinic nav**

The two routes are architecturally complementary (clinic side + support-engineer side of one session). They MUST remain as separate routes. However, `Admin Podpora` is a VET.IS internal tool incorrectly appearing in every clinic admin's sidebar. The tRPC router already has `checkSupportRole` [VERIFIED: support.ts:137] for exactly this distinction.

**Decision:** Keep both routes. Remove `Admin Podpora` from `customNavItems` in `custom-nav.ts`. Protect route with `checkSupportRole` capability flag. Access via direct URL or internal VET.IS portal only.

**Migration risk:** **Low**
- Only admin-role clinic users see this item. Removing from nav doesn't break functionality.
- `nav.adminSupport` i18n key deprecated.
- No known e2e spec asserts this nav item [INFERRED].
- Route `/admin/support` remains intact for direct URL access.

---

## M-02 · Analýza Snímkov (`/agent/imaging`) — nest vs keep standalone
**Hypothesis tested:** H5  
**Cluster verdict:** ai-agent — H5 TRUE (should nest in encounter/imaging workflow)  
**Orchestrator resolution:** **NEST inside Encounter workspace — remove from top-level nav**

Evidence is decisive: `injectFindingsIntoSoap` procedure [VERIFIED: imaging.ts:539] writes directly into the encounter's SOAP note via the shared soap lifecycle. The imaging analysis IS a step within a diagnostic encounter. The standalone nav item fragments the clinical workflow — a vet must leave the encounter, navigate to `/agent/imaging`, run analysis, then return to the encounter for the findings to appear.

**Decision:** Add "Snímky & AI analýza" tab to the encounter workspace (`/encounters/[id]#imaging`). Remove from top-level nav. Route `/agent/imaging` remains for direct access (backward compat). Marketing quiz generator becomes a bonus action within the imaging tab.

**Migration risk:** **Medium**
- `nav.agentImaging` i18n key deprecated; remove from `customNavItems`.
- Encounter workspace gains a new tab — requires UI implementation.
- `baseline-screenshots.spec.ts` may assert the sidebar contains this item [INFERRED — check before removal].
- Role restriction (admin/vet) consistent with encounter roles — no role impact.

---

## M-03 · Prepúšťacie Správy (`/agent/discharge`) — nest vs keep standalone
**Hypothesis tested:** H4  
**Cluster verdict:** ai-agent — H4 TRUE (should nest in encounter closeout)  
**Orchestrator resolution:** **NEST inside Encounter closeout — remove from top-level nav**

Evidence: the discharge page searches for a patient and optionally links to an appointment [VERIFIED: discharge/page.tsx:126,131]. The discharge summary is semantically 1:1 with a specific visit. The `generateSmsAndSchedule` action and the history list (`listRecent`) are the only features that justify a standalone view — and both can live within the encounter workspace or be accessible from the patient's record page.

Additionally, the agent tool `create_discharge_summary` in the chat interface duplicates the core function [VERIFIED: ux-analysis §4a]. After nesting, the agent tool becomes the quick-path for power users; the standalone encounter tab is the guided UX.

**Decision:** Add "Prepúšťacia správa" action/tab to encounter closeout flow. Remove from top-level nav. Route `/agent/discharge` remains for backward compat with any bookmarks or direct links (e.g., from SMS → discharge history).

**Migration risk:** **Medium**
- `nav.agentDischarge` i18n key deprecated; remove from `customNavItems`.
- Roles: currently all roles except viewer — consistent with encounter closeout roles.
- `ai-finalization-pilot.spec.ts` [VERIFIED: e2e/ directory] — this spec may test the discharge AI flow; **must be checked** before removing the nav item. The spec likely navigates to `/agent/discharge` directly, so route removal is more impactful than nav removal.

---

## M-04 · Plán obsahu + Schvaľovanie obsahu — merge as tabs
**Cluster verdict:** marketing-web-media — near-total operational overlap  
**Orchestrator resolution:** **MERGE — both become tabs inside Marketingové Štúdio dashboard**

Both query `ext_marketing_content_items`. The distinction (calendar view vs approval queue) is a VIEW, not a module. Having two separate nav items for two views of the same table doubles the nav footprint for no structural reason.

**Decision:** Marketingové Štúdio (`/marketing`) becomes a tabbed dashboard with: Overview, Kalendár (was: Plán obsahu), Schvaľovanie (was: Schvaľovanie obsahu), and Vet Intel (was: Vet Intelligence, see M-06). Routes `/marketing/plan` and `/marketing/content-queue` can redirect to `/marketing#plan` and `/marketing#queue` respectively.

**Migration risk:** **Medium**
- Two i18n keys deprecated: `nav.marketingPlan`, `nav.marketingContentQueue`.
- Routes redirect rather than disappear — no bookmark breakage.
- `baseline-screenshots.spec.ts` may capture these routes [INFERRED].

---

## M-05 · Centrum potlačení — merge as tab inside Automatizácie
**Cluster verdict:** marketing-web-media — compliance view of automation outputs  
**Orchestrator resolution:** **NEST as tab inside `/marketing/automations`**

The suppression center is the audit trail of the automation engine. It has no independent workflow — it is read-only monitoring of automation outcomes. Having it as a sibling nav item of Automatizácie duplicates the marketing section with a compliance sub-view.

**Decision:** Add "Suppression" tab to `/marketing/automations`. Route `/marketing/suppression` redirects to `/marketing/automations#suppression`.

**Migration risk:** **Low**
- `nav.marketingSuppression` i18n key deprecated.
- Route redirects — no broken bookmarks.
- Admin/vet roles — consistent.

---

## M-06 · Vet Intelligence — nest as tab inside Marketing Studio
**Cluster verdict:** ai-agent — thin standalone page, feeding marketing domain  
**Orchestrator resolution:** **NEST as tab inside Marketingové Štúdio**

The Vet Intel page is primarily a "run competitor analysis" trigger + results list. The data feeds directly into marketing content strategy. Making it a tab inside Marketing Studio (`/marketing#competition`) makes it discoverable in context and removes an English-named item from the Slovak nav.

**Decision:** `/vet-intel` → tab in `/marketing#competition`. Route `/vet-intel` redirects. Nav item removed.

**Migration risk:** **Low**
- `nav.vetIntel` i18n key deprecated.
- Route redirects.
- No known e2e for this specific item [INFERRED].

---

## M-07 · Připomienky (`/recalls`) — merge as tab inside Zdravotné pripomienky
**Cluster verdict:** clinical-records — partial overlap, different workflow (individual vs batch)  
**Orchestrator resolution:** **NEST as tab, not a full merge**

The recall page uses `trpc.notifications.sendVaccinationReminders` (batch cross-patient). The care-reminders page uses `trpc.careReminders.*` (individual). These are different data sources and different operational workflows — they should NOT share a single data view. However, they ARE conceptually adjacent (both about vaccination reminders) and should be co-located.

**Decision:** Zdravotné pripomienky gains a second tab: "Hromadný recall" (was: Pripomienky `/recalls`). Route `/recalls` redirects to `/care-reminders#batch`.

**Migration risk:** **Medium**
- `nav.recalls` i18n key deprecated.
- Route redirect needed.
- Check `fresh-clinic-mock-launch.spec.ts` and `dogfood.spec.ts` for `/recalls` navigation assertions [INFERRED — could not verify without running specs].

---

## NO-MERGE Decisions (Overlaps Investigated but Rejected)

| Pair | Decision | Reason |
|---|---|---|
| Záznamy vs Vyšetrenia | **No merge** | Same data different purpose: records = patient-level history (read-only context), encounters = active visit workspace (edit/closeout). Merging would destroy the visit-focused UX. |
| Zdravotné pripomienky vs Pripomienky | **No merge** — nest instead (M-07) | Different data sources; nesting preserves distinction while reducing nav sprawl. |
| Laboratórium vs Záznamy (lab section) | **No merge** | Lab-results = workflow queue (technician review inbox). Záznamy lab history = patient-scoped read. Same data, different views for different personas. Keep both; add cross-reference. |
| Fakturácia vs e-Kasa | **No merge** | e-Kasa is fiscal regulation, not invoice management. Correctly separate routes in the billing section. |
| Agent vs Hlasové Diktovanie | **No merge** | Voice dictation needs dedicated microphone UX; chat agent cannot replace it. |
| Správy (inbox) vs Správy & SMS (marketing) | **No merge** | Different data (`conversations` vs `ext_marketing_sms_log`). Fix by renaming marketing item to "Kampane & SMS". |
| Platform Admin vs Nastavenia | **No merge** | Different concerns: multi-tenant management vs clinic configuration. |
