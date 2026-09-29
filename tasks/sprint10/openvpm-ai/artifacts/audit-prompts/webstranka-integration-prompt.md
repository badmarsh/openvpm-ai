# OpenVPM AI — "Webstránka" Module: Deepen Cross-Module Data Integration

> **Usage:** Paste everything below the cut line into a fresh Claude Code /
> agent session running at the repo root
> (`C:\Users\marek\Documents\Vet\openvpm-ai`). This is a **build** mission
> (backend + UI changes across several modules), not a docs-only audit. Work
> in a feature branch. Read "Evidence already gathered" first — it's a
> verified map of the current implementation as of 2026-09-14, so re-derive
> from code only where this prompt is silent or the code has since changed.
>
> Note: the drag-and-drop section builder itself (17 section types, brand-kit
> theming, dnd-kit canvas) is **already built** — see
> `artifacts/audit-prompts/website-builder-dragdrop-prompt.md` for that prior
> mission. This prompt is the *next* pass: today the builder is a fairly
> closed island that only reads a few other tables read-only. The goal now is
> to wire it two-way into the rest of the practice's live data so the public
> site (and the editor) genuinely benefit from — and feed back into — the
> shared OpenVPM database instead of being a static content editor.

---

## MISSION

Turn "Webstránka" from a mostly-static page builder into a **live surface of
the clinic's real operational data**, and make sure everything a visitor does
on it (contact form, booking clicks, review clicks) flows back into the
clinic's existing CRM/marketing/communications tables instead of disappearing.
Concretely: replace hand-typed section content with live queries wherever the
data already exists elsewhere in the monorepo, and close the loop on visitor
actions.

---
## EVIDENCE ALREADY GATHERED

- **Editor:** `apps/web/app/(dashboard)/marketing/website/page.tsx` — drag/
  drop canvas over `WebsiteSection[]`, autosave via
  `trpc.extensions.marketing.updateWebsiteSections`, publish via
  `trpc.extensions.marketing.toggleWebsite`.
- **Public renderer:** `apps/web/app/web/[clinicId]/page.tsx`, fed by
  `trpc.extensions.marketing.getPublicWebsiteData` (`publicProcedure`).
- **Backend:** `apps/web/server/routers/extensions/marketing.ts`
  (~line 3502–3785): `getWebsiteConfig`, `updateWebsiteSections`,
  `toggleWebsite`, `getPublicWebsiteData`, `submitWebsiteContactForm`.
- **Schema:** `packages/db/schema/ext_marketing_website.ts` —
  `ext_marketing_website_config` (`sectionsDraft`, `sectionsPublished`,
  `published`, `publishedAt`), keyed 1:1 on `practiceId`.
- **Section content schemas:** `apps/web/lib/marketing/website-builder-types.ts`
  — 17 discriminated-union variants (hero, about, services, team, reviews,
  faq, hours_location, booking_cta, gallery, handouts, trust_badges, stats,
  emergency_banner, contact_form, video_embed, social_proof,
  custom_rich_text). Seed defaults in `apps/web/lib/marketing/website-seed.ts`.
- **What's already wired live (read-only) today, confirmed in
  `getPublicWebsiteData`:**
  - `team` ← `users` table, filtered to `admin`/`veterinarian`/`technician`
    roles (does **not** check `photo_web` consent at read time — only the
    *count* in `getWebsiteConfig` is consent-gated; verify this isn't a
    real GDPR gap before touching it further).
  - `handouts` ← `extMarketingHandouts` where `isPublic = true` (limit 6).
  - `reviews` ← `extMarketingReviews` where `rating >= 4` (limit 8).
  - `bookingSlug` ← `bookingPages` where `published = true` (just the slug,
    not availability/calendar data).
  - `brandKit` ← `practices.settings.brandKit` / `brandColor`.
- **Confirmed gap — contact form is a dead end.**
  `submitWebsiteContactForm` (public mutation, `apps/web/server/routers/
  extensions/marketing.ts` ~line 3785) does **only**
  `console.log(...)` and returns `{ ok: true }`. Nothing is persisted, no
  staff task is created, no email/SMS notification fires, and it is
  completely disconnected from `extMarketingStaffTasks` (used elsewhere in
  this same file for e.g. condolence tasks) or from `communications`/
  `messaging` tables. This is the highest-leverage, lowest-risk fix in this
  prompt — do it first.
- **Confirmed gap — static content that has a live equivalent elsewhere:**
  - `stats` section content is 100% clinic-authored free text (`"14 000+
    Vyliečených pacientov"`), even though real counts exist: patient count
    (`patients` table), years in practice could derive from `practices`
    creation date or a clinic-entered founding year, 5-star review count is
    *already computed* in `getWebsiteConfig` (`reviewsCount`) but never
    reused inside the `stats` section content itself.
  - `services` section is a hand-typed array with an optional `price` field
    — there is a real service/price list elsewhere in the product (check
    `apps/web/server/routers/billing.ts` and `apps/web/lib/billing` for the
    canonical price-list/procedure-catalog source before building a new one).
  - `gallery` section defaults to an **empty images array** even though a
    full consent-tracked media library already exists
    (`extMarketingMediaAssets`, `apps/web/components/marketing/media-frame.tsx`,
    `apps/web/app/(dashboard)/marketing/media/page.tsx`) — there is no
    "pick from library" affordance in the gallery section's edit `Sheet`
    today (confirm by reading `apps/web/components/marketing/
    website-editor-sheet.tsx`).
  - `hours_location.customHours` is hand-typed free text, not derived from
    any canonical "clinic hours" setting — check `apps/web/app/(dashboard)/
    settings/` and `packages/db` for whether opening hours are modeled
    anywhere else (e.g. for the booking/scheduling module) before deciding
    whether to unify or leave this clinic-authored on purpose (small clinics
    may legitimately want marketing copy here, e.g. "closed for lunch",
    that differs from raw scheduling data).
  - `emergency_banner.phone` is hand-typed instead of defaulting to
    `practices.phone` (still overridable, since after-hours numbers often
    differ from the main line).
  - `trust_badges` and `faq` are fully static — acceptable as authored
    content, but confirm there's an "AI suggest" affordance consistent with
    other marketing copy tools in this router (`generatePost`,
    `createPostFromBulletin`) or note it as a good follow-up, not a gap to
    silently fix.
- **Never wired at all:**
  - `wellnessEnrollments` and `wellnessRedemptions` tables are imported into
    `marketing.ts` already (for other features) but the website has no
    membership/wellness-plan section — clinics running a wellness/loyalty
    program (see `apps/web/app/(dashboard)/marketing/wellness/`) currently
    can't advertise it on their public site at all.
  - `extMarketingAutomationRules` / journeys (`apps/web/server/routers/
    extensions/automation-*.ts`) never get a signal from website visitors —
    a contact-form submission or booking-CTA click should be able to enroll
    the visitor's resulting client record into an automation journey (e.g.
    a "new lead" welcome sequence), the same way other lead sources already
    do (check `createMessagesForTrigger` in `apps/web/lib/marketing/
    messaging.ts`).
