/**
 * VPM Context Layer — workspace context builders & reducers.
 *
 * Pure helpers that assemble / patch `VpmWorkspaceContext`. React hooks
 * hold the reactive state; these functions keep updates deterministic and
 * testable without a renderer.
 */

import { buildVpmPatientContext } from "./sympathy-gate";
import {
  EMPTY_VPM_WORKSPACE_CONTEXT,
  type VpmActorContext,
  type VpmClientContext,
  type VpmPatientContext,
  type VpmPatientStatus,
  type VpmVisitContextRef,
  type VpmWorkspaceContext,
} from "./types";

export { EMPTY_VPM_WORKSPACE_CONTEXT };

function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyVpmWorkspaceContext(): VpmWorkspaceContext {
  return { ...EMPTY_VPM_WORKSPACE_CONTEXT, updatedAt: nowIso() };
}

export function setVpmActor(
  ctx: VpmWorkspaceContext,
  actor: VpmActorContext | null,
): VpmWorkspaceContext {
  return { ...ctx, actor, updatedAt: nowIso() };
}

export function setVpmPatient(
  ctx: VpmWorkspaceContext,
  patient: VpmPatientContext | null,
): VpmWorkspaceContext {
  return { ...ctx, patient, updatedAt: nowIso() };
}

export function setVpmPatientFromStatus(
  ctx: VpmWorkspaceContext,
  input: {
    patientId: string;
    name?: string | null;
    species?: string | null;
    status: VpmPatientStatus;
    clientId?: string | null;
  } | null,
): VpmWorkspaceContext {
  if (!input) return setVpmPatient(ctx, null);
  return setVpmPatient(ctx, buildVpmPatientContext(input));
}

export function setVpmClient(
  ctx: VpmWorkspaceContext,
  client: VpmClientContext | null,
): VpmWorkspaceContext {
  return { ...ctx, client, updatedAt: nowIso() };
}

export function setVpmVisit(
  ctx: VpmWorkspaceContext,
  visit: VpmVisitContextRef | null,
): VpmWorkspaceContext {
  return { ...ctx, visit, updatedAt: nowIso() };
}

/**
 * Clear patient-scoped slices (patient + visit) while keeping actor/client.
 * Used when navigating away from a clinical chart.
 */
export function clearVpmClinicalScope(
  ctx: VpmWorkspaceContext,
): VpmWorkspaceContext {
  return {
    ...ctx,
    patient: null,
    visit: null,
    updatedAt: nowIso(),
  };
}

/**
 * True when the workspace has an authenticated actor with practice scope.
 */
export function hasVpmPracticeScope(ctx: VpmWorkspaceContext): boolean {
  return Boolean(ctx.actor?.userId && ctx.actor?.practiceId);
}

/**
 * True when a living (non-deceased) patient is in scope.
 */
export function hasVpmActivePatient(ctx: VpmWorkspaceContext): boolean {
  return Boolean(ctx.patient?.patientId && !ctx.patient.isDeceased);
}

/**
 * Merge a partial patch into the workspace. `undefined` fields are ignored;
 * explicit `null` clears the slice.
 */
export function patchVpmWorkspace(
  ctx: VpmWorkspaceContext,
  patch: {
    actor?: VpmActorContext | null;
    patient?: VpmPatientContext | null;
    client?: VpmClientContext | null;
    visit?: VpmVisitContextRef | null;
  },
): VpmWorkspaceContext {
  return {
    actor: patch.actor !== undefined ? patch.actor : ctx.actor,
    patient: patch.patient !== undefined ? patch.patient : ctx.patient,
    client: patch.client !== undefined ? patch.client : ctx.client,
    visit: patch.visit !== undefined ? patch.visit : ctx.visit,
    updatedAt: nowIso(),
  };
}
