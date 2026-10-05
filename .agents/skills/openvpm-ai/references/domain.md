# OpenVPM AI — Clinical, Fiscal & Domain Standards

Detailed references for Slovak veterinary legal compliance, fiscalization, AI copilot gates, and CRM automation.

---

## 1. Statutory Compliance & Veterinary Registers (ŠVPS SR & KVL SR)

- **Zákon 39/2007 Z. z. (§3) — Human-in-the-Loop:**
  - AI is strictly advisory and cannot directly write final clinical assertions into the Treatment Diary (Kniha ošetrení) or medical records.
  - All AI drafts (Voice -> SOAP, PDF -> Lab, content briefs) must remain in `draft` status until explicitly reviewed, verified, and signed by a licensed KVL veterinarian via `ClinicalDiffConfirmModal`.
- **Zákon 139/1998 Z. z. — Strict Zero AI Prefill for Controlled Substances:**
  - Controlled substances (omamné a psychotropné látky — Schedule I/II opiates, ketamine, propofol, butorphanol, fentanyl) MUST HAVE ZERO AI PREFILL.
  - The system must actively detect controlled substance codes/names, blank out AI proposals, and require manual, authenticated entry and signature by the attending veterinarian.
- **Unconditional Sympathy Flow Safety Gate:**
  - When a patient's status is `deceased` or euthanasia is recorded, immediately suppress all automated outreach (vaccine reminders, care reminders, Google review asks, promotional SMS).
  - Open care reminders are auto-dismissed with reason `Sympathy Gate`.
  - Defensive queue filtering: `careReminders.list` must filter out deceased pets.
  - Every suppression is logged to `ext_automation_suppression_log`.
  - Automatically creates a staff condolence task in `extMarketingStaffTasks`.
- **Statutory Registers:**
  - Rabies Register (Kniha besnoty) with 3-day notification window to RVPS.
  - Treatment Diary (Kniha ošetrení) with withdrawal period (ochranná lehota) tracking.
  - Euthanasia Register with exact dosing and rendering plant disposal records.
  - Controlled Substances Register with immutable audit ledger.
  - Informed consent protocols (Anesthesia, Surgery, Hospitalization, Euthanasia).
- **Medical Imaging Ownership:**
  - Imaging files (`xray`, `ct`, `mri`, `ultrasound`, `photo`) use category `"imaging"` and attach to the patient record without overwriting `patient.photoUrl`.

---

## 2. Slovak Fiscal Compliance (e-Kasa — Zákon 289/2008 Z. z.)

- **Isolated Fiscal Driver:**
  - All e-Kasa logic lives in `packages/db/schema/ext_ekasa.ts`, `apps/web/lib/ekasa/`, and `apps/web/server/routers/extensions/ekasa.ts`.
- **Offline Resiliency & Deduplication:**
  - Every receipt request uses cryptographic UUID idempotency keys and an offline sync queue to handle fiscal printer disconnects or Internet dropouts without double-charging or orphaned financial records.
- **Slovak VAT Slabs:**
  - Support standard and reduced Slovak VAT rates (20%, 10%, 5% / 23%, 19%, 5% per tax consolidation rules) and correct item categorization (goods vs veterinary medical services).

---

## 3. AI Agent, Copilot & Inference Standards

- **Inference Models:**
  - Use `configuredModel()` or inference proxy with Vercel AI SDK (`generateText`).
- **Direct Storage Access:**
  - Medical files are read directly from object storage via `readPrimaryObject(file.fileKey)` from `@/lib/s3`. Never perform HTTP self-fetch loops against `/api/files/...`.
- **Confidence Score Calibration:**
  - Modules expose calibrated confidence scores in 3 tiers via `ConfidenceScoreBadge`:
    - High (`>= 0.92`): Green badge — safe for rapid verification.
    - Medium (`0.75 – 0.91`): Amber badge — manual review recommended.
    - Low (`< 0.75`): Red badge — mandatory line-by-line review.
- **Human-in-the-Loop Confirmation:**
  - All Copilot entries pass through `ClinicalDiffConfirmModal` showing side-by-side original vs proposed values before committing.
- **GDPR 24-Hour Voice Purge:**
  - Raw audio files used for voice transcription must be deleted within 24 hours.

---

## 4. Autopilot, CRM & Reputation Governance

- **Durable Event Bus (`ext_automation_events`):**
  - Core triggers: `visit_completed`, `appointment_no_show`, `appointment_booked`, `vaccine_due`, `surgery_completed`.
  - Unique `dedupeKey` and background worker execution.
- **5 Canonical Customer Journeys:**
  1. `welcome_new_client` (onboarding + welcome + 7-day feedback)
  2. `post_visit_followup` (thank you + 24h review ask)
  3. `vaccine_reminder_journey` (14d reminder + 3d countdown + overdue notice)
  4. `post_operative_care` (24h condition check + day 3 recovery + day 10 suture check)
  5. `patient_reactivation` (12-month recall for inactive pets)
- **12 Canonical CRM Segments (`ext_crm_segments`):**
  - Deterministic segmentation (`puppy_kitten`, `senior_pet`, `chronic_patient`, `vip_clients`, `churn_risk`, `unvaccinated_overdue`, `wellness_enrolled`, `dental_attention`, `post_op_recovery`, `frequent_flyer`, `weight_management`, `lapsed_inactive`) — the single canonical set implemented by `lib/autopilot/segmentation-engine.ts` (`CRM_SEGMENT_DEFINITIONS`) and seeded by `packages/db/seed-marketing.ts`.
- **OAuth Token Security (`ext_channel_accounts`):**
  - Tokens for Google Business Profile, Facebook, Instagram, and YouTube MUST be encrypted at rest and never exposed over tRPC APIs.
- **Reputation SLA & Reception Escalation:**
  - Incoming reviews track a 24h SLA. Negative reviews (`rating <= 2`) set `escalationStatus: "pending"` and route to staff tasks.
- **Unified Suppression Center (GDPR Art. 22):**
  - Suppressed messages logged to `ext_automation_suppression_log` with reason codes (`sympathy_gate`, `quiet_hours`, `sms_rate_limit`, `opt_out`, `frequency_cap`).
