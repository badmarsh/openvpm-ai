"use client";

/**
 * Reactive hook: evaluate VPM AI safety gates for a proposed clinical write.
 *
 * - Zákon 39/2007 Z. z.: AI stays `draft` until clinician confirmation.
 * - Zákon 139/1998 Z. z.: ZERO AI prefill for controlled substances.
 * - Sympathy Gate: flags deceased patients for outreach suppression.
 *
 * Spec: openvpm/context-flow · Sprint 24.
 */

import { useMemo } from "react";
import {
  applyZeroAiPrefillForControlledSubstance,
  evaluateVpmAiSafety,
  isVpmControlledSubstanceName,
  stripControlledSubstancePrefills,
  type EvaluateVpmAiSafetyInput,
  type VpmAiSafetyDecision,
  type VpmPatientContext,
  type VpmPatientStatus,
} from "@/core/context";

export type UseVpmAiSafetyInput = {
  requestedStatus?: EvaluateVpmAiSafetyInput["requestedStatus"];
  clinicianConfirmed?: unknown;
  /** Free-text fields the model proposed (plan, medications, SOAP sections…). */
  proposedTexts?: Array<string | null | undefined>;
  patientStatus?: VpmPatientStatus | null;
  patient?: VpmPatientContext | null;
};

export type UseVpmAiSafetyResult = VpmAiSafetyDecision & {
  /**
   * Apply ZERO AI prefill: returns null when the label is a controlled
   * substance so the UI shows ShieldAlert + empty manual field.
   */
  sanitizePrefill: <T>(proposed: T, drugNameOrText: string | null | undefined) => T | null;
  /** Drop controlled-substance lines from an AI medication proposal list. */
  stripControlledPrefills: typeof stripControlledSubstancePrefills;
  /** Direct name check (ShieldAlert condition). */
  isControlledSubstance: (name: string) => boolean;
  /** True when UI must show the controlled-substance ShieldAlert. */
  showControlledSubstanceShield: boolean;
  /** True when UI must keep the record badge in "AI draft" state. */
  showAiDraftBadge: boolean;
};

export function useVpmAiSafety(input: UseVpmAiSafetyInput): UseVpmAiSafetyResult {
  const {
    requestedStatus,
    clinicianConfirmed,
    proposedTexts,
    patientStatus,
    patient,
  } = input;

  const decision = useMemo(
    () =>
      evaluateVpmAiSafety({
        requestedStatus,
        clinicianConfirmed,
        proposedTexts,
        patientStatus,
        patient,
      }),
    [requestedStatus, clinicianConfirmed, proposedTexts, patientStatus, patient],
  );

  return useMemo(
    () => ({
      ...decision,
      sanitizePrefill: applyZeroAiPrefillForControlledSubstance,
      stripControlledPrefills: stripControlledSubstancePrefills,
      isControlledSubstance: isVpmControlledSubstanceName,
      showControlledSubstanceShield: decision.blocksControlledSubstancePrefill,
      showAiDraftBadge:
        decision.recordStatus === "draft" || !decision.clinicianConfirmed,
    }),
    [decision],
  );
}
