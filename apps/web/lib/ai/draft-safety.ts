import { z } from "zod";
import { createHash } from "node:crypto";

/**
 * Human-in-the-loop contract for every AI-assisted clinical surface.
 *
 * AI output (voice transcription, imaging evaluation, SOAP drafting, discharge
 * letters) may only ever become part of the legal medical record after a
 * clinician has explicitly confirmed it. This module centralises that rule so
 * routers cannot drift:
 *
 *  - `clinicianConfirmationInput` is a zod literal `true`. A request that omits
 *    it, or sends `false`, fails validation before any database work.
 *  - `AI_DRAFT_STATUS` is the only status an AI surface may write without that
 *    confirmation.
 *  - `assertClinicianConfirmed` is a defensive runtime guard for code paths
 *    that receive already-parsed input (e.g. internal helpers).
 */

export const AI_DRAFT_STATUS = "draft" as const;
export const AI_FINALIZED_STATUS = "finalized" as const;

export const CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE =
  "A clinician must explicitly confirm AI-generated content before it can be finalized.";

export const AI_FINALIZED_RECORD_IMMUTABLE_MESSAGE =
  "AI output cannot modify a finalized clinical record. Add an addendum or replacement through the clinician workflow instead.";

/** Optional or required confirmation envelope carrying a bound confirmationId token. */
export const clinicianConfirmationEnvelopeInput = z.object({
  confirmationId: z.string().uuid(),
  expectedRevision: z.number().int().min(0).optional(),
});

export type ClinicianConfirmationInput =
  | true
  | z.infer<typeof clinicianConfirmationEnvelopeInput>;

/** Required on any mutation that finalizes AI-derived content. */
export const clinicianConfirmationInput = z.union(
  [z.literal(true), clinicianConfirmationEnvelopeInput],
  {
    errorMap: () => ({ message: CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE }),
  },
);

/** Optional confirmation used where the default outcome is a draft. */
export const optionalClinicianConfirmationInput = z
  .union([z.boolean(), clinicianConfirmationEnvelopeInput])
  .optional();

export class AiDraftSafetyError extends Error {
  constructor(
    readonly code: "BAD_REQUEST" | "PRECONDITION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "AiDraftSafetyError";
  }
}

export function isClinicianConfirmed(
  confirmed: unknown,
): confirmed is ClinicianConfirmationInput {
  if (confirmed === true) return true;
  if (
    typeof confirmed === "object" &&
    confirmed !== null &&
    "confirmationId" in confirmed &&
    typeof (confirmed as { confirmationId: unknown }).confirmationId === "string" &&
    (confirmed as { confirmationId: string }).confirmationId.trim().length > 0
  ) {
    return true;
  }
  return false;
}

export function assertClinicianConfirmed(
  confirmed: unknown,
): asserts confirmed is ClinicianConfirmationInput {
  if (!isClinicianConfirmed(confirmed)) {
    throw new AiDraftSafetyError(
      "BAD_REQUEST",
      CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE,
    );
  }
}

/**
 * Resolve the persisted status for AI-derived content. Anything short of an
 * explicit `true` or valid confirmation envelope stays a draft, regardless of what
 * the caller asked for.
 */
export function resolveAiRecordStatus(input: {
  requestedStatus?: typeof AI_DRAFT_STATUS | typeof AI_FINALIZED_STATUS;
  clinicianConfirmed?: unknown;
}): typeof AI_DRAFT_STATUS | typeof AI_FINALIZED_STATUS {
  if (input.requestedStatus !== AI_FINALIZED_STATUS) return AI_DRAFT_STATUS;
  return isClinicianConfirmed(input.clinicianConfirmed)
    ? AI_FINALIZED_STATUS
    : AI_DRAFT_STATUS;
}

/**
 * AI surfaces may append to an open draft only. A finalized note is immutable
 * from the AI side; the clinician-owned addendum/replacement flow is the sole
 * path to change it.
 */
export function assertAiMayWriteToSoapNote(note: {
  status: string;
}): void {
  if (note.status !== AI_DRAFT_STATUS) {
    throw new AiDraftSafetyError(
      "PRECONDITION_FAILED",
      AI_FINALIZED_RECORD_IMMUTABLE_MESSAGE,
    );
  }
}

// ---------------------------------------------------------------------------
// Human-in-the-loop Audit Trail & Evidence Hash
// ---------------------------------------------------------------------------

export interface AiConfirmationAuditRecord {
  actorId: string;
  actorName: string;
  confirmedAt: Date;
  entityType: "soap_note" | "discharge_report" | "imaging_analysis" | "treatment_plan" | "prescription";
  entityId: string;
  originalDraftHash: string;
  confirmedContentHash: string;
  wasEditedByClinician: boolean;
  ipAddress?: string;
}

export function generateContentHash(content: string | Record<string, unknown>): string {
  const serialized = typeof content === "string" ? content.trim() : JSON.stringify(content);
  return createHash("sha256").update(serialized).digest("hex");
}

export function buildAiConfirmationAuditTrail(params: {
  actorId: string;
  actorName: string;
  entityType: AiConfirmationAuditRecord["entityType"];
  entityId: string;
  originalAiDraft: string | Record<string, unknown>;
  finalClinicianContent: string | Record<string, unknown>;
  ipAddress?: string;
}): AiConfirmationAuditRecord {
  const originalDraftHash = generateContentHash(params.originalAiDraft);
  const confirmedContentHash = generateContentHash(params.finalClinicianContent);
  return {
    actorId: params.actorId,
    actorName: params.actorName,
    confirmedAt: new Date(),
    entityType: params.entityType,
    entityId: params.entityId,
    originalDraftHash,
    confirmedContentHash,
    wasEditedByClinician: originalDraftHash !== confirmedContentHash,
    ipAddress: params.ipAddress,
  };
}

// ---------------------------------------------------------------------------
// Partial Section Approvals (e.g. S & O confirmed, A & P left as draft)
// ---------------------------------------------------------------------------

export const soapSectionApprovalSchema = z.object({
  subjective: z.boolean().default(false),
  objective: z.boolean().default(false),
  assessment: z.boolean().default(false),
  plan: z.boolean().default(false),
});

export type SoapSectionApprovals = z.infer<typeof soapSectionApprovalSchema>;

export function resolveSoapSectionalStatus(approvals: SoapSectionApprovals): {
  isFullyFinalized: boolean;
  isPartiallyApproved: boolean;
  finalizedSections: Array<keyof SoapSectionApprovals>;
  draftSections: Array<keyof SoapSectionApprovals>;
} {
  const sectionKeys: Array<keyof SoapSectionApprovals> = ["subjective", "objective", "assessment", "plan"];
  const finalizedSections = sectionKeys.filter((s) => approvals[s]);
  const draftSections = sectionKeys.filter((s) => !approvals[s]);
  return {
    isFullyFinalized: draftSections.length === 0,
    isPartiallyApproved: finalizedSections.length > 0 && draftSections.length > 0,
    finalizedSections,
    draftSections,
  };
}

