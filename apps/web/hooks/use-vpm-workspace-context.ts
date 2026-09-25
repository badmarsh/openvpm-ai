"use client";

/**
 * Reactive VPM workspace context hook.
 *
 * Holds actor / patient / client / visit scope and exposes pure reducers
 * from `@/core/context` so every clinical surface reads the same truth.
 *
 * Spec: openvpm/context-flow · Sprint 24 Finalize VPM Context Layer.
 */

import { useCallback, useMemo, useState } from "react";
import {
  clearVpmClinicalScope,
  createEmptyVpmWorkspaceContext,
  hasVpmActivePatient,
  hasVpmPracticeScope,
  patchVpmWorkspace,
  setVpmActor,
  setVpmClient,
  setVpmPatient,
  setVpmPatientFromStatus,
  setVpmVisit,
  type VpmActorContext,
  type VpmClientContext,
  type VpmPatientContext,
  type VpmPatientStatus,
  type VpmVisitContextRef,
  type VpmWorkspaceContext,
} from "@/core/context";

export type UseVpmWorkspaceContextResult = {
  context: VpmWorkspaceContext;
  /** Replace the entire workspace context. */
  reset: (next?: VpmWorkspaceContext) => void;
  setActor: (actor: VpmActorContext | null) => void;
  setPatient: (patient: VpmPatientContext | null) => void;
  setPatientFromStatus: (
    input: {
      patientId: string;
      name?: string | null;
      species?: string | null;
      status: VpmPatientStatus;
      clientId?: string | null;
    } | null,
  ) => void;
  setClient: (client: VpmClientContext | null) => void;
  setVisit: (visit: VpmVisitContextRef | null) => void;
  clearClinicalScope: () => void;
  patch: (patch: {
    actor?: VpmActorContext | null;
    patient?: VpmPatientContext | null;
    client?: VpmClientContext | null;
    visit?: VpmVisitContextRef | null;
  }) => void;
  hasPracticeScope: boolean;
  hasActivePatient: boolean;
  /** Convenience: deceased flag from current patient slice. */
  isPatientDeceased: boolean;
};

/**
 * Local reactive workspace context. Pass `initial` when hydrating from
 * a route param / server payload. Does not talk to the network.
 */
export function useVpmWorkspaceContext(
  initial?: VpmWorkspaceContext | null,
): UseVpmWorkspaceContextResult {
  const [context, setContext] = useState<VpmWorkspaceContext>(
    () => initial ?? createEmptyVpmWorkspaceContext(),
  );

  const reset = useCallback((next?: VpmWorkspaceContext) => {
    setContext(next ?? createEmptyVpmWorkspaceContext());
  }, []);

  const handleSetActor = useCallback((actor: VpmActorContext | null) => {
    setContext((prev) => setVpmActor(prev, actor));
  }, []);

  const handleSetPatient = useCallback((patient: VpmPatientContext | null) => {
    setContext((prev) => setVpmPatient(prev, patient));
  }, []);

  const handleSetPatientFromStatus = useCallback(
    (
      input: {
        patientId: string;
        name?: string | null;
        species?: string | null;
        status: VpmPatientStatus;
        clientId?: string | null;
      } | null,
    ) => {
      setContext((prev) => setVpmPatientFromStatus(prev, input));
    },
    [],
  );

  const handleSetClient = useCallback((client: VpmClientContext | null) => {
    setContext((prev) => setVpmClient(prev, client));
  }, []);

  const handleSetVisit = useCallback((visit: VpmVisitContextRef | null) => {
    setContext((prev) => setVpmVisit(prev, visit));
  }, []);

  const handleClearClinicalScope = useCallback(() => {
    setContext((prev) => clearVpmClinicalScope(prev));
  }, []);

  const handlePatch = useCallback(
    (patch: {
      actor?: VpmActorContext | null;
      patient?: VpmPatientContext | null;
      client?: VpmClientContext | null;
      visit?: VpmVisitContextRef | null;
    }) => {
      setContext((prev) => patchVpmWorkspace(prev, patch));
    },
    [],
  );

  return useMemo(
    () => ({
      context,
      reset,
      setActor: handleSetActor,
      setPatient: handleSetPatient,
      setPatientFromStatus: handleSetPatientFromStatus,
      setClient: handleSetClient,
      setVisit: handleSetVisit,
      clearClinicalScope: handleClearClinicalScope,
      patch: handlePatch,
      hasPracticeScope: hasVpmPracticeScope(context),
      hasActivePatient: hasVpmActivePatient(context),
      isPatientDeceased: context.patient?.isDeceased === true,
    }),
    [
      context,
      reset,
      handleSetActor,
      handleSetPatient,
      handleSetPatientFromStatus,
      handleSetClient,
      handleSetVisit,
      handleClearClinicalScope,
      handlePatch,
    ],
  );
}
