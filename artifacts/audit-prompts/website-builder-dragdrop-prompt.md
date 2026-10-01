# OpenVPM AI — "Webstránka" Drag-and-Drop Website Builder (Brand-Kit-Aware, 15+ Shadcn Sections)

> **Usage:** Paste everything below the cut line into a fresh Claude Code / GLM-5.3
> agent session running at the repo root (`C:\Users\marek\Documents\Vet\openvpm-ai`).
> This is a **build** mission (schema, backend, and UI changes), not a docs-only
> audit. Work in a feature branch. Read the "Evidence already gathered" section
> first — it is a verified map of the current implementation, so re-derive from
> code only where this prompt is silent or where the code has since changed.

---

## MISSION

`Webstránka kliniky` ("clinic website") is currently a **single hardcoded public
page** (`/web/[clinicId]`) with a fixed section order (Hero → Team → Handouts →
Reviews → Booking CTA → Footer) and a binary published/draft toggle. Clinics
cannot reorder, hide, add, remove, or restyle sections — the only per-clinic
variation comes from data (name, team, reviews, handouts) and the global Brand
Kit colors are not even applied to the public page today.

Turn this into a **simple drag-and-drop page builder**: clinic admins pick from
a library of **at least 15 polished, shadcn/ui-based section templates**, drop
them onto a single-page canvas, reorder them, edit each section's content
inline, toggle visibility, and publish — with every section automatically
themed from the clinic's existing **Brand Kit** (primary/secondary color, tone
of voice, logo/initials, social handles).

---

## EVIDENCE ALREADY GATHERED (verify, don't re-discover from scratch)

- **Editor entry point (authenticated):**
  `apps/web/app/(dashboard)/marketing/website/page.tsx` — currently shows KPIs,
  a publish/unpublish toggle (`trpc.extensions.marketing.toggleWebsite`), and a
  read-only iframe preview of `/web/[clinicId]` with a desktop/mobile switch.
  This is the natural home for the new builder UI (replace the read-only
  iframe area with the editable canvas; keep the KPI cards and publish toggle).
- **Public renderer:** `apps/web/app/web/[clinicId]/page.tsx` — client component,
  fetches `trpc.extensions.marketing.getPublicWebsiteData({ clinicId })`
  (public procedure), renders the fixed section order noted above. This is the
  file that must become a **generic section-array renderer**.
- **Backend router:** `apps/web/server/routers/extensions/marketing.ts`
  (~3700-3620 region) — `getWebsiteConfig` (protected), `toggleWebsite`
  (protected, `requireRole("admin","veterinarian")`), `getPublicWebsiteData`
  (public). All website state today is just one boolean,
  `settings.websitePublished`, stored inside the `practices.settings` jsonb
  column (drizzle). There is **no concept of sections at all yet** — build it.
- **Brand Kit (already fully built, just not wired into the public site):**
  `apps/web/components/settings/brand-kit-tab.tsx` +
  `trpc.settings.getBrandKit` / `trpc.settings.updateBrandKit`. Fields:
  `brandColor`, `secondaryColor`, `toneOfVoice`, `brandVoiceInstructions`,
  `disclaimer`, `defaultHashtags`, `socialHandles.{instagram,facebook,tiktok}`,
  `clinicName`. Reuse this data verbatim for section theming — do not create a
  second brand config.
- **Existing content sources to bind sections to (all already have tRPC
  procedures under `extensions.marketing`):** team members with
  `photo_web` consent (`extMarketingMediaConsents`), public handouts
  (`extMarketingHandouts`, `isPublic=true`), 4-5★ reviews
  (`extMarketingReviews`), published booking page slug (`bookingPages`), and a
  **media library with GDPR consent tracking**
  (`apps/web/app/(dashboard)/marketing/media/page.tsx`,
  `components/marketing/media-frame.tsx`) — reuse this for any section that
  needs an image picker (hero background, gallery, team photos). Do not build
  a second upload pipeline.
- **shadcn/ui primitives currently in the repo**
  (`apps/web/components/ui/`): `button`, `card`, `badge`, `dialog`, `sheet`,
  `tabs`, `dropdown-menu`, `input`, `textarea`, `select`, `switch`, `checkbox`,
  `label`, `popover`, `command`, `table`, `tooltip`, `progress`,
  `date-picker`, `form-field`. **Missing but needed for this feature:**
  `accordion` (FAQ), `avatar` (team/testimonials), `carousel` (gallery),
  `separator`, `aspect-ratio` — add these via the shadcn CLI in this project's
  existing style rather than hand-rolling.
- **No drag-and-drop library is installed anywhere in the monorepo** (checked
  `apps/web/package.json` and lockfile for `dnd`, `drag`, `framer-motion`,
  `react-beautiful-*` — nothing found). Recommend `@dnd-kit/core` +
  `@dnd-kit/sortable` (accessible, tree-shakeable, standard pairing with
  shadcn/ui community builders) — confirm current versions before installing
  and check them against `pnpm-workspace.yaml` catalog conventions.
- **i18n:** every dashboard string goes through `useI18n()` / `t(key, fallback)`
  (see `apps/web/lib/i18n`, `apps/web/messages/`) with Slovak as the primary
  language and English fallbacks in-line as the second argument — follow this
  exact pattern for all new editor chrome. Public-facing section *content*
  authored by the clinic stays as free text (not translated).
- **e2e coverage that touches this surface today** (must keep passing or be
  deliberately and visibly updated): `e2e/baseline-screenshots.spec.ts`,
  `e2e/demo-screenshots.spec.ts`, `e2e/production-walkthrough.spec.ts`,
  `e2e/public-repo-check.spec.ts`. Check each for hardcoded assumptions about
  `/web/[clinicId]` markup/section order before changing the renderer.

---

## 1. DATA MODEL

Do **not** keep stuffing this into `practices.settings` jsonb — it's already a
grab-bag (`websitePublished`, `competitorDigestEnabled`, ...) and this feature
needs versioning (draft vs. published) and room to grow. Add a dedicated table
via drizzle in `packages/db`, e.g.:

```
ext_marketing_website_config
  id                 uuid pk
  practice_id        uuid fk -> practices.id, unique
  sections_draft     jsonb   -- WebsiteSection[]
  sections_published jsonb   -- WebsiteSection[] (null until first publish)
  published          boolean default false
  published_at       timestamptz
  updated_at         timestamptz
  created_at         timestamptz
```

`WebsiteSection` (zod discriminated union on `type`, one variant per template
in §2), each sharing a base shape:

```ts
{ id: string; type: SectionType; order: number; visible: boolean; content: <variant-specific, zod-validated> }
```

**Migration/seeding:** on first read for a practice with no row yet, synthesize
a `sections_draft`/`sections_published` array that reproduces the **current
hardcoded page exactly** (Hero, Team, Handouts, Reviews, Booking CTA — in that
order, `visible: true`) so existing published clinic sites render pixel-identical
until an admin actually opens the editor and changes something. This is the
backward-compatibility guarantee — treat it as a hard requirement, not a nicety.

## 2. SECTION LIBRARY — MINIMUM 15 TEMPLATES

Each is a small, self-contained component in a new
`apps/web/components/marketing/website-sections/` directory, built from the
shadcn primitives above, taking `(content, brand)` props and rendering with
brand CSS variables (see §3). Ship at least these 15+:

1. **Hero (banner)** — headline, subheadline, primary/secondary CTA buttons,
   optional background image from media library, gradient-over-brand-color
   fallback (this is the current hardcoded hero — port it, don't rewrite blind).
2. **About / Story** — rich-text-lite body (bold/italic/lists only, no raw
   HTML), optional side image, optional stat chips (years open, patients seen).
3. **Services grid** — icon + title + short description cards, N columns,
   pulled from a manually-curated list (not the full clinical service catalog).
4. **Team** — the existing GDPR-consent-gated team cards, ported to `Avatar` +
   `Card`, editable order/visibility per member.
5. **Reviews / Testimonials** — the existing star-rating cards, add a
   carousel layout option for >4 reviews.
6. **FAQ (accordion)** — question/answer pairs using the new `Accordion`.
7. **Hours & location** — opening hours table + address + embedded map
   (static image or iframe, no new API key dependencies — reuse `address`
   from `practices` if present).
8. **Booking CTA (banner)** — the existing "objednať sa online" block, themed.
9. **Gallery** — image grid/carousel sourced from the media library, respecting
   `subjectsPresent`/consent flags exactly as `media-frame.tsx` already does.
10. **Handouts / patient education grid** — the existing handouts cards,
    ported as a reusable, toggleable section (already dynamic from
    `extMarketingHandouts`).
11. **Trust badges / certifications** — Fear-Free, professional-association
    logos, "GDPR-compliant" badge, small icon+label row.
12. **Stats strip** — 3-4 big numbers with labels (years in practice, patients
    treated, 5-star reviews, emergency response time) — clinic-authored values.
13. **Emergency / urgent-care banner** — high-contrast alert bar with phone
    number, dismissible, uses `secondaryColor` background + brand accent text.
14. **Newsletter / contact form** — name+email+message fields, posts to a new
    lightweight tRPC mutation that reuses the existing contact/lead pipeline
    if one exists (check `apps/web/app/api/funnel-event`) rather than inventing
    a new inbox.
15. **Video embed** — YouTube/Vimeo URL field, responsive `aspect-ratio`
    wrapper, no autoplay.
16. **Social proof / social links bar** — Instagram/Facebook/TikTok icons
    pulled straight from Brand Kit `socialHandles`.
17. **Custom rich-text block** — free-form sanitized rich text for anything
    not covered above (escape hatch, still no raw HTML/script injection).

(17 listed to comfortably clear the "at least 15" bar with margin for one or
two to be cut if genuinely redundant during implementation — do not go below 15.)

## 3. BRAND-KIT THEMING (must be automatic, not a separate settings panel)

Every section renders inside a single wrapper that injects CSS custom
properties from `trpc.settings.getBrandKit`:

```
--wb-primary: {brandColor}
--wb-secondary: {secondaryColor}
--wb-on-primary: <computed readable text color, don't hardcode white>
```

Sections use these variables (not raw shadcn default theme tokens) for
buttons, accents, badges, and section-alternating backgrounds, so changing
Brand Kit colors on the Brand Kit page instantly re-themes the whole site on
next load — no separate "website colors" field. `toneOfVoice` /
`brandVoiceInstructions` are surfaced only as **optional AI-assist copy
suggestions** inside each section's edit panel (a "✨ Navrhnúť text" button
that calls a small AI text-completion procedure) — this is a stretch goal, not
required for the MVP; ship the manual editing path first and make sure it's
solid before touching AI copy generation.

## 4. EDITOR UX (the drag-and-drop canvas)

Replace the read-only iframe in `marketing/website/page.tsx` with:

- **Left rail:** section library palette (17 template cards, icon + name +
  one-line description), click-to-append or drag-onto-canvas.
- **Center canvas:** live-rendered stack of the clinic's current
  `sections_draft`, each wrapped in a hover toolbar (drag handle via
  `@dnd-kit/sortable`, edit-pencil, duplicate, hide/show eye, delete-with-
  confirm). Reordering persists via an autosave mutation (debounced, optimistic
  UI, same `sonner` toast conventions used elsewhere in this file).
- **Edit panel:** clicking edit opens a `Sheet` (matches existing pattern in
  this codebase, e.g. `messaging-wizard.tsx`) with a zod-validated form
  scoped to that section's content schema — text fields, image picker
  (reuses `MediaFrame`/media library), toggles, no free-form code fields.
- **Preview toggle:** keep the existing desktop/mobile switch, now applied to
  the live canvas itself rather than a separate iframe, so what you edit is
  what you see (no need for two representations).
- **Publish flow:** keep the existing "Publikovať / Skryť webstránku" button,
  now copying `sections_draft` → `sections_published` and flipping
  `published`, exactly mirroring the current `toggleWebsite` semantics extended
  to sections. Draft edits never affect the live public page until published.

## 5. BACKEND CHANGES (`apps/web/server/routers/extensions/marketing.ts`)

- `getWebsiteConfig` → also return `sectionsDraft` (with the seed fallback
  from §1).
- New `updateWebsiteSections` mutation (`requireRole("admin","veterinarian")`,
  zod-validated `WebsiteSection[]`) — replaces `sections_draft` wholesale
  (simplest correct approach; add per-section patch mutations later only if
  autosave payload size becomes a real problem).
- `toggleWebsite`/new `publishWebsite` → copy draft to published as above.
- `getPublicWebsiteData` → return `sections_published` (or the seeded
  equivalent) instead of hand-assembling the fixed section list; the *data
  lookups* it already does (team, handouts, reviews, booking slug) become
  inputs that section renderers pull from, not a fixed page shape.

## 6. GUARDRAILS — DO NOT SKIP

- **No arbitrary HTML/script.** Any "rich text" section content must go
  through a constrained sanitizer/renderer (allow-list of tags only) — never
  `dangerouslySetInnerHTML` on unsanitized clinic input, since this page is
  `publicProcedure`-served to anonymous visitors.
- **Zod discriminated unions**, not loosely-typed `content: any`, for every
  section variant, validated on both the mutation input and before rendering.
- **Consent flags stay authoritative.** Team and gallery sections must keep
  respecting `photo_web` consent / `subjectsPresent` exactly as today — the
  builder must never let an admin bypass GDPR consent checks by, e.g., manually
  typing a name into a "custom" section as a workaround.
- **`requireRole` stays on every mutation**; `getPublicWebsiteData` and the
  public renderer stay `publicProcedure`/anonymous-safe.
- **i18n discipline** for all editor chrome (`useI18n`/`t()`), Slovak-first.
- **No new upload/storage pipeline** — route all section images through the
  existing media library.
- **Multi-tenant safety** — every new query/mutation scoped by
  `ctx.practiceId` (draft/editor side) or the `clinicId` route param validated
  against the public data query (public side), matching existing patterns in
  this router file.

## 7. DELIVERABLES / SUGGESTED ORDER

1. Short written plan (schema diagram, section content-schema list, file
   tree) — get this reviewed before writing code.
2. Drizzle schema + migration for `ext_marketing_website_config`, plus the
   seed-from-current-page fallback logic.
3. Router changes (§5) with zod schemas colocated or in a shared
   `packages/api` types file if that's this repo's convention — check first.
4. Shared section renderer components (§2) used by *both* the editor canvas
   and the public `/web/[clinicId]` page (one implementation, two mount
   points — do not fork the markup).
5. Editor UI (§4): palette, canvas, dnd-kit wiring, edit sheets.
6. Wire Brand Kit theming (§3) into the shared renderer.
7. Update/extend the four e2e specs listed in "Evidence gathered" plus add at
   least one new e2e test that adds a section, reorders it, edits its content,
   publishes, and asserts the public page reflects the change.
8. Docs: short addition to `docs/help/` (or wherever clinic-facing help docs
   live) explaining the new editor, plus a changelog entry.

## 8. ACCEPTANCE CRITERIA

- A clinic with zero prior interaction with this feature sees their public
  site render **identically** to today (seed fallback works).
- An admin can add any of the 15+ sections, drag to reorder, edit content,
  hide/show, delete, and publish — all without a page reload, with autosave
  and clear draft-vs-published affordance.
- Every section visually adopts the clinic's Brand Kit primary/secondary
  color with zero extra configuration.
- No section type allows arbitrary script/HTML injection.
- Non-admin/non-vet roles cannot mutate website sections (verified by test).
- All four listed e2e specs pass (or are updated with a clear rationale in
  the PR description for any intentional behavior change).
