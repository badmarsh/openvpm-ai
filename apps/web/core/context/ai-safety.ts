/**
 * VPM Context Layer — AI clinical safety (Zákon 39/2007 Z. z.).
 *
 * AI proposals remain in `draft` until a licensed veterinarian explicitly
 * confirms. Controlled-substance fields never receive AI prefill.
 * Sympathy Gate flags deceased patients so callers suppress outreach.
 *
 * Pure functions — no React, no DB. Reactive hooks in `apps/web/hooks`
 * wrap these for UI consumption.
 */

import {
  detectControlledSubstancesInText,
  VPM_CONTROLLED_SUBSTANCE_BLOCK_REASON_KEY,
} from "./controlled-substances";
import {
  evaluateSympathyGate,
  isVpmPatientDeceased,
  VPM_SYMPATHY_SUPPRESS_REASON_KEY,
} from "./sympathy-gate";
import type {
  VpmAiRecordStatus,
  VpmAiSafetyDecision,
  VpmPatientContext,
  VpmPatientStatus,
} from "./types";

export const VPM_AI_DRAFT_STATUS: VpmAiRecordStatus = "draft";
export const VPM_AI_FINALIZED_STATUS: VpmAiRecordStatus = "finalized";

export const VPM_CLINICIAN_CONFIRMATION_REQUIRED_KEY =
  "vpmContext.gates.clinicianConfirmationRequired";

export const VPM_AI_DRAFT_ONLY_KEY = "vpmContext.gates.aiRemainsDraft";

/**
 * True when the clinician confirmation payload is an explicit opt-in.
 * Accepts `true` or a non-empty confirmation envelope `{ confirmationId }`.
 */
export function isVpmClinicianConfirmed(confirmed: unknown): boolean {
  if (confirmed === true) return true;
  if (
    typeof confirmed === "object" &&
    confirmed !== null &&
    "confirmationId" in confirmed &&
    typeof (confirmed as { confirmationId: unknown }).confirmationId ===
      "string" &&
    (confirmed as { confirmationId: string }).confirmationId.trim().length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve the only status AI may persist. Without clinician confirmation
 * the result is always `draft` — even if the caller requested `finalized`.
 */
export function resolveVpmAiRecordStatus(input: {
  requestedStatus?: VpmAiRecordStatus;
  clinicianConfirmed?: unknown;
}): VpmAiRecordStatus {
  if (input.requestedStatus !== VPM_AI_FINALIZED_STATUS) {
    return VPM_AI_DRAFT_STATUS;
  }
  return isVpmClinicianConfirmed(input.clinicianConfirmed)
    ? VPM_AI_FINALIZED_STATUS
    : VPM_AI_DRAFT_STATUS;
}

export type EvaluateVpmAiSafetyInput = {
  /** Requested write status (AI surfaces typically omit → draft). */
  requestedStatus?: VpmAiRecordStatus;
  /** Explicit clinician confirmation (literal true or envelope). */
  clinicianConfirmed?: unknown;
  /** Free-text / medication fields proposed by AI. */
  proposedTexts?: Array<string | null | undefined>;
  /** Patient status or full patient context for Sympathy Gate. */
  patientStatus?: VpmPatientStatus | null;
  patient?: VpmPatientContext | null;
};

/**
 * Single entry point for cross-module AI safety evaluation.
 *
 * Decision matrix:
 * 1. Controlled substances → block AI prefill (manual entry + ShieldAlert).
 * 2. No clinician confirmation → record stays `draft`.
 * 3. Deceased patient → sympathyGateActive (outreach suppression signal).
 * 4. Write is always "allowed" as draft; finalization requires confirmation.
 */
export function evaluateVpmAiSafety(
  input: EvaluateVpmAiSafetyInput,
): VpmAiSafetyDecision {
  const controlledSubstanceHits = detectControlledSubstancesInText(
    ...(input.proposedTexts ?? []),
  );
  const blocksControlledSubstancePrefill = controlledSubstanceHits.length > 0;

  const clinicianConfirmed = isVpmClinicianConfirmed(input.clinicianConfirmed);
  const recordStatus = resolveVpmAiRecordStatus({
    requestedStatus: input.requestedStatus,
    clinicianConfirmed: input.clinicianConfirmed,
  });

  const deceased =
    input.patient?.isDeceased === true ||
    isVpmPatientDeceased(input.patientStatus) ||
    isVpmPatientDeceased(input.patient?.status);

  const sympathy = evaluateSympathyGate({
    patient: input.patient,
    patientStatus: input.patientStatus,
    outreachKind: "other",
  });

  const reasonKeys: string[] = [];
  if (blocksControlledSubstancePrefill) {
    reasonKeys.push(VPM_CONTROLLED_SUBSTANCE_BLOCK_REASON_KEY);
  }
  if (!clinicianConfirmed) {
    reasonKeys.push(VPM_AI_DRAFT_ONLY_KEY);
    if (input.requestedStatus === VPM_AI_FINALIZED_STATUS) {
      reasonKeys.push(VPM_CLINICIAN_CONFIRMATION_REQUIRED_KEY);
    }
  }
  if (deceased || sympathy.suppress) {
    reasonKeys.push(VPM_SYMPATHY_SUPPRESS_REASON_KEY);
  }

  return {
    recordStatus,
    clinicianConfirmed,
    blocksControlledSubstancePrefill,
    controlledSubstanceHits,
    sympathyGateActive: deceased || sympathy.suppress,
    reasonKeys: Array.from(new Set(reasonKeys)),
    // AI may always persist a draft; finalization needs confirmation.
    // Controlled-substance *prefill* is blocked separately — the write of
    // blank/manual fields remains allowed.
    allowed: true,
  };
}

/**
 * Guard used by AI finalize paths. Throws a plain Error with a stable
 * English message (server-side); UI maps via useI18n.
 */
export function assertVpmClinicianConfirmed(confirmed: unknown): void {
  if (!isVpmClinicianConfirmed(confirmed)) {
    throw new Error(
      "A clinician must explicitly confirm AI-generated content before it can be finalized.",
    );
  }
}

/**
 * AI may only mutate open drafts — never overwrite a finalized clinical record.
 */
export function assertVpmAiMayWriteRecord(note: { status: string }): void {
  if (note.status !== VPM_AI_DRAFT_STATUS) {
    throw new Error(
      "AI output cannot modify a finalized clinical record. Add an addendum or replacement through the clinician workflow instead.",
    );
  }
}
