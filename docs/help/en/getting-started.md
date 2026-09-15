# Getting Started with OpenVPM

Welcome to OpenVPM — your open veterinary practice management system. This
guide walks you through your first login, setting up your practice, and
understanding who can do what.

Every walkthrough here also runs inside the app with your own live data: open
**Settings** and click **Guides**.

---

## Your first login

Go to your practice URL and sign in with your email address and password. On
**OpenVPM Cloud**, email verification is required before your first login. If
you see a verification prompt after registering, check your inbox and click the
verification link — then return to the login page.

---

## Creating your practice account

During registration (`/register`) you set your practice name, timezone, and
admin email. Once your account is created, a small set of sample data is added
automatically — a few demo clients, pets, and appointments — so the app feels
real while you explore.

When you are ready for real work, remove sample data at
**Settings → Data → Remove sample data**.

---

## Inviting team members

Go to **Settings → Users**. Click **Invite**. Enter the team member's email
address and select their role. An invitation email is sent automatically; they
set their own password when they accept the invite (`/accept-invite`).

---

## Password reset

On the login page, click **Forgot password** (`/forgot-password`). Enter your
email address and check your inbox for a reset link. The link takes you to
`/reset-password` where you choose a new password. Reset links are
time-limited.

---

## Email verification (hosted only)

On OpenVPM Cloud, every new account must verify its email address before
logging in. The verification email is sent immediately after registration. If
you do not receive it, check your spam folder or contact
[jurkemik@significa.sk](mailto:jurkemik@significa.sk).

Self-hosted instances can disable the email verification requirement in their
environment configuration.

---

## Demo mode

Evaluation and demo accounts start with pre-loaded sample data so you can
explore every feature without touching real records. All features — billing,
scheduling, statutory compliance, AI agent — are fully functional in demo mode.

When you are ready to go live, remove sample data via **Settings → Data →
Remove sample data**.

---

## Client portal access

Clients do not create their own accounts. You generate a secure magic link from
their client record (open the client, click **Send portal link**). The link
authenticates them automatically and opens their personal portal view at
`/portal`. Links expire after a configurable period; regenerate them from the
client record at any time.

---

## System Navigation

The sidebar navigation has been consolidated into ~32 streamlined items grouped into 7 logical sections aligned with daily clinic workflow:

- **Clinical Record:** Patients (`/patients`), SOAP Records (`/records`), Encounters (`/encounters`), Lab Results (`/lab-results`), Care Reminders (`/care-reminders`), Recalls (`/recalls`), AI Medical Imaging (`/agent/imaging`), AI Voice Dictation (`/agent/voice`).
- **Preventive Care:** Vaccinations (`/vaccinations`) and Wellness Plans (`/wellness`).
- **Front Desk & Flow:** Schedule (`/schedule`), Waiting Room (`/waiting-room`), Whiteboard (`/whiteboard`), Clients (`/clients`), Messages & Inbox (`/inbox`).
- **Pharmacy & Inventory:** Stock & Supplies (`/inventory`), Controlled Substances (`/controlled-substances`).
- **Billing & Compliance:** Invoicing (`/billing`), e-Kasa Receipts (`/billing/ekasa`), Statutory Registers (`/statutory`), Reports (`/reports`), Whiteboard (`/whiteboard`).
- **Campaigns & SMS:** Marketing Studio (`/marketing` with 4 tabs), Reviews (`/marketing/reviews`), Handouts (`/marketing/handouts`), Messages & SMS (`/marketing/messages`), Website Builder (`/marketing/website`), Waiting Room TV (`/marketing/tv`), Automations (`/marketing/automations`), Reception Scripts (`/marketing/consents`), Media Library (`/marketing/media`).
- **Management & Admin:** Platform Admin (`/admin`), Clinic Settings & Brand Kit (`/settings`), AI Agent (`/agent`), Discharge Summaries (`/agent/discharge`).

---

## Roles & permissions quick reference

| Role | Description | Key restrictions |
|---|---|---|
| **Admin** | Full access to settings, billing, audit log, all clinical records | None |
| **Veterinarian** | Full clinical authority: SOAP notes, prescriptions, controlled substances, imaging | — |
| **Technician** | Vitals, draft records, administered treatments | Cannot access controlled substances or write prescriptions |
| **Front Desk** | Appointments, client registration, payments, e-Kasa receipts | No controlled substances; no prescription access |
| **Client (portal)** | Own pets, own appointments, own invoices, messages | Own records only via capability token |

Role permissions are enforced server-side. UI hiding is a convenience, not a
security boundary.

---

## Keep exploring

- [Your day sheet](../your-day.md) — schedule, whiteboard, check-in
- [Billing & Finance](billing-finance.md) — invoicing, payments, e-Kasa
- [Statutory Compliance](statutory-compliance.md) — KVEPIS, rabies, withdrawal periods
- [Ask the AI](../ask-the-ai.md) — query your data in plain words
- [Your data: export, backup, and import](../your-data.md)

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk) and a real
person will answer.
