# Cluster: Support / Admin / Pilot

**Commit:** `65e008d` | **Cluster:** support-admin-pilot | **Date:** 2026-09-14

Modules covered: Vzdialená Podpora (`/support`), Admin Podpora (`/admin/support`), Pilotná Reconciliácia (`/admin/pilot`), Platform Admin (`/admin`). Tests H3 (Support pair = same feature twice?).

---

## H3 Verdict: FALSE — `/support` and `/admin/support` back DIFFERENT workflows, serve DIFFERENT audiences; they are NOT the same feature exposed twice by role

**Evidence:**

**`/support` (Vzdialená Podpora):**
- Uses: `trpc.extensions.support.createSession`, `.startSession`, `.endSession` [VERIFIED: support/page.tsx:19,29,36]
- Role: all roles (admin/vet/tech/front_desk) [VERIFIED: custom-nav.ts:222]
- UX: The CLINIC STAFF interface. Staff creates a support session → gets a session code → shares the code with the support engineer. They then receive screen-share or remote-control assistance.
- This is the CLIENT-SIDE of the remote support product.

**`/admin/support` (Admin Podpora):**
- Uses: `trpc.extensions.support.endSession`, `.getSessionByCode` [VERIFIED: admin/support/page.tsx:16,23]
- Role: admin ONLY [VERIFIED: custom-nav.ts:230]
- UX: The SUPPORT-ENGINEER interface. A VET.IS support engineer joins the session initiated by the clinic by entering the session code. They can observe or take over the session.
- This is the SERVICE-SIDE of the same remote support product.

**The same `ext_support_sessions` table backs both** — the session is created on one side and joined on the other. This is architecturally correct (a single session entity accessed by two different actors). It is NOT duplication — removing either breaks the feature.

**Verdict:** H3 is **FALSE**. The two routes are complementary halves of a remote-support feature. However, the navigation is misleading: both appear in the general sidebar under "Správa & Manažment" visible to ALL staff (Vzdialená Podpora) and to admin (Admin Podpora). `Admin Podpora` should NOT be in the clinic's sidebar at all — it is a VET.IS internal tool, not a clinic admin tool.

**H3 Supplementary Finding:** `Admin Podpora` being in the clinic's sidebar navigation (even admin-only) is a product architecture smell. A clinic's Practice Admin role is NOT the same as a VET.IS support engineer. This item should either:
1. Be removed from the clinic sidebar entirely and accessed via a separate internal VET.IS support portal.
2. OR be protected by an additional `isSupportEngineer` capability flag beyond just the `admin` role.

---

## A. Integration Opportunities

### A1. Vzdialená Podpora — no context payload when starting session
When a clinic starts a support session, the session is created with no attached context (no practice ID metadata attached to the session that the support engineer can see without asking). The support engineer joins blind.
**Missing link:** `createSession` should attach `{practiceId, practiceName, currentRoute, userAgent}` as session metadata so the support engineer sees context immediately.

### A2. Pilotná Reconciliácia — data parity summary not surfaced on Platform Admin dashboard
The `/admin/pilot` reconciliation page shows daily parity between VetSoftware v2 and OpenVPM AI [VERIFIED: pilot/page.tsx:61–82 — queries `getDailyParitySummary`, `getPendingClinicalDrafts`, `getSuppressedCommunications`, `listDiscrepancies`]. This is high-value admin data that should surface as a widget on the Platform Admin (`/admin`) page during the pilot phase.
**Missing link:** `trpc.extensions.reconciliation.getDailyParitySummary` → dashboard widget on `/admin` during pilot.

### A3. Platform Admin — no audit trail viewer for AI actions
The `ext_ai_audit_log` (SHA-256 hash chain for all AI clinical actions) has no UI viewer. Platform Admin is the natural home.
**Missing link:** `trpc.extensions.auditExport.*` → Audit Log tab in `/admin` (also flagged in ux-analysis F8).

---

## B. Duplication / Overlap Check

| Pair | Overlap | Evidence |
|---|---|---|
| Vzdialená Podpora vs Admin Podpora | **None** (H3: FALSE) | Different actor roles, different tRPC procedures, same session entity. Not duplicates — see H3 verdict. |
| Platform Admin vs Nastavenia | **Partial** | Both are admin-only. Platform Admin (`/admin`) handles multi-tenant practice management, subscriptions, user admin, billing lapse. Settings (`/settings`) handles clinic configuration (services, staff, appointment types, etc.). Different concerns, both correctly separate. However, some items in Settings could be considered Platform Admin territory (e.g., data import/export, API keys). Not a merge candidate. |

---

## C. Nesting Candidates

| Module | Nesting verdict | Where |
|---|---|---|
| Admin Podpora | **YES — remove from sidebar entirely** | Should be an internal VET.IS tool, not in any clinic's sidebar. Or move to Platform Admin section under a `checkSupportRole` capability check. |
| Pilotná Reconciliácia | **YES — temporary, should move to Platform Admin** | Currently shows to all roles (admin/vet/tech/front_desk) [VERIFIED: custom-nav.ts:239]. This is a pilot-phase operational tool that should be admin-only and nested under `/admin` as a tab (alongside the existing admin functionality). Post-pilot: remove entirely. |

---

## D. Settings Candidates

| Module | Verdict |
|---|---|
| Platform Admin | **No** — it IS the admin surface, not a setting |
| Vzdialená Podpora | **No** — daily/as-needed operational tool |
| Admin Podpora | **Move out of all clinic nav** — not settings, not daily workflow for clinics |
| Pilotná Reconciliácia | **No** — operational data (not config). Nest under admin, restrict to admin role. |

---

## E. Scope-Clarity Verdicts

| Module | Current name clarity | Proposed clarification |
|---|---|---|
| Vzdialená Podpora | ✅ Clear — "Remote Support" | Keep |
| Admin Podpora | ❌ Misleading — clinics' admins don't know this is for VET.IS engineers | Remove from clinic nav. Internal VET.IS tool only. |
| Pilotná Reconciliácia | ✅ Clear for current pilot phase | Rename to **"Shadow-Run Kontrola"** to make the temporary pilot nature explicit; restrict to admin role |
| Platform Admin | ✅ Clear | Keep |

---

## F. Recommendations + Migration Risk

| Module | Recommendation | Risk |
|---|---|---|
| Vzdialená Podpora | **Keep as-is** in nav (all roles). Add session context metadata (A1). | **Low** |
| Admin Podpora | **Remove from clinic sidebar**. Protect via `checkSupportRole` capability [VERIFIED: support.ts:137 — `checkSupportRole: protectedProcedure.query(({ ctx }) => ...)` already exists]. Access only via internal tool or direct URL. | **Low** — only admin-role users see this; `nav.adminSupport` i18n key deprecated; route `/admin/support` remains for direct access. No known e2e for this item [INFERRED]. |
| Pilotná Reconciliácia | **Move to admin-only** and nest as tab under `/admin`. Remove from nav as standalone. Role restriction from all→admin is a **breaking change for non-admin pilot users**. | **Med** — role change affects tech/front_desk/vet pilot users who currently see this. i18n key `nav.pilotReconciliation` deprecated. Post-pilot: entire feature retired. No known e2e [INFERRED]. |
| Platform Admin | **Keep as-is**. Add AI Audit Log viewer tab (A3). | **Low** |
