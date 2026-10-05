---
name: clinical-safety-review
description: Clinical safety review checklist for veterinary law, sympathy gates, controlled substances, and diff confirmation.
---

# Clinical Safety Review Skill

Checklist and guardrails for reviewing any changes that affect clinical records, AI assistance, marketing automations, or prescriptions.

## Review Gates
1. **Human-in-the-Loop (Zákon 39/2007 Z. z. §3):**
   - Verify that AI generated clinical drafts remain in `draft` status.
   - Confirm changes must pass through `ClinicalDiffConfirmModal` before signing.
2. **Controlled Substances Gate (Zákon 139/1998 Z. z.):**
   - Ensure zero AI prefill for opiates, ketamine, propofol, butorphanol, fentanyl.
   - Must require manual entry and licensed vet authentication.
3. **Sympathy Gate:**
   - Verify deceased/euthanized patients have automated outreach suppressed.
   - Check that open care reminders are dismissed and suppression is logged to `ext_automation_suppression_log`.
4. **Medical Imaging:**
   - Imaging uploads must use category `"imaging"` and never overwrite `patient.photoUrl`.
5. **Subagent Execution:**
   - For complex clinical changes, invoke the `.claude/agents/clinical-reviewer.md` reviewer agent.
