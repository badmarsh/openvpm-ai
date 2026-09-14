# Marketing & Communications

OpenVPM's marketing module sends automated messages to clients, manages
your online reputation, and helps you reach the right clients at the right
time. Navigate to **Marketing** (`/marketing`).

> **Roles**: Admin has full access. Veterinarians can view campaigns and
> approve clinical content. Technicians and Front Desk have read access.

---

## 1. Communications overview

The marketing module works with 12 built-in CRM segments that automatically
classify your clients based on their activity:

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

Segments are computed automatically — you do not need to maintain them
manually.

---

## 2. Care reminders & automated journeys

Five automated customer journeys run in the background once configured:

| Journey | Trigger | Messages |
|---|---|---|
| Welcome new client | New client registered | Onboarding message + 7-day feedback request |
| Post-visit follow-up | Visit completed | Thank-you + 24-hour review request |
| Vaccine reminder | Vaccine due date approaching | 14-day reminder + 3-day countdown + overdue notice |
| Post-operative care | Surgery completed | 24-hour condition check + day-3 recovery + day-10 suture check |
| Patient reactivation | 12 months since last visit | Recall message |

### ⚠️ Sympathy Flow — mandatory hard block

> **This is not a configurable setting. It cannot be disabled.**

When a patient's status is set to **deceased**, or when a euthanasia is
recorded in the system, the following happens **automatically and
permanently**:

- All automated reminders for that patient are **immediately suppressed** —
  including vaccine reminders, recall messages, post-visit follow-ups, and
  review requests
- Any open care reminder for the patient is dismissed with the reason
  *"Sympathy Gate: Patient deceased / euthanized"*
- A condolence staff task is created automatically so a team member can
  reach out to the owner personally
- Every suppression is logged to the audit trail with reason code
  `deceased_patient`

This behaviour applies to all five journeys listed above. There is no
override, no whitelist, and no opt-out.

---

## 3. Marketing Studio

Create social media posts, waiting room TV content, and printed client
handouts from **Marketing → Studio**.

AI-generated content drafts are produced by the system's AI model.
**Any draft containing clinical claims** (treatment advice, dosage
information, disease prevention) must be approved by a licensed veterinarian
before publishing. The system enforces this review requirement.

---

## 4. Reputation management

Incoming reviews are displayed in **Marketing → Reviews**. Each review
has a 24-hour response SLA tracked by the system.

Reviews with a rating of **2 stars or below** are automatically escalated:
the system sets an escalation flag and creates a staff task so a team
member can respond promptly.

---

## 5. Waiting room TV

Display your appointment queue, wellness promotions, and practice
announcements on a screen in your waiting room at `/tv`. The TV display
updates automatically and requires no additional hardware — just open the
URL on any browser connected to a screen.

---

Need help? Email [hello@openvpm.com](mailto:hello@openvpm.com) and a real
person will answer.
