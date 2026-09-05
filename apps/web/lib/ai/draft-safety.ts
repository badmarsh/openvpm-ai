import { z } from "zod";

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

/** Required on any mutation that finalizes AI-derived content. */
export const clinicianConfirmationInput = z.literal(true, {
  errorMap: () => ({ message: CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE }),
});

/** Optional confirmation used where the default outcome is a draft. */
export const optionalClinicianConfirmationInput = z.boolean().optional();

export class AiDraftSafetyError extends Error {
  constructor(
    readonly code: "BAD_REQUEST" | "PRECONDITION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "AiDraftSafetyError";
  }
}

export function assertClinicianConfirmed(
  confirmed: unknown,
): asserts confirmed is true {
  if (confirmed !== true) {
    throw new AiDraftSafetyError(
      "BAD_REQUEST",
      CLINICIAN_CONFIRMATION_REQUIRED_MESSAGE,
    );
  }
}

/**
 * Resolve the persisted status for AI-derived content. Anything short of an
 * explicit `true` confirmation stays a draft, regardless of what the caller
 * asked for.
 */
export function resolveAiRecordStatus(input: {
  requestedStatus?: typeof AI_DRAFT_STATUS | typeof AI_FINALIZED_STATUS;
  clinicianConfirmed?: boolean;
}): typeof AI_DRAFT_STATUS | typeof AI_FINALIZED_STATUS {
  if (input.requestedStatus !== AI_FINALIZED_STATUS) return AI_DRAFT_STATUS;
  return input.clinicianConfirmed === true
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
