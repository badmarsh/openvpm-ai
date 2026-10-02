# Cluster: Marketing / Web / Media

**Commit:** `65e008d` | **Cluster:** marketing-web-media | **Date:** 2026-09-14

Modules covered: Marketingové Štúdio (`/marketing`), Brand Kit (`/marketing/brand-kit`), Plán obsahu (`/marketing/plan`), Schvaľovanie obsahu (`/marketing/content-queue`), Recenzie (`/marketing/reviews`), Letáky (`/marketing/handouts`), Správy & SMS (`/marketing/messages`), Web kliniky (`/marketing/website`), Čakáreň TV (`/marketing/tv`), Automatizácie (`/marketing/automations`), Centrum potlačení (`/marketing/suppression`), Súhlasy & skripty (`/marketing/consents`), Knižnica médií (`/marketing/media`), Čerpanie benefitov (`/marketing/wellness`). Tests H1 (Website under-integrated) and H2 (Media library under-integrated).

---

## H1 Verdict: PARTIALLY TRUE — Website does pull some live data, but staff bios and opening hours are completely disconnected

**Evidence:**

The `getWebsiteConfig` procedure [VERIFIED: marketing.ts:3507–3628] pulls:
- ✅ `staffMembers` count from `users` table (admin/vet/tech roles) [VERIFIED: marketing.ts:3537–3546]
- ✅ `fiveStarReviews` count from `ext_marketing_reviews` [VERIFIED: marketing.ts:3561–3570]
- ✅ `patientCount` from `patients` table [VERIFIED: marketing.ts:3573–3582]
- ✅ `inquiriesCount` from `ext_marketing_website_inquiries` [VERIFIED: marketing.ts:3591–3600]
- ✅ `yearsInPractice` calculated from `practices.createdAt` [VERIFIED: marketing.ts:3585–3588]
- ✅ Brand kit (colors, logo, tone) pulled from `practices.settings.brandKit` [VERIFIED: marketing.ts:3602–3611]

**NOT pulled (hand-typed in sections):**
- ❌ Individual staff **biographies and photos** — only staff COUNT is returned. The website's "Team" section content (names, credentials, bio text, photo) is hand-authored in `sectionsDraft` JSON, not pulled from the `users` table's profile data.
- ❌ **Opening hours** — not queried from `settings.ts` (`appointmentTypes`, `providerAvailability`) or any opening hours schema. Hand-typed in website sections.
- ❌ **Services list** — the `services` table exists [VERIFIED: _app.ts router imports `settings.ts` which manages `services`] but is not queried by `getWebsiteConfig`. The website's "Services" section is hand-authored.
- ❌ **Appointment booking** — the website builder shows contact form inquiries but has no "Book Online" widget that links to `trpc.booking.*` (the self-booking flow used for the public booking portal).

**Verdict:** H1 is **partially true**. The system pulls aggregate stats (counts) correctly, but the rich content that makes a clinic website compelling — individual staff profiles, actual service list, live booking, opening hours — is entirely disconnected. The risk is data drift: a new vet joins the practice (added to `users`), but their bio never appears on the website because it's manually authored.

---

## H2 Verdict: TRUE — Knižnica médií is Marketing-only; Imaging and other modules cannot read from it

**Evidence:**

The media library (`/marketing/media`) uses:
- `trpc.extensions.marketing.listMediaAssets` — queries `ext_marketing_media_assets` table [VERIFIED: media/page.tsx:47]
- `trpc.extensions.marketing.createMediaAsset` — upload to `ext_marketing_media_assets` [VERIFIED: media/page.tsx:523]
- `trpc.extensions.marketing.getBrandInfo` — brand context [VERIFIED: media/page.tsx:51]

**Isolation evidence:**
- The imaging router (`extensions/imaging.ts`) uses `readPrimaryObject(file.fileKey)` from `@/lib/s3` — it reads from object storage directly, not from `ext_marketing_media_assets`. [VERIFIED: imaging.ts:30]
- The handouts router generates PDFs and stores them in `ext_marketing_handouts`, which has its own separate table — not `ext_marketing_media_assets`.
- The TV display (`/marketing/tv`) uses `ext_marketing_content_items` and `ext_marketing_handouts` — not the media library.
- The website builder (`/marketing/website`) section images are stored as inline data in `sectionsDraft` JSON — not referencing `ext_marketing_media_assets`.

**Verdict:** H2 is **TRUE**. The media library is a siloed store for AI-generated social media images/videos. It is not used by:
- Clinical imaging (uses object storage directly)
- Handouts (own table)
- TV display (uses content_items)
- Website builder (uses JSON sections)
- Emails/SMS (no media attachment mechanism found)

A real shared media library would be the single source of truth for clinic images (logo, team photos, procedure photos, marketing images) used across all surfaces. Currently it only serves social media posts.

---

## A. Integration Opportunities

### A1. Web kliniky — staff bios should read from `users` table
Staff profile photos, names, credentials (e.g. `MVDr.` title), and bios should be generated/editable from the `users` table rather than hand-typed. A toggle per user (`showOnWebsite: true/false`) would allow controlled public exposure.
**Missing link:** `users.{name, role, avatarUrl, bio}` → editable public profile section in website builder, pre-populated from user record.

### A2. Web kliniky — services section should read from `services` table
The clinic's service catalog (`trpc.settings.listServices` or equivalent, using the `services` table) should be the authoritative source for the website's "Services" section. Currently hand-authored, creating drift.
**Missing link:** `services` table → auto-populate website "Services" section, user can annotate/reorder.

### A3. Web kliniky — opening hours from provider availability
Opening hours on the website should be derived from `providerAvailability` or practice `settings.bookingHours` rather than hand-typed.
**Missing link:** `trpc.settings.getBookingConfig` or similar → website "Hours" section auto-populated.

### A4. Web kliniky — "Book Online" CTA should link to `trpc.booking.*`
The public booking widget exists at the booking portal. The website builder has no way to embed or link to it, missing a key conversion opportunity.
**Missing link:** Practice booking URL → "Book Online" button in website header/hero section.

### A5. Knižnica médií — should accept uploads from imaging workflow
When a vet completes an imaging analysis and marks a case as shareable/educational, the image should be promotable to the media library with one click, rather than requiring re-upload.
**Missing link:** `trpc.extensions.imaging.confirmAnalysis` → optional "Add to Media Library" action → `trpc.extensions.marketing.createMediaAsset`.

### A6. Knižnica médií — should supply images to website builder sections
The website "Hero" and "Gallery" sections currently use image URLs hand-pasted by admins. The media library should be the picker source.
**Missing link:** `trpc.extensions.marketing.listMediaAssets` → image picker in website section editor.

### A7. Letáky — should use media library for embedded images
Handout PDFs embed images. Currently images come from direct upload in the handout flow. The media library should be the source.
**Missing link:** Media library picker → handout image selector.

### A8. Recenzie — review count shown on website is real-time; client response should also create a staff task
When a review is responded to (`updateWebsiteInquiryStatus` / review response mutation), no staff task is created for follow-up. The negative-review escalation flow [VERIFIED: SKILL.md §7] creates a staff task for ratings ≤2, but mid-tier reviews (3-4 stars) have no follow-up task.
**Missing link:** 3–4 star reviews → create moderate-priority `extMarketingStaffTasks` for optional personal response.

### A9. Centrum potlačení — no link from suppression log to patient record
The suppression center (`/marketing/suppression`) shows suppression events but has no deeplink to the patient/client who was suppressed. Users must manually search.
**Missing link:** Patient/client name in suppression log → `/patients/UUID` deeplink.

---

## B. Duplication / Overlap Check

| Pair | Overlap | Evidence |
|---|---|---|
| Správy & SMS (`/marketing/messages`) vs Správy (`/inbox`) | **Partial — different data** | `/inbox` uses `trpc.communications.listConversations` (conversational 2-way messaging with clients). `/marketing/messages` uses `trpc.extensions.marketing.*` for outbound bulk SMS/marketing campaigns. Same surface label "Správy" for very different workflows — causes confusion. Nav item `/inbox` is already labeled "Správy" in sidebar.tsx; custom item is "Správy & SMS". |
| Plán obsahu vs Schvaľovanie obsahu | **Near-total operational overlap** | Both query `ext_marketing_content_items`. Plan = calendar view for scheduling. Content queue = approval queue view of the same items. They are two views of the same data, not two modules. Both are in the admin section as separate nav items. Should be tabs within Marketing Studio, not separate nav items. [VERIFIED: custom-nav.ts:75–89] |
| Automatizácie vs Centrum potlačení | **Partial** | Both operate on the automation/CRM domain. Automations = rules/journeys/channels config. Suppression = opt-out/blocked messages log. Suppression is a compliance view of automation outputs — should be a tab within Automatizácie, not a sibling nav item. |
| Čerpanie benefitov (`/marketing/wellness`) vs Fakturácia (`/billing`) wellness panel | **Partial** | Wellness benefit redemption (logging which benefits were used) is surfaced at `/marketing/wellness` via `trpc.extensions.marketing.redeemWellnessBenefit`. The billing page has a `WellnessBillingPanel` component that also manages wellness billing. They share `wellness_enrollments` but serve different sub-workflows (redemption tracking vs billing). Not a merge, but wrong section: redemption tracking is a front-desk/clinical task, not a marketing task. |

---

## C. Nesting Candidates

| Module | Nesting verdict | Where |
|---|---|---|
| Brand Kit | **YES** — one-time setup, rarely changed | Move to **Settings > Branding** (currently a subset of the settings brand section). Remove from nav. |
| Centrum potlačení | **YES** | Tab within **Automatizácie** (`/marketing/automations#suppression`) |
| Plán obsahu + Schvaľovanie obsahu | **YES — merge into tabs** | Both become tabs within **Marketingové Štúdio** dashboard page: Calendar tab + Approval Queue tab |
| Vet Intelligence | **YES** (cross-cluster, see ai-agent.md) | Tab within Marketing Studio |
| Čerpanie benefitov | **YES** | Move to **Klienti** section as "Wellness benefity" or to **Fakturácia** as a tab — it is a front-desk/billing task, not a marketing task |
| Súhlasy & skripty | **Borderline** — active front-desk use (scripts) + admin setup (consent forms) | Split: consent form templates → Settings > Clinical; call scripts → keep as front-desk tool, move to frontDesk section |

---

## D. Settings Candidates

| Module | Verdict |
|---|---|
| Brand Kit | **YES** → Settings > Branding. Touched once at setup. Admins only. |
| Automatizácie | **Partially** — the *journey/rule configuration* is setup; the *channel connection* (OAuth) is setup. The *monitoring/status* is daily. Keep Automations in nav but move channel OAuth setup to Settings > Integrations. |
| Centrum potlačení | **No** — compliance review is ongoing daily/weekly. |
| Súhlasy & skripty (consent forms) | **YES for templates** → Settings > Clinical > Consent Forms. The script library (call reception scripts) stays as a front-desk resource. |

---

## E. Scope-Clarity Verdicts

| Module | Current name clarity | Proposed clarification |
|---|---|---|
| Marketingové Štúdio | ✅ Clear hub concept | Keep — becomes the Marketing section parent with sub-tabs |
| Brand Kit | ⚠️ English in Slovak product | Rename to **Značka & vizuál** in Settings |
| Správy & SMS | ❌ Collides with inbox "Správy" | Rename to **Kampane & SMS** |
| Web kliniky | ✅ Clear | Keep |
| Centrum potlačení | ✅ Clear for compliance users | Keep as tab within Automatizácie |
| Čerpanie benefitov | ✅ Better than the old "Wellness balíčky" | Keep name; fix placement (out of Marketing) |
| Súhlasy & skripty | ⚠️ Two unrelated concepts in one nav item | Split into "Súhlasy" (Settings) and "Skripty" (front-desk resource) |

---

## F. Recommendations + Migration Risk

| Module | Recommendation | Risk |
|---|---|---|
| Brand Kit | **Move to Settings > Branding**. Remove from nav. | **Low** — admin-only; no e2e specs assert `/marketing/brand-kit` [INFERRED]. i18n key `nav.marketingBrandKit` deprecated. |
| Plán obsahu + Schvaľovanie obsahu | **Merge as Calendar/Approval tabs inside Marketing Studio** dashboard. Remove both as separate nav items. | **Med** — two i18n keys deprecated (`nav.marketingPlan`, `nav.marketingContentQueue`); routes `/marketing/plan` and `/marketing/content-queue` can redirect to `/marketing#plan` and `/marketing#queue`. `website-builder.spec.ts` and `baseline-screenshots.spec.ts` may capture these routes [INFERRED]. |
| Centrum potlačení | **Nest as tab inside Automatizácie** (`/marketing/automations#suppression`). Remove from nav. | **Low** — `nav.marketingSuppression` key deprecated; `/marketing/suppression` route can redirect. |
| Správy & SMS | **Rename to "Kampane & SMS"**. Keep as nav item in marketing section. | **Low** — only i18n key and label changes. No route change. |
| Čerpanie benefitov | **Move section from admin to frontDesk**. Keep as standalone nav item. Long-term: merge into `/clients` wellness panel. | **Low** — section change in custom-nav.ts only. Route unchanged. |
| Knižnica médií | **Keep as standalone** (shared library concept is correct), but integrate with website builder image picker, handouts, and add "promote from imaging" action. | **Low** — enhancements only; no nav changes. |
| Web kliniky | **Keep as standalone**. Implement H1 fixes (staff sync, services sync, opening hours). | **Med** (implementation effort for data connections, not nav changes) |
| Súhlasy & skripty | **Split**: consent form templates → Settings > Clinical; keep call scripts as front-desk resource under `/marketing/consents` relabeled "Skripty recepcie". | **Med** — route split; deep links to consent forms move to Settings; i18n key updated. |
