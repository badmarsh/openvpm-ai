/**
 * VPM Context Layer — shared domain types.
 *
 * Cross-module clinical / administrative context propagated through
 * reactive hooks (`apps/web/hooks/*`). Pure types only — no React, no DB.
 *
 * Spec alignment: openvpm/context-flow (Sprint 24 Finalize VPM Context Layer).
 */

/** Patient lifecycle status used by clinical safety gates. */
export type VpmPatientStatus = "active" | "inactive" | "deceased" | string;

/** AI clinical record lifecycle (Zákon 39/2007 Z. z. — human-in-the-loop). */
export type VpmAiRecordStatus = "draft" | "finalized";

/** Staff role within a practice (mirrors session user.role). */
export type VpmUserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer"
  | string;

/** Identity of the signed-in clinician / staff member. */
export type VpmActorContext = {
  userId: string;
  practiceId: string;
  role: VpmUserRole;
  displayName?: string | null;
};

/** Active patient scope for clinical surfaces. */
export type VpmPatientContext = {
  patientId: string;
  name?: string | null;
  species?: string | null;
  status: VpmPatientStatus;
  clientId?: string | null;
  /** True when status is deceased / euthanized — triggers Sympathy Gate. */
  isDeceased: boolean;
};

/** Optional client (owner) scope. */
export type VpmClientContext = {
  clientId: string;
  displayName?: string | null;
};

/** Linked appointment / visit scope (feeds AI visit context). */
export type VpmVisitContextRef = {
  appointmentId?: string | null;
  encounterId?: string | null;
  typeName?: string | null;
  notes?: string | null;
};

/**
 * Full VPM workspace context propagated across modules.
 * Modules read slices via dedicated hooks; they never invent their own
 * patient/status truth.
 */
export type VpmWorkspaceContext = {
  actor: VpmActorContext | null;
  patient: VpmPatientContext | null;
  client: VpmClientContext | null;
  visit: VpmVisitContextRef | null;
  /** ISO timestamp of last reactive update. */
  updatedAt: string | null;
};

export const EMPTY_VPM_WORKSPACE_CONTEXT: VpmWorkspaceContext = {
  actor: null,
  patient: null,
  client: null,
  visit: null,
  updatedAt: null,
};

/** Outcome of evaluating clinical AI safety gates for a proposed write. */
export type VpmAiSafetyDecision = {
  /** Final status the AI surface may write. Always "draft" without clinician sign-off. */
  recordStatus: VpmAiRecordStatus;
  /** True when the clinician has explicitly confirmed (HITL). */
  clinicianConfirmed: boolean;
  /** True when any field matched a controlled substance — ZERO AI prefill. */
  blocksControlledSubstancePrefill: boolean;
  /** Controlled substance names detected in the proposed content. */
  controlledSubstanceHits: string[];
  /** True when patient is deceased — automated outreach must be suppressed. */
  sympathyGateActive: boolean;
  /** Human-readable reason keys (i18n) explaining blocks. */
  reasonKeys: string[];
  /** True when the write is allowed to proceed (as draft or finalized). */
  allowed: boolean;
};

/** Automated outreach kinds suppressed by the Sympathy Gate. */
export type VpmOutreachKind =
  | "vaccination_reminder"
  | "care_reminder"
  | "review_request"
  | "marketing"
  | "postop_check"
  | "thank_you"
  | "other";

export type VpmSympathyDecision = {
  suppress: boolean;
  reasonKey: string | null;
  patientId: string | null;
  outreachKind: VpmOutreachKind;
};
