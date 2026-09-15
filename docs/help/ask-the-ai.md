# Ask the AI About a Pet

Stop digging through charts. Just ask.

## How it works

Open **Agent** and type a question in plain words, like:

- "Which pets are overdue for vaccines?"
- "When was Biscuit's last visit?"
- "Which invoices are still unpaid this month?"

Press send. The AI reads your charts so you do not have to, and answers with
your clinic's real data. It only sees your practice's data, never anyone
else's.

## What it is good at

- Finding pets that need something: overdue shots, missed rechecks.
- Pulling up a pet's history without clicking through tabs.
- Answering questions about your day, your bills, and your records.

## A note on trust

The AI helper reads your data to answer questions. It does not write records
on its own. When it helps draft something, like a visit note, a person always
reviews and saves it.

## If the AI helper is off

Your AI helper turns on once your workspace key is set. On OpenVPM Cloud it
is ready out of the box. Self-hosting? Add your AI key in the environment
settings and the Agent page lights up.

## See it with your own data

Open **Settings**, click **Guides**, and pick "Ask the AI about a pet." It
takes about 1 minute.

---

## Enabling write operations

By default, the AI agent answers questions and drafts content — it does not
write to your records. Write operations (booking appointments, creating
prescription drafts, updating patient data) require explicit opt-in.

To enable write operations: go to **Settings → Agent** and turn on
**Allow agent write tools**. This setting is available to Admin and
Veterinarian roles only. Once enabled, the agent will confirm the action
and show you exactly what it intends to write before committing anything.

The agent **cannot**: finalise or sign clinical records, void invoices,
issue e-Kasa receipts, or modify controlled substance entries — those
actions always require a human.

---

## Clinical content review

When the AI helps draft a SOAP note, discharge summary, or prescription, the
draft is shown to you for review — it is **not** saved automatically.

You review the draft in the **Clinical Review** confirmation screen, which
shows a side-by-side comparison of the AI's proposal and the current record.
Only after you click **Confirm & Save** is anything written to the patient's
permanent medical record.

> ⚠️ **Liability disclaimer**: AI-generated clinical content is a drafting
> aid only. The attending veterinarian is legally responsible for all content
> saved to the medical record under Zákon č. 39/2007 Z. z. Do not save an
> AI draft you have not reviewed and verified.

---

## Drug safety checker limitations

The dosing calculator and AI drug references use a built-in formulary and
a multimodal AI model (`configuredModel()`). They are clinical decision
support tools, not a substitute for professional judgment.

Limitations:
- The formulary covers common veterinary drugs but is not exhaustive
- The AI cannot access real-time drug databases or current SPC documents
- Controlled substance dosing is **never** prefilled by the AI — all entries
  are manual
- Species-specific toxicity guards (e.g. paracetamol for cats) are built in,
  but unusual presentations may not be caught

Always verify any AI drug suggestion against the product's official Summary
of Product Characteristics (SPC) and your clinical judgment.

---

## Marketing content — billing & usage caps

AI-generated marketing content (social media posts, client emails, handouts)
uses model inference credits. On OpenVPM Cloud, usage is metered against
your plan's AI credit allowance. Usage and remaining credits are shown in
**Settings → Subscription**.

Any AI-generated content containing clinical claims must be approved by a
licensed veterinarian before publishing. The system enforces this review.

---

## Voice dictation — audio retention policy

When you dictate a SOAP note or encounter using the voice scribe feature,
the raw audio file is uploaded temporarily for transcription. OpenVPM's
policy under GDPR Article 5(1)(e):

- Raw audio files are **scheduled for automatic deletion within 24 hours**
  of upload
- Deletion is executed by the system's automated cron process
- Only the transcription text is retained long-term (as part of the
  SOAP draft)
- Audio is never shared with third parties for purposes other than
  transcription

You can verify the deletion schedule in **Settings → Data Retention**.

---

## Statutory data entry accuracy

The AI may suggest values for KVEPIS fields, withdrawal periods, and
statutory register entries based on context in the patient record. These
suggestions are **not legally binding**.

Requirements:
- KVEPIS entries must reflect accurate, verified clinical data — errors
  in submitted XML are your practice's legal responsibility
- Withdrawal period entries must match the product's official SPC — the AI
  suggestion is a starting point only
- All statutory entries require manual review and confirmation by the
  attending veterinarian before submission

The AI is a drafting aid for statutory data. The veterinarian signs off.

