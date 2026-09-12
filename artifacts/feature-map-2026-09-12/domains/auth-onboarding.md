# Domain: Authentication & Onboarding
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **Email/password registration** | `authRouter.register` | public | `users`, `practices`, `locations` | **live** | [VERIFIED: apps/web/server/routers/auth.ts:168-532] |
| **Email verification** (hosted only) | `authRouter.verifyEmail`, `resendVerification` | public (verify), protected (resend) | `authTokens`, `users.emailVerifiedAt`, `authEmailAttempts`, `authEmailDeliveryEvents` | **live (hosted flag-gated)** | [VERIFIED: apps/web/server/routers/auth.ts:575-714] |
| **Password reset** | `authRouter.requestPasswordReset`, `resetPassword` | public | `authTokens`, `users.passwordHash` | **live** | [VERIFIED: apps/web/server/routers/auth.ts:716-783] |
| **Staff invite** (admin invites team members) | `settingsRouter.inviteStaff` | admin | `users`, `authTokens` (type=invite) | **live** | [VERIFIED: apps/web/server/routers/settings.ts:2460-2650] |
| **Accept staff invite** | `authRouter.acceptInvite` | public | `users.passwordHash`, `users.emailVerifiedAt` | **live** | [VERIFIED: apps/web/server/routers/auth.ts:785-810] |
| **Login (credentials)** | NextAuth `CredentialsProvider` | public | `users`, `practices` | **live** | [VERIFIED: apps/web/lib/auth.ts:92-155] |
| **Login (demo mode)** | NextAuth `demo` CredentialsProvider | public | `users`, `practices` | **live (env-gated)** | [VERIFIED: apps/web/lib/auth.ts:156-207] |
| **Session management** | NextAuth JWT callbacks + `protectedProcedure` middleware | — | — (JWT-based) | **live** | [VERIFIED: apps/web/lib/auth.ts:209-274, apps/web/server/trpc.ts:420] |
| **"Me" profile query** | `authRouter.me` | protected | `users` | **live** | [VERIFIED: apps/web/server/routers/auth.ts:812-833] |
| **Rate limiting** (login, register, pw-reset, verify resend) | Multiple `assertPreAuthRateLimit` calls | — | `rateLimits` (in-memory) | **live** | [VERIFIED: apps/web/server/routers/auth.ts:62-82] |
| **Demo access** (pre-seeded accounts) | `demoModeEnabled()` + signed cookie gate | public (demo) | `users`, `practices` | **live (env-gated)** | [VERIFIED: apps/web/lib/demo-access.ts:1-171] |
| **Onboarding intent capture** | `onboardingDraft` on register, `clinicModel`/`firstGoal` enums | public | `practices.settings.onboardingState` | **live** | [VERIFIED: apps/web/server/routers/auth.ts:93-138, apps/web/lib/onboarding/clinic-profile.ts:1-12] |
| **Onboarding journey steps** | 4-step guided flow: intent → basics → data → allSet | — | `practices.settings.onboardingState.journeyStepId` | **live** | [VERIFIED: apps/web/lib/onboarding/journey-plan.ts:1-49] |
| **Starter catalog seed** (`seedPractice`) | Called during registration transaction | — | `appointmentTypes`, `rooms`, `services` | **live** | [VERIFIED: apps/web/lib/onboarding/defaults.ts:69-120] |
| **Demo data seed** (`seedDemoData`) | Called during registration (hosted only) | — | `clients`, `patients`, `appointments`, `soapNotes`, `vaccinationRecords`, `problemList`, `invoices`, `payments`, `careReminders`, `products` | **live (hosted only)** | [VERIFIED: apps/web/lib/onboarding/defaults.ts:130-813] |
| **Onboarding import/migration workflow** | `onboarding-workflow.ts` helpers | — | — (state in `practices.settings`) | **live** | [VERIFIED: apps/web/lib/import/onboarding-workflow.ts:1-87] |
| **Setup recovery emails** (trial stall nudge) | `setupRecoveryState`, `setupRecoveryAttempt` | — | `practices.settings.onboardingState` | **live** | [VERIFIED: apps/web/lib/onboarding/setup-recovery.ts:1-177] |
| **Hosted billing/trial gates** | `billingEnforced()`, `noCardTrialEnabled()`, `hasHostedFullAccess()` | — | `practices` (subscriptionTier, billingStatus, trialEndsAt) | **live** | [VERIFIED: apps/web/lib/billing/plans.ts:275-300] |
| **Auth token system** (email_verify, password_reset, invite) | `createAuthToken`, `consumeAuthToken` | — | `authTokens` | **live** | [VERIFIED: apps/web/lib/auth-tokens.ts:1-113] |
| **Auth email delivery tracking** | `sendTrackedVerificationEmail`, `recordAuthEmailDeliveryEvent` | — | `authEmailAttempts`, `authEmailDeliveryEvents`, `authEmailProviderIdentityConflicts`, `authEmailWebhookConflicts` | **live** | [VERIFIED: apps/web/lib/auth-email-delivery.ts:1-860] |
| **Portal client auth** (pet-owner access) | `portalProcedure` middleware, capability tokens | portal_user | `portalSessions`, `verificationTokens`, `clients` | **live** | [VERIFIED: apps/web/server/routers/portal.ts:1-805, apps/web/server/trpc.ts:389-417] |
| **Portal online booking** | `portalRouter.bookAppointment` | portal_user | `appointments` | **live** | [VERIFIED: apps/web/server/routers/portal.ts] |
| **Portal messaging** | `portalRouter.createMessage` | portal_user | `communications` | **live** | [VERIFIED: apps/web/server/routers/portal.ts] |
| **Cron route auth** | `isCronAuthorized` (Bearer CRON_SECRET) | service_cron | — | **live** | [VERIFIED: apps/web/lib/cron-auth.ts:1-44] |
| **Postgres RLS enforcement** | `packages/db/rls/enable-rls.sql` + `withTenant()` | all | all tenant tables | **live** | [VERIFIED: docs/authorization-enforcement-audit.md:27-38] |
| **Auth redirect safety** | `safeAuthNextPath()` | — | — | **live** | [VERIFIED: apps/web/lib/auth-redirect.ts:1-33] |
| **Acquisition tracking** (funnel source/medium/campaign) | `acquisition` on register input | public | `practices.settings.acquisition` | **live** | [VERIFIED: apps/web/server/routers/auth.ts:141-152] |
| **Clinic model / first goal** selector | `CLINIC_MODELS`, `FIRST_GOALS` enums | public | `practices.settings.onboardingState` | **live** | [VERIFIED: apps/web/lib/onboarding/clinic-profile.ts:1-180] |
| **Password hashing** (bcrypt) | `bcryptjs.hash()` at cost 12 | — | `users.passwordHash` | **live** | [VERIFIED: apps/web/lib/auth-hashing.ts:1-2] |

### Dashboard routes
| Route | Purpose | Source tag |
|---|---|---|
| `/login` | Staff sign-in page | [VERIFIED: apps/web/server/trpc.ts:279] |
| `/register` | New practice + admin registration | [VERIFIED: apps/web/server/routers/auth.ts:168] |
| `/verify-email` | Email verification landing (token consumed) | [VERIFIED: apps/web/server/routers/auth.ts:575] |
| `/reset-password` | Password reset landing (token consumed) | [VERIFIED: apps/web/server/routers/auth.ts:747] |
| `/accept-invite` | Staff invite acceptance (token consumed) | [VERIFIED: apps/web/server/routers/auth.ts:785] |
| `/portal/:token` | Client portal (capability-token gated) | [VERIFIED: apps/web/server/routers/portal.ts:1-805] |

---

## B. Import/Export specifics

### Auth tokens (email verification, password reset, staff invites)
- **Token format**: 64-char hex strings (`/^[a-f0-9]{64}$/i`). Generated via `randomBytes(32).toString("hex")`. [VERIFIED: apps/web/lib/auth-tokens.ts:23-24]
- **Storage**: Only SHA-256 hashes persisted in `authTokens.tokenHash`; raw tokens never stored. [VERIFIED: apps/web/lib/auth-tokens.ts:15-17]
- **TTLs**: email_verify = 24h, password_reset = 1h, invite = 72h. [VERIFIED: apps/web/lib/auth-tokens.ts:10-13]
- **Single-use**: Consumed tokens marked with `usedAt`; double-consume returns null. [VERIFIED: apps/web/lib/auth-tokens.ts:78-105]
- **Token lifecycle rotation**: For email_verify, resending does NOT invalidate existing unexpired tokens (multi-link tolerance). For password_reset and invite, resending invalidates prior unexpired tokens by setting `usedAt`. [VERIFIED: apps/web/lib/auth-tokens.ts:35-45]
- **Cleanup**: `cleanupExpiredAuthArtifacts()` sweeps expired auth tokens, sessions, verification tokens, and portal sessions. [VERIFIED: apps/web/lib/auth-tokens.ts:115-162]

### Auth email delivery ledger
- **Identity safety**: No recipient addresses, URLs, or auth links stored in operational alerts. Only attempt IDs, provider names, and outcome enums. [VERIFIED: apps/web/lib/auth-email-delivery.ts:33-40]
- **Signed webhook evidence**: Resend webhooks (Svix-signed) create `authEmailDeliveryEvents` with SHA-256 raw-body fingerprints, not payloads. [VERIFIED: apps/web/lib/auth-email-delivery.ts:431-438]
- **Conflict resolution**: Provider identity conflicts quarantined in `authEmailProviderIdentityConflicts`; webhook payload conflicts in `authEmailWebhookConflicts`. [VERIFIED: apps/web/lib/auth-email-delivery.ts:199-224]

### Demo access tokens
- **Format**: JWT-like `{base64url(payload)}.{HMAC-SHA256 signature}`. 7-day expiry. Email stored as SHA-256 hash only. [VERIFIED: apps/web/lib/demo-access.ts:38-110]
- **Transport**: Cookie `openvpm_demo_access`, verified with timing-safe comparison. [VERIFIED: apps/web/lib/demo-access.ts:130-155]

---

## C. Integration specifics

### NextAuth.js (session layer)
- **Version**: NextAuth v4 (JWT strategy, no DB sessions for staff). [VERIFIED: apps/web/lib/auth.ts:1-8]
- **Providers**: `CredentialsProvider` (email/password) + custom `demo` provider. [VERIFIED: apps/web/lib/auth.ts:92-207]
- **Secret**: `NEXTAUTH_SECRET` env var; whitespace-trimmed; blank-whitespace treated as unset. [VERIFIED: apps/web/lib/auth-secret.ts:1-30, apps/web/lib/__tests__/auth.test.ts:7-33]
- **JWT payload**: Carries `id`, `email`, `name`, `role`, `practiceId`, `emailVerifiedAt`, `practiceCreatedAt`, `recoveryHold`, `billingTier`, `billingStatus`, `trialEndsAt`. [VERIFIED: apps/web/lib/auth.ts:75-90]

### Stripe (hosted billing)
- **Gated by**: `HOSTED_BILLING_ENABLED` (off by default for self-host). [VERIFIED: apps/web/lib/billing/plans.ts:283-285]
- **Card-free trial**: 14-day trial (`TRIAL_DAYS`) with no Stripe subscription at signup. Gated by `HOSTED_NO_CARD_TRIAL` (on by default). [VERIFIED: apps/web/lib/billing/plans.ts:245-260]
- **Checkout**: Single per-location price; AI+SMS metered overage attached server-side. [VERIFIED: apps/web/server/routers/auth.ts:258-280]
- **Subscription sync**: Practice `subscriptionTier`, `billingStatus`, `trialEndsAt`, `stripeCustomerId`, `stripeSubscriptionId` columns. [VERIFIED: apps/web/lib/billing/plans.ts:17-30]

### Resend (email provider, hosted only)
- **Provider detection**: `verificationEmailProvider()` returns `"resend"` (production) or `"console"` (dev preview). [INFERRED from email provider module pattern]
- **Svix webhook signature**: Signed Resend webhooks carry `openvpm_attempt_id` and `openvpm_email_kind` tags for auth email attempt matching. [VERIFIED: apps/web/lib/auth-email-delivery.ts:545-558]

### Postgres RLS
- **Enforcement**: `withTenant(db, practiceId, fn)` sets `app.current_practice_id` for all queries inside the block. [INFERRED from docs/authorization-enforcement-audit.md:27-38]
- **Auth lookups**: Pre-tenant (registration, login) use `withSystem()` to bypass RLS; all post-auth queries use `withTenant()`. [VERIFIED: apps/web/lib/tenant-db.ts — inferred from usage patterns]

### Rate limiting
- **Backend**: In-memory, not Redis. Keys: `login:email:<email>`, `login:ip:<ip>`, `register:<email>`, `register:ip:<ip>`, `pwreset:<email>`, `verifyresend:<email>`. [VERIFIED: apps/web/server/routers/auth.ts:62-82]
- **Limits**: Login = 8/email/15min, 40/IP/15min; Register = 5/email/hr, 5/IP/hr; Pw-reset = 5/email/hr; Verify resend = 5/email/hr. [VERIFIED: apps/web/lib/auth.ts:18-19, apps/web/server/routers/auth.ts:62-82]

---

## D. Docs-vs-reality pass

| Docs/README claim | Reality (commit 23f23a3) | Verdict | Source tag |
|---|---|---|---|
| "Email/password authentication" | Fully implemented via NextAuth CredentialsProvider + tRPC auth router. | **Accurate** | [VERIFIED: apps/web/lib/auth.ts, apps/web/server/routers/auth.ts] |
| "Role-based access control (RBAC)" | 5 staff roles (admin, veterinarian, technician, front_desk, viewer) + portal_user. Enforced via `protectedProcedure`, `requireRole()`, `assertAgentRole()`. | **Accurate** | [VERIFIED: docs/authorization-matrix.md, apps/web/lib/authorization.ts] |
| "Multi-tenant isolation" | Enforced via `withTenant()` + Postgres RLS. Practice ID never trusted from client. | **Accurate** | [VERIFIED: docs/authorization-enforcement-audit.md:27-38] |
| "Email verification" | Implemented but only enforced on hosted (`billingEnforced()`). Self-host skips verification entirely. | **Accurate (conditional)** | [VERIFIED: apps/web/server/routers/auth.ts:505-532] |
| "14-day free trial" | `TRIAL_DAYS = 14`, implemented. Card-free trial by default (no Stripe checkout wall). | **Accurate** | [VERIFIED: apps/web/lib/billing/plans.ts:245] |
| "Self-host has no billing gates" | `billingEnforced()` returns false when `HOSTED_BILLING_ENABLED` unset; all features unlocked. | **Accurate** | [VERIFIED: apps/web/lib/billing/plans.ts:283-285] |
| "Fail-closed authorization" | `assertAgentRole()` and `requireRole()` default to DENY for absent/unknown roles. Fixed from earlier fail-open bug. | **Accurate (post-fix)** | [VERIFIED: docs/authorization-enforcement-audit.md:17-25, apps/web/lib/authorization.ts:65-99] |
| "Staff invites" | Admin-only `inviteStaff` creates user with random password hash, sends email with 72h invite token. | **Accurate** | [VERIFIED: apps/web/server/routers/settings.ts:2460-2650] |
| "Onboarding journey" | 4-step flow (intent → basics → data → allSet). Retired steps (branding, team, agent, phone, billing) redirect to data or allSet. | **Accurate** | [VERIFIED: apps/web/lib/onboarding/journey-plan.ts:1-49] |
| "Demo mode" | Pre-seeded 4-role demo accounts (admin, vet, tech, front_desk) behind signed cookie gate + `NEXT_PUBLIC_DEMO_MODE=true`. | **Accurate** | [VERIFIED: apps/web/lib/demo-access.ts:10-14, 28-33] |
| "Portal client access" | Capability-token-free browser sessions via `portalProcedure`. Revocable portal sessions with rate limiting. | **Accurate** | [VERIFIED: apps/web/server/trpc.ts:389-417, apps/web/server/routers/portal.ts] |
| "Password policy: min 8, max 128" | Enforced via Zod schema `authPasswordInput`. | **Accurate** | [VERIFIED: apps/web/lib/auth-password-policy.ts:1-2] |
| "Bcrypt cost 12" | `PASSWORD_HASH_COST = 12`. | **Accurate** | [VERIFIED: apps/web/lib/auth-hashing.ts:1] |
| "Acquisition/funnel tracking" | Captures source, medium, campaign, funnelId at registration. Stored on practice settings. | **Accurate** | [VERIFIED: apps/web/server/routers/auth.ts:141-152] |
| "Auth email delivery observability" | Full ledger with attempt tracking, webhook evidence, identity conflict quarantine. No PII in alerts. | **Accurate** | [VERIFIED: apps/web/lib/auth-email-delivery.ts:1-860] |
| "Cron routes use Bearer CRON_SECRET" | Timing-safe comparison, also accepts `x-cron-secret` header for local dev. | **Accurate** | [VERIFIED: apps/web/lib/cron-auth.ts:1-44] |
| "Auth redirect safety" | `safeAuthNextPath()` prevents open redirect, auth-route loops, scheme attacks. | **Accurate** | [VERIFIED: apps/web/lib/auth-redirect.ts:1-33] |

---

## E. Friction / "doesn't make sense" notes

1. **Email verification is soft on hosted, not hard**: New users can sign in immediately after signup even before verifying email. The banner nudges but does not block. This is intentional (trial + onboarding shouldn't be blocked by email round-trip) but may surprise auditors expecting hard verification. [VERIFIED: apps/web/lib/auth.ts:147-155, comment: "Email verification is a SOFT requirement on hosted"]

2. **No account enumeration in password reset**: `requestPasswordReset` always returns `{ ok: true }` regardless of email existence. This is a security feature (prevents email fishing) but means the UI cannot tell users whether they have an account. [VERIFIED: apps/web/server/routers/auth.ts:716-744]

3. **Auth token TTL inconsistency**: Email verification tokens last 24h, but password reset tokens expire in 1h. This makes password-reset emails feel "broken" more often than verification emails. The 1h TTL may be too aggressive for a veterinary practice that checks email infrequently. [VERIFIED: apps/web/lib/auth-tokens.ts:10-13]

4. **Rate limiting is in-memory only**: No Redis or shared state means rate limits don't work across replicas in a multi-instance deployment. The comment says "in-memory" but no distributed rate limiter is wired up. [INFERRED from rate-limit.ts usage pattern — no Redis client observed]

5. **Demo mode uses seeded emails that look real**: Demo accounts use `@vetsykora.sk` domain emails that resemble real staff addresses. If `NEXT_PUBLIC_DEMO_MODE=true` is accidentally set in production, these accounts become accessible. [VERIFIED: apps/web/lib/demo-access.ts:10-14]

6. **Onboarding journey steps are decoupled from actual feature enablement**: Steps like "data" (migration) and "allSet" (first day) rely on `journeyStepId` being updated, but nothing enforces completion of actual data import before advancing. The journey is guidance, not a gate. [VERIFIED: apps/web/lib/onboarding/journey-plan.ts:12-18]

7. **Staff invite creates a user row before email delivery**: If the email provider fails, a pending user row exists with a random password hash. This is correct (billing seat must be reserved) but means a failed invite still increments staff count. [VERIFIED: apps/web/server/routers/settings.ts:2568-2590]

8. **Portal sessions have no explicit logout**: Portal access is via browser-session cookie with expiry, but there is no explicit `portalLogout` procedure to revoke a session. Sessions expire naturally. [INFERRED from absence in portal router — only read/mutation procedures found, no logout]

9. **`view` role is not in the official role taxonomy doc**: The authorization matrix docs list `admin`, `veterinarian`, `technician`, `front_desk`, `portal_user`, `service_cron` but `viewer` (read-only staff) exists in code and is enforced. [VERIFIED: docs/authorization-matrix.md:20-33 vs apps/web/lib/authorization.ts:17-22]

10. **Auth email delivery tracking is complex for a simple feature**: 4 tables (`authEmailAttempts`, `authEmailDeliveryEvents`, `authEmailProviderIdentityConflicts`, `authEmailWebhookConflicts`) for email delivery observability. This is thorough but may be over-engineered for a startup-stage product. [VERIFIED: apps/web/lib/auth-email-delivery.ts:1-860]

---

## F. Proposed user-manual section(s)

### Getting Started — Your First Login

1. **Navigate to** `/login` in your browser.
2. **Enter** the email and password set during registration.
3. **You will land** on the dashboard. If on hosted service, a banner may prompt email verification — this is optional for immediate access but recommended for account recovery.

### Creating Your Practice Account

1. **Go to** `/register`.
2. **Provide**: practice name, your email, a password (min 8 characters), and country.
3. **Optional**: Select your clinic type (companion, mobile, equine, specialty, shelter, exploring) and first goal (run a visit, import records, start fresh, explore sample data).
4. **On hosted service**: A 14-day free trial starts immediately — no credit card required. You land in the product with sample data pre-loaded.
5. **On self-host**: Full access with no billing gates.

### Inviting Team Members

1. **As an admin**: Go to Settings → Team → Invite.
2. **Enter**: team member email, name (optional), and role (admin, veterinarian, technician, front_desk, viewer).
3. **They receive** an invitation email with a link valid for 72 hours.
4. **On acceptance**: They set their password and are immediately verified.

### Password Reset

1. **From the login page**: Click "Forgot password?"
2. **Enter your email**. If the email is registered, a reset link is sent (valid for 1 hour).
3. **Important**: The page always says "if an account exists, we sent an email" — this prevents others from discovering if your email is registered.

### Email Verification (Hosted Only)

1. **After signup**: Check your inbox for a verification email.
2. **Click the link** to verify (valid for 24 hours).
3. **If expired**: Sign in and use the "Resend verification" button in the dashboard banner.
4. **Note**: You can use the product before verifying, but verification is required for account recovery and certain admin operations.

### Demo Mode (Evaluation Accounts)

1. **When enabled** (`NEXT_PUBLIC_DEMO_MODE=true`): Four pre-seeded accounts are available (admin, vet, technician, front_desk).
2. **Access**: Via the demo login page with signed cookie authentication.
3. **Data**: Includes a full sample clinic with clients, patients, appointments, invoices, and clinical records.
4. **Reset**: Demo data resets on each deployment; changes are not persisted across sessions.

### Client Portal Access

1. **Clients receive** a portal link from their clinic.
2. **They can view**: their pets' records, vaccination certificates, upcoming/past appointments, and invoices.
3. **They can**: book appointments and send messages to the clinic.
4. **Access is scoped**: clients can only see their own pets and records — never other clients' data.

### Roles & Permissions Quick Reference

| Role | Can do | Cannot do |
|---|---|---|
| **Admin** | Everything: settings, billing, staff, clinical | — |
| **Veterinarian** | Full clinical: SOAP, prescriptions, OPL, imaging | Practice settings, staff management |
| **Technician** | Vitals, draft SOAP, administer treatments | Prescribe, OPL, finalize clinical records |
| **Front Desk** | Scheduling, billing, client registration, e-Kasa | Clinical records, OPL, prescribing |
| **Viewer** | Read-only access to all data | Any write operation (mutations blocked) |
| **Client Portal** | Own pets, appointments, invoices, messaging | Staff operations, other clients' data |
