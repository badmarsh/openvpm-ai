/**
 * VPM Context Layer — Sympathy Gate.
 *
 * When a patient is deceased / euthanized, automated outreach
 * (vaccination reminders, care reminders, review asks, marketing) must
 * be suppressed immediately. Pure evaluation — callers own persistence
 * (e.g. `ext_automation_suppression_log`, care reminder dismissal).
 *
 * Spec: SKILL.md §3 · openvpm/context-flow.
 */

import type {
  VpmOutreachKind,
  VpmPatientContext,
  VpmPatientStatus,
  VpmSympathyDecision,
} from "./types";

/** i18n key explaining why outreach was suppressed. */
export const VPM_SYMPATHY_SUPPRESS_REASON_KEY =
  "vpmContext.gates.sympathyOutreachSuppressed";

/** Statuses that activate the Sympathy Gate. */
const DECEASED_STATUSES = new Set<string>(["deceased", "euthanized", "euthanised"]);

/**
 * Returns true when the patient status represents death / euthanasia.
 * Accepts raw status strings from the patients table or context layer.
 */
export function isVpmPatientDeceased(
  status: VpmPatientStatus | null | undefined,
): boolean {
  if (!status) return false;
  return DECEASED_STATUSES.has(String(status).trim().toLowerCase());
}

/**
 * Build a patient context slice with the deceased flag derived from status.
 */
export function buildVpmPatientContext(input: {
  patientId: string;
  name?: string | null;
  species?: string | null;
  status: VpmPatientStatus;
  clientId?: string | null;
}): VpmPatientContext {
  return {
    patientId: input.patientId,
    name: input.name ?? null,
    species: input.species ?? null,
    status: input.status,
    clientId: input.clientId ?? null,
    isDeceased: isVpmPatientDeceased(input.status),
  };
}

/**
 * Evaluate whether automated outreach of `outreachKind` must be suppressed
 * for the given patient. Always suppresses when deceased — no allow-list
 * bypass for marketing or reminders (SKILL.md §3 unconditional).
 */
export function evaluateSympathyGate(input: {
  patientStatus?: VpmPatientStatus | null;
  patient?: VpmPatientContext | null;
  patientId?: string | null;
  outreachKind: VpmOutreachKind;
}): VpmSympathyDecision {
  const deceased =
    input.patient?.isDeceased === true ||
    isVpmPatientDeceased(input.patientStatus) ||
    isVpmPatientDeceased(input.patient?.status);

  if (!deceased) {
    return {
      suppress: false,
      reasonKey: null,
      patientId: input.patient?.patientId ?? input.patientId ?? null,
      outreachKind: input.outreachKind,
    };
  }

  return {
    suppress: true,
    reasonKey: VPM_SYMPATHY_SUPPRESS_REASON_KEY,
    patientId: input.patient?.patientId ?? input.patientId ?? null,
    outreachKind: input.outreachKind,
  };
}

/**
 * Convenience: should this automated reminder fire?
 * Inverse of evaluateSympathyGate.suppress.
 */
export function maySendAutomatedOutreach(input: {
  patientStatus?: VpmPatientStatus | null;
  patient?: VpmPatientContext | null;
  outreachKind: VpmOutreachKind;
}): boolean {
  return !evaluateSympathyGate(input).suppress;
}

/** Outreach kinds that are always blocked under Sympathy Gate. */
export const VPM_SYMPATHY_BLOCKED_OUTREACH: readonly VpmOutreachKind[] = [
  "vaccination_reminder",
  "care_reminder",
  "review_request",
  "marketing",
  "postop_check",
  "thank_you",
] as const;
