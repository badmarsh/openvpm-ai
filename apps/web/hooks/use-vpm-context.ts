"use client";

/**
 * Composite VPM context hook — workspace scope + AI safety + Sympathy Gate.
 *
 * Preferred entry point for clinical surfaces that need the full
 * openvpm/context-flow bundle in one call. Thin orchestration over the
 * dedicated hooks; no extra business rules live here.
 *
 * Spec: Sprint 24 Finalize VPM Context Layer.
 */

import { useMemo } from "react";
import type { VpmWorkspaceContext } from "@/core/context";
import {
  useVpmWorkspaceContext,
  type UseVpmWorkspaceContextResult,
} from "./use-vpm-workspace-context";
import {
  useVpmAiSafety,
  type UseVpmAiSafetyInput,
  type UseVpmAiSafetyResult,
} from "./use-vpm-ai-safety";
import {
  useVpmSympathyGate,
  type UseVpmSympathyGateResult,
} from "./use-vpm-sympathy-gate";

export type UseVpmContextOptions = {
  initialWorkspace?: VpmWorkspaceContext | null;
  /** AI proposal texts to scan for controlled substances / draft status. */
  proposedTexts?: UseVpmAiSafetyInput["proposedTexts"];
  clinicianConfirmed?: unknown;
  requestedStatus?: UseVpmAiSafetyInput["requestedStatus"];
  outreachKind?: Parameters<typeof useVpmSympathyGate>[0]["outreachKind"];
};

export type UseVpmContextResult = {
  workspace: UseVpmWorkspaceContextResult;
  aiSafety: UseVpmAiSafetyResult;
  sympathy: UseVpmSympathyGateResult;
};

/**
 * One-stop reactive context for VPM clinical modules.
 *
 * ```tsx
 * const { workspace, aiSafety, sympathy } = useVpmContext({
 *   proposedTexts: [planText],
 *   clinicianConfirmed: false,
 * });
 * // aiSafety.showAiDraftBadge → keep draft badge until vet signs
 * // aiSafety.showControlledSubstanceShield → ShieldAlert + manual entry
 * // sympathy.suppress → hide automated reminder CTAs
 * ```
 */
export function useVpmContext(
  options: UseVpmContextOptions = {},
): UseVpmContextResult {
  const workspace = useVpmWorkspaceContext(options.initialWorkspace);

  const patient = workspace.context.patient;
  const patientStatus = patient?.status ?? null;

  const aiSafety = useVpmAiSafety({
    requestedStatus: options.requestedStatus,
    clinicianConfirmed: options.clinicianConfirmed,
    proposedTexts: options.proposedTexts,
    patient,
    patientStatus,
  });

  const sympathy = useVpmSympathyGate({
    patient,
    patientStatus,
    patientId: patient?.patientId ?? null,
    outreachKind: options.outreachKind,
  });

  return useMemo(
    () => ({ workspace, aiSafety, sympathy }),
    [workspace, aiSafety, sympathy],
  );
}

export type {
  UseVpmWorkspaceContextResult,
  UseVpmAiSafetyResult,
  UseVpmSympathyGateResult,
};
