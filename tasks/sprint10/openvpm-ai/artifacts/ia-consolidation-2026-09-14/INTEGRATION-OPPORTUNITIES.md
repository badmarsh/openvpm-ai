# Integration Opportunities — Prioritized Master List

**Commit:** `65e008d` | **Date:** 2026-09-14

Aggregated from all 7 cluster analyses. Sorted by **Impact × Effort⁻¹** (plain judgment). Each item names the specific modules and data links involved, not generic "better integration."

---

## Priority 1 — High Impact, Low Effort

### I-01 · Prevádzková tabuľa — unified visit + invoice status badge
**Cluster:** front-desk-ops  
**From:** `trpc.billing.getInvoiceForAppointment` → whiteboard patient card  
**Impact:** Eliminates the most common front-desk context-switch (whiteboard → billing to check payment). Prevents premature checkout of unpaid visits. Already flagged as F5/ICE W3 in ux-analysis.  
**Effort:** Low — one additional query per appointment card; result already available in `invoices` table.  
**Status:** Not implemented [VERIFIED: whiteboard/page.tsx scan — no billing join].

### I-02 · Záznamy — vitals snapshot in patient sidebar
**Cluster:** clinical-records  
**From:** `trpc.vitals.listByPatient` → patient record sidebar  
**Impact:** Vets reviewing history no longer need to open an encounter to see the last recorded weight/temperature. Reduces navigation friction for rapid record reviews.  
**Effort:** Low — `vitals.listByPatient` already exists; add a summary widget to records page patient detail panel.  
**Status:** Not implemented [VERIFIED: records/page.tsx:799 — vitals query exists only in encounter context, not in patient sidebar].

### I-03 · Discharge — auto-suggest most recent checked-out appointment
**Cluster:** ai-agent  
**From:** `trpc.appointments.list({patientId, status:'checked_out'})` → discharge page patient search  
**Impact:** Eliminates manual appointment lookup during discharge generation. Reduces errors where discharge is generated for wrong appointment. H4-adjacent (discharge should eventually nest in encounter, but this is a quick win in the interim).  
**Effort:** Low — one additional query after patient selection.  
**Status:** Not implemented [VERIFIED: discharge/page.tsx:182–190 — no appointment auto-suggest].

### I-04 · Agent — patient context deep-link from records/encounters
**Cluster:** ai-agent  
**From:** "Ask Agent" button → `/agent?patientId=UUID&encounterId=UUID`  
**Impact:** Vets can invoke the AI agent from within a patient context without losing the patient reference. Drug interaction queries and SOAP plan suggestions become contextual.  
**Effort:** Low — add URL param handling to agent page (already accepts query params for voice dictation, same pattern).  
**Status:** Not implemented [INFERRED from agent/page.tsx structure].

### I-05 · e-Kasa daily closure status badge on billing dashboard
**Cluster:** finance-compliance  
**From:** `trpc.extensions.ekasa.getDailyClosureStatus` → billing dashboard header  
**Impact:** Admins and front desk see e-Kasa compliance status without navigating to `/billing/ekasa`. Critical for end-of-day workflow.  
**Effort:** Low — one status query; result is a boolean + timestamp.  
**Status:** Not implemented [INFERRED from billing/page.tsx structure].

---

## Priority 2 — High Impact, Medium Effort

### I-06 · Web kliniky — staff profiles sync from `users` table
**Cluster:** marketing-web-media (H1)  
**From:** `users.{name, role, bio, avatarUrl}` + opt-in `showOnWebsite` flag → website "Team" section  
**Impact:** Eliminates data drift when staff change. New hires automatically appear (with opt-in). Removes manual authoring of bios that are already in the system.  
**Effort:** Medium — requires: (a) `showOnWebsite` + `bio` fields on `users` table; (b) `getWebsiteConfig` query extension; (c) website section editor populated with live data.  
**Status:** Not implemented — `getWebsiteConfig` returns only staff COUNT, not profiles [VERIFIED: marketing.ts:3537–3546].

### I-07 · Web kliniky — services list from `services` table
**Cluster:** marketing-web-media (H1)  
**From:** `services` table → website "Services" section auto-populate  
**Impact:** Service pricing and descriptions stay consistent between booking portal and public website. Current hand-authoring creates price drift.  
**Effort:** Medium — `getWebsiteConfig` needs to query `services` table; website section editor needs a "use live services" toggle.  
**Status:** Not implemented [VERIFIED: marketing.ts:3507–3628 — no `services` table query].

### I-08 · Inbox — patient record deeplink from conversation thread
**Cluster:** front-desk-ops  
**From:** client ID in conversation → `patients` lookup → `/patients/[id]` deeplink  
**Impact:** Front desk answering patient-related messages can immediately pull up the patient record without a separate search.  
**Effort:** Medium — requires client→patient association in conversation display; `clients` table has patient list.  
**Status:** Not implemented [INFERRED from inbox/page.tsx structure].

### I-09 · Laboratórium — imaging study cross-reference panel
**Cluster:** clinical-records + ai-agent (H5-adjacent)  
**From:** `trpc.extensions.imaging.listByPatient` → panel in lab-results review  
**Impact:** Vets reviewing biochemistry results can simultaneously see radiography findings for the same patient visit — eliminates "two-screen" review of diagnostic results.  
**Effort:** Medium — add a collapsible sidebar panel to lab-results page.  
**Status:** Not implemented [VERIFIED: lab-results/page.tsx — no imaging query].

### I-10 · Imaging — "Promote to Media Library" action post-analysis
**Cluster:** marketing-web-media (H2)  
**From:** `trpc.extensions.imaging.confirmAnalysis` → optional `trpc.extensions.marketing.createMediaAsset`  
**Impact:** Educational imaging cases (de-identified) can flow directly into the media library for social/handout use without re-upload. Closes H2's isolation problem partially.  
**Effort:** Medium — action button + confirmation dialog with de-identification reminder; API call to media library.  
**Status:** Not implemented [VERIFIED: imaging.ts procedures — no media library reference].

### I-11 · Zdravotné pripomienky — "Book appointment" action from reminder row
**Cluster:** clinical-records  
**From:** `trpc.appointments.create` pre-filled with appointment type inferred from reminder care type  
**Impact:** Converts care reminder into a booked appointment in one click. Currently requires two separate navigation steps.  
**Effort:** Medium — care_reminders table has `careType` field; map to appointment type; pre-fill schedule.  
**Status:** Not implemented [INFERRED from care-reminders/page.tsx].

### I-12 · Vet Intelligence — competitor insights in Marketing Plan
**Cluster:** ai-agent  
**From:** `trpc.extensions.marketing.listCompetitorSnapshots` → insight panel in `/marketing/plan`  
**Impact:** Content calendar decisions informed by competitor intelligence (what competitors are posting, what's working for them vs the clinic).  
**Effort:** Medium — sidebar insight widget in plan page.  
**Status:** Not implemented [INFERRED from vet-intel/page.tsx — competitor data not exported to plan page].

---

## Priority 3 — Medium Impact, Medium Effort

### I-13 · Voice dictation — "Open in Encounter" shortcut after SOAP confirmation
**Cluster:** ai-agent  
**From:** After `trpc.extensions.discharge.save` / voice SOAP confirmation → deeplink to `/encounters/[appointmentId]`  
**Impact:** Removes the manual navigation step after voice dictation — vet goes directly to encounter to finalize.  
**Effort:** Low-Med — deeplink button; appointment context needed at save time.

### I-14 · Klienti — wellness benefit balance in client header
**Cluster:** front-desk-ops  
**From:** `trpc.wellness.getEnrollment({clientId})` → client detail header  
**Impact:** Front desk can answer "how many benefits left?" without navigating to wellness billing panel.  
**Effort:** Low-Med.

### I-15 · Rozvrh — manual SMS reminder from appointment card
**Cluster:** front-desk-ops  
**From:** `trpc.messaging.*` / `trpc.notifications.sendSms` → appointment card action  
**Impact:** Front desk can send a quick reminder to clients with same-day appointments without navigating to messaging.  
**Effort:** Medium — confirmation dialog + SMS send.

### I-16 · Platform Admin — AI audit trail viewer tab
**Cluster:** support-admin-pilot + finance-compliance  
**From:** `trpc.extensions.auditExport.*` → Audit Log tab in `/admin` or `/statutory`  
**Impact:** Compliance officers and admins can review and export the SHA-256 hash-chained AI audit log through the UI. Currently CLI-only.  
**Effort:** Medium — table UI + export; data already exists in `ext_ai_audit_log`.

### I-17 · Klienti portal — "Book appointment" from waiting-room row
**Cluster:** front-desk-ops  
**From:** `trpc.portal.*` portal token → quick-send from `/waiting-room`  
**Impact:** Staff can send a portal link to clients in the waiting room who need to fill in forms.  
**Effort:** Medium.

---

## Priority 4 — Medium/Low Impact or High Effort

### I-18 · Web kliniky — opening hours from provider availability settings
**Cluster:** marketing-web-media (H1)  
**From:** `trpc.settings.getBookingConfig` → website "Hours" section  
**Impact:** Removes hours drift when clinic changes schedule.  
**Effort:** High — `providerAvailability` hours format needs translation to human-readable website format.

### I-19 · Recenzie — 3–4 star review staff task creation
**Cluster:** marketing-web-media  
**From:** Mid-tier review → moderate priority `extMarketingStaffTasks`  
**Impact:** Proactive reputation management for reviews that don't trigger automatic escalation.  
**Effort:** Low — add condition to review processing logic.

### I-20 · Fakturácia — AI missed-charge detection at closeout
**Cluster:** finance-compliance  
**From:** SOAP procedures/meds vs `invoice_items` comparison at `encounters.finalizeCloseout`  
**Impact:** Prevents revenue leakage from unbilled administered items.  
**Effort:** High — NLP parsing of SOAP text + item matching logic.

### I-21 · Centrum potlačení — deeplink to patient from suppression event
**Cluster:** marketing-web-media  
**From:** Patient/client ID in suppression log row → `/patients/UUID`  
**Impact:** Low friction for investigating a suppression event.  
**Effort:** Low.
