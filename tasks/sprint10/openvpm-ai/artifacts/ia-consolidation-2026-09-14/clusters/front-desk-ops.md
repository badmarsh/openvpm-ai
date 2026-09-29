# Cluster: Front Desk / Ops

**Commit:** `65e008d` | **Cluster:** front-desk-ops | **Date:** 2026-09-14

Modules covered: Rozvrh (`/schedule`), Čakáreň (`/waiting-room`), Prevádzková tabuľa (`/whiteboard`), Klienti (`/clients`), Správy/Inbox (`/inbox`).

---

## A. Integration Opportunities

### A1. Rozvrh — no automated "Send reminder SMS" action from calendar
The schedule page shows appointments but has no one-click "Send reminder SMS" action from the appointment card. Reminders are triggered via care-reminders or the automation journey — but a front-desk person reviewing tomorrow's schedule cannot send a quick manual reminder SMS from the schedule view.
**Missing link:** `trpc.messaging.*` or `trpc.notifications.sendSms` → "Odoslať pripomienku" action button on appointment card in schedule.

### A2. Čakáreň — no link to client portal for checked-in patients
The waiting-room display shows checked-in patients. There is no quick-action to send a portal link to a client who just arrived and needs to fill in a form or view their consent.
**Missing link:** `trpc.portal.*` (generate portal token) → "Poslať odkaz na portál" action in waiting-room row.

### A3. Prevádzková tabuľa — no unified visit+invoice status badge
The whiteboard shows patient status (`checked_in`, `in_exam`, etc.) but does NOT show invoice status. Front desk staff must navigate to `/billing` to check if a patient has been invoiced before checkout. This was flagged as F5 in the UX analysis [VERIFIED: ux-analysis F5].
**Missing link:** `trpc.billing.getInvoiceForAppointment` → invoice status badge on whiteboard patient card.

### A4. Klienti — no wellness benefit status in client header
The client detail page shows patient list, portal access, insurance — but no wellness plan enrollment status or benefit balance. Front desk answering "how many dental cleanings do we have left?" must navigate to the wellness billing panel.
**Missing link:** `trpc.wellness.getEnrollment` → benefit balance summary widget in client detail header.

### A5. Inbox (`/inbox`) — no link to patient record from conversation thread
When a client messages about their pet, the conversation thread has no deeplink to the patient's record. Staff must manually search for the patient.
**Missing link:** `patients` lookup by client ID → "View patient record" link in conversation thread header.

### A6. Rozvrh — no conflict warning for doctor double-booking across rooms
The schedule page shows appointments per doctor/room but [INFERRED from appointments.ts:1161] the `fetchOverlapping` conflict check exists at the API level. There is no live visual warning on the calendar when a drag-and-drop would create a conflict before confirmation.
**Missing link:** Pre-commit conflict check → visual warning overlay on calendar drop target.

---

## B. Duplication / Overlap Check

| Pair | Overlap | Evidence |
|---|---|---|
| Čakáreň vs Prevádzková tabuľa | **Partial** | Both use `trpc.whiteboard.*` on `appointments` table. Čakáreň = waiting-room display (checked-in, read-only, TV-optimized). Whiteboard = staff operational board (all active visits, status transitions, staff-facing). Different audiences (patients vs staff) and interaction modes (passive display vs active management). Not a merge — but both updating via 30s polling [VERIFIED: ux-analysis F2]. |
| Správy `/inbox` vs Správy & SMS `/marketing/messages` | **Partial** (cross-cluster) | Same nav label "Správy" for different features. flagged in marketing cluster — resolved by renaming marketing item to "Kampane & SMS". |

---

## C. Nesting Candidates

| Module | Nesting verdict | Where |
|---|---|---|
| Čakáreň | **Borderline** — could be a "TV Mode" view of the Whiteboard | If implemented: a full-screen mode toggle on the Whiteboard that becomes the Čakáreň TV view. However, the current Čakáreň serves a distinct audience (patients looking at a screen in the waiting area), so keeping it separate has value. **Recommendation: keep standalone but add deeplink from Whiteboard.** |
| All front-desk items | **No** — these are all daily high-frequency workflow tools that should stay visible and accessible. | — |

---

## D. Settings Candidates

| Module | Verdict |
|---|---|
| Rozvrh | **No** — core daily workflow |
| Čakáreň | **No** — daily display |
| Prevádzková tabuľa | **No** — core daily workflow |
| Klienti | **No** — core daily workflow |
| Inbox | **No** — core daily workflow |

None of the front-desk ops modules are Settings candidates. They are all high-frequency daily workflow items correctly placed.

---

## E. Scope-Clarity Verdicts

| Module | Current name clarity | Proposed clarification |
|---|---|---|
| Rozvrh | ✅ Clear — "Schedule" | Keep |
| Čakáreň | ✅ Clear — "Waiting Room" | Keep; consider adding "(TV)" qualifier to distinguish from the whiteboard |
| Prevádzková tabuľa | ✅ Clear — "Operations Board" | Keep |
| Klienti | ✅ Clear — "Clients" | Keep |
| Správy (inbox) | ⚠️ Collides with marketing "Správy & SMS" | Keep nav label "Správy" for inbox; ensure marketing item is renamed to "Kampane & SMS" (cross-cluster) |

---

## F. Recommendations + Migration Risk

| Module | Recommendation | Risk |
|---|---|---|
| Rozvrh | **Keep as-is**. Add manual reminder SMS action (A1). Add visual conflict warning (A6). | **Low** — enhancements only |
| Čakáreň | **Keep as-is**. Add portal link quick-action (A2). | **Low** |
| Prevádzková tabuľa | **Keep as-is**. Add invoice status badge (A3). Fix "Live" indicator to show polling interval [VERIFIED: ux-analysis F5, F2 — already known]. | **Low** |
| Klienti | **Keep as-is**. Add wellness benefit summary widget (A4). | **Low** |
| Inbox | **Keep as-is**. Add patient record deeplink from conversation (A5). | **Low** |

**Overall front-desk cluster assessment:** This is the best-structured cluster in the sidebar. All 5 modules are correctly placed, distinct in scope, and daily-use. The improvements needed are integration enhancements (adding cross-links), not structural nav changes.
