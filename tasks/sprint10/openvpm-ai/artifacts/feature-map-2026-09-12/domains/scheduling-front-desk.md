# Domain: Scheduling & Front Desk
Commit: 23f23a3

## A. Feature inventory
| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| Schedule calendar (day/week/month) | `/schedule` page, `appointments.list` | all authenticated | `appointments`, `appointmentTypes`, `patients`, `clients`, `users`, `rooms`, `locations` | stable | [VERIFIED: apps/web/app/(dashboard)/schedule/page.tsx; apps/web/server/routers/appointments.ts:532] |
| Inline appointment creation | `/schedule` click-to-book, `appointments.create` | admin, veterinarian, front_desk | `appointments` | stable | [VERIFIED: apps/web/app/(dashboard)/schedule/page.tsx; apps/web/server/routers/appointments.ts:775] |
| Appointment reschedule | `appointments.reschedule` | admin, veterinarian, front_desk | `appointments` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1662] |
| Appointment status transitions (state machine) | `appointments.updateStatus`, whiteboard modal | admin, veterinarian, technician, front_desk | `appointments`, `visitCloseouts` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1036; apps/web/lib/scheduling/appointment-status.ts] |
| Recurring appointments (weekly/monthly/annual) | `appointments.createRecurring` | admin, veterinarian, front_desk | `appointments`, `recurringSeries` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1945] |
| Cancel recurring series | `appointments.cancelRecurringSeries` | admin, veterinarian, front_desk | `recurringSeries`, `appointments` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1574] |
| Whiteboard (live kanban) | `/whiteboard` page, `whiteboard.getActive`, `whiteboard.updateStatus` | all authenticated (viewers read-only) | `appointments`, `patients`, `clients`, `users`, `rooms`, `locations` | stable | [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx; apps/web/server/routers/whiteboard.ts] |
| Whiteboard 30-second polling | `trpc.whiteboard.getActive.useQuery({ refetchInterval: 30000 })` | all | N/A | stable | [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:617-619] |
| Waiting Room TV display | `/waiting-room` page, `<WaitingRoomTv>` | patient-facing (client view) | `appointments`, `patients`, `clients` | stable | [VERIFIED: apps/web/app/(dashboard)/waiting-room/page.tsx; apps/web/components/waiting-room/waiting-room-tv.tsx] |
| Check-in confirmation recording | `appointments.updateStatus` with `confirmationContactMethod` | admin, veterinarian, technician, front_desk | `appointments`, `communications` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1042-1260] |
| Doctor assignment enforcement on check-in | `whiteboard.updateStatus` / `appointments.updateStatus` | all mutation-capable roles | `appointments`, `appointmentTypes` | stable | [VERIFIED: apps/web/server/routers/whiteboard.ts:245-260; apps/web/server/routers/appointments.ts:1123-1136] |
| Inline doctor assignment + check-in (whiteboard modal) | Whiteboard `AppointmentDetailModal` `Assign & Check In` | admin, veterinarian, technician, front_desk | `appointments`, `users` | stable | [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:400-430] |
| Patient attach mid-visit | `appointments.attachPatient` | admin, veterinarian, technician, front_desk | `appointments`, `patients` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1441] |
| Field/ambulatory visit creation | `appointments.startFieldVisit` | admin, veterinarian, technician | `appointments`, `patients`, `clients` | stable (gated: `ambulatoryWorkspaceRolloutEnabled`) | [VERIFIED: apps/web/server/routers/appointments.ts:853-944] |
| Open slot finder | `appointments.availableSlots` | all authenticated | `appointments`, `staffSchedules` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1830] |
| Provider availability enforcement | `providerCoverageForDate` → `staffSchedules` + `users.isVeterinarian` | N/A (lib) | `staffSchedules`, `users` | stable | [VERIFIED: apps/web/lib/scheduling/provider-availability.ts; apps/web/lib/scheduling/availability.ts] |
| Conflict detection (doctor/room/location) | `detectConflicts` → used in create, reschedule, whiteboard recovery | N/A (lib) | `appointments` | stable | [VERIFIED: apps/web/lib/scheduling/conflicts.ts] |
| Concurrent-appointment column layout | `layoutOverlaps` → day calendar lanes | N/A (lib) | N/A | stable | [VERIFIED: apps/web/lib/scheduling/overlap-layout.ts] |
| Appointment types CRUD | `appointments.listTypes` (read via appointments router; write via settings or separate router) | all authenticated (read) | `appointmentTypes` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1894] |
| Doctor listing for assignment | `appointments.listDoctors` | all authenticated | `users` (isVeterinarian=true) | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1907] |
| Room listing per location | `appointments.listRooms` | all authenticated | `rooms` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1925] |
| Location listing | `appointments.listLocations` | all authenticated | `locations` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:1890] |
| Appointment lock (pg_advisory_xact_lock) | `takeAppointmentSchedulingLock` | N/A (system) | N/A | stable | [VERIFIED: apps/web/lib/scheduling/location.ts:37-47] |
| Waitlist entry management | `waitlist.list`, `waitlist.add`, `waitlist.setStatus` | admin, veterinarian, front_desk | `appointmentWaitlist` | stable | [VERIFIED: apps/web/server/routers/waitlist.ts] |
| Waitlist slot matching | `waitlist.matchesForSlot` → `matchWaitlist` | all authenticated | `appointmentWaitlist` | stable | [VERIFIED: apps/web/server/routers/waitlist.ts:matchesForSlot; apps/web/lib/scheduling/waitlist.ts] |
| Public booking page | `booking.getPage`, `booking.availableSlots`, `booking.book` | public (unauthenticated) | `bookingPages`, `appointments`, `clients`, `patients` | stable | [VERIFIED: apps/web/server/routers/booking.ts:getPage,availableSlots,book] |
| Booking page admin config | `booking.getMyPage`, `booking.savePage`, `booking.checkSlug` | admin | `bookingPages` | stable | [VERIFIED: apps/web/server/routers/booking.ts:808,843,858] |
| ICS calendar feed export | `appointments.calendarFeed`, `appointments.enableCalendarFeed`, `appointments.rotateCalendarFeed`, `/api/calendar/[token]/route.ts` | all authenticated (enable/rotate: any; rotate: admin-only) | `practices.calendarFeedToken` | stable | [VERIFIED: apps/web/server/routers/appointments.ts:2063-2114; apps/web/app/api/calendar/[token]/route.ts] |
| Schedule subscribe button | `<CalendarSubscribe>` in `/schedule` | all authenticated | N/A | stable | [VERIFIED: apps/web/components/schedule/calendar-subscribe.tsx; apps/web/app/(dashboard)/schedule/page.tsx] |
| Webhook dispatch on appointment events | `dispatchAppointmentWebhookAfterCommit` on create, check-in, cancel | N/A (system) | N/A | stable | [VERIFIED: apps/web/server/routers/appointments.ts:dispatchAppointmentWebhookAfterCommit calls; apps/web/server/routers/whiteboard.ts:updateStatus] |
| Honeypot bot protection (public booking) | `booking.book` `website` field | public | N/A | stable | [VERIFIED: apps/web/server/routers/booking.ts:495-502] |
| Rate limiting (public booking) | IP-based and slug-based rate limits | public | N/A | stable | [VERIFIED: apps/web/server/routers/booking.ts:60-70] |
| Pre-visit intake fields (public booking) | `filterPrevisitIntakeByFieldKeys`, `previsitIntakeInput` | public | N/A | stable | [VERIFIED: apps/web/server/routers/booking.ts:book input] |

## B. Import/Export specifics

### Calendar feed export (ICS)
- **Format:** RFC 5545 `.ics` file served at `/api/calendar/{token}.ics` [VERIFIED: apps/web/app/api/calendar/[token]/route.ts]
- **Token generation:** `generateCalendarFeedToken()` stores a capability token in `practices.calendarFeedToken` [VERIFIED: apps/web/server/routers/appointments.ts:2080-2092]
- **Subscription workflow:** Staff clicks "Subscribe" button on `/schedule`, copies URL, pastes into Google Calendar / Apple Calendar / Outlook [VERIFIED: docs/help/calendar-feed.md; apps/web/components/schedule/calendar-subscribe.tsx]
- **Token rotation:** Admin can rotate via `rotateCalendarFeed`, invalidating old URL for the whole clinic [VERIFIED: apps/web/server/routers/appointments.ts:2096-2114]
- **Access:** Token is a read-only capability; any staff member can read/enable; only admin can rotate [VERIFIED: apps/web/server/routers/appointments.ts:2063-2114]
- **Idempotency:** `enableCalendarFeed` uses `COALESCE` — concurrent calls or double-clicks get the same URL [VERIFIED: apps/web/server/routers/appointments.ts:2080-2092]

### Public booking page (import of external appointment requests)
- **Format:** Public web page at `/book/[slug]` accepting contact info, pet info, reason, optional pre-visit intake [VERIFIED: apps/web/server/routers/booking.ts:getPage,book]
- **Result:** Creates `appointments` row with `status: "scheduled"` and notes prefixed `[Online request]`, plus a `communications` inbox entry [VERIFIED: apps/web/server/routers/booking.ts:book — appointment insert + communications insert]
- **Confirmation:** Always `requiresConfirmation: true` — public booking is deliberately request-only, staff must manually confirm [VERIFIED: apps/web/server/routers/booking.ts:758-762]

## C. Integration specifics

### External calendar sync
- **Mechanism:** One-directional read-only ICS feed (calDAV-compatible URL subscription) [VERIFIED: apps/web/app/api/calendar/[token]/route.ts]
- **Protocol:** Standard iCalendar (.ics) served over HTTPS; no WebCal/CalDAV two-way sync [INFERRED: ICS route is GET-only]
- **Supported clients:** Google Calendar, Apple Calendar, Outlook (per docs) [CLAIMED IN DOCS: docs/help/calendar-feed.md]
- **Refresh cadence:** Up to external calendar app's polling interval; docs note "can take a little while to appear" [CLAIMED IN DOCS: docs/help/calendar-feed.md]

### Public booking page
- **URL structure:** `/book/[slug]` — slug chosen by practice admin, globally unique across tenants [VERIFIED: apps/web/server/routers/booking.ts:checkSlug; apps/web/lib/booking/page-config.ts:RESERVED_BOOKING_SLUGS]
- **Config surface:** weekly hours (day-by-day open/close), bookable appointment types, new-client toggle, lead time, booking window (1-365 days), welcome text, accent color, optional pre-visit intake fields [VERIFIED: apps/web/lib/booking/page-config.ts:configWriteSchema]
- **Identity resolution:** Matches existing client by email; creates new client if `allowNewClients` is true [VERIFIED: apps/web/server/routers/booking.ts:687-710]
- **Patient matching:** Reuses existing patient within client when name matches (case-insensitive) [VERIFIED: apps/web/server/routers/booking.ts:712-737]

### Webhook integration
- **Events dispatched:** `appointment.created` (dashboard + booking_page sources), `appointment.checked_in`, `appointment.cancelled` [VERIFIED: apps/web/server/routers/appointments.ts:dispatchAppointmentWebhookAfterCommit calls; apps/web/server/routers/whiteboard.ts:updateStatus]
- **Signature:** HMAC-SHA256 via `dispatchWebhookEvent` [INFERRED: from UX analysis §1 — webhook-dispatcher.ts]

### Billing gating
- Public booking is a hosted feature: practices with paused/lapsed billing return 404 for their booking page [VERIFIED: apps/web/server/routers/booking.ts:assertBookingBillingAccess]

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| "Your Day Sheet" — "Book a visit on the schedule. Check the pet in. Watch the whiteboard." [docs/help/your-day.md] | **MATCH** — workflow is accurate: Schedule → Whiteboard is the canonical front-desk loop | [VERIFIED: apps/web/app/(dashboard)/schedule/page.tsx; apps/web/app/(dashboard)/whiteboard/page.tsx] |
| "Everyone at the clinic sees the same board, live." [docs/help/your-day.md] | **NUANCE** — "Live" means 30-second tRPC polling, not WebSockets/SSE. The UI displays a pulsing green dot and "Auto-refreshes every 30s" label. | [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:220-231, 617-619] |
| "When the visit is done, turn it into a bill with one click from Billing." [docs/help/your-day.md] | **MATCH** — checkout is gated through `encounters.finalizeCloseout`, which bridges clinical closeout to billing | [VERIFIED: apps/web/server/routers/appointments.ts:1113-1117 (CLOSEOUT_BYPASS_MESSAGE)] |
| "See your schedule in your own calendar" — subscribe button, Google/Apple/Outlook instructions [docs/help/calendar-feed.md] | **MATCH** — ICS feed exists at `/api/calendar/{token}.ics`, subscribe UI in Schedule page | [VERIFIED: apps/web/server/routers/appointments.ts:calendarFeed,enableCalendarFeed; apps/web/components/schedule/calendar-subscribe.tsx] |
| "It stays up to date on its own" [docs/help/calendar-feed.md] | **NUANCE** — true but dependent on external calendar app's refresh cadence; no push/WebSub mechanism | [VERIFIED: ICS route is GET-only, no push notification] |
| "Anyone with the link can see your schedule" [docs/help/calendar-feed.md] | **MATCH** — token is a capability; rotation invalidates old URL | [VERIFIED: apps/web/server/routers/appointments.ts:2096-2114] |
| "Book a visit... Click any open slot to book a visit." [docs/help/your-day.md] | **MATCH** — day/week/month calendar has inline click-to-book slot creation | [VERIFIED: apps/web/app/(dashboard)/schedule/page.tsx:DayCalendar onSlotClick] |
| "Check a pet in from the schedule and it appears on the whiteboard." [docs/help/your-day.md] | **MATCH** — `updateStatus` mutation triggers whiteboard cache invalidation via tRPC utils | [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx: whiteboard uses `refetchInterval: 30000`; cache invalidation on local mutations] |
| "Move pets through the visit: waiting, in exam, ready to go home." [docs/help/your-day.md] | **MATCH** — whiteboard 3-column layout: Waiting (confirmed), In Progress (checked_in + in_exam), Completed (checked_out) | [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:COLUMNS constant lines 73-99] |

## E. Friction / "doesn't make sense" notes

### E1. Whiteboard "Live" badge — 30-second polling, not real-time
- **Current state:** Whiteboard UI shows pulsing green dot with "Auto-refreshes every 30s" label [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:220-231]
- **Reality:** `refetchInterval: 30000` — plain tRPC polling, no WebSocket / SSE / Supabase Realtime [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:617-619]
- **Impact:** Status changes from other staff can take up to 30 seconds to appear. For a "live" board used for patient flow, this creates a window where two staff members could try to move the same patient.
- **UX analysis note:** F2 already flagged this as high severity [VERIFIED: artifacts/ux-codebase-analysis-2026-09-11.md §F2]
- **Cross-ref:** This is still true as of commit `23f23a3` — code unchanged from analysis.

### E2. `/waiting-room` vs `/whiteboard` — distinct pages, different audiences
- **`/whiteboard`:** Staff-facing kanban with 3 columns (Waiting / In Progress / Completed), status transition buttons, patient detail modal, doctor assignment. For clinic staff workflow. [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx]
- **`/waiting-room`:** Patient-facing TV display (`<WaitingRoomTv>`) with check-in chime audio, seasonal health tips, species emoji, full-screen mode toggle. For the clinic lobby. [VERIFIED: apps/web/app/(dashboard)/waiting-room/page.tsx; apps/web/components/waiting-room/waiting-room-tv.tsx]
- **Conclusion:** These are correctly separate concerns — one is a workflow tool, the other is a client information display. No confusion.

### E3. Appointment status state machine — verified against router enforcement
- **State machine (lib):** 7 states, 14 allowed transitions [VERIFIED: apps/web/lib/scheduling/appointment-status.ts:13-24]
- **Router enforcement:** Both `appointments.updateStatus` and `whiteboard.updateStatus` call `canTransitionAppointmentStatus()` [VERIFIED: apps/web/server/routers/appointments.ts:1100-1104; apps/web/server/routers/whiteboard.ts:228-232]
- **Checked-out gate:** Direct `checked_out` via `updateStatus` is explicitly blocked — must go through `encounters.finalizeCloseout` [VERIFIED: apps/web/server/routers/appointments.ts:1113-1117; apps/web/server/routers/whiteboard.ts:223-227]
- **Recovery paths:** `no_show → scheduled` and `cancelled → scheduled` are allowed in lib, and the whiteboard router validates location + conflict checks before re-opening [VERIFIED: apps/web/server/routers/whiteboard.ts:270-310]
- **Clinical finalization gate:** If `visitCloseouts.status` is `clinical_finalized` or `completed`, status changes are blocked [VERIFIED: apps/web/server/routers/whiteboard.ts:312-322]
- **Verdict:** State machine in code matches router enforcement. No drift.

### E4. Waitlist state machine — simpler than appointments
- **Waitlist statuses:** `waiting → scheduled | cancelled` (terminal states) [VERIFIED: apps/web/server/routers/waitlist.ts:canTransitionWaitlistStatus]
- **Matcher:** `matchWaitlist()` is a pure function: filters waiting entries by type preference, date window, sorts FIFO by `createdAt` [VERIFIED: apps/web/lib/scheduling/waitlist.ts]
- **Note:** Waitlist `scheduled` status does NOT create an actual appointment — that's a separate manual or automated step. The matcher only suggests candidates.

### E5. Booking page auto-confirm is deliberately normalized to `false`
- **Code:** `autoConfirm` in config is normalized to `false` on every read/write: `transform(() => false)` [VERIFIED: apps/web/lib/booking/page-config.ts:autoConfirm transforms]
- **Comment:** "Public booking is deliberately request-only. Keep this invariant independent of legacy booking-page config stored in jsonb." [VERIFIED: apps/web/server/routers/booking.ts:756-758]
- **Implication:** There is no path where a public booking auto-confirms. Staff must always manually confirm. This is a deliberate clinical safety choice.

### E6. 25 flat sidebar sections — scheduling occupies 3
- **Scheduling-related sections:** `schedule`, `whiteboard`, `waiting-room` (3 of 25) [VERIFIED: apps/web/app/(dashboard)/ directory inventory]
- **UX analysis F4:** Flagged as navigation clutter for front-desk staff [VERIFIED: artifacts/ux-codebase-analysis-2026-09-11.md §F4]
- **Note:** These 3 are the most frequently used by front desk but scattered among 22 other sections including compliance, inventory, and admin tools.

### E7. Calendar feed token — all staff can enable, only admin can rotate
- **Enable:** Any authenticated user (not viewer, due to global mutation guard) can call `enableCalendarFeed` [VERIFIED: apps/web/server/routers/appointments.ts:2080]
- **Rotate:** Requires `requireRole("admin")` [VERIFIED: apps/web/server/routers/appointments.ts:2096-2098]
- **Read:** Any authenticated user can read `calendarFeed` to get current URL [VERIFIED: apps/web/server/routers/appointments.ts:2063]
- **Design note:** This is intentional — a capability URL that anyone on staff can share with their own calendar, but only admin can globally invalidate.

## F. Proposed user-manual section(s)

### Persona: front_desk
**Section title:** "Managing Today's Appointments"

1. **Opening the schedule** — Navigate to Schedule, understand day/week/month views, read the calendar
2. **Booking a new appointment** — Click an open slot, pick client/patient/type/doctor/room, confirm. Keyboard shortcuts.
3. **Checking in a patient** — From schedule or whiteboard, status transition to `checked_in`. Doctor assignment requirement when type requires it.
4. **Using the whiteboard** — Three columns (Waiting / In Progress / Completed), moving patients through the visit, opening the encounter
5. **Handling no-shows and cancellations** — Marking no-show, recovering a no-show/cancelled appointment
6. **The waiting room display** — What clients see on the TV, check-in chime, privacy considerations
7. **Managing the waitlist** — Adding clients to waitlist, matching when slots open, FIFO fairness
8. **Recurring appointments** — Setting up weekly/monthly/annual series, cancelling a series
9. **Calendar subscriptions** — Getting your ICS feed link, adding to Google/Apple/Outlook

### Persona: veterinarian
**Section title:** "Your Daily Appointment Flow"

1. **Reading the whiteboard** — See who's waiting, who's in progress, who's checked in under your name
2. **Starting an exam** — Moving from `checked_in` to `in_exam`, opening the encounter
3. **Field/ambulatory visits** — Starting a field visit from a patient chart, origin tracking
4. **Patient re-attachment** — Reassigning a patient mid-visit if the wrong one was selected

### Persona: admin
**Section title:** "Setting Up Scheduling"

1. **Configuring appointment types** — Names, durations, colors, doctor requirement
2. **Setting up rooms and locations** — Multi-location support, room types
3. **Provider schedules** — Staff working hours by day-of-week and location
4. **Public booking page** — Slug selection, weekly hours, visit types, new-client policy, pre-visit intake fields
5. **Calendar feed management** — Enabling, sharing, and rotating the ICS token
6. **Booking page billing** — Understanding that public booking is a hosted feature