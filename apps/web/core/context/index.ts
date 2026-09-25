/**
 * VPM Context Layer — public barrel (openvpm/context-flow).
 *
 * Import from `@/core/context` in hooks and (sparingly) feature modules.
 * Keeps clinical safety gates and workspace types in one place so
 * cross-module behaviour cannot drift.
 */

export type {
  VpmActorContext,
  VpmAiRecordStatus,
  VpmAiSafetyDecision,
  VpmClientContext,
  VpmOutreachKind,
  VpmPatientContext,
  VpmPatientStatus,
  VpmSympathyDecision,
  VpmUserRole,
  VpmVisitContextRef,
  VpmWorkspaceContext,
} from "./types";

export { EMPTY_VPM_WORKSPACE_CONTEXT } from "./types";

export {
  VPM_CONTROLLED_SUBSTANCES_PATTERN_SOURCE,
  VPM_CONTROLLED_SUBSTANCES_REGEX,
  VPM_CONTROLLED_SUBSTANCE_BLOCK_REASON_KEY,
  normalizeDrugNameForMatch,
  isVpmControlledSubstanceName,
  detectControlledSubstancesInText,
  applyZeroAiPrefillForControlledSubstance,
  stripControlledSubstancePrefills,
} from "./controlled-substances";

export {
  VPM_SYMPATHY_SUPPRESS_REASON_KEY,
  VPM_SYMPATHY_BLOCKED_OUTREACH,
  isVpmPatientDeceased,
  buildVpmPatientContext,
  evaluateSympathyGate,
  maySendAutomatedOutreach,
} from "./sympathy-gate";

export {
  VPM_AI_DRAFT_STATUS,
  VPM_AI_FINALIZED_STATUS,
  VPM_CLINICIAN_CONFIRMATION_REQUIRED_KEY,
  VPM_AI_DRAFT_ONLY_KEY,
  isVpmClinicianConfirmed,
  resolveVpmAiRecordStatus,
  evaluateVpmAiSafety,
  assertVpmClinicianConfirmed,
  assertVpmAiMayWriteRecord,
  type EvaluateVpmAiSafetyInput,
} from "./ai-safety";

export {
  createEmptyVpmWorkspaceContext,
  setVpmActor,
  setVpmPatient,
  setVpmPatientFromStatus,
  setVpmClient,
  setVpmVisit,
  clearVpmClinicalScope,
  hasVpmPracticeScope,
  hasVpmActivePatient,
  patchVpmWorkspace,
} from "./workspace";
