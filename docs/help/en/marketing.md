# Campaigns & SMS and Communications

The **Campaigns & SMS** module (`/marketing`) manages automated outreach to pet parents, protects your clinic's online reputation, and helps you communicate with the right clients at the right time in accordance with strict veterinary ethics and Slovak regulations.

> **Roles**: Practice Admin has full access. Veterinarians can view campaigns and approve clinical content. Technicians and Front Desk have read access and work with reception scripts.

---

## 1. Marketing Studio (`/marketing`)

The unified `/marketing` module integrates 4 key workspace tabs with automatic URL parameter sync (`?tab=...`):

1. **Overview & Generator (`?tab=overview`):**
   - Create social media posts (Facebook, Instagram) using veterinary AI assistance.
   - Generate educational TV slides for waiting room displays.
   - Multimedia content and printable handouts.
2. **Content Calendar (`?tab=calendar`):**
   - Weekly and monthly schedule of topics (tick prevention, vaccination schedules, dental care, senior pet wellness).
   - Export content plan to calendar.
   - Legacy route `/marketing/plan` automatically redirects to this tab.
3. **Approval Queue (`?tab=queue`):**
   - Staff review hub.
   - All AI-generated drafts with clinical claims (drug dosages, treatment advice, disease prevention) must be verified and signed off by a licensed veterinarian (Human-in-the-Loop, Act 39/2007 Coll.).
   - Legacy route `/marketing/content-queue` automatically redirects to this tab.
4. **Competitors & Intel (`?tab=competitors`):**
   - Market intelligence and monitoring of neighboring veterinary practices and reputation in your district.
   - Legacy route `/vet-intel` automatically redirects to this tab.

> ℹ️ **Brand Kit**: Clinic visual identity setup (logo, colors, typography) was consolidated from marketing directly into **Practice Settings** (`/settings?tab=brandKit`).

---

## 2. Automatic CRM Client Segmentation

The system automatically classifies your pet owner database into 12 real-time CRM segments:

| Segment | Who it includes |
|---|---|
| New clients | Registered in the last 30 days |
| Active clients | Visit in the last 6 months |
| Inactive (6 months) | No visit in 6–12 months |
| Inactive (12 months) | No visit in over 12 months |
| Post-surgery | Surgery recorded in the last 30 days |
| Vaccine due soon | Vaccine due in the next 14 days |
| Vaccine overdue | Vaccine due date passed |
| Seniors | Patients aged 7+ years |
| Puppies & kittens | Patients under 1 year |
| Chronic care | Patients with chronic conditions in problem list |
| Dental attention | Dental procedure due or flagged |
| High-value VIP | Top revenue clients |

---

## 3. Automations & Suppression Center (`/automations` & `/marketing/automations`)

The unified Automations Hub manages both client journeys and clinical safety monitoring. Client automations include 6 specialized tabs: **Rules** (`rules`), **Journeys** (`journeys`), **Segments** (`segments`), **Channels** (`channels`), **Event Bus** (`events`), and **Suppression** (`suppression`). Clinical automations host **Clinical Guardian** and **Deep Thinking Concilium**.

### Five built-in customer journeys:

| Journey | Trigger | Messages |
|---|---|---|
| Welcome new client | New client registered | Onboarding message + 7-day feedback request |
| Post-visit follow-up | Visit completed | Thank-you + 24-hour review request |
| Vaccine reminder | Vaccine due date approaching | 14-day reminder + 3-day countdown + overdue notice |
| Post-operative care | Surgery completed | 24-hour condition check + day-3 recovery + day-10 suture check |
| Patient reactivation | 12 months since last visit | Annual wellness recall |

### ⚠️ Ethical Safeguards & Suppression Center (`?tab=suppression`)

The **Suppression** tab (`/marketing/automations?tab=suppression`) provides an immutable audit log of all blocked communications according to legal and ethical limits:

1. **Sympathy Gate (Mandatory & Non-configurable):**
   - As soon as a patient status is set to **Deceased / Euthanized**, the system **immediately and permanently suppresses all automated communications** (vaccination reminders, recalls, Google review requests).
   - All open care reminders are dismissed with reason: *"Sympathy Gate: Patient deceased / euthanized."*
   - An internal staff task is created automatically for personalized condolence.
   - Every blocked message is logged to the audit trail with code `deceased_patient`.
2. **Quiet Hours:**
   - All automated SMS and promotional messages are paused between **20:00 and 08:00** to respect client privacy.
3. **SMS Rate Limit (Frequency Cap):**
   - Maximum 1 campaign message per 14 days per client to prevent fatigue and spam complaints.

---

## 4. Reception Scripts & Informed Consents (`/marketing/consents`)

The module at `/marketing/consents` provides communication and legal protocols for front-desk staff:

- **Reception Phone Scripts:** Standardized workflows for welcoming new clients, scheduling appointments, and handling pricing questions.
- **Informed Consents:** Generation and digital signing of informed consent forms before anesthesia, surgery, hospitalization, and euthanasia (Act 39/2007 Coll.).
- **GDPR Consents & Opt-out:** Logging client consent and instant processing of opt-out requests.

---

## 5. Reputation Management & Reviews (`/marketing/reviews`)

- Automated Google Business Profile review requests following successful visits.
- 24-hour SLA tracking for responding to reviews.
- **Escalation:** Negative reviews (2 stars or below) automatically trigger an urgent staff task for management resolution.

---

## 6. Waiting Room TV (`/waiting-room` and `/tv`)

Display live appointment queues, Marketing Studio slides, and clinic announcements on any screen in your waiting room at `/tv`. Slide management is integrated directly in `/waiting-room`.

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk).
