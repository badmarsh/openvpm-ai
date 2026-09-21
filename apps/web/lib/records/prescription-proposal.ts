import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { patients, prescriptions } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { assertAgentRole } from "@/lib/authorization";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import {
  ClinicianConfirmationError,
  consumeClinicianConfirmation,
  issueClinicianConfirmation,
} from "@/lib/ai/clinician-confirmation";
import { appendAiAuditEvent } from "@/lib/ai/audit-ledger";

/**
 * Two-phase prescription flow for AI/agent surfaces.
 *
 * Clinical safety contract (see docs/confirmation-protocol.md):
 *  1. The AI (agent tool `create_prescription`) may only PREPARE a proposal.
 *     It never writes to `prescriptions` — not even as a draft.
 *  2. Preparing binds a one-time confirmation envelope to a pre-generated
 *     prescription id plus the SHA-256 hash of the exact proposed content.
 *  3. Only a veterinarian/admin confirming the proposal in the UI can create
 *     the prescription (`agent.savePrescription`), and only by consuming that
 *     envelope in the same transaction as the INSERT.
 *  4. Controlled substances (OPL, Zákon č. 362/2011 Z. z.) can never be
 *     prescribed through the agent — zero AI prefill stays absolute.
 *
 * Server error messages stay in English/Slovak per Skill §2; user-facing
 * localization happens on the client via useI18n().
 */

export const PRESCRIPTION_CONFIRMATION_ACTION_TYPE = "prescription_create";
export const PRESCRIPTION_CONFIRMATION_ENTITY_TYPE = "prescription";
export const PRESCRIPTION_CONFIRMATION_TTL_SECONDS = 900;
export const PRESCRIPTION_PROPOSAL_STATUS = "pending_confirmation";

export const CONTROLLED_SUBSTANCE_AGENT_BLOCKED_MESSAGE =
  "Kontrolované látky (OPL) nie je možné predpísať cez AI agenta. Použite predpisový formulár s nulovým AI predplnením. / Controlled substances cannot be prescribed through the AI agent. Use the clinician prescribing screen instead.";

export class PrescriptionProposalError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "PRECONDITION_FAILED"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "PrescriptionProposalError";
  }
}

export interface AgentPrescriptionDraft {
  patientId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions?: string | null;
  startDate: string;
}

export interface PrescriptionProposal {
  status: typeof PRESCRIPTION_PROPOSAL_STATUS;
  prescriptionId: string;
  confirmationId: string;
  expiresAt: Date;
  requiresClinicianReview: true;
  draft: AgentPrescriptionDraft;
}

/**
 * Controlled substances are never written from an AI/agent surface: the
 * prescribing clinician must go through the zero-prefill screen where the
 * substance, quantity and witness rules are recorded.
 */
export function assertMedicationAllowedThroughAgent(medicationName: string): void {
  if (isControlledSubstanceName(medicationName)) {
    throw new PrescriptionProposalError(
      "FORBIDDEN",
      CONTROLLED_SUBSTANCE_AGENT_BLOCKED_MESSAGE,
    );
  }
}

/**
 * Canonical content hash of a proposed prescription. The same payload must be
 * presented for confirmation and later submitted for creation, otherwise the
 * envelope consumption fails with PAYLOAD_MISMATCH (fail-closed).
 */
export function prescriptionDraftHash(
  prescriptionId: string,
  draft: AgentPrescriptionDraft,
): string {
  const canonical = JSON.stringify({
    prescriptionId,
    patientId: draft.patientId,
    medicationName: draft.medicationName,
    dosage: draft.dosage,
    frequency: draft.frequency,
    instructions: draft.instructions ?? null,
    startDate: draft.startDate,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function assertClinicianActor(actorRole: string): void {
  assertAgentRole(
    { userRole: actorRole },
    ["veterinarian", "admin"],
    "Recepty môže vystavovať výhradne veterinárny lekár alebo administrátor. / Prescriptions may only be created by veterinarians and admins.",
  );
}

async function assertActivePatient(
  db: Database,
  practiceId: string,
  patientId: string,
): Promise<void> {
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, practiceId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);

  if (!patient) {
    throw new PrescriptionProposalError("NOT_FOUND", "Patient not found");
  }
}

/**
 * Prepares (but never persists) a prescription proposal. Writes only a PENDING
 * confirmation envelope bound to the proposed content.
 */
export async function preparePrescriptionProposal(
  db: Database,
  params: {
    practiceId: string;
    actorId: string;
    actorRole: string;
    draft: AgentPrescriptionDraft;
  },
): Promise<PrescriptionProposal> {
  assertClinicianActor(params.actorRole);
  assertMedicationAllowedThroughAgent(params.draft.medicationName);
  await assertActivePatient(db, params.practiceId, params.draft.patientId);

  const prescriptionId = randomUUID();
  const draftHash = prescriptionDraftHash(prescriptionId, params.draft);

  const envelope = await issueClinicianConfirmation(db, {
    practiceId: params.practiceId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    actionType: PRESCRIPTION_CONFIRMATION_ACTION_TYPE,
    entityType: PRESCRIPTION_CONFIRMATION_ENTITY_TYPE,
    entityId: prescriptionId,
    expectedRevision: 0,
    originalDraftHash: draftHash,
    confirmedContentHash: draftHash,
    ttlSeconds: PRESCRIPTION_CONFIRMATION_TTL_SECONDS,
    correlationId: "agent:create_prescription",
  });

  return {
    status: PRESCRIPTION_PROPOSAL_STATUS,
    prescriptionId,
    confirmationId: envelope.id,
    expiresAt: envelope.expiresAt,
    requiresClinicianReview: true,
    draft: params.draft,
  };
}

function mapConfirmationError(error: ClinicianConfirmationError): PrescriptionProposalError {
  switch (error.code) {
    case "NOT_FOUND":
      return new PrescriptionProposalError("NOT_FOUND", error.message);
    case "EXPIRED":
    case "ALREADY_CONSUMED":
    case "REVISION_MISMATCH":
      return new PrescriptionProposalError("CONFLICT", error.message);
    default:
      return new PrescriptionProposalError("PRECONDITION_FAILED", error.message);
  }
}

/**
 * Creates the prescription after a clinician explicitly confirmed the proposal.
 * Consumes the one-time envelope and writes the audit event in the caller's
 * transaction, so a consumed envelope can never exist without its prescription
 * and vice versa.
 */
export async function createConfirmedPrescription(
  db: Database,
  params: {
    practiceId: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    confirmationId: string;
    prescriptionId: string;
    draft: AgentPrescriptionDraft;
  },
): Promise<typeof prescriptions.$inferSelect> {
  assertClinicianActor(params.actorRole);
  // Defence in depth: re-screen at write time, even though prepare screened too.
  assertMedicationAllowedThroughAgent(params.draft.medicationName);
  await assertActivePatient(db, params.practiceId, params.draft.patientId);

  const draftHash = prescriptionDraftHash(params.prescriptionId, params.draft);

  try {
    await consumeClinicianConfirmation(db, {
      confirmationId: params.confirmationId,
      practiceId: params.practiceId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      actionType: PRESCRIPTION_CONFIRMATION_ACTION_TYPE,
      entityType: PRESCRIPTION_CONFIRMATION_ENTITY_TYPE,
      entityId: params.prescriptionId,
      expectedRevision: 0,
      originalDraftHash: draftHash,
      confirmedContentHash: draftHash,
    });
  } catch (error) {
    if (error instanceof ClinicianConfirmationError) {
      throw mapConfirmationError(error);
    }
    throw error;
  }

  const [created] = await db
    .insert(prescriptions)
    .values({
      id: params.prescriptionId,
      practiceId: params.practiceId,
      patientId: params.draft.patientId,
      prescribedBy: params.actorId,
      medicationName: params.draft.medicationName,
      dosage: params.draft.dosage,
      frequency: params.draft.frequency,
      instructions: params.draft.instructions ?? null,
      startDate: params.draft.startDate,
      status: "active",
    })
    .returning();

  await appendAiAuditEvent(db, {
    practiceId: params.practiceId,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    entityType: "prescription",
    entityId: params.prescriptionId,
    actionType: PRESCRIPTION_CONFIRMATION_ACTION_TYPE,
    originalDraftHash: draftHash,
    confirmedContentHash: draftHash,
    wasEditedByClinician: false,
  });

  return created!;
}
