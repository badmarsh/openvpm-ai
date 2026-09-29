# OpenVPM AI — Arena Consolidation Sprint Prompt

> **Context for all agents:** This is a production veterinary practice management system built with Next.js 14 App Router, tRPC, Drizzle ORM, and PostgreSQL. It operates under Slovak veterinary law (Zákon 39/2007 Z.z., Zákon 139/1998 Z.z.) and contains clinical safety gates that must never be modified. Read AGENTS.md before touching any file.

---

## Mission

Fix all remaining ESLint react-hooks/exhaustive-deps warnings, polish GUI inconsistencies, and resolve backend/data weakpoints across the codebase. Every change must pass `pnpm lint`, `pnpm typecheck`, and `pnpm test` before being committed. i18n symmetry (`messages/en.json` == `messages/sk.json`) must be maintained at 100%.

---

## 1. ESLint Fixes — react-hooks/exhaustive-deps (6 files, 14 warnings)

Fix each warning by wrapping the relevant variable in `useMemo` with a correct dependency array. Do NOT silence warnings with eslint-disable comments.

### 1A. `apps/web/app/(dashboard)/encounters/page.tsx` (lines 66–67)

`appointments` and `followUps` are initialized as `query.data ?? []` outside any memo, then used inside `useMemo` hooks at lines 78, 121, 136. Wrap both:

```tsx
const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
const followUps = useMemo(() => followUpsQuery.data ?? [], [followUpsQuery.data]);
```

### 1B. `apps/web/app/(dashboard)/lab-results/page.tsx` (line 327)

`rows` is `inbox.data?.items ?? []`. Wrap it:

```tsx
const rows = useMemo(() => inbox.data?.items ?? [], [inbox.data]);
```

### 1C. `apps/web/app/(dashboard)/marketing/media/page.tsx` (line 72)

`rawAssets` is `mediaQuery.data ?? []`. Move it inside the existing `useMemo` for `shown`, or wrap separately:

```tsx
const rawAssets = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
```

### 1D. `apps/web/app/(dashboard)/marketing/reviews/page.tsx` (line 283, used at 303 and 364)

`rawReviews` is `reviewsQuery.data ?? []`. Wrap it:

```tsx
const rawReviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
```

### 1E. `apps/web/app/(dashboard)/schedule/page.tsx` (line 1318)

`useEffect` at line 1318 uses `start` and `end` but they are not in its dependency array. Inspect the effect body and add the missing deps. If the effect intentionally should not re-run on every `start`/`end` change (e.g. it resets a form only on appointment selection), use a ref-based approach to track the previous appointmentId and reset only when it changes rather than adding stale deps.

### 1F. `apps/web/app/(dashboard)/settings/page.tsx` (lines 3848, 3906, 3968, 4033 — missing `t`; line 4934 — `roomLocations`)

For the four `useCallback` hooks missing `t`: add `t` to each dependency array. `t` is stable (memoized in context) so this is safe.

For line 4934, `roomLocations` is `locationsQuery.data ?? []`. Wrap it:

```tsx
const roomLocations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
```

### 1G. `apps/web/components/marketing/content-calendar-tab.tsx` (line 85)

`briefs` is `briefsQuery.data ?? []`. Wrap it:

```tsx
const briefs = useMemo(() => briefsQuery.data ?? [], [briefsQuery.data]);
```

### 1H. `apps/web/components/onboarding/steps/bring-data.tsx` (line 552)

`useEffect` missing `finishStage` and `runImport`. Add them to the dependency array. Both are `useCallback`-memoized so adding them is safe.

### 1I. `apps/web/components/settings/services-tab.tsx` (line 168)

`availableServices` is a `?? []` expression. Wrap it:

```tsx
const availableServices = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
```

### 1J. `apps/web/components/support/ScreenShareButton.tsx` (line 63)

`useCallback` missing `stopSharing`. Add it to the dependency array.

### 1K. `apps/web/components/support/ScreenViewer.tsx` (line 84)

`useEffect` missing `peerConn`. Add it to the dependency array or restructure to use a ref if `peerConn` changes would cause an unwanted re-run.

---

## 2. GUI Polishing

### 2A. Marketing / CompetitorsTab — hardcoded Slovak strings

File: `apps/web/app/(dashboard)/marketing/page.tsx` — `CompetitorsTab` component.

The competitor cards and "Nedávne objavy" section contain hardcoded Slovak strings (competitor names, labels like "Publikácie (30 dní)", "Zapojenie", "Rast sledujúcich", "Nová akcia konkurencie", "Zmena v tíme"). These must go through `useI18n()`. Add keys to both `messages/en.json` and `messages/sk.json` under `marketing.competitors`. The `t` call is already added (fixed in this sprint's build error fix); now complete the i18n coverage.

### 2B. CompetitorsTab — dynamic color classes

The `bg-${competitor.color}-100` Tailwind class is dynamically constructed and won't be included in the purge. Replace with a static color map:

```tsx
const colorMap: Record<string, string> = {
  blue: "bg-blue-100 dark:bg-blue-900/30",
  green: "bg-green-100 dark:bg-green-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30",
};
```

### 2C. Schedule page — calendar slot overflow on narrow screens

The week-view calendar in `apps/web/app/(dashboard)/schedule/page.tsx` uses fixed pixel widths. On viewports under 1024px, appointment cards overflow their column. Add `overflow-hidden text-ellipsis` to appointment card text nodes and `min-w-0` to flex containers inside calendar columns. Reference the existing `HOUR_HEIGHT` and `CALENDAR_HEIGHT` constants for any height-related changes.

### 2D. Settings page — tab scrollbar on mobile

`apps/web/app/(dashboard)/settings/page.tsx` renders a horizontal tab strip without overflow scroll. On mobile, tabs overflow off-screen with no scroll affordance. Wrap the tab container in `<div className="overflow-x-auto pb-1 -mb-px">` with a `scrollbar-thin` utility or native scroll.

### 2E. Encounters page — status badge inconsistency

`apps/web/app/(dashboard)/encounters/page.tsx` uses inline class strings for status coloring in some places and `StatusPulseBadge` in others. Audit all status badges in this file and consolidate to use `StatusPulseBadge` for live statuses (checked_in, in_exam) and the existing `Badge` variant pattern for terminal statuses. Import `StatusPulseBadge` from `@/components/ui/status-pulse-badge`.

### 2F. Lab results — follow-up action panel z-index

`apps/web/app/(dashboard)/lab-results/page.tsx` renders an inline action panel that overlaps the table header on scroll. Set `sticky top-0 z-10 bg-background` on the table header row so it floats above the panel.

### 2G. Waiting Room TV — slide counter indicator

`apps/web/components/waiting-room/waiting-room-tv.tsx` has a slide rotator but no visual indicator showing which slide is active. Add a dot-indicator row below the content panel: render one `<span>` per slide, filled for the active index, using `transition-all duration-300` for smooth state changes. Only show when `hasCustomSlides` is true.

### 2H. Empty states — missing on several pages

The following pages have no empty state when their queries return zero results — they just render nothing or a loading spinner indefinitely:

- `apps/web/app/(dashboard)/marketing/media/page.tsx` — media grid returns empty array
- `apps/web/components/marketing/content-calendar-tab.tsx` — briefs list empty
- `apps/web/app/(dashboard)/care-reminders/page.tsx` — reminders empty

Use the existing `<EmptyState>` component from `@/components/common/empty-state` with an appropriate icon, title (`i18n` key), and subtitle.

---

## 3. Backend / Data Weakpoints

### 3A. Missing indexes — potential slow queries

The following query patterns are used in hot paths but lack composite indexes:

```sql
-- Appointments by patient status (used in whiteboard, encounters, schedule)
-- Already has: appointments_client_status_idx, appointments_doctor_status_idx
-- Missing: patient-level status index for the whiteboard query
CREATE INDEX IF NOT EXISTS appointments_patient_status_idx
  ON appointments (practice_id, patient_id, status, deleted_at);

-- Care reminders open status scan (used in reminders dashboard widget)
CREATE INDEX IF NOT EXISTS care_reminders_open_idx
  ON care_reminders (practice_id, status, deleted_at)
  WHERE status = 'open';

-- ext_marketing_content_items by status and practice (content calendar)
CREATE INDEX IF NOT EXISTS ext_content_items_practice_status_idx
  ON ext_marketing_content_items (practice_id, status, deleted_at);

-- ext_crm_segment_memberships lookup (CRM segments, used in automations)
CREATE INDEX IF NOT EXISTS ext_crm_memberships_segment_idx
  ON ext_crm_segment_memberships (practice_id, segment_id, deleted_at);

-- Voice dictations by appointment (referenced from encounter detail)
CREATE INDEX IF NOT EXISTS voice_dictations_appt_idx
  ON voice_dictations (practice_id, appointment_id, deleted_at)
  WHERE deleted_at IS NULL;
```

Add these in a new `packages/db/drizzle/bootstrap/add-missing-indexes.sql` (or wherever bootstrap SQL lives). Do NOT touch `_journal.json`. Apply with `pnpm db:bootstrap` or directly via the docker exec pattern from AGENTS.md.

### 3B. `voice_dictations.audio_duration_seconds` is `text` — should be `numeric`

Column stores duration as text (e.g. `"45.3"`). Any arithmetic (average, sum) requires a cast. This is a vanilla schema column — do not rename or drop it, but add a generated/computed column in an extension schema:

Create `packages/db/schema/ext_voice.ts` addition (or in the existing file if it exists):

```ts
// Add alongside existing voice_dictations extension columns
export const voiceDictationDurationNumeric = pgView("voice_dictation_duration_view").as(
  (qb) => qb.select({
    id: voiceDictations.id,
    durationSeconds: sql<number>`(audio_duration_seconds::numeric)`.as("duration_seconds"),
  }).from(voiceDictations)
);
```

This avoids mutating the upstream schema.

### 3C. `audit_log` — missing `practice_id IS NOT NULL` partial index

`audit_log` is 3.8 MB and growing. Most queries filter by `practice_id` but the column is nullable (for platform-level events). Add a partial index:

```sql
CREATE INDEX IF NOT EXISTS audit_log_practice_action_idx
  ON audit_log (practice_id, action, created_at DESC)
  WHERE practice_id IS NOT NULL;
```

### 3D. `ext_marketing_reviews` — no index on `sentiment` + `practice_id`

Reviews page filters by sentiment. Current table is 72 kB (will grow). Add:

```sql
CREATE INDEX IF NOT EXISTS ext_reviews_practice_sentiment_idx
  ON ext_marketing_reviews (practice_id, sentiment, deleted_at);
```

### 3E. `appointments` — `recurring_series_id` has no index

Recurring series lookup (cancel all in series, list series) does a full scan. Add:

```sql
CREATE INDEX IF NOT EXISTS appointments_recurring_series_idx
  ON appointments (recurring_series_id)
  WHERE recurring_series_id IS NOT NULL;
```

### 3F. tRPC router — `extensions/marketing.listTvSlides` missing `isActive` filter server-side

`apps/web/server/routers/extensions/marketing.ts` — `listTvSlides` procedure likely returns all slides and lets the client filter by `isActive`. Move the filter server-side:

```ts
.where(and(
  eq(extMarketingTvSlides.practiceId, ctx.session.user.practiceId),
  isNull(extMarketingTvSlides.deletedAt),
  // Only fetch active slides for the TV display endpoint
  // Keep a separate admin list endpoint without this filter
))
```

Add a separate `listAllTvSlides` procedure (no `isActive` filter) for the slide manager UI. Update the slide manager in `waiting-room-tv.tsx` to call `listAllTvSlides` and the TV display to call `listTvSlides`.

### 3G. `clients` router — search does ILIKE without limit enforcement

`apps/web/server/routers/clients.ts` — search procedure. Ensure a hard `limit` cap is applied server-side (max 100) regardless of what the client requests, and that the `ILIKE` pattern has an index to support it. Add a GIN trigram index if not present:

```sql
-- Requires pg_trgm extension (should already be enabled)
CREATE INDEX IF NOT EXISTS clients_search_trgm_idx
  ON clients USING gin (
    (first_name || ' ' || last_name || ' ' || coalesce(email, '')) gin_trgm_ops
  )
  WHERE deleted_at IS NULL;
```

Check whether `pg_trgm` is already enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';`

### 3H. `ext_automation_events` — no index on `status` for pending event processor

The automation event processor queries for `status = 'pending'` events. Current table is 8 kB (will grow fast when automations fire). Add:

```sql
CREATE INDEX IF NOT EXISTS ext_automation_events_pending_idx
  ON ext_automation_events (practice_id, status, created_at)
  WHERE status IN ('pending', 'processing');
```

---

## 4. i18n Gaps

### 4A. Scan and fix hardcoded strings

Run: `pnpm --filter @openpims/web i18n:scan`

Fix any hardcoded JSX text found. Add missing keys to both `messages/en.json` and `messages/sk.json` under the appropriate section. Both files are currently 8042 lines — keep them in perfect sync.

### 4B. `marketing.competitors` keys needed

Add to both files:

```json
"marketing": {
  "competitors": {
    "title": "Konkurencia & Intel",
    "subtitle": "Monitorovanie konkurenčných aktivít a trhový výskum",
    "startMonitoring": "Spustiť monitorovanie",
    "posts30d": "Publikácie (30 dní)",
    "engagement": "Zapojenie",
    "followerGrowth": "Rast sledujúcich",
    "recentDiscoveries": "Nedávne objavy",
    "newCampaign": "Nová akcia konkurencie",
    "teamChange": "Zmena v tíme"
  }
}
```

English equivalents in `en.json`.

---

## 5. Test Verification

After all changes, run in order:

```bash
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web exec vitest run
```

All three must pass with zero errors. ESLint warnings from the files listed in sections 1A–1K must be gone. No new warnings may be introduced.

---

## Database Reference

**Connection (local dev):**
```bash
docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai
```

**Key tables relevant to this sprint:**

| Table | Rows (approx) | Notes |
|---|---|---|
| `appointments` | 312 kB | Hot path — schedule, whiteboard, encounters |
| `audit_log` | 3.8 MB | Growing fast; needs partial index |
| `clients` | 512 kB | Search uses ILIKE — needs trigram index |
| `soap_notes` | 3 MB | Largest clinical table |
| `ext_marketing_content_items` | 64 kB | Content calendar |
| `ext_marketing_reviews` | 72 kB | Reviews tab filtering |
| `ext_automation_events` | 8 kB | Will grow rapidly |
| `voice_dictations` | 104 kB | `audio_duration_seconds` is `text` type — see 3B |
| `ext_marketing_tv_slides` | 16 kB | listTvSlides — see 3F |
| `ext_crm_segment_memberships` | 48 kB | Missing segment index |
| `care_reminders` | 16 kB | Missing partial index on open status |

**Enum types used in filtering (for correct SQL comparisons):**

- `appointment_status`: scheduled, confirmed, checked_in, in_exam, checked_out, no_show, cancelled
- `care_reminder_status`: open, completed, dismissed
- `ext_automation_event_status`: pending, processing, processed, failed, skipped
- `ext_marketing_content_status`: proposed, approved, published, blocked, archived
- `ext_reputation_sentiment`: positive, neutral, negative, mixed
- `voice_dictation_status`: RECORDING, TRANSCRIBING, FORMATTING, COMPLETED, FAILED

**Schema rules (read AGENTS.md §3 before touching any schema file):**
- Never modify `packages/db/schema/*.ts` upstream files
- Extension tables go in `packages/db/schema/ext_{name}.ts`
- Never touch `packages/db/drizzle/meta/_journal.json`
- Apply schema changes with `pnpm db:push` (never direct DDL for Drizzle-managed tables)
- Bootstrap-level SQL (indexes, views, RLS) can be applied directly via docker exec

---

## Architecture Constraints

- **No URL locale prefixes** — never add `/[locale]/` to routes
- **tRPC extensions** — all custom routers go in `apps/web/server/routers/extensions/` and mount under `extensions:` in `_app.ts`
- **Sidebar nav** — never hardcode links in `sidebar.tsx`; add to `apps/web/config/custom-nav.ts`
- **Clinical safety gates** — do not touch `ClinicalDiffConfirmModal`, controlled substance zero-prefill, or sympathy gate suppression logic
- **Zero hardcoded JSX text** — all user-visible strings through `useI18n()`

---

## Commit Convention

```
fix(lint): <scope> — <what was fixed>
fix(ui): <component> — <what was improved>
fix(db): <table/index> — <what was added>
feat(i18n): <section> — <keys added>
```

One logical change per commit. Do not bundle unrelated fixes.

