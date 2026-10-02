# Cluster: Finance / Compliance

**Commit:** `65e008d` | **Cluster:** finance-compliance | **Date:** 2026-09-14

Modules covered: Fakturácia (`/billing`), e-Kasa Doklady (`/billing/ekasa`), Omamné látky (`/controlled-substances`), Zákonné registre (`/statutory`), Prehľady (`/reports`).

---

## A. Integration Opportunities

### A1. Fakturácia — no missed-charge detection at closeout
When a visit is closed out via `encounters.finalizeCloseout`, the SOAP note and procedures are finalized but there is no AI check for unbilled items (medications administered, procedures performed but not invoiced). This was proposed as A1 in the UX analysis ICE roadmap [VERIFIED: ux-analysis §6 A1 — ICE 12.5].
**Missing link:** At `encounters.finalizeCloseout` → compare SOAP procedures/meds to `invoice_items` → flag missing charges.

### A2. e-Kasa — daily closure not surfaced on the billing dashboard
The `ekasaDailyClosures` cron runs automatically, but the billing dashboard (`/billing`) has no status indicator showing whether today's e-Kasa closure has run successfully or is pending. A user must navigate to `/billing/ekasa` to check.
**Missing link:** `trpc.extensions.ekasa.getDailyClosureStatus` → status badge on billing dashboard header.

### A3. Zákonné registre — AI audit chain log not visible in compliance tab
The SHA-256 hash-chained `ext_ai_audit_log` is a critical compliance record (shows all AI-assisted clinical decisions). It has no UI viewer. The statutory registers page is the natural home.
**Missing link:** `trpc.extensions.auditExport.*` → "AI Audit Log" tab in Zákonné registre (or Platform Admin).

### A4. Prehľady — controlled substances not in financial reports
The reports page (`/reports`) covers financial and clinical metrics but does not surface controlled substance usage reports. Slovak law requires periodic controlled substance reporting. A dedicated controlled substances report should appear under reports or as an export option.
**Missing link:** `trpc.controlledSubstances.list` with date filter → export tab in Prehľady.

### A5. Fakturácia — no insurance claim integration with `/billing/ekasa` receipt cross-reference
Pet insurance (PetExpert HTML report [VERIFIED: REORGANIZATION-FINDINGS.md §5]) generates claims from encounter data. The e-Kasa receipt for the same visit is not cross-referenced in the insurance claim view. A clinician generating an insurance claim cannot see whether the e-Kasa receipt was already issued.
**Missing link:** `ext_ekasa_receipts.appointmentId` → cross-reference in insurance claim flow.

---

## B. Duplication / Overlap Check

| Pair | Overlap | Evidence |
|---|---|---|
| Fakturácia vs e-Kasa Doklady | **Partial** | Both are billing-related. Fakturácia = invoice management (Slovak: `invoices` table). e-Kasa = fiscal receipt issuance (`ext_ekasa_receipts` table). They are related (an e-Kasa receipt is issued FROM an invoice) but architecturally separate. The e-Kasa sub-route (`/billing/ekasa`) is correctly nested under billing in the URL hierarchy. In the nav it appears as a separate custom item in the billing section — this is reasonable (the e-Kasa workflow is distinct enough to need its own page). Not a merge. |
| Zákonné registre vs Prehľady | **Low** | Statutory registers = compliance record-keeping (rabies, treatment diary, euthanasia). Reports = financial/clinical analytics. Different audiences and purposes. Not a merge. |
| Omamné látky vs Zákonné registre | **Partial** | Controlled substances have their own register (`controlled_substance_log`) which is a statutory register under Zákon 139/1998 Z.z. The statutory page (`/statutory`) does NOT include controlled substances — it has its own separate nav item under Pharmacy. This creates a compliance gap: a regulatory inspector would look for all registers in one place. |

---

## C. Nesting Candidates

| Module | Nesting verdict | Where |
|---|---|---|
| e-Kasa Doklady | **Borderline** — already nested in URL (`/billing/ekasa`). Should it ALSO be a top-level nav item in the billing section? Yes — the fiscal workflow is frequent enough (every invoice for cash payment) to justify its own nav entry in the billing group. Keep as sub-nav item. |
| Omamné látky | **Weak nesting candidate** | Could be added as a tab to Zákonné registre (it IS a statutory register). Currently in Pharmacy/Lekáreň section, which also makes sense (pharmacists access it). See §D verdict. |
| Prehľady | **No** — reports are used by admin/vet regularly. Keep standalone. |

---

## D. Settings Candidates

| Module | Verdict |
|---|---|
| Fakturácia | **No** — daily workflow |
| e-Kasa Doklady | **Partially** — the e-Kasa device/printer *configuration* (ORP/VRP registration, API keys) is setup. The *receipt issuance* workflow is daily. Config → Settings > Integrations > e-Kasa. Receipt issuance stays in billing nav. |
| Omamné látky | **No** — daily/as-needed clinical compliance workflow with strict witness requirements |
| Zákonné registre | **No** — compliance registers are touched regularly (after each euthanasia, each rabies case, etc.) |
| Prehľady | **No** — regularly reviewed by admin/vet |

---

## E. Scope-Clarity Verdicts

| Module | Current name clarity | Proposed clarification |
|---|---|---|
| Fakturácia | ✅ Clear | Keep |
| e-Kasa Doklady | ✅ Clear for Slovak context | Keep |
| Omamné látky | ✅ Clear | Keep; add cross-reference to Zákonné registre |
| Zákonné registre | ✅ Clear | Keep; add AI audit log tab (A3) |
| Prehľady | ✅ Clear | Keep |

---

## F. Recommendations + Migration Risk

| Module | Recommendation | Risk |
|---|---|---|
| Fakturácia | **Keep as-is**. Add missed-charge detection at closeout (A1). | **Low** |
| e-Kasa Doklady | **Keep as nav item**. Move e-Kasa device CONFIG to Settings > Integrations. | **Low** — config moves to settings, workflow item stays. |
| Omamné látky | **Keep in Pharmacy section**. Add a "View in Statutory Register" link to the `/statutory` controlled substances log (A4 cross-link). | **Low** |
| Zákonné registre | **Keep as-is**. Add AI Audit Log tab (A3). | **Low** |
| Prehľady | **Keep as-is**. Add controlled substance usage export (A4). | **Low** |

**Overall finance/compliance cluster assessment:** This is a well-structured cluster with clear module separation. The only meaningful structural issue is the cross-silo gap between controlled substances (Pharmacy section) and the statutory register where it legally belongs (Compliance section). The fix is a cross-link, not a nav restructure.
