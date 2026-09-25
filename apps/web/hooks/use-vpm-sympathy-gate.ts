"use client";

/**
 * Reactive Sympathy Gate hook.
 *
 * Suppresses automated outreach when the patient is deceased / euthanized.
 * Pure evaluation is in `@/core/context`; this hook memoises the decision
 * for UI banners and send-path guards.
 *
 * Spec: SKILL.md §3 · openvpm/context-flow · Sprint 24.
 */

import { useMemo } from "react";
import {
  evaluateSympathyGate,
  isVpmPatientDeceased,
  maySendAutomatedOutreach,
  VPM_SYMPATHY_BLOCKED_OUTREACH,
  VPM_SYMPATHY_SUPPRESS_REASON_KEY,
  type VpmOutreachKind,
  type VpmPatientContext,
  type VpmPatientStatus,
  type VpmSympathyDecision,
} from "@/core/context";

export type UseVpmSympathyGateInput = {
  patientStatus?: VpmPatientStatus | null;
  patient?: VpmPatientContext | null;
  patientId?: string | null;
  /** Defaults to `care_reminder` — the most common automated path. */
  outreachKind?: VpmOutreachKind;
};

export type UseVpmSympathyGateResult = VpmSympathyDecision & {
  /** True when patient status is deceased / euthanized. */
  isDeceased: boolean;
  /** Inverse of suppress — safe to enqueue automated message. */
  maySend: boolean;
  /** i18n key for the suppression banner (stable). */
  suppressReasonKey: typeof VPM_SYMPATHY_SUPPRESS_REASON_KEY;
  /** All outreach kinds blocked under the gate (reference list). */
  blockedOutreachKinds: readonly VpmOutreachKind[];
  /** Evaluate a different outreach kind without recreating the hook. */
  evaluate: (kind: VpmOutreachKind) => VpmSympathyDecision;
};

export function useVpmSympathyGate(
  input: UseVpmSympathyGateInput,
): UseVpmSympathyGateResult {
  const {
    patientStatus,
    patient,
    patientId,
    outreachKind = "care_reminder",
  } = input;

  const isDeceased = useMemo(
    () =>
      patient?.isDeceased === true ||
      isVpmPatientDeceased(patientStatus) ||
      isVpmPatientDeceased(patient?.status),
    [patient, patientStatus],
  );

  const decision = useMemo(
    () =>
      evaluateSympathyGate({
        patientStatus,
        patient,
        patientId,
        outreachKind,
      }),
    [patientStatus, patient, patientId, outreachKind],
  );

  const evaluate = useMemo(
    () => (kind: VpmOutreachKind) =>
      evaluateSympathyGate({
        patientStatus,
        patient,
        patientId,
        outreachKind: kind,
      }),
    [patientStatus, patient, patientId],
  );

  const maySend = useMemo(
    () =>
      maySendAutomatedOutreach({
        patientStatus,
        patient,
        outreachKind,
      }),
    [patientStatus, patient, outreachKind],
  );

  return useMemo(
    () => ({
      ...decision,
      isDeceased,
      maySend,
      suppressReasonKey: VPM_SYMPATHY_SUPPRESS_REASON_KEY,
      blockedOutreachKinds: VPM_SYMPATHY_BLOCKED_OUTREACH,
      evaluate,
    }),
    [decision, isDeceased, maySend, evaluate],
  );
}
