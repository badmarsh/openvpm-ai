import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { patients } from "@openpims/db";
import type { Database } from "@openpims/db/client";

/**
 * Confirmation-protocol enforcement (clinical AI finalization).
 *
 * Standard browser/API finalization of AI-derived clinical content requires a
 * stored, one-time, actor/practice/entity/revision/content-bound confirmation
 * envelope issued by the matching `prepareConfirmation` mutation. A bare
 * `clinicianConfirmed: true` boolean is NOT accepted on these paths: it
 * carries no nonce, no expiry, and no payload binding, so it cannot provide
 * replay protection.
 *
 * The single documented exception is the external AI-scribe hook
 * (`ai.createSoapFromAI`, create-only), which records a direct confirmation
 * distinctly; whole-request replay there is refused by the SOAP lifecycle
 * (existing draft/finalized note for the encounter yields CONFLICT).
 * See docs/confirmation-protocol.md (Option 2 transitional path).
 *
 * Server error messages stay in English per Skill §2; all user-facing
 * localization happens on the client via useI18n().
 */
export const CONFIRMATION_ENVELOPE_REQUIRED_MESSAGE =
  "A pre-issued confirmation token is required. Review the content and call prepareConfirmation first, then finalize with the returned confirmationId.";

export const EXPECTED_REVISION_REQUIRED_MESSAGE =
  "expectedRevision is required to finalize or update this record. Reload the record and retry with the current revision.";

/**
 * Requires a valid one-time confirmation envelope reference.
 * Rejects missing values AND bare `true` booleans with PRECONDITION_FAILED.
 */
export function requireConfirmationEnvelopeId(
  clinicianConfirmed: unknown,
): string {
  if (
    typeof clinicianConfirmed === "object" &&
    clinicianConfirmed !== null &&
    "confirmationId" in clinicianConfirmed &&
    typeof (clinicianConfirmed as { confirmationId: unknown }).confirmationId ===
      "string" &&
    (clinicianConfirmed as { confirmationId: string }).confirmationId.trim()
      .length > 0
  ) {
    return (clinicianConfirmed as { confirmationId: string }).confirmationId;
  }
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: CONFIRMATION_ENVELOPE_REQUIRED_MESSAGE,
  });
}

/**
 * Requires an explicit optimistic-concurrency token for updates and
 * finalizations of existing clinical/regulated records.
 *
 * Absent, non-integer, or negative revisions fail with PRECONDITION_FAILED
 * (the typed tRPC equivalent of PRECONDITION_REQUIRED — tRPC has no such
 * code). Callers must NEVER fall back to the currently stored revision:
 * `input.expectedRevision ?? existing.revision` silently disables the
 * concurrency check it claims to perform.
 */
export function requireExpectedRevision(
  expectedRevision: unknown,
): number {
  if (
    typeof expectedRevision === "number" &&
    Number.isInteger(expectedRevision) &&
    expectedRevision >= 0
  ) {
    return expectedRevision;
  }
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: EXPECTED_REVISION_REQUIRED_MESSAGE,
  });
}

/**
 * Sympathy-flow safety gate (Skill §3 — Clinical & Safety Gates):
 * hard-blocks automated outreach (marketing posts, owner SMS, recall /
 * post-op check-ins) for a deceased / euthanized patient before any work is
 * performed. Single shared implementation used by the marketing and
 * discharge extension routers. When no patient is resolved the gate is a
 * no-op so free-form manual entries (no linked record) remain usable.
 *
 * Server error messages stay in English per Skill §2; all user-facing
 * localization happens on the client via useI18n().
 */
export async function assertPatientNotDeceased(
  db: Database,
  patientId: string | undefined,
): Promise<void> {
  if (!patientId) return;
  const [p] = await db
    .select({ status: patients.status })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (p?.status === "deceased") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Sympathy Gate: Blocked for deceased patient.",
    });
  }
}
